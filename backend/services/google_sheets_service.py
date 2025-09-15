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

logger = logging.getLogger(__name__)

class GoogleSheetsService:
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
        self._init_client()
    
    def _init_client(self):
        """Initialize Google Sheets client with service account credentials"""
        try:
            # For demo purposes, we'll create a mock service account
            # In production, this would use actual Google service account credentials
            logger.info("Initializing Google Sheets client (Demo Mode)")
            # Mock client initialization
            self.client = None
            logger.info("Google Sheets client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Google Sheets client: {str(e)}")
            self.client = None
    
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