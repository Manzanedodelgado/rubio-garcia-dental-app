const { GoogleSpreadsheet } = require('google-spreadsheet');
const creds = require('./credentials.json');

const doc = new GoogleSpreadsheet('1_jmn0CaFs2URz4kTKL_0ji3cSt8dr522-gVbXCIkXtw');

async function syncWithGoogleSheets() {
    try {
        await doc.useServiceAccountAuth(creds);
        await doc.loadInfo();
        
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();
        
        // Sincronizar con base de datos local
        rows.forEach(row => {
            const appointmentData = {
                fecha: row.Fecha,
                hora: row.Hora,
                paciente: `${row.Nombre} ${row.Apellidos}`,
                telefono: row.TelMovil,
                tratamiento: row.Tratamiento,
                estado: row.EstadoCita,
                odontologo: row.Odontologo
            };
            saveAppointmentToDB(appointmentData);
        });
        
        console.log('🔄 Sincronización con Google Sheets completada');
    } catch (error) {
        console.error('❌ Error sincronizando con Google Sheets:', error);
    }
}

// Sincronizar cada 5 minutos
setInterval(syncWithGoogleSheets, 5 * 60 * 1000);