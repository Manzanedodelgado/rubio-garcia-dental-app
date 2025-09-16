import gspread
import os
import logging
from typing import List, Dict, Optional
from datetime import datetime, date, time
from google.oauth2.service_account import Credentials
import json
from functools import wraps
import time as time_module
import random

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def retry_with_backoff(max_retries: int = 3, base_delay: float = 1.0, 
                      max_delay: float = 60.0, exponential_factor: float = 2.0):
    """Decorator that implements exponential backoff retry logic."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_retries:
                        logger.error(f"Max retries exceeded for {func.__name__}: {e}")
                        raise
                    
                    # Calculate delay with exponential backoff and jitter
                    delay = min(base_delay * (exponential_factor ** attempt), max_delay)
                    jitter = random.uniform(0.1, 0.9) * delay
                    total_delay = delay + jitter
                    
                    logger.warning(f"Attempt {attempt + 1} failed for {func.__name__}: {e}. "
                                  f"Retrying in {total_delay:.2f} seconds...")
                    time_module.sleep(total_delay)
            
            return None
        return wrapper
    return decorator

class GoogleSheetsError(Exception):
    """Base exception for Google Sheets integration errors."""
    def __init__(self, message: str, error_code: str = None, details: dict = None):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)

class GoogleSheetsService:
    """Service for managing Google Sheets integration for agenda synchronization."""
    
    def __init__(self, credentials_path: str = None, spreadsheet_id: str = None):
        """Initialize Google Sheets service."""
        self.credentials_path = credentials_path or os.getenv('GOOGLE_CREDENTIALS_PATH')
        self.spreadsheet_id = spreadsheet_id or os.getenv('GOOGLE_SPREADSHEET_ID')
        self.scopes = [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'
        ]
        self.client = None
        self.worksheet = None
        self.last_sync_time = None
        self.sync_stats = {
            'successful_syncs': 0,
            'failed_syncs': 0,
            'last_error': None
        }
        
        # Initialize client
        self._authenticate()
        
    def _authenticate(self):
        """Authenticate with Google Sheets API using service account."""
        try:
            if not self.credentials_path or not os.path.exists(self.credentials_path):
                raise GoogleSheetsError(f"Credentials file not found: {self.credentials_path}")
            
            # Load credentials
            credentials = Credentials.from_service_account_file(
                self.credentials_path, 
                scopes=self.scopes
            )
            
            # Create client
            self.client = gspread.authorize(credentials)
            logger.info("Successfully authenticated with Google Sheets API")
            
            # Get worksheet
            if self.spreadsheet_id:
                self._get_worksheet()
            
        except Exception as e:
            logger.error(f"Failed to authenticate with Google Sheets API: {e}")
            raise GoogleSheetsError(f"Authentication failed: {e}")
    
    def _get_worksheet(self, worksheet_name: str = None):
        """Get the worksheet (first sheet by default)."""
        try:
            spreadsheet = self.client.open_by_key(self.spreadsheet_id)
            if worksheet_name:
                self.worksheet = spreadsheet.worksheet(worksheet_name)
            else:
                self.worksheet = spreadsheet.sheet1
            
            logger.info(f"Connected to worksheet: {self.worksheet.title}")
            
        except gspread.SpreadsheetNotFound:
            logger.error(f"Spreadsheet not found: {self.spreadsheet_id}")
            raise GoogleSheetsError(f"Spreadsheet not found: {self.spreadsheet_id}")
        except gspread.WorksheetNotFound:
            logger.error(f"Worksheet not found: {worksheet_name}")
            raise GoogleSheetsError(f"Worksheet not found: {worksheet_name}")
        except Exception as e:
            logger.error(f"Failed to get worksheet: {e}")
            raise GoogleSheetsError(f"Failed to get worksheet: {e}")
    
    async def get_all_appointments(self) -> List[Dict[str, Any]]:
        """Get all appointments from the Google Sheet"""
        try:
            if not self.client:
                # Return mock data for demo
                return self._get_mock_appointments()
            
            # In production, this would fetch from actual Google Sheets
            worksheet = self.client.open_by_key(self.spreadsheet_id).worksheet(self.sheet_name)
            records = worksheet.get_all_records()
            
            appointments = []
            for record in records:
                if record.get('Fecha'):  # Only include records with dates
                    appointments.append(self._format_appointment_data(record))
            
            return appointments
        except Exception as e:
            logger.error(f"Error fetching appointments from Google Sheets: {str(e)}")
            return []
    
    async def get_appointments_by_date(self, target_date: str) -> List[Dict[str, Any]]:
        """Get appointments for a specific date"""
        all_appointments = await self.get_all_appointments()
        return [apt for apt in all_appointments if apt.get('fecha') == target_date]
    
    async def create_appointment(self, appointment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new appointment in the Google Sheet"""
        try:
            if not self.client:
                # Mock creation for demo
                appointment_data['registro'] = len(self._get_mock_appointments()) + 1
                appointment_data['fecha_alta'] = datetime.now().isoformat()
                return appointment_data
            
            worksheet = self.client.open_by_key(self.spreadsheet_id).worksheet(self.sheet_name)
            
            # Prepare row data according to column order
            row_data = []
            for col in self.columns:
                value = appointment_data.get(col.lower(), '')
                if col in ['Fecha', 'FechaAlta'] and isinstance(value, (date, datetime)):
                    value = value.strftime('%Y-%m-%d')
                elif col == 'Hora' and isinstance(value, time):
                    value = value.strftime('%H:%M')
                row_data.append(str(value))
            
            worksheet.append_row(row_data)
            
            # Get the new record ID
            all_records = worksheet.get_all_records()
            new_record = all_records[-1] if all_records else {}
            
            return self._format_appointment_data(new_record)
        except Exception as e:
            logger.error(f"Error creating appointment in Google Sheets: {str(e)}")
            raise
    
    async def update_appointment(self, appointment_id: str, appointment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing appointment in the Google Sheet"""
        try:
            if not self.client:
                # Mock update for demo
                return appointment_data
            
            worksheet = self.client.open_by_key(self.spreadsheet_id).worksheet(self.sheet_name)
            
            # Find the row to update
            registro_col = self.columns.index('Registro') + 1
            cell = worksheet.find(appointment_id, in_column=registro_col)
            
            if not cell:
                raise ValueError(f"Appointment with ID {appointment_id} not found")
            
            row_num = cell.row
            
            # Update the row data
            for i, col in enumerate(self.columns):
                if col.lower() in appointment_data:
                    value = appointment_data[col.lower()]
                    if col in ['Fecha', 'FechaAlta'] and isinstance(value, (date, datetime)):
                        value = value.strftime('%Y-%m-%d')
                    elif col == 'Hora' and isinstance(value, time):
                        value = value.strftime('%H:%M')
                    worksheet.update_cell(row_num, i + 1, str(value))
            
            # Return updated data
            updated_row = worksheet.row_values(row_num)
            updated_record = dict(zip(self.columns, updated_row))
            
            return self._format_appointment_data(updated_record)
        except Exception as e:
            logger.error(f"Error updating appointment in Google Sheets: {str(e)}")
            raise
    
    async def delete_appointment(self, appointment_id: str) -> bool:
        """Delete an appointment from the Google Sheet (soft delete by updating status)"""
        try:
            await self.update_appointment(appointment_id, {'estadocita': 'CANCELADA'})
            return True
        except Exception as e:
            logger.error(f"Error deleting appointment in Google Sheets: {str(e)}")
            return False
    
    async def sync_appointments(self) -> Dict[str, Any]:
        """Synchronize appointments - this would be called every 5 minutes"""
        try:
            appointments = await self.get_all_appointments()
            sync_result = {
                'timestamp': datetime.now().isoformat(),
                'total_appointments': len(appointments),
                'status': 'success',
                'message': f'Successfully synchronized {len(appointments)} appointments'
            }
            logger.info(f"Sync completed: {sync_result['message']}")
            return sync_result
        except Exception as e:
            logger.error(f"Sync failed: {str(e)}")
            return {
                'timestamp': datetime.now().isoformat(),
                'status': 'error',
                'message': f'Sync failed: {str(e)}'
            }
    
    def _format_appointment_data(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """Format appointment data from Google Sheets format to API format"""
        formatted = {}
        for i, col in enumerate(self.columns):
            key = col.lower()
            value = record.get(col, '')
            
            # Handle date formatting
            if col in ['Fecha', 'FechaAlta'] and value:
                try:
                    if isinstance(value, str):
                        formatted[key] = value
                    else:
                        formatted[key] = str(value)
                except:
                    formatted[key] = str(value)
            # Handle time formatting
            elif col == 'Hora' and value:
                try:
                    if isinstance(value, str):
                        formatted[key] = value
                    else:
                        formatted[key] = str(value)
                except:
                    formatted[key] = str(value)
            else:
                formatted[key] = str(value) if value else ''
        
        return formatted
    
    def _get_mock_appointments(self) -> List[Dict[str, Any]]:
        """Return mock appointment data for demo purposes"""
        return [
            {
                'registro': 1,
                'citmod': 'CM001',
                'fechaalta': '2024-01-15',
                'numpac': 'PAC0001',
                'apellidos': 'García López',
                'nombre': 'María',
                'telmovil': '666123456',
                'fecha': '2024-12-20',
                'hora': '09:00',
                'estadocita': 'PROGRAMADA',
                'tratamiento': 'Limpieza dental',
                'odontologo': 'Dr. Rubio García',
                'notas': 'Primera consulta',
                'duracion': '30'
            },
            {
                'registro': 2,
                'citmod': 'CM002',
                'fechaalta': '2024-01-16',
                'numpac': 'PAC0002',
                'apellidos': 'Martínez Ruiz',
                'nombre': 'Carlos',
                'telmovil': '666789012',
                'fecha': '2024-12-20',
                'hora': '10:30',
                'estadocita': 'CONFIRMADA',
                'tratamiento': 'Empaste',
                'odontologo': 'Dr. Rubio García',
                'notas': 'Caries en molar derecho',
                'duracion': '45'
            },
            {
                'registro': 3,
                'citmod': 'CM003',
                'fechaalta': '2024-01-17',
                'numpac': 'PAC0003',
                'apellidos': 'Fernández Silva',
                'nombre': 'Ana',
                'telmovil': '666345678',
                'fecha': '2024-12-21',
                'hora': '16:00',
                'estadocita': 'PROGRAMADA',
                'tratamiento': 'Ortodoncia - Revisión',
                'odontologo': 'Dr. Rubio García',
                'notas': 'Control mensual de brackets',
                'duracion': '20'
            }
        ]

# Global service instance
google_sheets_service = GoogleSheetsService()