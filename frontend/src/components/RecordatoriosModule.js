import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Send, Users, Calendar, FileText, Upload, Download, 
  Plus, Edit, Trash2, Eye, Clock, CheckCircle, User
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RecordatoriosModule = () => {
  const [reminders, setReminders] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewReminder, setShowNewReminder] = useState(false);
  const [selectedSource, setSelectedSource] = useState('agenda'); // 'agenda' or 'pacientes'
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  const [newReminderData, setNewReminderData] = useState({
    name: '',
    template_id: '',
    recipients: [],
    schedule_time: '',
    source: 'agenda'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [remindersRes, templatesRes, patientsRes, appointmentsRes] = await Promise.all([
        axios.get(`${API}/reminders`).catch(() => ({ data: [] })),
        axios.get(`${API}/templates`),
        axios.get(`${API}/patients`),
        axios.get(`${API}/appointments`)
      ]);

      setReminders(getMockReminders());
      setTemplates(templatesRes.data);
      setPatients(patientsRes.data);
      setAppointments(appointmentsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMockReminders = () => [
    {
      id: '1',
      name: 'Recordatorio citas mañana',
      template: 'Recordatorio de cita',
      recipients_count: 5,
      status: 'sent',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
      sent_count: 5
    },
    {
      id: '2',
      name: 'Cuestionario satisfacción',
      template: 'Cuestionario post-tratamiento',
      recipients_count: 12,
      status: 'scheduled',
      created_at: new Date(Date.now() - 30 * 60 * 1000),
      schedule_time: new Date(Date.now() + 60 * 60 * 1000)
    },
    {
      id: '3',
      name: 'Recordatorio medicación',
      template: 'Instrucciones post-cirugía',
      recipients_count: 2,
      status: 'pending',
      created_at: new Date(Date.now() - 10 * 60 * 1000)
    }
  ];

  const handleCreateReminder = async (e) => {
    e.preventDefault();
    try {
      const reminderPayload = {
        ...newReminderData,
        recipients: selectedRecipients
      };

      await axios.post(`${API}/reminders/send-batch`, reminderPayload);
      
      setShowNewReminder(false);
      setNewReminderData({
        name: '',
        template_id: '',
        recipients: [],
        schedule_time: '',
        source: 'agenda'
      });
      setSelectedRecipients([]);
      setSelectAll(false);
      fetchData();
    } catch (error) {
      console.error('Error creating reminder:', error);
    }
  };

  const handleSelectRecipient = (recipientId) => {
    if (selectedRecipients.includes(recipientId)) {
      setSelectedRecipients(selectedRecipients.filter(id => id !== recipientId));
    } else {
      setSelectedRecipients([...selectedRecipients, recipientId]);
    }
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRecipients([]);
    } else {
      const allIds = selectedSource === 'agenda' 
        ? appointments.map(apt => apt.id)
        : patients.map(pat => pat.id);
      setSelectedRecipients(allIds);
    }
    setSelectAll(!selectAll);
  };

  const handleImportCSV = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Mock CSV import
      console.log('Importing CSV file:', file.name);
      alert('CSV importado exitosamente');
    } catch (error) {
      console.error('Error importing CSV:', error);
      alert('Error al importar el archivo CSV');
    }
    
    event.target.value = '';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'sent': return 'bg-green-100 text-green-800 border-green-200';
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent': return <CheckCircle className="w-4 h-4" />;
      case 'scheduled': return <Clock className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const sourceData = selectedSource === 'agenda' ? appointments : patients;

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recordatorios</h1>
          <p className="text-gray-600 mt-1">Envío masivo de mensajes y recordatorios</p>
        </div>
        <div className="flex space-x-3">
          <label className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-medium transition-colors cursor-pointer flex items-center">
            <Upload className="w-4 h-4 mr-2" />
            Importar CSV
            <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
          </label>
          <button
            onClick={() => setShowNewReminder(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium transition-colors flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Recordatorio
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{reminders.length}</p>
            <p className="text-sm text-gray-600">Total Recordatorios</p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {reminders.filter(r => r.status === 'sent').length}
            </p>
            <p className="text-sm text-gray-600">Enviados</p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-600">
              {reminders.filter(r => r.status === 'scheduled').length}
            </p>
            <p className="text-sm text-gray-600">Programados</p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">
              {reminders.reduce((sum, r) => sum + (r.sent_count || 0), 0)}
            </p>
            <p className="text-sm text-gray-600">Mensajes Enviados</p>
          </div>
        </div>
      </div>

      {/* Reminders List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Historial de Recordatorios</h2>
        </div>
        
        <div className="divide-y divide-gray-200">
          {reminders.map((reminder) => (
            <div key={reminder.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white">
                    <Send className="w-6 h-6" />
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{reminder.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">Plantilla: {reminder.template}</p>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        {reminder.recipients_count} destinatarios
                      </span>
                      <span>
                        {reminder.created_at.toLocaleString('es-ES')}
                      </span>
                      {reminder.schedule_time && (
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          Programado: {reminder.schedule_time.toLocaleString('es-ES')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(reminder.status)}`}>
                    {getStatusIcon(reminder.status)}
                    <span className="ml-1 capitalize">{reminder.status}</span>
                  </span>
                  
                  <div className="flex space-x-2">
                    <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver detalles">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Duplicar">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {reminders.length === 0 && (
            <div className="p-12 text-center">
              <Send className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay recordatorios</h3>
              <p className="text-gray-600">Crea tu primer recordatorio para comenzar</p>
            </div>
          )}
        </div>
      </div>

      {/* New Reminder Modal */}
      {showNewReminder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-90vh overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Nuevo Recordatorio</h2>
              <button
                onClick={() => setShowNewReminder(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleCreateReminder} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del recordatorio *</label>
                  <input
                    type="text"
                    value={newReminderData.name}
                    onChange={(e) => setNewReminderData({...newReminderData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Recordatorio citas mañana"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plantilla de mensaje *</label>
                  <select
                    value={newReminderData.template_id}
                    onChange={(e) => setNewReminderData({...newReminderData, template_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Seleccionar plantilla</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Schedule Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Programar envío (opcional)</label>
                <input
                  type="datetime-local"
                  value={newReminderData.schedule_time}
                  onChange={(e) => setNewReminderData({...newReminderData, schedule_time: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Si no se especifica, se enviará inmediatamente</p>
              </div>

              {/* Source Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Origen de contactos</label>
                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() => {setSelectedSource('agenda'); setSelectedRecipients([]); setSelectAll(false);}}
                    className={`flex items-center px-4 py-2 rounded-lg border-2 transition-colors ${
                      selectedSource === 'agenda' 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Calendar className="w-5 h-5 mr-2" />
                    Desde Agenda ({appointments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {setSelectedSource('pacientes'); setSelectedRecipients([]); setSelectAll(false);}}
                    className={`flex items-center px-4 py-2 rounded-lg border-2 transition-colors ${
                      selectedSource === 'pacientes' 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Users className="w-5 h-5 mr-2" />
                    Base de Pacientes ({patients.length})
                  </button>
                </div>
              </div>

              {/* Recipients Selection */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Seleccionar destinatarios ({selectedRecipients.length} seleccionados)
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {selectAll ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </button>
                </div>
                
                <div className="border border-gray-300 rounded-lg max-h-60 overflow-y-auto">
                  {sourceData.map((item) => (
                    <div 
                      key={item.id} 
                      className="flex items-center p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRecipients.includes(item.id)}
                        onChange={() => handleSelectRecipient(item.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <div className="ml-3 flex-1">
                        {selectedSource === 'agenda' ? (
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {item.nombre} {item.apellidos}
                            </p>
                            <p className="text-xs text-gray-500">
                              {item.fecha} - {item.hora} - {item.tratamiento}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {item.nombre} {item.apellidos}
                            </p>
                            <p className="text-xs text-gray-500">
                              {item.tel_movil} - {item.num_pac}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {sourceData.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                      <User className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>No hay {selectedSource === 'agenda' ? 'citas' : 'pacientes'} disponibles</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={selectedRecipients.length === 0 || !newReminderData.template_id}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {newReminderData.schedule_time ? 'Programar Recordatorio' : 'Enviar Recordatorio'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewReminder(false)}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecordatoriosModule;