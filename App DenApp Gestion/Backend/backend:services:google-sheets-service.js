const { GoogleSpreadsheet } = require('google-spreadsheet');
const db = require('../config/database');

class GoogleSheetsService {
    constructor() {
        this.doc = new GoogleSpreadsheet('1_jmn0CaFs2URz4kTKL_0ji3cSt8dr522-gVbXCIkXtw');
        this.initialized = false;
    }

    async initialize() {
        try {
            // Autenticación con servicio account (archivo credentials.json)
            await this.doc.useServiceAccountAuth(require('../credentials.json'));
            await this.doc.loadInfo();
            this.initialized = true;
            console.log('✅ Google Sheets inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando Google Sheets:', error);
        }
    }

    async syncAppointmentsToDB() {
        if (!this.initialized) await this.initialize();

        try {
            const sheet = this.doc.sheetsByIndex[0]; // Hoja 1
            const rows = await sheet.getRows();
            
            console.log(`🔄 Sincronizando ${rows.length} citas...`);

            for (const row of rows) {
                await this.saveOrUpdateAppointment(row);
            }

            console.log('✅ Sincronización completada');
        } catch (error) {
            console.error('❌ Error sincronizando citas:', error);
        }
    }

    async saveOrUpdateAppointment(row) {
        const sql = `
            INSERT OR REPLACE INTO appointments 
            (id, date, time, patient_name, phone, treatment, status, odontologo, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const appointmentData = [
            row.Registro,
            row.Fecha,
            row.Hora,
            `${row.Nombre} ${row.Apellidos}`,
            row.TelMovil,
            row.Tratamiento,
            row.EstadoCita,
            row.Odontologo,
            row.Notas
        ];

        return new Promise((resolve, reject) => {
            db.run(sql, appointmentData, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async updateAppointmentStatus(appointmentId, newStatus) {
        if (!this.initialized) await this.initialize();

        try {
            const sheet = this.doc.sheetsByIndex[0];
            const rows = await sheet.getRows();
            
            const row = rows.find(r => r.Registro === appointmentId.toString());
            if (row) {
                row.EstadoCita = newStatus;
                await row.save();
                console.log(`✅ Estado actualizado en Sheets: ${appointmentId} -> ${newStatus}`);
            }
        } catch (error) {
            console.error('❌ Error actualizando Sheets:', error);
        }
    }
}

// Sincronizar cada 5 minutos
const sheetsService = new GoogleSheetsService();
setInterval(() => sheetsService.syncAppointmentsToDB(), 5 * 60 * 1000);

module.exports = sheetsService;