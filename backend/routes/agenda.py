from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Dict, Any, Optional
from datetime import datetime, date
import logging

from models.agenda import AgendaItem, AgendaResponse, SyncStatus
from services.agenda_sync_service import get_sync_service
from services.google_sheets_service import get_sheets_service

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agenda", tags=["Agenda"])
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Simple token validation - you can expand this based on your auth system."""
    # For now, we'll just return a placeholder user
    return {"username": "authenticated_user"}

@router.get("/", response_model=AgendaResponse)
async def get_agenda(
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get agenda items, optionally filtered by date."""
    try:
        sync_service = get_sync_service()
        
        if date:
            # Get items for specific date
            agenda_items = sync_service.get_agenda_items_by_date(date)
        else:
            # Get all cached items
            agenda_items = sync_service.get_cached_agenda_items()
        
        return AgendaResponse(
            items=agenda_items,
            total_count=len(agenda_items),
            last_sync_time=sync_service.last_sync_time,
            sync_status="success",
            message=f"Retrieved {len(agenda_items)} agenda items"
        )
    
    except Exception as e:
        logger.error(f"Failed to get agenda: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get agenda: {e}")

@router.get("/patient/{patient_number}")
async def get_agenda_by_patient(
    patient_number: str,
    current_user: dict = Depends(get_current_user)
):
    """Get agenda items for a specific patient."""
    try:
        sync_service = get_sync_service()
        agenda_items = sync_service.get_agenda_items_by_patient(patient_number)
        
        return AgendaResponse(
            items=agenda_items,
            total_count=len(agenda_items),
            last_sync_time=sync_service.last_sync_time,
            sync_status="success",
            message=f"Retrieved {len(agenda_items)} agenda items for patient {patient_number}"
        )
    
    except Exception as e:
        logger.error(f"Failed to get agenda for patient {patient_number}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get agenda for patient: {e}")

@router.post("/", response_model=AgendaItem)
async def create_agenda_item(
    agenda_data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Create a new agenda item."""
    try:
        sync_service = get_sync_service()
        
        # Add creation timestamp
        agenda_data['created_at'] = datetime.utcnow()
        agenda_data['updated_at'] = datetime.utcnow()
        
        # Create the agenda item
        agenda_item = sync_service.add_agenda_item(agenda_data)
        
        logger.info(f"Created agenda item: {agenda_item.id}")
        return agenda_item
    
    except Exception as e:
        logger.error(f"Failed to create agenda item: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to create agenda item: {e}")

@router.put("/{item_id}", response_model=AgendaItem)
async def update_agenda_item(
    item_id: str,
    agenda_data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Update an existing agenda item."""
    try:
        sync_service = get_sync_service()
        
        # Add update timestamp
        agenda_data['updated_at'] = datetime.utcnow()
        
        # Update the agenda item
        agenda_item = sync_service.update_agenda_item(item_id, agenda_data)
        
        logger.info(f"Updated agenda item: {item_id}")
        return agenda_item
    
    except ValueError as e:
        logger.error(f"Agenda item not found: {item_id}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to update agenda item {item_id}: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to update agenda item: {e}")

@router.post("/sync")
async def trigger_sync(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Trigger immediate synchronization with Google Sheets."""
    try:
        sync_service = get_sync_service()
        
        # Add sync task to background
        background_tasks.add_task(sync_service.force_sync)
        
        return {
            "message": "Synchronization triggered successfully",
            "status": "pending"
        }
    
    except Exception as e:
        logger.error(f"Failed to trigger sync: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to trigger sync: {e}")

@router.get("/sync/status", response_model=SyncStatus)
async def get_sync_status(
    current_user: dict = Depends(get_current_user)
):
    """Get current synchronization status."""
    try:
        sync_service = get_sync_service()
        return sync_service.get_sync_status()
    
    except Exception as e:
        logger.error(f"Failed to get sync status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get sync status: {e}")

@router.get("/test-connection")
async def test_sheets_connection(
    current_user: dict = Depends(get_current_user)
):
    """Test connection to Google Sheets."""
    try:
        sheets_service = get_sheets_service()
        result = sheets_service.test_connection()
        
        if result['status'] == 'error':
            raise HTTPException(status_code=503, detail=result['message'])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to test connection: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to test connection: {e}")

@router.get("/stats")
async def get_agenda_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get agenda statistics."""
    try:
        sync_service = get_sync_service()
        agenda_items = sync_service.get_cached_agenda_items()
        
        # Calculate statistics
        total_items = len(agenda_items)
        today = date.today()
        
        today_items = [item for item in agenda_items if item.fecha == today]
        upcoming_items = [item for item in agenda_items if item.fecha and item.fecha > today]
        
        # Count by status
        status_counts = {}
        for item in agenda_items:
            status = item.estado_cita or 'Sin Estado'
            status_counts[status] = status_counts.get(status, 0) + 1
        
        # Count by doctor
        doctor_counts = {}
        for item in agenda_items:
            doctor = item.odontologo or 'Sin Asignar'
            doctor_counts[doctor] = doctor_counts.get(doctor, 0) + 1
        
        return {
            "total_appointments": total_items,
            "today_appointments": len(today_items),
            "upcoming_appointments": len(upcoming_items),
            "status_distribution": status_counts,
            "doctor_distribution": doctor_counts,
            "last_sync": sync_service.last_sync_time.isoformat() if sync_service.last_sync_time else None,
            "cache_updated_at": sync_service._cache_updated_at.isoformat() if sync_service._cache_updated_at else None
        }
    
    except Exception as e:
        logger.error(f"Failed to get agenda stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get agenda stats: {e}")

@router.get("/search")
async def search_agenda(
    q: str,
    current_user: dict = Depends(get_current_user)
):
    """Search agenda items by patient name, phone, or treatment."""
    try:
        sync_service = get_sync_service()
        agenda_items = sync_service.get_cached_agenda_items()
        
        # Perform case-insensitive search
        search_term = q.lower()
        filtered_items = []
        
        for item in agenda_items:
            # Search in various fields
            search_fields = [
                item.nombre or '',
                item.apellidos or '',
                item.tel_movil or '',
                item.tratamiento or '',
                item.notas or '',
                item.odontologo or ''
            ]
            
            # Check if search term is in any field
            if any(search_term in field.lower() for field in search_fields):
                filtered_items.append(item)
        
        return AgendaResponse(
            items=filtered_items,
            total_count=len(filtered_items),
            last_sync_time=sync_service.last_sync_time,
            sync_status="success",
            message=f"Found {len(filtered_items)} agenda items matching '{q}'"
        )
    
    except Exception as e:
        logger.error(f"Failed to search agenda: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to search agenda: {e}")

@router.get("/export")
async def export_agenda(
    format: str = "json",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Export agenda data in specified format."""
    try:
        sync_service = get_sync_service()
        agenda_items = sync_service.get_cached_agenda_items()
        
        # Filter by date range if provided
        if date_from or date_to:
            filtered_items = []
            for item in agenda_items:
                if not item.fecha:
                    continue
                
                item_date = item.fecha
                include_item = True
                
                if date_from:
                    from_date = datetime.strptime(date_from, '%Y-%m-%d').date()
                    if item_date < from_date:
                        include_item = False
                
                if date_to and include_item:
                    to_date = datetime.strptime(date_to, '%Y-%m-%d').date()
                    if item_date > to_date:
                        include_item = False
                
                if include_item:
                    filtered_items.append(item)
            
            agenda_items = filtered_items
        
        if format.lower() == "json":
            return {
                "format": "json",
                "total_items": len(agenda_items),
                "export_date": datetime.utcnow().isoformat(),
                "data": [item.dict() for item in agenda_items]
            }
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported export format: {format}")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to export agenda: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to export agenda: {e}")