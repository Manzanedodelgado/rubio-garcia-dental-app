import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Settings, Save, Upload, User, MessageSquare, 
  Bot, Clock, Bell, Palette, Shield 
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const WhatsAppConfig = ({ onClose }) => {
  const [config, setConfig] = useState({
    business_name: 'Rubio García Dental',
    business_description: 'Clínica dental especializada en tratamientos de calidad',
    business_phone: '664218253',
    business_email: 'info@rubiogarciadental.com',
    business_address: 'Calle Mayor 19, Alcorcón, 28921 Madrid',
    business_hours: 'Lunes a Viernes: 9:00 - 19:00',
    ai_enabled: true,
    ai_personality: 'Comportamiento de odontólogo responsable, lenguaje correcto pero cercano, tratamiento de "Usted"',
    auto_response_enabled: true,
    auto_response_delay: 2,
    greeting_message: '¡Hola! Bienvenido/a a Rubio García Dental 🦷\n\nSoy su asistente virtual. ¿En qué puedo ayudarle hoy?',
    business_hours_message: 'Gracias por contactarnos. En este momento estamos fuera del horario de atención.\n\nNuestro horario:\n🕘 Lunes a Viernes: 9:00-19:00\n\nTe responderemos lo antes posible.',
    profile_photo: null
  });
  
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await axios.get(`${API}/settings`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      const aiResponse = await axios.get(`${API}/ai-agent/config`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      setConfig({
        business_name: response.data.clinic_name || 'Rubio García Dental',
        business_description: 'Clínica dental especializada en tratamientos de calidad',
        business_phone: response.data.whatsapp_number || '664218253',
        business_email: response.data.email || 'info@rubiogarciadental.com',
        business_address: response.data.address || 'Calle Mayor 19, Alcorcón, 28921 Madrid',
        business_hours: 'Lunes a Viernes: 9:00 - 19:00',
        ai_enabled: aiResponse.data.is_active || true,
        ai_personality: aiResponse.data.personality || 'Comportamiento de odontólogo responsable, lenguaje correcto pero cercano, tratamiento de "Usted"',
        auto_response_enabled: true,
        auto_response_delay: 2,
        greeting_message: '¡Hola! Bienvenido/a a Rubio García Dental 🦷\n\nSoy su asistente virtual. ¿En qué puedo ayudarle hoy?',
        business_hours_message: 'Gracias por contactarnos. En este momento estamos fuera del horario de atención.\n\nNuestro horario:\n🕘 Lunes a Viernes: 9:00-19:00\n\nTe responderemos lo antes posible.',
        profile_photo: response.data.logo_url
      });
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setSaved(false);
    
    try {
      // Update clinic settings
      await axios.put(`${API}/settings`, {
        clinic_name: config.business_name,
        email: config.business_email,
        address: config.business_address,
        whatsapp_number: config.business_phone,
        logo_url: config.profile_photo
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      // Update AI configuration
      await axios.put(`${API}/ai-agent/config`, {
        personality: config.ai_personality,
        is_active: config.ai_enabled
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Error al guardar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/settings/upload-logo`, formData, {
        headers: { 
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setConfig({ ...config, profile_photo: response.data.logo_url });
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Error al subir la imagen');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-semibold text-gray-900">Configuración de WhatsApp</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ✕
          </button>
        </div>
        
        <div className="p-6 space-y-8">
          {/* Business Profile */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <User className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Perfil del Negocio</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Negocio
                </label>
                <input
                  type="text"
                  value={config.business_name}
                  onChange={(e) => setConfig({ ...config, business_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono WhatsApp Business
                </label>
                <input
                  type="tel"
                  value={config.business_phone}
                  onChange={(e) => setConfig({ ...config, business_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={config.business_email}
                  onChange={(e) => setConfig({ ...config, business_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Horario de Atención
                </label>
                <input
                  type="text"
                  value={config.business_hours}
                  onChange={(e) => setConfig({ ...config, business_hours: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dirección
                </label>
                <textarea
                  value={config.business_address}
                  onChange={(e) => setConfig({ ...config, business_address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Profile Photo */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Upload className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Foto de Perfil</h3>
            </div>
            
            <div className="flex items-center space-x-4">
              {config.profile_photo && (
                <img
                  src={config.profile_photo}
                  alt="Profile"
                  className="w-16 h-16 rounded-full object-cover border-2 border-gray-300"
                />
              )}
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="profile-photo"
                />
                <label
                  htmlFor="profile-photo"
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer transition-colors"
                >
                  Subir Imagen
                </label>
                <p className="text-sm text-gray-500 mt-1">
                  Imagen cuadrada recomendada (mínimo 640x640px)
                </p>
              </div>
            </div>
          </div>

          {/* AI Configuration */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Bot className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Asistente IA</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="ai-enabled"
                  checked={config.ai_enabled}
                  onChange={(e) => setConfig({ ...config, ai_enabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="ai-enabled" className="text-sm font-medium text-gray-700">
                  Activar respuestas automáticas con IA
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personalidad del Asistente
                </label>
                <textarea
                  value={config.ai_personality}
                  onChange={(e) => setConfig({ ...config, ai_personality: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Describe cómo debe comportarse el asistente de IA..."
                />
              </div>
            </div>
          </div>

          {/* Auto Messages */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <MessageSquare className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Mensajes Automáticos</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mensaje de Bienvenida
                </label>
                <textarea
                  value={config.greeting_message}
                  onChange={(e) => setConfig({ ...config, greeting_message: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mensaje Fuera de Horario
                </label>
                <textarea
                  value={config.business_hours_message}
                  onChange={(e) => setConfig({ ...config, business_hours_message: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancelar
          </button>
          
          <button
            onClick={handleSave}
            disabled={loading}
            className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-medium transition-colors ${
              saved 
                ? 'bg-green-600 text-white' 
                : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>
              {loading ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar Configuración'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppConfig;