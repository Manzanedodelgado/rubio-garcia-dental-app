const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const router = express.Router();

let whatsappClient = null;

router.get('/start', (req, res) => {
    if (whatsappClient) {
        return res.json({ status: 'already_running' });
    }

    whatsappClient = new Client({
        authStrategy: new LocalAuth({
            clientId: "rubio-garcia-dental"
        }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    whatsappClient.on('qr', (qr) => {
        console.log('🔑 QR recibido, escanear con WhatsApp:');
        qrcode.generate(qr, { small: true });
        // Enviar QR al frontend (implementar WebSocket para esto)
    });

    whatsappClient.on('ready', () => {
        console.log('✅ WhatsApp conectado correctamente');
    });

    whatsappClient.on('message', async (msg) => {
        // Clasificación automática de mensajes
        const messageText = msg.body.toLowerCase();
        let status = 'green'; // Consulta resuelta por defecto
        
        if (messageText.includes('dolor') || /dolor\s+[7-9]|10/.test(messageText)) {
            status = 'red'; // Urgente
        } else if (messageText.includes('cita') || messageText.includes('horario')) {
            status = 'blue'; // Pendiente cita
        }

        // Guardar en base de datos
        saveMessageToDB(msg.from, msg.body, status);
    });

    whatsappClient.initialize();
    res.json({ status: 'initializing', message: 'Cliente WhatsApp iniciado' });
});

function saveMessageToDB(phone, content, status) {
    // Implementar guardado en SQLite
    console.log(`💾 Guardando mensaje: ${phone} - ${status} - ${content}`);
}

module.exports = router;