from pydantic import BaseModel, Field, validator
from datetime import datetime, date, time
from typing import Optional, List
from enum import Enum
import uuid

class EstadoCita(str, Enum):
    PROGRAMADA = "Programada"
    CONFIRMADA = "Confirmada"
    ASISTIO = "Asistió"
    NO_ASISTIO = "No asistió"
    CANCELADA = "Cancelada"
    REAGENDADA = "Reagendada"

class AgendaItem(BaseModel):
    """Modelo para items de agenda sincronizados con Google Sheets."""
    
    # Campos obligatorios de la hoja
    registro: Optional[str] = None
    cit_mod: Optional[datetime] = None  # CitMod - datetime
    fecha_alta: Optional[datetime] = None  # FechaAlta - datetime
    num_pac: Optional[str] = None  # NumPac
    apellidos: Optional[str] = None
    nombre: Optional[str] = None
    tel_movil: Optional[str] = None
    fecha: Optional[date] = None  # Fecha de la cita
    hora: Optional[time] = None   # Hora de la cita
    estado_cita: Optional[str] = None  # EstadoCita
    tratamiento: Optional[str] = None
    odontologo: Optional[str] = None
    notas: Optional[str] = None
    duracion: Optional[str] = None
    
    # Campos internos para el sistema
    id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    synced_at: Optional[datetime] = None
    
    @validator('cit_mod', 'fecha_alta', pre=True)
    def parse_datetime_fields(cls, v):
        """Parse datetime fields from various string formats."""
        if v is None or v == '':
            return None
        if isinstance(v, str):
            try:
                # Formato: 2024-09-26 12:32:00
                return datetime.strptime(v, '%Y-%m-%d %H:%M:%S')
            except ValueError:
                try:
                    # Formato alternativo sin segundos
                    return datetime.strptime(v, '%Y-%m-%d %H:%M')
                except ValueError:
                    return None
        return v
    
    @validator('fecha', pre=True)
    def parse_date_field(cls, v):
        """Parse date field from string format."""
        if v is None or v == '':
            return None
        if isinstance(v, str):
            try:
                # Formato: 2025-01-01
                return datetime.strptime(v, '%Y-%m-%d').date()
            except ValueError:
                try:
                    # Formato alternativo
                    return datetime.strptime(v, '%d/%m/%Y').date()
                except ValueError:
                    return None
        return v
    
    @validator('hora', pre=True)
    def parse_time_field(cls, v):
        """Parse time field from string format."""
        if v is None or v == '':
            return None
        if isinstance(v, str):
            try:
                # Formato: 10:00
                return datetime.strptime(v, '%H:%M').time()
            except ValueError:
                try:
                    # Formato alternativo con segundos
                    return datetime.strptime(v, '%H:%M:%S').time()
                except ValueError:
                    return None
        return v
    
    @validator('tel_movil', pre=True)
    def clean_phone_number(cls, v):
        """Clean and format phone number."""
        if v is None or v == '':
            return None
        # Remove common phone number formatting
        cleaned = str(v).replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
        return cleaned if cleaned else None
    
    @validator('duracion', 'registro', 'num_pac', 'apellidos', 'nombre', 'tratamiento', 'odontologo', 'notas', pre=True)
    def convert_to_string(cls, v):
        """Convert numeric and other types to string."""
        if v is None or v == '':
            return None
        return str(v) if v is not None else None
    
    def to_sheets_row(self) -> List[str]:
        """Convert to list format for Google Sheets row."""
        return [
            str(self.registro) if self.registro else '',
            self.cit_mod.strftime('%Y-%m-%d %H:%M:%S') if self.cit_mod else '',
            self.fecha_alta.strftime('%Y-%m-%d %H:%M:%S') if self.fecha_alta else '',
            str(self.num_pac) if self.num_pac else '',
            str(self.apellidos) if self.apellidos else '',
            str(self.nombre) if self.nombre else '',
            str(self.tel_movil) if self.tel_movil else '',
            self.fecha.strftime('%Y-%m-%d') if self.fecha else '',
            self.hora.strftime('%H:%M') if self.hora else '',
            str(self.estado_cita) if self.estado_cita else '',
            str(self.tratamiento) if self.tratamiento else '',
            str(self.odontologo) if self.odontologo else '',
            str(self.notas) if self.notas else '',
            str(self.duracion) if self.duracion else ''
        ]
    
    @classmethod
    def from_sheets_row(cls, row_data: dict):
        """Create AgendaItem from Google Sheets row data."""
        # Map Google Sheets column names to model fields
        field_mapping = {
            'Registro': 'registro',
            'CitMod': 'cit_mod',
            'FechaAlta': 'fecha_alta',
            'NumPac': 'num_pac',
            'Apellidos': 'apellidos',
            'Nombre': 'nombre',
            'TelMovil': 'tel_movil',
            'Fecha': 'fecha',
            'Hora': 'hora',
            'EstadoCita': 'estado_cita',
            'Tratamiento': 'tratamiento',
            'Odontologo': 'odontologo',
            'Notas': 'notas',
            'Duracion': 'duracion'
        }
        
        mapped_data = {}
        for sheets_key, model_field in field_mapping.items():
            if sheets_key in row_data:
                mapped_data[model_field] = row_data[sheets_key]
        
        mapped_data['synced_at'] = datetime.utcnow()
        return cls(**mapped_data)
    
    class Config:
        json_encoders = {
            datetime: lambda dt: dt.isoformat() if dt else None,
            date: lambda d: d.isoformat() if d else None,
            time: lambda t: t.isoformat() if t else None
        }

class AgendaResponse(BaseModel):
    """Response model for agenda operations."""
    items: List[AgendaItem]
    total_count: int
    last_sync_time: Optional[datetime]
    sync_status: str = "success"
    message: Optional[str] = None

class SyncStatus(BaseModel):
    """Model for synchronization status."""
    last_sync_time: Optional[datetime]
    sync_in_progress: bool = False
    scheduler_running: bool = False
    next_sync_time: Optional[datetime] = None
    total_items: int = 0
    successful_syncs: int = 0
    failed_syncs: int = 0
    last_error: Optional[str] = None