const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Obtener todos los pacientes
router.get('/', (req, res) => {
    const sql = `SELECT * FROM patients ORDER BY last_name, first_name`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Crear nuevo paciente
router.post('/', (req, res) => {
    const { first_name, last_name, phone, email } = req.body;
    const sql = `INSERT INTO patients (first_name, last_name, phone, email) VALUES (?, ?, ?, ?)`;
    
    db.run(sql, [first_name, last_name, phone, email], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, message: 'Paciente creado correctamente' });
    });
});

// Importar pacientes desde CSV
router.post('/import-csv', (req, res) => {
    // Lógica para importar desde CSV
    res.json({ message: 'Importación CSV en desarrollo' });
});

module.exports = router;