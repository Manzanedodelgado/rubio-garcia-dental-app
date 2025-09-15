import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Settings, Plus, Edit, Trash2, Play, Pause, Clock, 
  Calendar, MessageSquare, Zap, AlertCircle, CheckCircle,
  ArrowRight, Target, Filter, Search
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AutomatizacionesModule = () => {
  const [automations, setAutomations] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const [automationData, setAutomationData] = useState({
    name: '',
    trigger_type: '',
    trigger_time: '',
    template_id: '',
    conditions: {},
    is_active: true
  });

  const triggerTypes = [
    {
      id: 'appointment_reminder',
      name: 'Recordatorio de Cita',
      description: 'Envía recordatorios antes de las citas',
      icon: Calendar,
      color: 'text-blue-600'
    },
    {
      id: 'medication_reminder',
      name: 'Recordatorio de Medicación',
      description: 'Recordatorios para tomar medicamentos',
      icon: Clock,
      color: 'text-green-600'
    },
    {
      id: 'post_treatment',
      name: 'Seguimiento Post-Tratamiento',
      description: 'Mensajes de seguimiento después del tratamiento',
      icon: MessageSquare,
      color: 'text-purple-600'
    },
    {
      id: 'birthday_reminder',
      name: 'Felicitación de Cumpleaños',
      description: 'Mensajes automáticos de cumpleaños',
      icon: Target,
      color: 'text-pink-600'
    }
  ];

  const triggerTimeOptions = {
    appointment_reminder: [
      { value: '1 hour before', label: '1 hora antes' },
      { value: '2 hours before', label: '2 horas antes' },
      { value: '1 day before', label: '1 día antes' },
      { value: '2 days before', label: '2 días antes' },
      { value: '1 week before', label: '1 semana antes' }
    ],
    medication_reminder: [
      { value: '2 days before surgery', label: '2 días antes de cirugía' },
      { value: '1 day before surgery', label: '1 día antes de cirugía' },
      { value: 'every 8 hours', label: 'Cada 8 horas' },
      { value: 'every 12 hours', label: 'Cada 12 horas' }
    ],
    post_treatment: [
      { value: '1 day after', label: '1 día después' },
      { value: '3 days after', label: '3 días después' },
      { value: '1 week after', label: '1 semana después' },
      { value: '1 month after', label: '1 mes después' }
    ],
    birthday_reminder: [
      { value: 'on birthday', label: 'El día del cumpleaños' },
      { value: '1 day before birthday', label: '1 día antes del cumpleaños' }
    ]
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [automationsRes, templatesRes] = await Promise.all([
        axios.get(`${API}/automations`),
        axios.get(`${API}/templates`)
      ]);

      // Add mock automations for demo
      const mockAutomations = [
        {
          id: '1',
          name: 'Recordatorio citas día anterior',
          trigger_type: 'appointment_reminder',
          trigger_time: '1 day before',
          template_id: 'reminder_24h',
          is_active: true,
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          executions: 45,
          last_execution: new Date(Date.now() - 60 * 60 * 1000)
        },
        {
          id: '2',
          name: 'Recordatorio antibiótico pre-cirugía',
          trigger_type: 'medication_reminder',
          trigger_time: '2 days before surgery',
          template_id: 'medication_reminder',
          is_active: true,
          created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          executions: 8,
          last_execution: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        },
        {
          id: '3',
          name: 'Seguimiento post-ortodoncia',
          trigger_type: 'post_treatment',
          trigger_time: '1 day after',
          template_id: 'post_treatment',
          is_active: false,
          created_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
          executions: 23,
          last_execution: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        }
      ];

      setAutomations([...mockAutomations, ...automationsRes.data]);
      setTemplates(templatesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAutomation = async (e) => {
    e.preventDefault();
    try {
      if (editingAutomation) {
        await axios.put(`${API}/automations/${editingAutomation.id}`, automationData);
      } else {
        await axios.post(`${API}/automations`, automationData);
      }
      
      setShowEditor(false);
      setEditingAutomation(null);
      setAutomationData({
        name: '',
        trigger_type: '',
        trigger_time: '',
        template_id: '',
        conditions: {},
        is_active: true
      });
      fetchData();
    } catch (error) {
      console.error('Error saving automation:', error);
    }
  };

  const handleEditAutomation = (automation) => {
    setEditingAutomation(automation);
    setAutomationData({
      name: automation.name,
      trigger_type: automation.trigger_type,
      trigger_time: automation.trigger_time,
      template_id: automation.template_id,
      conditions: automation.conditions || {},
      is_active: automation.is_active
    });
    setShowEditor(true);
  };

  const handleDeleteAutomation = async (automationId) => {
    if (window.confirm('¿Está seguro de eliminar esta automatización?')) {
      try {
        await axios.delete(`${API}/automations/${automationId}`);
        fetchData();
      } catch (error) {
        console.error('Error deleting automation:', error);
      }
    }
  };

  const toggleAutomationStatus = async (automationId, currentStatus) => {
    try {
      const automation = automations.find(a => a.id === automationId);
      await axios.put(`${API}/automations/${automationId}`, {
        ...automation,
        is_active: !currentStatus
      });
      fetchData();
    } catch (error) {
      console.error('Error toggling automation status:', error);
    }
  };

  const getTriggerTypeInfo = (triggerType) => {
    return triggerTypes.find(t => t.id === triggerType) || triggerTypes[0];
  };

  const filteredAutomations = automations.filter(automation => {
    const matchesSearch = automation.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && automation.is_active) ||
      (filterStatus === 'inactive' && !automation.is_active);
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
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
          <h1 className="text-3xl font-bold text-gray-900">Automatizaciones</h1>
          <p className="text-gray-600 mt-1">Configuración de reglas automáticas para mensajes</p>
        </div>
        <button
          onClick={() => setShowEditor(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium transition-colors flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva Automatización
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{automations.length}</p>
            <p className="text-sm text-gray-600">Total Automatizaciones</p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {automations.filter(a => a.is_active).length}
            </p>
            <p className="text-sm text-gray-600">Activas</p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-600">
              {automations.reduce((sum, a) => sum + (a.executions || 0), 0)}
            </p>
            <p className="text-sm text-gray-600">Ejecuciones</p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">
              {Math.round(automations.reduce((sum, a) => sum + (a.executions || 0), 0) / Math.max(automations.length, 1))}
            </p>
            <p className="text-sm text-gray-600">Promedio/Regla</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar automatizaciones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Todas</option>
            <option value="active">Activas</option>
            <option value="inactive">Inactivas</option>
          </select>
        </div>
      </div>

      {/* Automations List */}
      <div className="space-y-4">
        {filteredAutomations.map((automation) => {
          const triggerInfo = getTriggerTypeInfo(automation.trigger_type);
          const TriggerIcon = triggerInfo.icon;
          
          return (
            <div key={automation.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 ${automation.is_active ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gray-400'} rounded-xl flex items-center justify-center text-white transition-colors`}>
                      <TriggerIcon className="w-6 h-6" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{automation.name}</h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          automation.is_active 
                            ? 'bg-green-100 text-green-800 border border-green-200' 
                            : 'bg-gray-100 text-gray-800 border border-gray-200'
                        }`}>
                          {automation.is_active ? (
                            <>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Activa
                            </>
                          ) : (
                            <>
                              <Pause className="w-3 h-3 mr-1" />
                              Pausada
                            </>
                          )}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-6 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${triggerInfo.color.replace('text-', 'bg-')}`}></span>
                          <span>{triggerInfo.name}</span>
                        </div>
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {automation.trigger_time}
                        </div>
                        <div className="flex items-center">
                          <Zap className="w-4 h-4 mr-1" />
                          {automation.executions || 0} ejecuciones
                        </div>
                        {automation.last_execution && (
                          <div className="flex items-center">
                            <span>Última: {automation.last_execution.toLocaleDateString('es-ES')}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-3 flex items-center space-x-2 text-sm">
                        <span className="text-gray-500">Flujo:</span>
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                          {triggerInfo.name}
                        </span>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                        <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs">
                          Enviar Mensaje
                        </span>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                        <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">
                          Completado
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => toggleAutomationStatus(automation.id, automation.is_active)}
                      className={`p-2 rounded-lg transition-colors ${
                        automation.is_active
                          ? 'text-yellow-600 hover:bg-yellow-50'
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                      title={automation.is_active ? 'Pausar' : 'Activar'}
                    >
                      {automation.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    
                    <button
                      onClick={() => handleEditAutomation(automation)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => handleDeleteAutomation(automation.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        {filteredAutomations.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <Settings className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay automatizaciones</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || filterStatus !== 'all' 
                ? 'No se encontraron automatizaciones con los filtros aplicados'
                : 'Crea tu primera automatización para comenzar'
              }
            </p>
            {!searchTerm && filterStatus === 'all' && (
              <button
                onClick={() => setShowEditor(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Crear Automatización
              </button>
            )}
          </div>
        )}
      </div>

      {/* Automation Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-90vh overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingAutomation ? 'Editar Automatización' : 'Nueva Automatización'}
              </h2>
              <button
                onClick={() => {
                  setShowEditor(false);
                  setEditingAutomation(null);
                  setAutomationData({
                    name: '',
                    trigger_type: '',
                    trigger_time: '',
                    template_id: '',
                    conditions: {},
                    is_active: true
                  });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSaveAutomation} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la automatización *</label>
                <input
                  type="text"
                  value={automationData.name}
                  onChange={(e) => setAutomationData({...automationData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Recordatorio citas día anterior"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Tipo de disparador *</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {triggerTypes.map((trigger) => {
                    const TriggerIcon = trigger.icon;
                    return (
                      <button
                        key={trigger.id}
                        type="button"
                        onClick={() => setAutomationData({...automationData, trigger_type: trigger.id, trigger_time: ''})}
                        className={`p-4 border-2 rounded-lg text-left transition-colors ${
                          automationData.trigger_type === trigger.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center space-x-3 mb-2">
                          <TriggerIcon className={`w-5 h-5 ${trigger.color}`} />
                          <span className="font-medium text-gray-900">{trigger.name}</span>
                        </div>
                        <p className="text-sm text-gray-600">{trigger.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {automationData.trigger_type && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Momento de ejecución *</label>
                  <select
                    value={automationData.trigger_time}
                    onChange={(e) => setAutomationData({...automationData, trigger_time: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Seleccionar momento</option>
                    {triggerTimeOptions[automationData.trigger_type]?.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plantilla de mensaje *</label>
                <select
                  value={automationData.template_id}
                  onChange={(e) => setAutomationData({...automationData, template_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Seleccionar plantilla</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={automationData.is_active}
                  onChange={(e) => setAutomationData({...automationData, is_active: e.target.checked})}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  Activar automatización inmediatamente
                </label>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors"
                >
                  {editingAutomation ? 'Actualizar' : 'Crear'} Automatización
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditor(false);
                    setEditingAutomation(null);
                    setAutomationData({
                      name: '',
                      trigger_type: '',
                      trigger_time: '',
                      template_id: '',
                      conditions: {},
                      is_active: true
                    });
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
    </div>
  );
};

export default AutomatizacionesModule;