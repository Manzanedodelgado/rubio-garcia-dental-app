const express = require('express');
const router = express.Router();

// Usuarios hardcodeados (temporal)
const users = [
  { username: 'JMD', password: '190582', role: 'admin', permissions: 'all' },
  { username: 'MGarcia', password: 'clinic2024', role: 'editor', permissions: 'agenda,pacientes,whatsapp,recordatorios' }
];

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);

  if (user) {
    res.json({
      success: true,
      token: 'temp-jwt-token',
      user: {
        username: user.username,
        role: user.role,
        permissions: user.permissions
      }
    });
  } else {
    res.status(401).json({ success: false, message: 'Credenciales inválidas' });
  }
});

module.exports = router;