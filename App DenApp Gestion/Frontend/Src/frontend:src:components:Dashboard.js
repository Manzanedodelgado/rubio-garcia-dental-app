import React, { useState, useEffect } from 'react';
import './Dashboard.css';

const Dashboard = () => {
    const [appointments, setAppointments] = useState([]);
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        fetchAppointments();
        fetchMessages();
    }, []);

    const fetchAppointments = async () => {
        // Lógica para obtener citas del día
        const todayAppointments = [
            { id: 1, time: '10:00', patient: 'María López', treatment: 'Limpieza', status: 'confirmada' },
            { id: 2, time: '11:30', patient: 'Juan Pérez', treatment: 'Ortodoncia', status: 'pendiente' }
        ];
        setAppointments(todayAppointments);
    };

    const fetchMessages = async () => {
        // Lógica para obtener mensajes
        const urgentMessages = [
            { id: 1, patient: 'Ana García', time: '09:45', message: 'Tengo mucho dolor nivel 8', status: 'red' },
            { id: 2, patient: 'Carlos Ruiz', time: '10:20', message: '¿Podría cambiar mi cita?', status: 'blue' }
        ];
        setMessages(urgentMessages);
    };

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <h1>Panel de Control - Rubio García Dental</h1>
            </header>
            
            <div className="dashboard-grid">
                {/* Widget Mensajes Urgentes */}
                <div className="widget urgent-messages">
                    <h2>📩 Mensajes Urgentes</h2>
                    {messages.filter(m => m.status === 'red').map(msg => (
                        <div key={msg.id} className="message-card red">
                            <strong>{msg.patient}</strong> - {msg.time}
                            <p>{msg.message}</p>
                        </div>
                    ))}
                </div>

                {/* Widget Citas Hoy */}
                <div className="widget today-appointments">
                    <h2>📅 Citas Hoy</h2>
                    {appointments.map(apt => (
                        <div key={apt.id} className="appointment-card">
                            <span className="time">{apt.time}</span>
                            <span className="patient">{apt.patient}</span>
                            <span className="treatment">{apt.treatment}</span>
                            <span className={`status ${apt.status}`}>{apt.status}</span>
                        </div>
                    ))}
                </div>

                {/* Widget Estadísticas */}
                <div className="widget stats">
                    <h2>📊 Estadísticas</h2>
                    <div className="stat-item">
                        <span>Citas Confirmadas:</span>
                        <strong>75%</strong>
                    </div>
                    <div className="stat-item">
                        <span>Mensajes Pendientes:</span>
                        <strong>3</strong>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;