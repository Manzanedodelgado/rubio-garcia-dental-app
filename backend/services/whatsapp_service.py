import httpx
import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import json

logger = logging.getLogger(__name__)

class WhatsAppService:
    def __init__(self, service_url: str = "http://localhost:3001"):
        self.service_url = service_url
        self.client = httpx.AsyncClient(timeout=30.0)
        
    async def get_status(self) -> Dict[str, Any]:
        """Get WhatsApp connection status"""
        try:
            response = await self.client.get(f"{self.service_url}/status")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error getting WhatsApp status: {str(e)}")
            return {
                "status": "error",
                "connected": False,
                "error": str(e)
            }
    
    async def get_qr_code(self) -> Dict[str, Any]:
        """Get current QR code for authentication"""
        try:
            response = await self.client.get(f"{self.service_url}/qr")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error getting QR code: {str(e)}")
            return {
                "qr": None,
                "error": str(e)
            }
    
    async def send_message(self, phone_number: str, message: str) -> Dict[str, Any]:
        """Send a message to a phone number"""
        try:
            # Clean phone number (remove spaces, dashes, etc.)
            clean_phone = ''.join(filter(str.isdigit, phone_number))
            
            response = await self.client.post(
                f"{self.service_url}/send",
                json={
                    "phone_number": clean_phone,
                    "message": message
                }
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error sending message to {phone_number}: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def send_bulk_messages(self, recipients: List[Dict[str, str]], message: str) -> Dict[str, Any]:
        """Send bulk messages to multiple recipients"""
        try:
            # Prepare recipients with clean phone numbers
            clean_recipients = []
            for recipient in recipients:
                clean_phone = ''.join(filter(str.isdigit, recipient.get('phone_number', '')))
                if clean_phone:
                    clean_recipients.append({
                        "phone_number": clean_phone,
                        "name": recipient.get('name', '')
                    })
            
            response = await self.client.post(
                f"{self.service_url}/send-bulk",
                json={
                    "recipients": clean_recipients,
                    "message": message
                }
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error sending bulk messages: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def is_connected(self) -> bool:
        """Check if WhatsApp is connected"""
        status = await self.get_status()
        return status.get("connected", False)
    
    async def wait_for_connection(self, timeout: int = 60) -> bool:
        """Wait for WhatsApp to connect"""
        start_time = datetime.now()
        while (datetime.now() - start_time).seconds < timeout:
            if await self.is_connected():
                return True
            await asyncio.sleep(2)
        return False
    
    def process_template_variables(self, template: str, variables: Dict[str, str]) -> str:
        """Replace template variables with actual values"""
        processed = template
        for key, value in variables.items():
            placeholder = f"{{{{{key}}}}}"
            processed = processed.replace(placeholder, str(value))
        return processed
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()

# Global service instance
whatsapp_service = WhatsAppService()