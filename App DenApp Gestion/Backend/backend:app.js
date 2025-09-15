const express = require('express');
const cors = require('cors');
const path = require('path');
const { scheduleBackup } = require('./utils/backup');
const { authenticateToken } = require('./middleware/auth');

// Importar rutas
const authRoutes = require('./routes/auth');
const appointmentRoutes = require('./routes/appointments');
const patientRoutes = require('./routes/patients');
const whatsappRoutes = require('./routes/whatsapp');
const automationRoutes = require('./routes/automations');
const templateRoutes = require('./routes/templates');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Rutas públicas
app.use('/api/auth', authRoutes);

// Rutas protegidas
app.use('/api/appointments', authenticateToken, appointmentRoutes);
app.use('/api/patients', authenticateToken, patientRoutes);
app.use('/api/whatsapp', authenticateToken, whatsappRoutes);
app.use('/api/automations', authenticateToken, automationRoutes);
app.use('/api/templates', authenticateToken, templateRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Servir React app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

// Inicializar servicios
const initServices = async () => {
    // Iniciar backup automático
    scheduleBackup();
    
    // Iniciar WhatsApp
    const whatsappService = require('./services/whatsapp-service');
    whatsappService.initialize();
    
    // Iniciar Google Sheets sync
    const sheetsService = require('./services/google-sheets-service');
    sheetsService.syncAppointmentsToDB();
    
    console.log('✅ Todos los servicios inicializados');
};

app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    initServices();
});