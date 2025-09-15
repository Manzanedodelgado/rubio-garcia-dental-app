const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const db = require('../config/database');

class WhatsAppService {
    constructor() {
        this.client = null;
        this.isReady = false;
    }

    initialize() {
        this.client = new Client({
            authStrategy: new LocalAuth({ clientId: "rubio-garcia-dental" }),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });

        this.client.on('qr', (qr) => {
            console.log('🔑 QR Code generado, escanear con WhatsApp:');
            qrcode.generate(qr, { small: true });
            this.qrCode = qr;
        });

        this.client.on('ready', () => {
            console.log('✅ WhatsApp conectado correctamente');
            this.isReady = true;
        });

        this.client.on('message', async (msg) => {
            await this.handleIncomingMessage(msg);
        });

        this.client.on('disconnected', (reason) => {
            console.log('❌ WhatsApp desconectado:', reason);
            this.isReady = false;
            this.initialize(); // Reconectar automáticamente
        });

        this.client.initialize();
    }

    async handleIncomingMessage(msg) {
        const messageText = msg.body.toLowerCase();
        let status = 'green';
        let priority = 'low';

        // Clasificación automática por contenido
        if (messageText.includes('dolor') || /dolor\s+[7-9]|10/.test(messageText)) {
            status = 'red';
            priority = 'high';
        } else if (messageText.includes('cita') || messageText.includes('horario')) {
            status = 'blue';
            priority = 'medium';
        }

        // Guardar en base de datos
        this.saveMessageToDatabase(msg.from, msg.body, status, priority);

        // Respuesta automática para mensajes urgentes
        if (status === 'red') {
            const response = "Hemos recibido su mensaje urgente. Le atenderemos en breve. ⚠️";
            await this.sendMessage(msg.from, response);
        }
    }

    saveMessageToDatabase(phone, content, status, priority) {
        const sql = `INSERT INTO messages (phone_number, content, status, priority) VALUES (?, ?, ?, ?)`;
        db.run(sql, [phone, content, status, priority], (err) => {
            if (err) {
                console.error('Error guardando mensaje:', err);
            } else {
                console.log(`💾 Mensaje guardado: ${phone} - ${status}`);
            }
        });
    }

    async sendMessage(phone, message) {
        if (!this.isReady) {
            throw new Error('WhatsApp no está conectado');
        }
        
        try {
            await this.client.sendMessage(phone, message);
            console.log(`📤 Mensaje enviado a: ${phone}`);
        } catch (error) {
            console.error('Error enviando mensaje:', error);
        }
    }

    getQRCode() {
        return this.qrCode;
    }

    getStatus() {
        return this.isReady ? 'connected' : 'disconnected';
    }
}

module.exports = new WhatsAppService();