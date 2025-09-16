from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import logging
import os
import asyncio
from threading import Thread

from services.google_sheets_service import get_sheets_service
from models.agenda import AgendaItem, SyncStatus

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AgendaSyncService:
    """Service for automated agenda synchronization with Google Sheets."""
    
    def __init__(self):
        """Initialize the agenda sync service."""
        self.sheets_service = get_sheets_service()
        self.scheduler = BackgroundScheduler()
        self.sync_in_progress = False
        self.last_sync_time = None
        self.sync_interval_minutes = int(os.getenv('SYNC_INTERVAL_MINUTES', 5))
        self.sync_stats = {
            'total_syncs': 0,
            'successful_syncs': 0,
            'failed_syncs': 0,
            'last_error': None
        }
        
        # Local cache for agenda items
        self._agenda_cache = {}
        self._cache_updated_at = None
        
    def start_scheduler(self):
        """Start the background scheduler for periodic synchronization."""
        try:
            # Schedule synchronization every N minutes
            self.scheduler.add_job(
                func=self.sync_agenda_data,
                trigger=IntervalTrigger(minutes=self.sync_interval_minutes),
                id='agenda_sync',
                name='Agenda Synchronization',
                replace_existing=True,
                max_instances=1  # Prevent concurrent sync operations
            )
            
            # Schedule a full sync daily at midnight
            self.scheduler.add_job(
                func=self.full_sync_agenda_data,
                trigger=CronTrigger(hour=0, minute=0),
                id='full_agenda_sync',
                name='Full Agenda Synchronization',
                replace_existing=True,
                max_instances=1
            )
            
            self.scheduler.start()
            logger.info(f"Agenda synchronization scheduler started - syncing every {self.sync_interval_minutes} minutes")
            
            # Perform initial sync
            self.sync_agenda_data()
            
        except Exception as e:
            logger.error(f"Failed to start synchronization scheduler: {e}")
            raise
    
    def stop_scheduler(self):
        """Stop the background scheduler."""
        if self.scheduler.running:
            self.scheduler.shutdown(wait=True)
            logger.info("Agenda synchronization scheduler stopped")
    
    def sync_agenda_data(self):
        """Perform incremental synchronization of agenda data."""
        if self.sync_in_progress:
            logger.warning("Synchronization already in progress, skipping this cycle")
            return
        
        self.sync_in_progress = True
        start_time = datetime.utcnow()
        
        try:
            logger.info("Starting agenda synchronization with Google Sheets")
            
            # Read current data from Google Sheets
            sheets_data = self.sheets_service.read_agenda_data()
            
            if sheets_data:
                # Update local cache
                self._update_cache(sheets_data)
                
                logger.info(f"Synchronization completed successfully. "
                          f"Processed {len(sheets_data)} items in "
                          f"{(datetime.utcnow() - start_time).total_seconds():.2f} seconds")
                
                self.sync_stats['successful_syncs'] += 1
                self.sync_stats['last_error'] = None
            else:
                logger.info("No agenda data found in Google Sheets")
                self.sync_stats['successful_syncs'] += 1
            
            self.last_sync_time = start_time
            self.sync_stats['total_syncs'] += 1
            
        except Exception as e:
            logger.error(f"Synchronization failed: {e}")
            self.sync_stats['failed_syncs'] += 1
            self.sync_stats['last_error'] = str(e)
            raise
        finally:
            self.sync_in_progress = False
    
    def full_sync_agenda_data(self):
        """Perform a full synchronization, including cleanup of deleted items."""
        logger.info("Starting full agenda synchronization")
        self.sync_agenda_data()
        # Additional full sync logic can be implemented here
        # Such as comparing with local data to detect deletions
    
    def _update_cache(self, agenda_items: List[AgendaItem]):
        """Update the local cache with synchronized data."""
        self._agenda_cache.clear()
        
        for item in agenda_items:
            # Use a combination of fields as key for uniqueness
            cache_key = f"{item.num_pac}_{item.fecha}_{item.hora}" if item.num_pac and item.fecha and item.hora else str(item.id)
            self._agenda_cache[cache_key] = item
        
        self._cache_updated_at = datetime.utcnow()
        logger.info(f"Updated local cache with {len(agenda_items)} agenda items")
    
    def get_cached_agenda_items(self) -> List[AgendaItem]:
        """Get agenda items from local cache."""
        return list(self._agenda_cache.values())
    
    def get_agenda_items_by_date(self, target_date: str) -> List[AgendaItem]:
        """Get agenda items for a specific date from cache."""
        filtered_items = []
        
        for item in self._agenda_cache.values():
            if item.fecha and item.fecha.strftime('%Y-%m-%d') == target_date:
                filtered_items.append(item)
        
        return filtered_items
    
    def get_agenda_items_by_patient(self, patient_number: str) -> List[AgendaItem]:
        """Get agenda items for a specific patient from cache."""
        filtered_items = []
        
        for item in self._agenda_cache.values():
            if item.num_pac and item.num_pac == patient_number:
                filtered_items.append(item)
        
        return filtered_items
    
    def add_agenda_item(self, agenda_item_data: Dict) -> AgendaItem:
        """Add a new agenda item to Google Sheets."""
        try:
            # Create AgendaItem from data
            agenda_item = AgendaItem(**agenda_item_data)
            
            # Add to Google Sheets
            success = self.sheets_service.append_agenda_item(agenda_item)
            
            if success:
                # Add to local cache
                cache_key = f"{agenda_item.num_pac}_{agenda_item.fecha}_{agenda_item.hora}" if agenda_item.num_pac and agenda_item.fecha and agenda_item.hora else str(agenda_item.id)
                self._agenda_cache[cache_key] = agenda_item
                
                logger.info(f"Successfully added agenda item: {agenda_item.nombre} {agenda_item.apellidos}")
                return agenda_item
            else:
                raise Exception("Failed to add agenda item to Google Sheets")
                
        except Exception as e:
            logger.error(f"Failed to add agenda item: {e}")
            raise
    
    def update_agenda_item(self, item_id: str, agenda_item_data: Dict) -> AgendaItem:
        """Update an existing agenda item in Google Sheets."""
        try:
            # Find the item in cache first
            cache_key = None
            for key, item in self._agenda_cache.items():
                if str(item.id) == item_id or str(item.registro) == item_id:
                    cache_key = key
                    break
            
            if not cache_key:
                raise ValueError(f"Agenda item with ID {item_id} not found in cache")
            
            # Update the item data
            cached_item = self._agenda_cache[cache_key]
            updated_data = cached_item.dict()
            updated_data.update(agenda_item_data)
            updated_data['updated_at'] = datetime.utcnow()
            
            agenda_item = AgendaItem(**updated_data)
            
            # For Google Sheets update, we need to find the row index
            # This is a simplified approach - in production you might want to store row indices
            all_items = list(self._agenda_cache.values())
            row_index = 0
            for i, item in enumerate(all_items):
                if str(item.id) == item_id or str(item.registro) == item_id:
                    row_index = i
                    break
            
            # Update in Google Sheets
            success = self.sheets_service.update_agenda_item(row_index, agenda_item)
            
            if success:
                # Update local cache
                self._agenda_cache[cache_key] = agenda_item
                
                logger.info(f"Successfully updated agenda item: {agenda_item.nombre} {agenda_item.apellidos}")
                return agenda_item
            else:
                raise Exception("Failed to update agenda item in Google Sheets")
                
        except Exception as e:
            logger.error(f"Failed to update agenda item: {e}")
            raise
    
    def get_sync_status(self) -> SyncStatus:
        """Get current synchronization status."""
        return SyncStatus(
            last_sync_time=self.last_sync_time,
            sync_in_progress=self.sync_in_progress,
            scheduler_running=self.scheduler.running if self.scheduler else False,
            next_sync_time=self._get_next_sync_time(),
            total_items=len(self._agenda_cache),
            successful_syncs=self.sync_stats['successful_syncs'],
            failed_syncs=self.sync_stats['failed_syncs'],
            last_error=self.sync_stats['last_error']
        )
    
    def _get_next_sync_time(self) -> Optional[datetime]:
        """Get the next scheduled synchronization time."""
        if self.scheduler and self.scheduler.running:
            job = self.scheduler.get_job('agenda_sync')
            if job and job.next_run_time:
                return job.next_run_time
        return None
    
    def force_sync(self):
        """Force an immediate synchronization."""
        logger.info("Forcing immediate agenda synchronization")
        self.sync_agenda_data()
    
    def test_connection(self) -> Dict[str, any]:
        """Test the connection to Google Sheets."""
        return self.sheets_service.test_connection()

# Global sync service instance
sync_service = None

def get_sync_service() -> AgendaSyncService:
    """Get the global agenda sync service instance."""
    global sync_service
    if sync_service is None:
        sync_service = AgendaSyncService()
    return sync_service

def start_agenda_sync():
    """Start the agenda synchronization service."""
    service = get_sync_service()
    service.start_scheduler()
    return service

def stop_agenda_sync():
    """Stop the agenda synchronization service."""
    global sync_service
    if sync_service:
        sync_service.stop_scheduler()
        sync_service = None