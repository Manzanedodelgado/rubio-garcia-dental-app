from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from passlib.hash import bcrypt
import jwt
import os
import uuid
import logging
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'denapp-secret-key-2024')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

app = FastAPI(title="DenApp Control", version="1.0.0")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Pydantic Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    role: str  # 'admin' or 'recepcionista'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    role: str
    token: str

class Patient(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    num_pac: str
    nombre: str
    apellidos: str
    tel_movil: str
    fecha_alta: datetime
    notas: Optional[str] = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PatientCreate(BaseModel):
    nombre: str
    apellidos: str
    tel_movil: str
    notas: Optional[str] = ""

class Appointment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    cit_mod: str
    num_pac: str
    paciente_nombre: str
    paciente_apellidos: str
    fecha: str
    hora: str
    estado_cita: str
    tratamiento: str
    odontologo: str
    notas: Optional[str] = ""
    duracion: Optional[str] = "30"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AppointmentCreate(BaseModel):
    num_pac: str
    paciente_nombre: str
    paciente_apellidos: str
    fecha: str
    hora: str
    estado_cita: str
    tratamiento: str
    odontologo: str
    notas: Optional[str] = ""
    duracion: Optional[str] = "30"

class WhatsAppMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    contact_id: str
    contact_name: str
    phone_number: str
    message: str
    message_type: str  # 'incoming' or 'outgoing'
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = Field(default="pending")  # pending, sent, delivered, read
    tag_color: Optional[str] = ""  # 'red', 'blue', 'green'
    urgency_level: Optional[int] = 1  # 1-10

class MessageTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    content: str
    variables: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TemplateCreate(BaseModel):
    name: str
    content: str
    variables: List[str] = []

class Automation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    trigger_type: str  # 'appointment_reminder', 'medication_reminder', 'post_treatment'
    trigger_time: str  # e.g., "1 day before", "2 hours before"
    template_id: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AutomationCreate(BaseModel):
    name: str
    trigger_type: str
    trigger_time: str
    template_id: str
    is_active: bool = True

# Utility Functions
def create_jwt_token(user_data: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode = {"exp": expire, **user_data}
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Initialize default users
async def init_default_users():
    admin_exists = await db.users.find_one({"username": "JMD"})
    if not admin_exists:
        admin_password = bcrypt.hash("190582")
        admin_user = {
            "id": str(uuid.uuid4()),
            "username": "JMD",
            "password": admin_password,
            "role": "admin",
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(admin_user)
    
    recep_exists = await db.users.find_one({"username": "MGarcia"})
    if not recep_exists:
        recep_password = bcrypt.hash("clinic2024")
        recep_user = {
            "id": str(uuid.uuid4()),
            "username": "MGarcia",
            "password": recep_password,
            "role": "recepcionista",
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(recep_user)

# Authentication Routes
@api_router.post("/auth/login", response_model=UserResponse)
async def login(user_login: UserLogin):
    user = await db.users.find_one({"username": user_login.username})
    if not user or not bcrypt.verify(user_login.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_jwt_token({
        "id": user["id"],
        "username": user["username"],
        "role": user["role"]
    })
    
    return UserResponse(
        id=user["id"],
        username=user["username"],
        role=user["role"],
        token=token
    )

@api_router.get("/auth/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    return current_user

# Patient Routes
@api_router.get("/patients", response_model=List[Patient])
async def get_patients(current_user: dict = Depends(get_current_user)):
    patients = await db.patients.find().to_list(1000)
    return [Patient(**patient) for patient in patients]

@api_router.post("/patients", response_model=Patient)
async def create_patient(patient: PatientCreate, current_user: dict = Depends(get_current_user)):
    # Generate patient number
    patient_count = await db.patients.count_documents({})
    num_pac = f"PAC{str(patient_count + 1).zfill(4)}"
    
    patient_dict = patient.dict()
    patient_dict["num_pac"] = num_pac
    patient_dict["fecha_alta"] = datetime.now(timezone.utc)
    patient_obj = Patient(**patient_dict)
    
    await db.patients.insert_one(patient_obj.dict())
    return patient_obj

@api_router.put("/patients/{patient_id}", response_model=Patient)
async def update_patient(patient_id: str, patient: PatientCreate, current_user: dict = Depends(get_current_user)):
    patient_dict = patient.dict()
    await db.patients.update_one({"id": patient_id}, {"$set": patient_dict})
    
    updated_patient = await db.patients.find_one({"id": patient_id})
    if not updated_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    return Patient(**updated_patient)

@api_router.delete("/patients/{patient_id}")
async def delete_patient(patient_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.patients.delete_one({"id": patient_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"message": "Patient deleted successfully"}

# Appointment Routes
@api_router.get("/appointments", response_model=List[Appointment])
async def get_appointments(date: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if date:
        query["fecha"] = date
    
    appointments = await db.appointments.find(query).to_list(1000)
    return [Appointment(**appointment) for appointment in appointments]

@api_router.post("/appointments", response_model=Appointment)
async def create_appointment(appointment: AppointmentCreate, current_user: dict = Depends(get_current_user)):
    appointment_dict = appointment.dict()
    appointment_dict["cit_mod"] = str(uuid.uuid4())[:8]
    appointment_obj = Appointment(**appointment_dict)
    
    await db.appointments.insert_one(appointment_obj.dict())
    return appointment_obj

@api_router.put("/appointments/{appointment_id}", response_model=Appointment)
async def update_appointment(appointment_id: str, appointment: AppointmentCreate, current_user: dict = Depends(get_current_user)):
    appointment_dict = appointment.dict()
    await db.appointments.update_one({"id": appointment_id}, {"$set": appointment_dict})
    
    updated_appointment = await db.appointments.find_one({"id": appointment_id})
    if not updated_appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    return Appointment(**updated_appointment)

# WhatsApp Routes
@api_router.get("/whatsapp/messages", response_model=List[WhatsAppMessage])
async def get_whatsapp_messages(contact_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if contact_id:
        query["contact_id"] = contact_id
    
    messages = await db.whatsapp_messages.find(query).sort("timestamp", -1).to_list(1000)
    return [WhatsAppMessage(**message) for message in messages]

@api_router.post("/whatsapp/send")
async def send_whatsapp_message(
    contact_id: str,
    phone_number: str,
    message: str,
    current_user: dict = Depends(get_current_user)
):
    # Here you would integrate with WhatsApp API (Baileys or similar)
    # For now, we'll store the message as outgoing
    
    whatsapp_message = WhatsAppMessage(
        contact_id=contact_id,
        contact_name="",
        phone_number=phone_number,
        message=message,
        message_type="outgoing",
        status="sent"
    )
    
    await db.whatsapp_messages.insert_one(whatsapp_message.dict())
    return {"status": "sent", "message": "Message sent successfully"}

@api_router.put("/whatsapp/messages/{message_id}/tag")
async def tag_whatsapp_message(
    message_id: str,
    tag_color: str,
    urgency_level: int,
    current_user: dict = Depends(get_current_user)
):
    await db.whatsapp_messages.update_one(
        {"id": message_id},
        {"$set": {"tag_color": tag_color, "urgency_level": urgency_level}}
    )
    return {"message": "Message tagged successfully"}

# Template Routes
@api_router.get("/templates", response_model=List[MessageTemplate])
async def get_templates(current_user: dict = Depends(get_current_user)):
    templates = await db.message_templates.find().to_list(1000)
    return [MessageTemplate(**template) for template in templates]

@api_router.post("/templates", response_model=MessageTemplate)
async def create_template(template: TemplateCreate, current_user: dict = Depends(get_current_user)):
    template_obj = MessageTemplate(**template.dict())
    await db.message_templates.insert_one(template_obj.dict())
    return template_obj

@api_router.put("/templates/{template_id}", response_model=MessageTemplate)
async def update_template(template_id: str, template: TemplateCreate, current_user: dict = Depends(get_current_user)):
    template_dict = template.dict()
    await db.message_templates.update_one({"id": template_id}, {"$set": template_dict})
    
    updated_template = await db.message_templates.find_one({"id": template_id})
    if not updated_template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return MessageTemplate(**updated_template)

@api_router.delete("/templates/{template_id}")
async def delete_template(template_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.message_templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted successfully"}

# Automation Routes
@api_router.get("/automations", response_model=List[Automation])
async def get_automations(current_user: dict = Depends(get_current_user)):
    automations = await db.automations.find().to_list(1000)
    return [Automation(**automation) for automation in automations]

@api_router.post("/automations", response_model=Automation)
async def create_automation(automation: AutomationCreate, current_user: dict = Depends(get_current_user)):
    automation_obj = Automation(**automation.dict())
    await db.automations.insert_one(automation_obj.dict())
    return automation_obj

@api_router.put("/automations/{automation_id}", response_model=Automation)
async def update_automation(automation_id: str, automation: AutomationCreate, current_user: dict = Depends(get_current_user)):
    automation_dict = automation.dict()
    await db.automations.update_one({"id": automation_id}, {"$set": automation_dict})
    
    updated_automation = await db.automations.find_one({"id": automation_id})
    if not updated_automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    
    return Automation(**updated_automation)

# Dashboard Routes
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get today's appointments
    today_appointments = await db.appointments.count_documents({"fecha": today})
    
    # Get pending WhatsApp messages
    pending_messages = await db.whatsapp_messages.count_documents({"status": "pending"})
    
    # Get total patients
    total_patients = await db.patients.count_documents({})
    
    # Get confirmation rate (assuming confirmed appointments have estado_cita = "Confirmada")
    confirmed_appointments = await db.appointments.count_documents({
        "fecha": today,
        "estado_cita": "Confirmada"
    })
    
    confirmation_rate = (confirmed_appointments / today_appointments * 100) if today_appointments > 0 else 0
    
    return {
        "today_appointments": today_appointments,
        "pending_messages": pending_messages,
        "total_patients": total_patients,
        "confirmation_rate": round(confirmation_rate, 1)
    }

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    await init_default_users()
    logger.info("DenApp Control started successfully")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()