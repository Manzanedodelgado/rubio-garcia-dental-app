const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();

// Configuración inicial de BD
const db = new sqlite3.Database('../database/denapp.db');

router.get('/', (req, res) => {
  db.all('SELECT * FROM appointments ORDER BY date, time', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

module.exports = router;