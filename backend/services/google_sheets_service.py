import gspread
import os
import logging
from typing import List, Dict, Optional, Any
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
    
    @retry_with_backoff(max_retries=3)
    def read_agenda_data(self):
        """Read all agenda data from Google Sheets."""
        from models.agenda import AgendaItem
        
        try:
            if not self.worksheet:
                self._get_worksheet()
            
            # Get all records as dictionaries
            records = self.worksheet.get_all_records()
            logger.info(f"Retrieved {len(records)} records from Google Sheets")
            
            # Convert to AgendaItem objects
            agenda_items = []
            for i, record in enumerate(records):
                try:
                    # Skip empty rows
                    if not any(str(value).strip() for value in record.values()):
                        continue
                    
                    agenda_item = AgendaItem.from_sheets_row(record)
                    agenda_items.append(agenda_item)
                    
                except Exception as e:
                    logger.warning(f"Failed to parse row {i + 2}: {record}. Error: {e}")
                    continue
            
            logger.info(f"Successfully parsed {len(agenda_items)} agenda items")
            self.last_sync_time = datetime.utcnow()
            self.sync_stats['successful_syncs'] += 1
            
            return agenda_items
        
        except Exception as e:
            logger.error(f"Failed to read agenda data: {e}")
            self.sync_stats['failed_syncs'] += 1
            self.sync_stats['last_error'] = str(e)
            raise GoogleSheetsError(f"Failed to read agenda data: {e}")
    
    async def get_all_appointments(self):
        """Alias for read_agenda_data for backward compatibility."""
        return self.read_agenda_data()
    
    @retry_with_backoff(max_retries=3)
    def write_agenda_data(self, agenda_items, clear_existing: bool = False):
        """Write agenda data to Google Sheets."""
        try:
            if not self.worksheet:
                self._get_worksheet()
            
            if clear_existing:
                self.worksheet.clear()
            
            if not agenda_items:
                logger.info("No agenda items to write")
                return True
            
            # Prepare headers (from the expected columns in the sheet)
            headers = [
                'Registro', 'CitMod', 'FechaAlta', 'NumPac', 'Apellidos', 'Nombre',
                'TelMovil', 'Fecha', 'Hora', 'EstadoCita', 'Tratamiento', 
                'Odontologo', 'Notas', 'Duracion'
            ]
            
            # Prepare data rows
            rows = [headers]
            for item in agenda_items:
                rows.append(item.to_sheets_row())
            
            # Update the worksheet
            self.worksheet.update('A1', rows)
            
            logger.info(f"Successfully wrote {len(agenda_items)} agenda items to Google Sheets")
            self.last_sync_time = datetime.utcnow()
            self.sync_stats['successful_syncs'] += 1
            
            return True
        
        except Exception as e:
            logger.error(f"Failed to write agenda data: {e}")
            self.sync_stats['failed_syncs'] += 1
            self.sync_stats['last_error'] = str(e)
            raise GoogleSheetsError(f"Failed to write agenda data: {e}")
    
    async def get_appointments_by_date(self, target_date: str):
        """Get appointments for a specific date"""
        all_appointments = await self.get_all_appointments()
        return [apt for apt in all_appointments if apt.get('fecha') == target_date]
    
    async def create_appointment(self, appointment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new appointment in the Google Sheet"""
        from models.agenda import AgendaItem
        
        try:
            # Convert appointment_data to AgendaItem
            agenda_item = AgendaItem(**appointment_data)
            
            # Use the append method
            success = self.append_agenda_item(agenda_item)
            if success:
                return agenda_item.dict()
            else:
                raise Exception("Failed to create appointment")
                
        except Exception as e:
            logger.error(f"Error creating appointment in Google Sheets: {str(e)}")
            raise
    
    @retry_with_backoff(max_retries=3)
    def append_agenda_item(self, agenda_item):
        """Append a single agenda item to the worksheet."""
        try:
            if not self.worksheet:
                self._get_worksheet()
            
            # Prepare row data
            row_data = agenda_item.to_sheets_row()
            
            # Append to the worksheet
            self.worksheet.append_row(row_data)
            
            logger.info(f"Successfully appended agenda item: {agenda_item.nombre} {agenda_item.apellidos}")
            self.sync_stats['successful_syncs'] += 1
            
            return True
        
        except Exception as e:
            logger.error(f"Failed to append agenda item: {e}")
            self.sync_stats['failed_syncs'] += 1
            self.sync_stats['last_error'] = str(e)
            raise GoogleSheetsError(f"Failed to append agenda item: {e}")
    
    @retry_with_backoff(max_retries=3)
    def update_agenda_item(self, row_index: int, agenda_item):
        """Update a specific agenda item by row index."""
        try:
            if not self.worksheet:
                self._get_worksheet()
            
            # Prepare row data
            row_data = agenda_item.to_sheets_row()
            
            # Calculate range (row_index + 2 because we have headers and 1-based indexing)
            start_col = 'A'
            end_col = chr(65 + len(row_data) - 1)  # Convert to letter (A=65)
            range_name = f'{start_col}{row_index + 2}:{end_col}{row_index + 2}'
            
            # Update the specific row
            self.worksheet.update(range_name, [row_data])
            
            logger.info(f"Successfully updated agenda item at row {row_index + 2}")
            self.sync_stats['successful_syncs'] += 1
            
            return True
        
        except Exception as e:
            logger.error(f"Failed to update agenda item: {e}")
            self.sync_stats['failed_syncs'] += 1
            self.sync_stats['last_error'] = str(e)
            raise GoogleSheetsError(f"Failed to update agenda item: {e}")

    async def update_appointment(self, appointment_id: str, appointment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing appointment in the Google Sheet"""
        from models.agenda import AgendaItem
        
        try:
            if not self.worksheet:
                self._get_worksheet()
            
            # Find the row to update by searching for the registro
            cells = self.worksheet.findall(appointment_id)
            if not cells:
                raise ValueError(f"Appointment with ID {appointment_id} not found")
            
            # Get the first match (assuming it's in the Registro column)
            cell = cells[0]
            row_num = cell.row
            
            # Create AgendaItem from appointment_data
            agenda_item = AgendaItem(**appointment_data)
            
            # Update using our method (row_num - 2 because our method adds 2)
            success = self.update_agenda_item(row_num - 2, agenda_item)
            
            if success:
                return agenda_item.dict()
            else:
                raise Exception("Failed to update appointment")
                
        except Exception as e:
            logger.error(f"Error updating appointment in Google Sheets: {str(e)}")
            raise
    
    async def delete_appointment(self, appointment_id: str) -> bool:
        """Delete an appointment from the Google Sheet (soft delete by updating status)"""
        try:
            await self.update_appointment(appointment_id, {'estado_cita': 'CANCELADA'})
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
    
    def get_sync_status(self):
        """Get current synchronization status."""
        from models.agenda import SyncStatus
        
        try:
            # Try to read one record to test connectivity
            if self.worksheet:
                test_records = self.worksheet.get_all_records(head=1)
                total_items = len(test_records)
            else:
                total_items = 0
                
        except Exception as e:
            logger.warning(f"Could not get item count: {e}")
            total_items = 0
        
        return SyncStatus(
            last_sync_time=self.last_sync_time,
            sync_in_progress=False,
            scheduler_running=False,
            total_items=total_items,
            successful_syncs=self.sync_stats['successful_syncs'],
            failed_syncs=self.sync_stats['failed_syncs'],
            last_error=self.sync_stats['last_error']
        )
    
    def test_connection(self) -> Dict[str, any]:
        """Test the connection to Google Sheets."""
        try:
            if not self.worksheet:
                self._get_worksheet()
            
            # Try to read headers
            headers = self.worksheet.row_values(1)
            
            # Get worksheet info
            worksheet_info = {
                'title': self.worksheet.title,
                'row_count': self.worksheet.row_count,
                'col_count': self.worksheet.col_count,
                'headers': headers,
                'url': f"https://docs.google.com/spreadsheets/d/{self.spreadsheet_id}"
            }
            
            logger.info("Google Sheets connection test successful")
            return {
                'status': 'success',
                'message': 'Connection to Google Sheets successful',
                'worksheet_info': worksheet_info
            }
        
        except Exception as e:
            logger.error(f"Google Sheets connection test failed: {e}")
            return {
                'status': 'error',
                'message': f'Connection failed: {e}',
                'worksheet_info': None
            }

# Global instance
sheets_service = None

def get_sheets_service():
    """Get global Google Sheets service instance."""
    global sheets_service
    if sheets_service is None:
        sheets_service = GoogleSheetsService()
    return sheets_service

# For backward compatibility
google_sheets_service = get_sheets_service()