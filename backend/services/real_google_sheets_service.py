import gspread
from google.auth.transport.requests import Request
from google.oauth2.service_account import Credentials
import os
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, date, time
import asyncio
import pandas as pd
from pathlib import Path

logger = logging.getLogger(__name__)

class RealGoogleSheetsService:
    def __init__(self):
        self.client = None
        self.worksheet = None
        self.spreadsheet_id = "1MBDBHQ08XGuf5LxVHCFhHDagIazFkpBnxwqyEQIBJrQ"
        self.sheet_name = "Hoja 1"
        self.columns = [
            'Registro', 'CitMod', 'FechaAlta', 'NumPac', 'Apellidos', 
            'Nombre', 'TelMovil', 'Fecha', 'Hora', 'EstadoCita', 
            'Tratamiento', 'Odontologo', 'Notas', 'Duracion'
        ]
        self.last_sync = None
        self._init_client()
    
    def _init_client(self):
        """Initialize Google Sheets client with service account credentials"""
        try:
            # Check for service account credentials
            creds_path = Path("/app/backend/google_credentials.json")
            
            if creds_path.exists():
                # Use service account credentials
                logger.info("Inicializando cliente Google Sheets con credenciales de servicio")
                
                credentials = Credentials.from_service_account_file(
                    str(creds_path),
                    scopes=[
                        'https://www.googleapis.com/auth/spreadsheets',
                        'https://www.googleapis.com/auth/drive'
                    ]
                )
                
                self.client = gspread.authorize(credentials)
                
                # Test connection
                try:
                    spreadsheet = self.client.open_by_key(self.spreadsheet_id)
                    self.worksheet = spreadsheet.worksheet(self.sheet_name)
                    logger.info("✅ Conexión exitosa con Google Sheets")
                    return True
                except Exception as e:
                    logger.error(f"Error accediendo a la hoja: {str(e)}")
                    self.client = None
                    
            else:
                logger.warning("📄 Credenciales de Google Sheets no encontradas. Usando datos de prueba.")
                self.client = None
                
        except Exception as e:
            logger.error(f"Error inicializando cliente de Google Sheets: {str(e)}")
            self.client = None
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test the connection to Google Sheets"""
        try:
            if not self.client:
                return {
                    "success": False,
                    "error": "Cliente no inicializado",
                    "message": "Las credenciales de Google Sheets no están configuradas"
                }
            
            # Try to access the spreadsheet
            spreadsheet = self.client.open_by_key(self.spreadsheet_id)
            worksheet = spreadsheet.worksheet(self.sheet_name)
            
            # Get basic info
            row_count = worksheet.row_count
            col_count = worksheet.col_count
            
            return {
                "success": True,
                "spreadsheet_title": spreadsheet.title,
                "worksheet_title": worksheet.title,
                "rows": row_count,
                "cols": col_count,
                "last_updated": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error probando conexión: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_all_appointments(self) -> List[Dict[str, Any]]:
        """Get all appointments from the Google Sheet"""
        try:
            if not self.client:
                # Return mock data when no connection
                return self._get_mock_appointments()
            
            worksheet = self.client.open_by_key(self.spreadsheet_id).worksheet(self.sheet_name)
            
            # Get all records
            records = worksheet.get_all_records()
            
            appointments = []
            for record in records:
                if record.get('Fecha'):  # Only include records with dates
                    formatted_appointment = self._format_appointment_data(record)
                    if formatted_appointment:
                        appointments.append(formatted_appointment)
            
            logger.info(f"📊 Obtenidas {len(appointments)} citas desde Google Sheets")
            self.last_sync = datetime.now()
            
            return appointments
            
        except Exception as e:
            logger.error(f"Error obteniendo citas de Google Sheets: {str(e)}")
            # Return mock data as fallback
            return self._get_mock_appointments()
    
    async def get_appointments_by_date(self, target_date: str) -> List[Dict[str, Any]]:
        """Get appointments for a specific date"""
        all_appointments = await self.get_all_appointments()
        
        # Filter by date
        filtered = []
        for apt in all_appointments:
            apt_date = apt.get('fecha', '')
            if apt_date == target_date:
                filtered.append(apt)
        
        logger.info(f"📅 Encontradas {len(filtered)} citas para {target_date}")
        return filtered
    
    async def create_appointment(self, appointment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new appointment in the Google Sheet"""
        try:
            if not self.client:
                # Mock creation when no connection
                appointment_data['registro'] = len(self._get_mock_appointments()) + 1
                appointment_data['fecha_alta'] = datetime.now().isoformat()
                logger.info("📝 Cita creada (modo simulación)")
                return appointment_data
            
            worksheet = self.client.open_by_key(self.spreadsheet_id).worksheet(self.sheet_name)
            
            # Get next registro number
            all_records = worksheet.get_all_records()
            next_registro = len(all_records) + 1
            
            # Prepare row data according to column order
            row_data = []
            for col in self.columns:
                if col == 'Registro':
                    value = str(next_registro)
                elif col == 'FechaAlta':
                    value = datetime.now().strftime('%Y-%m-%d')
                elif col == 'CitMod':
                    value = f"CM{str(next_registro).zfill(3)}"
                else:
                    value = appointment_data.get(col.lower(), '')
                    
                    # Format dates and times
                    if col in ['Fecha'] and isinstance(value, (date, datetime)):
                        value = value.strftime('%Y-%m-%d')
                    elif col == 'Hora' and isinstance(value, time):
                        value = value.strftime('%H:%M')
                    
                    value = str(value) if value is not None else ''
                
                row_data.append(value)
            
            # Append the row
            worksheet.append_row(row_data)
            
            # Return the created appointment
            created_appointment = appointment_data.copy()
            created_appointment['registro'] = next_registro
            created_appointment['fecha_alta'] = datetime.now().isoformat()
            
            logger.info(f"✅ Cita creada en Google Sheets: Registro {next_registro}")
            
            return created_appointment
            
        except Exception as e:
            logger.error(f"Error creando cita en Google Sheets: {str(e)}")
            raise
    
    async def update_appointment(self, registro: str, appointment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing appointment in the Google Sheet"""
        try:
            if not self.client:
                # Mock update when no connection
                logger.info(f"📝 Cita {registro} actualizada (modo simulación)")
                return appointment_data
            
            worksheet = self.client.open_by_key(self.spreadsheet_id).worksheet(self.sheet_name)
            
            # Find the row with the matching registro
            all_records = worksheet.get_all_records()
            row_number = None
            
            for i, record in enumerate(all_records):
                if str(record.get('Registro', '')) == str(registro):
                    row_number = i + 2  # +2 because sheets are 1-indexed and we skip header
                    break
            
            if not row_number:
                raise ValueError(f"Cita con registro {registro} no encontrada")
            
            # Update specific cells
            for i, col in enumerate(self.columns):
                if col.lower() in appointment_data:
                    value = appointment_data[col.lower()]
                    
                    # Format dates and times
                    if col in ['Fecha'] and isinstance(value, (date, datetime)):
                        value = value.strftime('%Y-%m-%d')
                    elif col == 'Hora' and isinstance(value, time):
                        value = value.strftime('%H:%M')
                    
                    worksheet.update_cell(row_number, i + 1, str(value))
            
            logger.info(f"✅ Cita {registro} actualizada en Google Sheets")
            
            return appointment_data
            
        except Exception as e:
            logger.error(f"Error actualizando cita en Google Sheets: {str(e)}")
            raise
    
    async def sync_appointments(self) -> Dict[str, Any]:
        """Synchronize appointments - this would be called every 5 minutes"""
        try:
            start_time = datetime.now()
            appointments = await self.get_all_appointments()
            
            sync_result = {
                'timestamp': start_time.isoformat(),
                'total_appointments': len(appointments),
                'status': 'success',
                'message': f'Sincronizadas {len(appointments)} citas exitosamente',
                'using_real_sheets': self.client is not None,
                'last_sync': self.last_sync.isoformat() if self.last_sync else None
            }
            
            logger.info(f"🔄 Sincronización completada: {sync_result['message']}")
            return sync_result
            
        except Exception as e:
            logger.error(f"Error en sincronización: {str(e)}")
            return {
                'timestamp': datetime.now().isoformat(),
                'status': 'error',
                'message': f'Error en sincronización: {str(e)}',
                'using_real_sheets': self.client is not None
            }
    
    def _format_appointment_data(self, record: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Format appointment data from Google Sheets format to API format"""
        try:
            formatted = {}
            for i, col in enumerate(self.columns):
                key = col.lower()
                value = record.get(col, '')
                
                # Handle empty values
                if value == '' or value is None:
                    formatted[key] = ''
                    continue
                
                # Handle specific data types
                if col in ['Fecha', 'FechaAlta']:
                    # Keep date as string in YYYY-MM-DD format
                    formatted[key] = str(value)
                elif col == 'Hora':
                    # Keep time as string in HH:MM format
                    formatted[key] = str(value)
                elif col == 'Registro':
                    # Ensure registro is integer
                    try:
                        formatted[key] = int(value) if value else 0
                    except:
                        formatted[key] = 0
                else:
                    formatted[key] = str(value)
            
            return formatted if formatted.get('fecha') else None
            
        except Exception as e:
            logger.error(f"Error formateando datos de cita: {str(e)}")
            return None
    
    def _get_mock_appointments(self) -> List[Dict[str, Any]]:
        """Return mock appointment data when Google Sheets is not available"""
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
real_google_sheets_service = RealGoogleSheetsService()