const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./denapp.db');

db.serialize(() => {
    // Crear tablas
    db.run(`CREATE TABLE IF NOT EXISTS users (...)`);
    db.run(`CREATE TABLE IF NOT EXISTS patients (...)`);
    db.run(`CREATE TABLE IF NOT EXISTS appointments (...)`);
    db.run(`CREATE TABLE IF NOT EXISTS messages (...)`);
    
    // Insertar usuario administrador
    db.run(
        `INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)`,
        ['JMD', '190582', 'admin']
    );
});

console.log('✅ Base de datos inicializada correctamente');
db.close();