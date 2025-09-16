import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';

// Import Lucide React icons
import { 
  BarChart3, Calendar, Users, MessageCircle, Send, FileText, 
  Settings, Bot, Bell, Home, X, Menu, Plus, Edit, Trash2,
  Phone, Mail, Search, Filter, Upload, Download, Eye,
  Clock, CheckCircle, AlertCircle, User, LogOut, Zap
} from 'lucide-react';

// Context for authentication
const AuthContext = createContext();

// API Configuration
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Configure axios interceptor for token
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Utility function for date formatting
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('es-ES');
};

const formatTime = (timeString) => {
  return timeString.slice(0, 5); // HH:MM format
};

// Login Component
const Login = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API}/auth/login`, credentials);
      const { token, role, username, permissions } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('currentUser', username); // Store for WhatsApp connection persistence
      login({ username, role, token, permissions });
    } catch (error) {
      setError('Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md border border-gray-100">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <div className="text-white text-3xl font-bold">D</div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">DenApp Control</h1>
          <p className="text-gray-600">Rubio García Dental</p>
          <div className="w-16 h-1 bg-blue-600 mx-auto mt-4 rounded-full"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Usuario</label>
            <input
              type="text"
              value={credentials.username}
              onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white"
              placeholder="Ingresa tu usuario"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Contraseña</label>
            <input
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white"
              placeholder="Ingresa tu contraseña"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Iniciando sesión...
              </div>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            Sistema de gestión dental
          </p>
          <p className="text-xs text-gray-400 mt-1">
            v1.0.0 - Rubio García Dental
          </p>
        </div>
      </div>
    </div>
  );
};

// Dashboard Component
const Dashboard = () => {
  const [stats, setStats] = useState({});
  const [appointmentStats, setAppointmentStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsResponse, appointmentStatsResponse] = await Promise.all([
          axios.get(`${API}/dashboard/stats`),
          axios.get(`${API}/dashboard/appointment-stats`)
        ]);
        setStats(statsResponse.data);
        setAppointmentStats(appointmentStatsResponse.data);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded-xl"></div>
            <div className="h-64 bg-gray-200 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, color, trend }) => (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {trend && (
            <p className={`text-sm mt-1 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend > 0 ? '+' : ''}{trend}% vs ayer
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Panel de Control</h1>
          <p className="text-gray-600 mt-1">Resumen de la actividad de hoy</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Última actualización</p>
          <p className="text-sm font-medium text-gray-900">{new Date().toLocaleTimeString('es-ES')}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Citas Hoy"
          value={stats.today_appointments || 0}
          icon={Calendar}
          color="bg-gradient-to-br from-blue-500 to-blue-600"
        />
        <StatCard
          title="Mensajes Pendientes"
          value={stats.pending_messages || 0}
          icon={MessageCircle}
          color="bg-gradient-to-br from-orange-500 to-orange-600"
        />
        <StatCard
          title="Total Pacientes"
          value={stats.total_patients || 0}
          icon={Users}
          color="bg-gradient-to-br from-green-500 to-green-600"
        />
        <StatCard
          title="% Confirmadas"
          value={`${stats.confirmation_rate || 0}%`}
          icon={CheckCircle}
          color="bg-gradient-to-br from-purple-500 to-purple-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Appointments */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-blue-600" />
            Citas de Hoy
          </h2>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {stats.recent_appointments?.length > 0 ? (
              stats.recent_appointments.map((appointment, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div>
                      <p className="font-medium text-gray-900">{appointment.nombre} {appointment.apellidos}</p>
                      <p className="text-sm text-gray-600">{appointment.tratamiento}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{formatTime(appointment.hora)}</p>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      appointment.estado_cita === 'CONFIRMADA' ? 'bg-green-100 text-green-800' :
                      appointment.estado_cita === 'PROGRAMADA' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {appointment.estado_cita}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">No hay citas programadas para hoy</p>
            )}
          </div>
        </div>

        {/* Urgent Messages */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 text-red-600" />
            Mensajes Urgentes
          </h2>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {stats.urgent_messages?.length > 0 ? (
              stats.urgent_messages.map((message, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg border border-red-100">
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{message.contact_name}</p>
                    <p className="text-sm text-gray-700 mt-1">{message.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(message.timestamp).toLocaleTimeString('es-ES')}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <span className="inline-block w-3 h-3 bg-red-500 rounded-full"></span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">No hay mensajes urgentes</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Zap className="w-5 h-5 mr-2 text-blue-600" />
          Acciones Rápidas
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="flex items-center justify-center p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors border border-blue-200">
            <Plus className="w-5 h-5 text-blue-600 mr-2" />
            <span className="text-blue-700 font-medium">Nueva Cita</span>
          </button>
          <button className="flex items-center justify-center p-4 bg-green-50 hover:bg-green-100 rounded-xl transition-colors border border-green-200">
            <MessageCircle className="w-5 h-5 text-green-600 mr-2" />
            <span className="text-green-700 font-medium">Enviar Mensaje</span>
          </button>
          <button className="flex items-center justify-center p-4 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors border border-purple-200">
            <Users className="w-5 h-5 text-purple-600 mr-2" />
            <span className="text-purple-700 font-medium">Nuevo Paciente</span>
          </button>
          <button className="flex items-center justify-center p-4 bg-orange-50 hover:bg-orange-100 rounded-xl transition-colors border border-orange-200">
            <Send className="w-5 h-5 text-orange-600 mr-2" />
            <span className="text-orange-700 font-medium">Recordatorio</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Patients Component
const Patients = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    nombre: '',
    apellidos: '',
    tel_movil: '',
    email: '',
    notas: ''
  });

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const response = await axios.get(`${API}/patients`);
      setPatients(response.data);
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPatient) {
        await axios.put(`${API}/patients/${editingPatient.id}`, formData);
      } else {
        await axios.post(`${API}/patients`, formData);
      }
      fetchPatients();
      setShowForm(false);
      setEditingPatient(null);
      setFormData({ nombre: '', apellidos: '', tel_movil: '', email: '', notas: '' });
    } catch (error) {
      console.error('Error saving patient:', error);
    }
  };

  const handleEdit = (patient) => {
    setEditingPatient(patient);
    setFormData({
      nombre: patient.nombre,
      apellidos: patient.apellidos,
      tel_movil: patient.tel_movil,
      email: patient.email || '',
      notas: patient.notas || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (patientId) => {
    if (window.confirm('¿Está seguro de eliminar este paciente?')) {
      try {
        await axios.delete(`${API}/patients/${patientId}`);
        fetchPatients();
      } catch (error) {
        console.error('Error deleting patient:', error);
      }
    }
  };

  const handleImportCSV = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(`${API}/patients/import-csv`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchPatients();
      alert('Pacientes importados exitosamente');
    } catch (error) {
      console.error('Error importing CSV:', error);
      alert('Error al importar el archivo CSV');
    }
    
    event.target.value = '';
  };

  const filteredPatients = patients.filter(patient =>
    patient.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.apellidos.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.tel_movil.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pacientes</h1>
          <p className="text-gray-600 mt-1">Gestión de pacientes registrados</p>
        </div>
        <div className="flex space-x-3">
          <label className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-medium transition-colors cursor-pointer flex items-center">
            <Upload className="w-4 h-4 mr-2" />
            Importar CSV
            <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
          </label>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium transition-colors flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Paciente
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar pacientes por nombre, apellidos o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </button>
        </div>
      </div>

      {/* Patient Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-90vh overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingPatient ? 'Editar Paciente' : 'Nuevo Paciente'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingPatient(null);
                  setFormData({ nombre: '', apellidos: '', tel_movil: '', email: '', notas: '' });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos *</label>
                <input
                  type="text"
                  value={formData.apellidos}
                  onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono *</label>
                <input
                  type="tel"
                  value={formData.tel_movil}
                  onChange={(e) => setFormData({ ...formData, tel_movil: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows="3"
                />
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors"
                >
                  {editingPatient ? 'Actualizar' : 'Crear'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingPatient(null);
                    setFormData({ nombre: '', apellidos: '', tel_movil: '', email: '', notas: '' });
                  }}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patients List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paciente</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Alta</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origen</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPatients.map((patient) => (
                <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold mr-3">
                        {patient.nombre.charAt(0)}{patient.apellidos.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{patient.nombre} {patient.apellidos}</p>
                        <p className="text-sm text-gray-500">{patient.num_pac}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center text-sm text-gray-900">
                        <Phone className="w-4 h-4 mr-2 text-gray-400" />
                        {patient.tel_movil}
                      </div>
                      {patient.email && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Mail className="w-4 h-4 mr-2 text-gray-400" />
                          {patient.email}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatDate(patient.fecha_alta)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      patient.source === 'agenda' ? 'bg-blue-100 text-blue-800' :
                      patient.source === 'whatsapp' ? 'bg-green-100 text-green-800' :
                      patient.source === 'csv' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {patient.source === 'agenda' ? 'Agenda' :
                       patient.source === 'whatsapp' ? 'WhatsApp' :
                       patient.source === 'csv' ? 'CSV' : 'Manual'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(patient)}
                        className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(patient.id)}
                        className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPatients.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    {searchTerm ? 'No se encontraron pacientes con esos criterios' : 'No hay pacientes registrados'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{patients.length}</p>
            <p className="text-sm text-gray-600">Total Pacientes</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {patients.filter(p => p.source === 'whatsapp').length}
            </p>
            <p className="text-sm text-gray-600">Desde WhatsApp</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">
              {patients.filter(p => p.source === 'agenda').length}
            </p>
            <p className="text-sm text-gray-600">Desde Agenda</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Import all modules
import AgendaModule from './components/AgendaModule';
import WhatsAppModuleSimple from './components/WhatsAppModuleSimple';
import RecordatoriosModule from './components/RecordatoriosModule';
import PlantillasModule from './components/PlantillasModule';
import AutomatizacionesModule from './components/AutomatizacionesModule';
import EntrenamientoIAModule from './components/EntrenamientoIAModule';
import ConfiguracionModule from './components/ConfiguracionModule';

// Components for all modules
const Agenda = () => <AgendaModule />;
const WhatsApp = () => <WhatsAppModule />;
const Recordatorios = () => <RecordatoriosModule />;
const Plantillas = () => <PlantillasModule />;
const Automatizaciones = () => <AutomatizacionesModule />;
const EntrenamientoIA = () => <EntrenamientoIAModule />;
const Configuracion = () => <ConfiguracionModule />;

// Sidebar Component
const Sidebar = ({ currentView, setCurrentView, user, isOpen, setIsOpen }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Panel', icon: Home, color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200' },
    { id: 'agenda', label: 'Agenda', icon: Calendar, color: 'text-green-600', bgColor: 'bg-green-50 border-green-200' },
    { id: 'pacientes', label: 'Pacientes', icon: Users, color: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-200' },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'text-green-600', bgColor: 'bg-green-50 border-green-200' },
    { id: 'recordatorios', label: 'Recordatorios', icon: Send, color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200' },
    { id: 'plantillas', label: 'Plantillas', icon: FileText, color: 'text-pink-600', bgColor: 'bg-pink-50 border-pink-200' },
    { id: 'automatizaciones', label: 'Automatizaciones', icon: Settings, color: 'text-indigo-600', bgColor: 'bg-indigo-50 border-indigo-200' },
    { id: 'entrenamiento-ia', label: 'Entrenamiento IA', icon: Bot, color: 'text-cyan-600', bgColor: 'bg-cyan-50 border-cyan-200' },
    { id: 'configuracion', label: 'Configuración', icon: Settings, color: 'text-gray-600', bgColor: 'bg-gray-50 border-gray-200' },
  ];

  // Filter menu items based on user permissions (for future implementation)
  const filteredMenuItems = menuItems;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full w-72 bg-white shadow-xl border-r border-gray-200 z-50 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                  <div className="text-white text-lg font-bold">D</div>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">DenApp</h1>
                  <p className="text-xs text-gray-600">Control</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="md:hidden text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentView(item.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 text-left ${
                    isActive
                      ? `${item.bgColor} ${item.color} border font-medium shadow-sm`
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-8 h-8 bg-gradient-to-br from-gray-500 to-gray-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {user?.username?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.username}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// Main App Component
const MainApp = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useContext(AuthContext);

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'pacientes':
        return <Patients />;
      case 'agenda':
        return <Agenda />;
      case 'whatsapp':
        return <WhatsApp />;
      case 'recordatorios':
        return <Recordatorios />;
      case 'plantillas':
        return <Plantillas />;
      case 'automatizaciones':
        return <Automatizaciones />;
      case 'entrenamiento-ia':
        return <EntrenamientoIA />;
      case 'configuracion':
        return <Configuracion />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        user={user}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
      />
      
      <div className="flex-1 md:ml-72 overflow-auto">
        {/* Top Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 sticky top-0 z-30">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden text-gray-600 hover:text-gray-900"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Rubio García Dental
                </h2>
                <p className="text-sm text-gray-600">Sistema de Gestión Dental</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                <span>{new Date().toLocaleTimeString('es-ES', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}</span>
              </div>
              
              <button
                onClick={logout}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="min-h-screen">
          {renderCurrentView()}
        </main>
      </div>
    </div>
  );
};

// Auth Provider
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.get(`${API}/auth/me`)
        .then(response => {
          setUser({ ...response.data, token });
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = (userData) => {
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando DenApp Control...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Main App
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthContext.Consumer>
          {({ user }) => (
            <Routes>
              <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
              <Route path="/*" element={user ? <MainApp /> : <Navigate to="/login" />} />
            </Routes>
          )}
        </AuthContext.Consumer>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;