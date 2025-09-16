const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const axios = require('axios')

const app = express()
app.use(cors())
app.use(express.json())

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8001'

let sock = null
let qrCode = null
let connectionStatus = 'disconnected'
let qrCodeExpiry = null

async function initWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('./auth_info')
        
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: ['DenApp Control', 'Chrome', '1.0.0'],
            logger: require('pino')({ level: 'silent' })
        })

        sock.ev.on('creds.update', saveCreds)

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update

            if (qr) {
                console.log('📱 Código QR generado')
                qrCode = qr
                qrCodeExpiry = Date.now() + (2 * 60 * 1000)
                connectionStatus = 'connecting'
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error?.output?.statusCode) !== 401
                console.log('❌ Conexión cerrada, reconectando...', shouldReconnect)
                connectionStatus = 'disconnected'
                qrCode = null
                qrCodeExpiry = null
                
                if (shouldReconnect) {
                    console.log('🔄 Reconectando en 5 segundos...')
                    setTimeout(initWhatsApp, 5000)
                }
            } else if (connection === 'open') {
                console.log('✅ WhatsApp conectado exitosamente!')
                console.log('📞 Número:', sock.user.id)
                connectionStatus = 'connected'
                qrCode = null
                qrCodeExpiry = null
                
                try {
                    await axios.post(`${FASTAPI_URL}/api/whatsapp/connected`, {
                        user: sock.user,
                        phone: sock.user.id.split(':')[0]
                    })
                } catch (error) {
                    console.log('No se pudo notificar conexión a FastAPI:', error.message)
                }
            } else if (connection === 'connecting') {
                console.log('🔄 Conectando a WhatsApp...')
                connectionStatus = 'connecting'
            }
        })

        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type === 'notify') {
                for (const message of messages) {
                    if (!message.key.fromMe && message.message) {
                        await handleIncomingMessage(message)
                    }
                }
            }
        })

    } catch (error) {
        console.error('❌ Error inicializando WhatsApp:', error)
        setTimeout(initWhatsApp, 10000)
    }
}

async function handleIncomingMessage(message) {
    try {
        const phoneNumber = message.key.remoteJid.replace('@s.whatsapp.net', '')
        const messageText = message.message?.conversation || 
                          message.message?.extendedTextMessage?.text || 
                          'Mensaje multimedia'

        console.log(`📥 Mensaje recibido de ${phoneNumber}: ${messageText}`)

        const response = await axios.post(`${FASTAPI_URL}/api/whatsapp/message-received`, {
            phone_number: phoneNumber,
            contact_name: phoneNumber,
            message: messageText,
            message_id: message.key.id,
            timestamp: message.messageTimestamp
        })

        if (response.data.reply) {
            await sock.sendMessage(message.key.remoteJid, { text: response.data.reply })
            console.log(`📤 Respuesta automática enviada a ${phoneNumber}`)
        }

    } catch (error) {
        console.error('❌ Error procesando mensaje:', error.message)
    }
}

// API Routes
app.get('/status', (req, res) => {
    res.json({
        status: connectionStatus,
        connected: connectionStatus === 'connected',
        user: sock?.user || null,
        phone: sock?.user?.id?.split(':')[0] || null,
        timestamp: new Date().toISOString()
    })
})

app.get('/qr', (req, res) => {
    if (qrCode) {
        res.json({
            qr: qrCode,
            expires_at: qrCodeExpiry,
            status: connectionStatus
        })
    } else {
        res.json({
            qr: null,
            expires_at: null,
            status: connectionStatus
        })
    }
})

app.post('/send', async (req, res) => {
    try {
        const { phone_number, message } = req.body
        
        if (!sock || connectionStatus !== 'connected') {
            return res.status(400).json({ error: 'WhatsApp no está conectado' })
        }

        const jid = phone_number.includes('@') ? phone_number : `${phone_number}@s.whatsapp.net`
        await sock.sendMessage(jid, { text: message })
        
        console.log(`📤 Mensaje enviado a ${phone_number}: ${message}`)
        res.json({ success: true })

    } catch (error) {
        console.error('❌ Error enviando mensaje:', error)
        res.status(500).json({ error: error.message })
    }
})

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        whatsapp_status: connectionStatus,
        uptime: process.uptime()
    })
})

// Start server
const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
    console.log(`🚀 Servicio WhatsApp iniciado en puerto ${PORT}`)
    console.log(`📡 FastAPI URL: ${FASTAPI_URL}`)
    initWhatsApp()
})

process.on('SIGINT', async () => {
    console.log('🛑 Cerrando servicio de WhatsApp...')
    if (sock) {
        await sock.logout()
    }
    process.exit(0)
})
