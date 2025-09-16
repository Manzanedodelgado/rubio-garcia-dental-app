const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const express = require('express')
const cors = require('cors')
const axios = require('axios')
const QRCode = require('qrcode-terminal')

const app = express()
app.use(cors())
app.use(express.json())

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8001'

let sock = null
let qrCode = null
let connectionStatus = 'disconnected'
let qrCodeExpiry = null
let keepaliveInterval = null

function startKeepalive() {
    // Clear any existing keepalive
    if (keepaliveInterval) {
        clearInterval(keepaliveInterval)
    }
    
    // Send keepalive every 30 seconds
    keepaliveInterval = setInterval(async () => {
        if (sock && connectionStatus === 'connected') {
            try {
                // Send a simple presence update to keep connection alive
                await sock.sendPresenceUpdate('available')
                console.log('💓 Keepalive enviado')
            } catch (error) {
                console.log('❌ Error en keepalive:', error.message)
            }
        }
    }, 30000)
}

async function initWhatsApp() {
    try {
        console.log('🚀 Iniciando servicio de WhatsApp...')
        
        const { state, saveCreds } = await useMultiFileAuthState('auth_info')

        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: ['DenApp Control', 'Chrome', '1.0.0'],
            logger: require('pino')({ level: 'silent' })
        })

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update

            if (qr) {
                qrCode = qr
                qrCodeExpiry = Date.now() + 60000 // QR expires in 1 minute
                console.log('📱 Código QR generado')
                QRCode.generate(qr, { small: true })
                
                // Notify FastAPI about new QR
                try {
                    await axios.post(`${FASTAPI_URL}/api/whatsapp/qr-updated`, { qr })
                } catch (error) {
                    console.log('No se pudo notificar QR a FastAPI:', error.message)
                }
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
                console.log('❌ Conexión cerrada:', lastDisconnect?.error, 'Reconectar:', shouldReconnect)
                
                connectionStatus = 'disconnected'
                
                if (shouldReconnect) {
                    console.log('🔄 Reconectando en 5 segundos...')
                    setTimeout(initWhatsApp, 5000)
                } else {
                    console.log('📱 Sesión cerrada. Necesitas escanear QR nuevamente.')
                }
            } else if (connection === 'open') {
                console.log('✅ WhatsApp conectado exitosamente!')
                console.log('📞 Número:', sock.user.id)
                connectionStatus = 'connected'
                qrCode = null
                qrCodeExpiry = null
                
                // Start keepalive to prevent disconnection
                startKeepalive()
                
                // Notify FastAPI about connection
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

        sock.ev.on('creds.update', saveCreds)

        // Clean expired QR codes
        setInterval(() => {
            if (qrCode && qrCodeExpiry && Date.now() > qrCodeExpiry) {
                console.log('⏰ Código QR expirado')
                qrCode = null
                qrCodeExpiry = null
            }
        }, 10000)

    } catch (error) {
        console.error('❌ Error inicializando WhatsApp:', error)
        connectionStatus = 'error'
        setTimeout(initWhatsApp, 10000)
    }
}

async function handleIncomingMessage(message) {
    try {
        const phoneNumber = message.key.remoteJid.replace('@s.whatsapp.net', '')
        const messageText = message.message.conversation ||
                           message.message.extendedTextMessage?.text || 
                           message.message.imageMessage?.caption ||
                           ''

        if (!messageText) return

        console.log(`📨 Mensaje de ${phoneNumber}: ${messageText}`)

        // Get contact name if available
        let contactName = phoneNumber
        try {
            const contact = await sock.onWhatsApp(phoneNumber)
            if (contact && contact[0] && contact[0].name) {
                contactName = contact[0].name
            }
        } catch (error) {
            // Use phone number as fallback
        }

        // Forward message to FastAPI for processing
        try {
            const response = await axios.post(`${FASTAPI_URL}/api/whatsapp/message-received`, {
                phone_number: phoneNumber,
                contact_name: contactName,
                message: messageText,
                message_id: message.key.id,
                timestamp: message.messageTimestamp || Math.floor(Date.now() / 1000)
            })

            // Send response back to WhatsApp if FastAPI returns one
            if (response.data && response.data.reply) {
                await sendMessage(phoneNumber, response.data.reply)
            }
        } catch (error) {
            console.error('❌ Error enviando mensaje a FastAPI:', error.message)
            
            // Send generic error response
            await sendMessage(phoneNumber, 
                'Disculpe, estamos experimentando problemas técnicos. ' +
                'Por favor, contacte directamente con la clínica al 664218253.'
            )
        }

    } catch (error) {
        console.error('❌ Error procesando mensaje entrante:', error)
    }
}

async function sendMessage(phoneNumber, text, options = {}) {
    try {
        if (!sock || connectionStatus !== 'connected') {
            throw new Error('WhatsApp no está conectado')
        }

        const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`
        
        // Send typing indicator
        await sock.sendPresenceUpdate('composing', jid)
        
        // Small delay to simulate typing
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        await sock.sendMessage(jid, { text })
        
        console.log(`📤 Mensaje enviado a ${phoneNumber}: ${text.substring(0, 50)}...`)
        
        return { success: true }

    } catch (error) {
        console.error('❌ Error enviando mensaje:', error)
        return { success: false, error: error.message }
    }
}

// REST API endpoints
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
    res.json({ 
        qr: qrCode,
        expires_at: qrCodeExpiry,
        status: connectionStatus
    })
})

app.post('/send', async (req, res) => {
    try {
        const { phone_number, message } = req.body
        
        if (!phone_number || !message) {
            return res.status(400).json({ 
                success: false, 
                error: 'phone_number and message are required' 
            })
        }

        const result = await sendMessage(phone_number, message)
        res.json(result)
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        })
    }
})

app.post('/send-bulk', async (req, res) => {
    try {
        const { recipients, message } = req.body
        
        if (!recipients || !Array.isArray(recipients) || !message) {
            return res.status(400).json({ 
                success: false, 
                error: 'recipients (array) and message are required' 
            })
        }

        const results = []
        
        for (const recipient of recipients) {
            const result = await sendMessage(recipient.phone_number, message)
            results.push({
                phone_number: recipient.phone_number,
                ...result
            })
            
            // Small delay between messages to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000))
        }

        const successCount = results.filter(r => r.success).length
        
        res.json({
            success: true,
            total: recipients.length,
            sent: successCount,
            failed: recipients.length - successCount,
            results
        })
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        })
    }
})

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        service: 'whatsapp-baileys',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        whatsapp_status: connectionStatus
    })
})

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Cerrando servicio de WhatsApp...')
    if (sock) {
        await sock.logout()
    }
    process.exit(0)
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
    console.log(`🚀 Servicio WhatsApp iniciado en puerto ${PORT}`)
    console.log(`📡 FastAPI URL: ${FASTAPI_URL}`)
    initWhatsApp()
})