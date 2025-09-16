from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone, date, time
from passlib.hash import bcrypt
import jwt
import os
import uuid
import logging
from pathlib import Path
import json
import csv
import io
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import asyncio

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

# Background scheduler for automations
scheduler = BackgroundScheduler()

# Pydantic Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    role: str  # 'admin' or 'recepcionista'
    permissions: Dict[str, str] = {}  # módulo: 'reader'/'editor'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    role: str
    permissions: Dict[str, str]
    token: str

class Patient(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    num_pac: str
    nombre: str
    apellidos: str
    tel_movil: str
    email: Optional[str] = ""
    fecha_alta: datetime
    notas: Optional[str] = ""
    source: str = "manual"  # 'agenda', 'whatsapp', 'manual', 'csv'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PatientCreate(BaseModel):
    nombre: str
    apellidos: str
    tel_movil: str
    email: Optional[str] = ""
    notas: Optional[str] = ""

class Appointment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    registro: Optional[int] = None
    cit_mod: Optional[str] = None
    fecha_alta: Optional[datetime] = None
    num_pac: str
    apellidos: str
    nombre: str
    tel_movil: Optional[str] = ""
    fecha: date
    hora: time
    estado_cita: str = "PROGRAMADA"
    tratamiento: str
    odontologo: str
    notas: Optional[str] = ""
    duracion: Optional[str] = "30"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AppointmentCreate(BaseModel):
    num_pac: str
    apellidos: str
    nombre: str
    tel_movil: Optional[str] = ""
    fecha: date
    hora: time
    estado_cita: str = "PROGRAMADA"
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
    is_ai_handled: bool = False

class WhatsAppMessageCreate(BaseModel):
    phone_number: str
    message: str
    schedule_time: Optional[datetime] = None

class MessageTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    content: str
    variables: List[str] = []
    category: str = "general"  # 'general', 'recordatorio', 'cuestionario', 'consentimiento'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TemplateCreate(BaseModel):
    name: str
    content: str
    variables: List[str] = []
    category: str = "general"

class Automation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    trigger_type: str  # 'appointment_reminder', 'medication_reminder', 'post_treatment'
    trigger_time: str  # e.g., "1 day before", "2 hours before"
    template_id: str
    conditions: Dict[str, Any] = {}
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AutomationCreate(BaseModel):
    name: str
    trigger_type: str
    trigger_time: str
    template_id: str
    conditions: Dict[str, Any] = {}
    is_active: bool = True

class AIAgentConfig(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    behavior: str = "professional"  # 'professional', 'friendly', 'formal'
    language: str = "es"
    personality: str = "Comportamiento de odontólogo responsable, lenguaje correcto pero cercano, tratamiento de 'Usted'"
    instructions: str = ""
    is_active: bool = True
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReminderBatch(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    template_id: str
    recipients: List[str]  # patient IDs or phone numbers
    schedule_time: Optional[datetime] = None
    status: str = "pending"  # pending, sent, failed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ClinicSettings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    clinic_name: str = "Rubio García Dental"
    logo_url: Optional[str] = ""
    icon_url: Optional[str] = ""
    primary_color: str = "#007AFF"
    secondary_color: str = "#FFFFFF"
    accent_color: str = "#F2F2F7"
    whatsapp_number: str = "664218253"
    email: str = "info@rubiogarciadental.com"
    address: str = "Calle Mayor 19, Alcorcón, 28921 Madrid"
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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

# Initialize default users and settings
async def init_default_data():
    # Create admin user
    admin_exists = await db.users.find_one({"username": "JMD"})
    if not admin_exists:
        admin_password = bcrypt.hash("190582")
        admin_user = {
            "id": str(uuid.uuid4()),
            "username": "JMD",
            "password": admin_password,
            "role": "admin",
            "permissions": {
                "dashboard": "editor",
                "agenda": "editor", 
                "pacientes": "editor",
                "whatsapp": "editor",
                "recordatorios": "editor",
                "plantillas": "editor",
                "automatizaciones": "editor",
                "entrenamiento_ia": "editor",
                "configuracion": "editor"
            },
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(admin_user)

    # Initialize clinic settings
    settings_exists = await db.clinic_settings.find_one({})
    if not settings_exists:
        default_settings = ClinicSettings().dict()
        await db.clinic_settings.insert_one(default_settings)

    # Initialize AI agent config
    ai_config_exists = await db.ai_agent_config.find_one({})
    if not ai_config_exists:
        default_ai_config = AIAgentConfig().dict()
        await db.ai_agent_config.insert_one(default_ai_config)

# Authentication Routes
@api_router.post("/auth/login", response_model=UserResponse)
async def login(user_login: UserLogin):
    user = await db.users.find_one({"username": user_login.username})
    if not user or not bcrypt.verify(user_login.password, user["password"]):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
    token = create_jwt_token({
        "id": user["id"],
        "username": user["username"],
        "role": user["role"]
    })
    
    return UserResponse(
        id=user["id"],
        username=user["username"],
        role=user["role"],
        permissions=user.get("permissions", {}),
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

@api_router.post("/patients/import-csv")
async def import_patients_csv(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    content = await file.read()
    csv_data = csv.DictReader(io.StringIO(content.decode('utf-8')))
    
    imported_count = 0
    for row in csv_data:
        try:
            patient_data = PatientCreate(
                nombre=row.get('nombre', ''),
                apellidos=row.get('apellidos', ''),
                tel_movil=row.get('tel_movil', ''),
                email=row.get('email', ''),
                notas=row.get('notas', '')
            )
            
            patient_count = await db.patients.count_documents({})
            num_pac = f"PAC{str(patient_count + 1).zfill(4)}"
            
            patient_dict = patient_data.dict()
            patient_dict["num_pac"] = num_pac
            patient_dict["fecha_alta"] = datetime.now(timezone.utc)
            patient_dict["source"] = "csv"
            patient_obj = Patient(**patient_dict)
            
            await db.patients.insert_one(patient_obj.dict())
            imported_count += 1
        except Exception as e:
            continue
    
    return {"message": f"Imported {imported_count} patients successfully"}

# Appointment Routes
@api_router.get("/appointments", response_model=List[Appointment])
async def get_appointments(date_filter: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if date_filter:
        query["fecha"] = date_filter
    
    appointments = await db.appointments.find(query).to_list(1000)
    return [Appointment(**appointment) for appointment in appointments]

@api_router.post("/appointments", response_model=Appointment)
async def create_appointment(appointment: AppointmentCreate, current_user: dict = Depends(get_current_user)):
    appointment_dict = appointment.dict()
    appointment_dict["registro"] = await get_next_registro()
    appointment_dict["fecha_alta"] = datetime.now(timezone.utc)
    appointment_obj = Appointment(**appointment_dict)
    
    await db.appointments.insert_one(appointment_obj.dict())
    
    # Auto-create patient if not exists
    existing_patient = await db.patients.find_one({"num_pac": appointment.num_pac})
    if not existing_patient:
        patient_data = PatientCreate(
            nombre=appointment.nombre,
            apellidos=appointment.apellidos,
            tel_movil=appointment.tel_movil or ""
        )
        patient_dict = patient_data.dict()
        patient_dict["num_pac"] = appointment.num_pac
        patient_dict["fecha_alta"] = datetime.now(timezone.utc)
        patient_dict["source"] = "agenda"
        patient_obj = Patient(**patient_dict)
        await db.patients.insert_one(patient_obj.dict())
    
    return appointment_obj

async def get_next_registro():
    last_appointment = await db.appointments.find().sort("registro", -1).limit(1).to_list(1)
    if last_appointment:
        return last_appointment[0].get("registro", 0) + 1
    return 1

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
    message_data: WhatsAppMessageCreate,
    current_user: dict = Depends(get_current_user)
):
    # Simulate WhatsApp message sending
    whatsapp_message = WhatsAppMessage(
        contact_id=str(uuid.uuid4()),
        contact_name="",
        phone_number=message_data.phone_number,
        message=message_data.message,
        message_type="outgoing",
        status="sent"
    )
    
    await db.whatsapp_messages.insert_one(whatsapp_message.dict())
    return {"status": "sent", "message": "Message sent successfully"}

@api_router.get("/whatsapp/pending-messages")
async def get_pending_whatsapp_messages(current_user: dict = Depends(get_current_user)):
    messages = await db.whatsapp_messages.find({
        "status": "pending",
        "message_type": "incoming"
    }).to_list(100)
    return messages

@api_router.put("/whatsapp/messages/{message_id}/tag")
async def tag_message(
    message_id: str,
    tag_data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    await db.whatsapp_messages.update_one(
        {"id": message_id},
        {"$set": tag_data}
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
    
    # Schedule the automation
    if automation_obj.is_active:
        schedule_automation(automation_obj)
    
    return automation_obj

@api_router.put("/automations/{automation_id}", response_model=Automation)
async def update_automation(automation_id: str, automation: AutomationCreate, current_user: dict = Depends(get_current_user)):
    automation_dict = automation.dict()
    await db.automations.update_one({"id": automation_id}, {"$set": automation_dict})
    
    updated_automation = await db.automations.find_one({"id": automation_id})
    if not updated_automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    
    # Reschedule the automation
    automation_obj = Automation(**updated_automation)
    if automation_obj.is_active:
        schedule_automation(automation_obj)
    
    return automation_obj

def schedule_automation(automation: Automation):
    """Schedule an automation task"""
    # Parse trigger_time and schedule accordingly
    if automation.trigger_type == "appointment_reminder":
        # Schedule daily check for appointments needing reminders
        scheduler.add_job(
            func=process_appointment_reminders,
            trigger=CronTrigger(hour=16, minute=0),  # Daily at 4 PM
            id=f"automation_{automation.id}",
            replace_existing=True,
            args=[automation.id]
        )

async def process_appointment_reminders(automation_id: str):
    """Process appointment reminder automation"""
    automation = await db.automations.find_one({"id": automation_id})
    if not automation or not automation.get("is_active"):
        return
    
    # Get appointments for tomorrow
    tomorrow = date.today() + timedelta(days=1)
    appointments = await db.appointments.find({
        "fecha": tomorrow.isoformat(),
        "estado_cita": {"$in": ["PROGRAMADA", "CONFIRMADA"]}
    }).to_list(1000)
    
    template = await db.message_templates.find_one({"id": automation["template_id"]})
    if not template:
        return
    
    for appointment in appointments:
        # Send reminder message
        message_content = template["content"].format(
            nombre=appointment["nombre"],
            apellido=appointment["apellidos"],
            fecha_cita=appointment["fecha"],
            hora_cita=appointment["hora"]
        )
        
        reminder_message = WhatsAppMessage(
            contact_id=appointment["num_pac"],
            contact_name=f"{appointment['nombre']} {appointment['apellidos']}",
            phone_number=appointment.get("tel_movil", ""),
            message=message_content,
            message_type="outgoing",
            status="scheduled"
        )
        
        await db.whatsapp_messages.insert_one(reminder_message.dict())

# Reminder Routes
@api_router.post("/reminders/send-batch")
async def send_reminder_batch(
    batch_data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    batch = ReminderBatch(
        name=batch_data["name"],
        template_id=batch_data["template_id"],
        recipients=batch_data["recipients"],
        schedule_time=batch_data.get("schedule_time")
    )
    
    await db.reminder_batches.insert_one(batch.dict())
    
    # Process batch in background
    background_tasks.add_task(process_reminder_batch, batch.id)
    
    return {"message": "Reminder batch scheduled successfully", "batch_id": batch.id}

async def process_reminder_batch(batch_id: str):
    """Process a reminder batch"""
    batch = await db.reminder_batches.find_one({"id": batch_id})
    if not batch:
        return
    
    template = await db.message_templates.find_one({"id": batch["template_id"]})
    if not template:
        return
    
    sent_count = 0
    for recipient in batch["recipients"]:
        # Get patient info
        patient = await db.patients.find_one({"id": recipient})
        if not patient:
            continue
        
        # Personalize message
        message_content = template["content"]
        for var in template.get("variables", []):
            if var == "nombre":
                message_content = message_content.replace("{{nombre}}", patient["nombre"])
            elif var == "apellido":
                message_content = message_content.replace("{{apellido}}", patient["apellidos"])
        
        # Create message
        reminder_message = WhatsAppMessage(
            contact_id=patient["id"],
            contact_name=f"{patient['nombre']} {patient['apellidos']}",
            phone_number=patient["tel_movil"],
            message=message_content,
            message_type="outgoing",
            status="sent"
        )
        
        await db.whatsapp_messages.insert_one(reminder_message.dict())
        sent_count += 1
    
    # Update batch status
    await db.reminder_batches.update_one(
        {"id": batch_id},
        {"$set": {"status": "sent", "sent_count": sent_count}}
    )

# AI Agent Routes
@api_router.get("/ai-agent/config", response_model=AIAgentConfig)
async def get_ai_config(current_user: dict = Depends(get_current_user)):
    config = await db.ai_agent_config.find_one({})
    if not config:
        config = AIAgentConfig().dict()
        await db.ai_agent_config.insert_one(config)
    return AIAgentConfig(**config)

@api_router.put("/ai-agent/config", response_model=AIAgentConfig)
async def update_ai_config(config: AIAgentConfig, current_user: dict = Depends(get_current_user)):
    config.updated_at = datetime.now(timezone.utc)
    await db.ai_agent_config.update_one({}, {"$set": config.dict()}, upsert=True)
    return config

@api_router.post("/ai-agent/test")
async def test_ai_agent(test_data: Dict[str, str], current_user: dict = Depends(get_current_user)):
    # Simulate AI response
    user_message = test_data.get("message", "")
    
    # Basic AI simulation
    if "dolor" in user_message.lower():
        ai_response = "Entiendo que tiene dolor. ¿Podría describir la intensidad del dolor del 1 al 10? Le recomiendo que programe una cita urgente."
    elif "cita" in user_message.lower():
        ai_response = "Por supuesto, estaré encantada de ayudarle con su cita. ¿Qué día prefiere para su visita?"
    else:
        ai_response = "Gracias por contactarnos. Soy el asistente virtual de Rubio García Dental. ¿En qué puedo ayudarle hoy?"
    
    return {"response": ai_response}

# Configuration Routes
@api_router.get("/settings", response_model=ClinicSettings)
async def get_clinic_settings(current_user: dict = Depends(get_current_user)):
    settings = await db.clinic_settings.find_one({})
    if not settings:
        settings = ClinicSettings().dict()
        await db.clinic_settings.insert_one(settings)
    return ClinicSettings(**settings)

@api_router.put("/settings", response_model=ClinicSettings)
async def update_clinic_settings(settings: ClinicSettings, current_user: dict = Depends(get_current_user)):
    settings.updated_at = datetime.now(timezone.utc)
    await db.clinic_settings.update_one({}, {"$set": settings.dict()}, upsert=True)
    return settings

@api_router.post("/settings/upload-logo")
async def upload_logo(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    try:
        # Create uploads directory if it doesn't exist
        uploads_dir = ROOT_DIR / "uploads"
        uploads_dir.mkdir(exist_ok=True)
        
        # Generate unique filename
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        unique_filename = f"logo_{uuid.uuid4()}.{file_extension}"
        file_path = uploads_dir / unique_filename
        
        # Save file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Generate accessible URL
        logo_url = f"/uploads/{unique_filename}"
        
        # Update database
        await db.clinic_settings.update_one(
            {},
            {"$set": {"logo_url": logo_url}},
            upsert=True
        )
        
        return {"logo_url": logo_url}
    except Exception as e:
        logger.error(f"Error uploading logo: {str(e)}")
        raise HTTPException(status_code=500, detail="Error uploading file")

# Dashboard Routes
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Today's appointments
    today_appointments = await db.appointments.count_documents({"fecha": today})
    
    # Pending WhatsApp messages
    pending_messages = await db.whatsapp_messages.count_documents({
        "message_type": "incoming",
        "$or": [
            {"status": "pending"},
            {"status": "received"}
        ]
    })
    
    # Total patients
    total_patients = await db.patients.count_documents({})
    
    # Confirmation rate
    confirmed_appointments = await db.appointments.count_documents({
        "fecha": today,
        "estado_cita": "CONFIRMADA"
    })
    
    confirmation_rate = (confirmed_appointments / today_appointments * 100) if today_appointments > 0 else 0
    
    # Recent appointments for today
    recent_appointments = await db.appointments.find({
        "fecha": today
    }).sort("hora", 1).to_list(10)
    
    # Urgent messages
    urgent_messages_cursor = db.whatsapp_messages.find({
        "$or": [
            {"tag_color": "red"},
            {"urgency_level": {"$gte": 7}}
        ],
        "message_type": "incoming"
    }).sort("timestamp", -1).limit(5)
    
    urgent_messages = []
    async for msg in urgent_messages_cursor:
        urgent_messages.append({
            "id": msg.get("id"),
            "contact_name": msg.get("contact_name"),
            "phone_number": msg.get("phone_number"),
            "message": msg.get("message", "")[:50] + "..." if len(msg.get("message", "")) > 50 else msg.get("message", ""),
            "timestamp": msg.get("timestamp"),
            "urgency_level": msg.get("urgency_level", 1)
        })
    
    return {
        "today_appointments": today_appointments,
        "pending_messages": pending_messages,
        "total_patients": total_patients,
        "confirmation_rate": round(confirmation_rate, 1),
        "recent_appointments": recent_appointments,
        "urgent_messages": urgent_messages
    }

@api_router.get("/dashboard/appointment-stats")
async def get_appointment_stats(current_user: dict = Depends(get_current_user)):
    """Get appointment statistics for charts"""
    # Get appointments for the last 7 days
    end_date = datetime.now(timezone.utc).date()
    start_date = end_date - timedelta(days=6)
    
    daily_stats = []
    for i in range(7):
        current_date = start_date + timedelta(days=i)
        count = await db.appointments.count_documents({
            "fecha": current_date.isoformat()
        })
        daily_stats.append({
            "date": current_date.isoformat(),
            "count": count
        })
    
    # Status distribution
    status_stats = await db.appointments.aggregate([
        {"$group": {"_id": "$estado_cita", "count": {"$sum": 1}}}
    ]).to_list(100)
    
    return {
        "daily_appointments": daily_stats,
        "status_distribution": status_stats
    }

# User Management Routes
@api_router.get("/users", response_model=List[User])
async def get_users(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find({}, {"password": 0}).to_list(100)
    return [User(**user) for user in users]

@api_router.post("/users", response_model=User)
async def create_user(user_data: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if username already exists
    existing_user = await db.users.find_one({"username": user_data["username"]})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Hash password
    hashed_password = bcrypt.hash(user_data["password"])
    
    user = User(
        username=user_data["username"],
        role=user_data["role"],
        permissions=user_data.get("permissions", {})
    )
    
    user_dict = user.dict()
    user_dict["password"] = hashed_password
    
    await db.users.insert_one(user_dict)
    return user

# Real WhatsApp Integration Routes
@api_router.get("/whatsapp/status")
async def get_whatsapp_status(current_user: dict = Depends(get_current_user)):
    from services.whatsapp_service import whatsapp_service
    return await whatsapp_service.get_status()

@api_router.get("/whatsapp/qr")
async def get_whatsapp_qr(current_user: dict = Depends(get_current_user)):
    from services.whatsapp_service import whatsapp_service
    return await whatsapp_service.get_qr_code()

@api_router.put("/whatsapp/messages/tag")
async def update_message_tags(
    tag_data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Update message tags for a phone number"""
    try:
        phone_number = tag_data.get("phone_number")
        tag_color = tag_data.get("tag_color")
        urgency_level = tag_data.get("urgency_level", 1)
        
        # Update all messages for this phone number
        await db.whatsapp_messages.update_many(
            {"phone_number": phone_number},
            {"$set": {
                "tag_color": tag_color,
                "urgency_level": urgency_level
            }}
        )
        
        return {"status": "success", "message": "Messages tagged successfully"}
    except Exception as e:
        logger.error(f"Error tagging messages: {str(e)}")
        raise HTTPException(status_code=500, detail="Error tagging messages")

@api_router.post("/whatsapp/messages")
async def create_whatsapp_message(
    message_data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Create a new WhatsApp message record"""
    try:
        whatsapp_message = WhatsAppMessage(
            contact_id=message_data.get("contact_id"),
            contact_name=message_data.get("contact_name"),
            phone_number=message_data.get("phone_number"),
            message=message_data.get("message"),
            message_type=message_data.get("message_type", "outgoing"),
            status=message_data.get("status", "sent")
        )
        
        await db.whatsapp_messages.insert_one(whatsapp_message.dict())
        return {"status": "success", "message": "Message saved successfully"}
    except Exception as e:
        logger.error(f"Error saving WhatsApp message: {str(e)}")
        raise HTTPException(status_code=500, detail="Error saving message")

@api_router.post("/whatsapp/send-real")
async def send_real_whatsapp_message(
    message_data: Dict[str, str],
    current_user: dict = Depends(get_current_user)
):
    from services.whatsapp_service import whatsapp_service
    phone_number = message_data.get("phone_number")
    message = message_data.get("message")
    
    if not phone_number or not message:
        raise HTTPException(status_code=400, detail="phone_number and message are required")
    
    return await whatsapp_service.send_message(phone_number, message)

@api_router.post("/whatsapp/send-bulk-real")
async def send_bulk_whatsapp_messages(
    request_data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    from services.whatsapp_service import whatsapp_service
    recipients = request_data.get("recipients", [])
    message = request_data.get("message", "")
    return await whatsapp_service.send_bulk_messages(recipients, message)

@api_router.post("/whatsapp/message-received")
async def handle_whatsapp_message_received(message_data: Dict[str, Any]):
    """Handle incoming WhatsApp messages from Baileys service"""
    try:
        phone_number = message_data.get("phone_number")
        contact_name = message_data.get("contact_name", phone_number)
        message_text = message_data.get("message", "")
        
        # Store the incoming message
        whatsapp_message = WhatsAppMessage(
            contact_id=phone_number,
            contact_name=contact_name,
            phone_number=phone_number,
            message=message_text,
            message_type="incoming",
            status="received"
        )
        
        await db.whatsapp_messages.insert_one(whatsapp_message.dict())
        
        # Check if AI is enabled before processing
        ai_config = await db.ai_agent_config.find_one({})
        if ai_config and ai_config.get("is_active", False):
            # Process with IA if enabled
            reply = await process_ai_response(message_text, phone_number)
            return {"reply": reply}
        else:
            # No AI response when disabled
            logger.info(f"AI is disabled, no auto-reply for message from {phone_number}")
            return {"reply": None}
        
    except Exception as e:
        logger.error(f"Error processing WhatsApp message: {str(e)}")
        return {"reply": None}

async def process_ai_response(message: str, phone_number: str) -> str:
    """Process message with AI logic"""
    message_lower = message.lower()
    
    # Basic AI responses for dental clinic
    if any(word in message_lower for word in ['dolor', 'duele', 'molestia']):
        return """Entiendo que tiene dolor dental. Le recomiendo:

🔴 Si el dolor es intenso (7-10): Contacte urgentemente al 664218253
🟡 Si es moderado: Puede tomar un analgésico y programar cita
📅 ¿Desea que le ayude a reservar una cita?

¿Podría calificar su dolor del 1 al 10?"""
    
    elif any(word in message_lower for word in ['cita', 'consulta', 'reservar']):
        return """📅 Estaré encantada de ayudarle con su cita.

Nuestro horario:
🕘 Lunes a Viernes: 9:00 - 19:00
📞 Teléfono: 664218253
📍 Calle Mayor 19, Alcorcón

¿Qué día prefiere para su visita?
¿Es una consulta de revisión o tiene alguna molestia específica?"""
    
    elif any(word in message_lower for word in ['precio', 'coste', 'cuanto']):
        return """💰 Los precios varían según el tratamiento necesario.

Algunos ejemplos orientativos:
• Limpieza dental: Desde 60€
• Empaste: Desde 80€
• Implante: Consultar presupuesto personalizado

📋 Le proporcionaremos un presupuesto detallado tras la primera consulta.
📞 ¿Desea programar una cita para valoración?"""
    
    elif any(word in message_lower for word in ['hola', 'buenos', 'buenas']):
        return """¡Hola! Bienvenido/a a Rubio García Dental 🦷

Soy su asistente virtual. Puedo ayudarle con:
📅 Programar citas
🔴 Urgencias dentales
💰 Información sobre tratamientos
📍 Ubicación y horarios

¿En qué puedo ayudarle hoy?"""
    
    else:
        return """Gracias por contactarnos. 

🦷 Rubio García Dental
📞 664218253
📍 Calle Mayor 19, Alcorcón
🕘 Lunes a Viernes: 9:00-19:00

¿Necesita programar una cita o tiene alguna consulta específica?"""

@api_router.post("/whatsapp/qr-updated")
async def whatsapp_qr_updated(qr_data: Dict[str, str]):
    """Receive QR code updates from WhatsApp service"""
    # This endpoint is called by the WhatsApp service when QR is updated
    return {"status": "received"}

@api_router.post("/whatsapp/connected")
async def whatsapp_connected(connection_data: Dict[str, Any]):
    """Receive connection status from WhatsApp service"""
    # This endpoint is called by the WhatsApp service when connected
    logger.info(f"WhatsApp connected: {connection_data}")
    return {"status": "received"}

# Real Google Sheets Integration Routes
@api_router.get("/google-sheets/test")
async def test_google_sheets_connection(current_user: dict = Depends(get_current_user)):
    from services.real_google_sheets_service import real_google_sheets_service
    return await real_google_sheets_service.test_connection()

@api_router.get("/google-sheets/appointments-real")
async def get_real_google_sheets_appointments(date_filter: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    from services.real_google_sheets_service import real_google_sheets_service
    if date_filter:
        appointments = await real_google_sheets_service.get_appointments_by_date(date_filter)
    else:
        appointments = await real_google_sheets_service.get_all_appointments()
    return appointments

@api_router.post("/google-sheets/sync-real")
async def sync_real_google_sheets(current_user: dict = Depends(get_current_user)):
    from services.real_google_sheets_service import real_google_sheets_service
    result = await real_google_sheets_service.sync_appointments()
    return result

@api_router.post("/google-sheets/appointments-real")
async def create_real_google_sheets_appointment(appointment: AppointmentCreate, current_user: dict = Depends(get_current_user)):
    from services.real_google_sheets_service import real_google_sheets_service
    appointment_dict = appointment.dict()
    result = await real_google_sheets_service.create_appointment(appointment_dict)
    return result

@api_router.put("/google-sheets/appointments-real/{registro}")
async def update_real_google_sheets_appointment(registro: str, appointment: AppointmentCreate, current_user: dict = Depends(get_current_user)):
    from services.real_google_sheets_service import real_google_sheets_service
    appointment_dict = appointment.dict()
    result = await real_google_sheets_service.update_appointment(registro, appointment_dict)
    return result

# Google Sheets Routes
@api_router.get("/google-sheets/appointments")
async def get_google_sheets_appointments(date_filter: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    from services.google_sheets_service import google_sheets_service
    if date_filter:
        appointments = await google_sheets_service.get_appointments_by_date(date_filter)
    else:
        appointments = await google_sheets_service.get_all_appointments()
    return appointments

@api_router.post("/google-sheets/sync")
async def sync_google_sheets(current_user: dict = Depends(get_current_user)):
    from services.google_sheets_service import google_sheets_service
    result = await google_sheets_service.sync_appointments()
    return result

@api_router.post("/google-sheets/appointments")
async def create_google_sheets_appointment(appointment: AppointmentCreate, current_user: dict = Depends(get_current_user)):
    from services.google_sheets_service import google_sheets_service
    appointment_dict = appointment.dict()
    result = await google_sheets_service.create_appointment(appointment_dict)
    return result

@api_router.put("/google-sheets/appointments/{appointment_id}")
async def update_google_sheets_appointment(appointment_id: str, appointment: AppointmentCreate, current_user: dict = Depends(get_current_user)):
    from services.google_sheets_service import google_sheets_service
    appointment_dict = appointment.dict()
    result = await google_sheets_service.update_appointment(appointment_id, appointment_dict)
    return result

# Include router
app.include_router(api_router)

# Mount static files for uploads
uploads_dir = ROOT_DIR / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

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
    await init_default_data()
    scheduler.start()
    logger.info("DenApp Control started successfully")

@app.on_event("shutdown")
async def shutdown_db_client():
    scheduler.shutdown()
    client.close()