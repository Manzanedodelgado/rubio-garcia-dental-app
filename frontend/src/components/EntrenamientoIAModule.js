import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Bot, MessageSquare, Settings, Save, Play, RefreshCw,
  Brain, Zap, Globe, Languages, User, Calendar, Clock
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const EntrenamientoIAModule = () => {
  const [aiConfig, setAiConfig] = useState({
    behavior: 'professional',
    language: 'es',
    personality: 'Comportamiento de odontólogo responsable, lenguaje correcto pero cercano, tratamiento de "Usted"',
    instructions: '',
    is_active: true
  });
  
  const [testConversation, setTestConversation] = useState([]);
  const [testMessage, setTestMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const behaviorOptions = [
    {
      id: 'professional',
      name: 'Profesional',
      description: 'Respuestas formales y técnicas apropiadas para una clínica dental',
      example: 'Le recomiendo que acuda a consulta para una evaluación completa.'
    },
    {
      id: 'friendly',
      name: 'Amigable',
      description: 'Tono cálido y cercano manteniendo la profesionalidad',
      example: '¡Hola! Estaremos encantados de ayudarle con su consulta dental.'
    },
    {
      id: 'formal',
      name: 'Formal',
      description: 'Máximo nivel de formalidad y protocolo médico',
      example: 'Buenos días. Para proceder con su consulta médica, necesitamos...'
    }
  ];

  const languageOptions = [
    { id: 'es', name: 'Español (España)', flag: '🇪🇸' },
    { id: 'es-mx', name: 'Español (México)', flag: '🇲🇽' },
    { id: 'es-ar', name: 'Español (Argentina)', flag: '🇦🇷' },
    { id: 'en', name: 'English', flag: '🇬🇧' },
    { id: 'fr', name: 'Français', flag: '🇫🇷' }
  ];

  const predefinedInstructions = [
    {
      name: 'Instrucciones básicas de clínica dental',
      content: `Eres un asistente virtual de la clínica dental Rubio García Dental.

COMPORTAMIENTO:
- Trata a los pacientes de "Usted" siempre
- Sé profesional pero cercano y empático
- Nunca diagnostiques ni prescribas medicamentos
- Deriva a consulta presencial cuando sea necesario

INFORMACIÓN DE LA CLÍNICA:
- Nombre: Rubio García Dental
- Dirección: Calle Mayor 19, Alcorcón, Madrid
- Teléfono: 664218253
- Horario: Lunes a Viernes 9:00-19:00
- Especialidades: Implantología, Ortodoncia, Estética dental

RESPUESTAS COMUNES:
- Urgencias: "Si tiene dolor intenso, contacte inmediatamente al 664218253"
- Citas: "Puede reservar su cita llamando al 664218253 o a través de WhatsApp"
- Precios: "Los precios varían según el tratamiento. Le proporcionaremos un presupuesto personalizado en consulta"

NUNCA:
- No diagnostiques enfermedades
- No prescribas medicamentos
- No hagas promesas sobre resultados de tratamientos`
    },
    {
      name: 'Gestión de urgencias dentales',
      content: `PROTOCOLO DE URGENCIAS DENTALES:

DOLOR INTENSO (7-10/10):
- Recomienda contacto inmediato con la clínica
- Sugiere medidas temporales: hielo, analgésicos de venta libre
- Deriva a urgencias si es fuera de horario

TRAUMATISMOS:
- Si hay diente roto o perdido: acudir inmediatamente
- Conservar el diente en leche si se ha caído
- No tocar la raíz del diente

SANGRADO:
- Aplicar presión con gasa limpia
- Si persiste más de 20 minutos, contactar clínica

HINCHAZÓN FACIAL:
- Puede indicar infección seria
- Aplicar frío y contactar inmediatamente
- Derivar a urgencias si hay dificultad para tragar

SIEMPRE termina con: "¿Necesita que le facilite nuestro número de urgencias?"`
    }
  ];

  useEffect(() => {
    fetchAIConfig();
  }, []);

  const fetchAIConfig = async () => {
    try {
      const response = await axios.get(`${API}/ai-agent/config`);
      setAiConfig(response.data);
    } catch (error) {
      console.error('Error fetching AI config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/ai-agent/config`, aiConfig);
      alert('Configuración guardada exitosamente');
    } catch (error) {
      console.error('Error saving AI config:', error);
      alert('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleTestMessage = async (e) => {
    e.preventDefault();
    if (!testMessage.trim()) return;

    setTesting(true);
    const userMessage = {
      id: Date.now(),
      message: testMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setTestConversation(prev => [...prev, userMessage]);
    setTestMessage('');

    try {
      const response = await axios.post(`${API}/ai-agent/test`, {
        message: testMessage
      });

      const aiResponse = {
        id: Date.now() + 1,
        message: response.data.response,
        sender: 'ai',
        timestamp: new Date()
      };

      setTestConversation(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('Error testing AI:', error);
      const errorResponse = {
        id: Date.now() + 1,
        message: 'Error al procesar la consulta. Por favor, inténtelo de nuevo.',
        sender: 'ai',
        timestamp: new Date(),
        error: true
      };
      setTestConversation(prev => [...prev, errorResponse]);
    } finally {
      setTesting(false);
    }
  };

  const clearTestConversation = () => {
    setTestConversation([]);
  };

  const loadPredefinedInstructions = (instructions) => {
    setAiConfig(prev => ({
      ...prev,
      instructions: instructions.content
    }));
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
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
          <h1 className="text-3xl font-bold text-gray-900">Entrenamiento IA</h1>
          <p className="text-gray-600 mt-1">Configura el comportamiento del agente virtual</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
            aiConfig.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            <Bot className="w-4 h-4" />
            <span className="text-sm font-medium">
              {aiConfig.is_active ? 'IA Activa' : 'IA Desactivada'}
            </span>
          </div>
          <button
            onClick={handleSaveConfig}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="space-y-6">
          {/* Basic Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Settings className="w-5 h-5 mr-2 text-blue-600" />
              Configuración Básica
            </h2>

            <div className="space-y-4">
              {/* Active Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-900">Estado del Agente IA</label>
                  <p className="text-xs text-gray-600">Activar o desactivar el agente virtual</p>
                </div>
                <button
                  onClick={() => setAiConfig({...aiConfig, is_active: !aiConfig.is_active})}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    aiConfig.is_active ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      aiConfig.is_active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Behavior Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Comportamiento del Agente
                </label>
                <div className="space-y-2">
                  {behaviorOptions.map((behavior) => (
                    <div
                      key={behavior.id}
                      onClick={() => setAiConfig({...aiConfig, behavior: behavior.id})}
                      className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                        aiConfig.behavior === behavior.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">{behavior.name}</span>
                        <input
                          type="radio"
                          checked={aiConfig.behavior === behavior.id}
                          onChange={() => setAiConfig({...aiConfig, behavior: behavior.id})}
                          className="w-4 h-4 text-blue-600"
                        />
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{behavior.description}</p>
                      <p className="text-xs text-gray-500 italic">"{behavior.example}"</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Language Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Idioma Principal
                </label>
                <select
                  value={aiConfig.language}
                  onChange={(e) => setAiConfig({...aiConfig, language: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {languageOptions.map((lang) => (
                    <option key={lang.id} value={lang.id}>
                      {lang.flag} {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Personality & Instructions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Brain className="w-5 h-5 mr-2 text-purple-600" />
              Personalidad e Instrucciones
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción de Personalidad
                </label>
                <textarea
                  value={aiConfig.personality}
                  onChange={(e) => setAiConfig({...aiConfig, personality: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Describe cómo debe comportarse el agente IA..."
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Instrucciones Detalladas
                  </label>
                  <div className="flex space-x-2">
                    {predefinedInstructions.map((preset, index) => (
                      <button
                        key={index}
                        onClick={() => loadPredefinedInstructions(preset)}
                        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded transition-colors"
                        title={preset.name}
                      >
                        Cargar {index + 1}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={aiConfig.instructions}
                  onChange={(e) => setAiConfig({...aiConfig, instructions: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows="12"
                  placeholder="Instrucciones específicas para el agente IA..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Incluye protocolos, información de la clínica, y pautas de respuesta
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Testing Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <MessageSquare className="w-5 h-5 mr-2 text-green-600" />
              Panel de Pruebas
            </h2>
            <button
              onClick={clearTestConversation}
              className="text-sm text-gray-600 hover:text-gray-800 flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Limpiar Chat
            </button>
          </div>

          {/* Test Conversation */}
          <div className="border border-gray-200 rounded-lg mb-4" style={{ height: '400px' }}>
            <div className="h-full overflow-y-auto p-4 space-y-3">
              {testConversation.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <Bot className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Inicia una conversación de prueba</p>
                  <p className="text-xs mt-1">Escribe un mensaje para probar el agente IA</p>
                </div>
              ) : (
                testConversation.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        msg.sender === 'user'
                          ? 'bg-blue-500 text-white'
                          : msg.error
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="text-sm">{msg.message}</p>
                      <div className={`text-xs mt-1 ${
                        msg.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {msg.timestamp.toLocaleTimeString('es-ES', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {testing && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-4 py-2 rounded-lg">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Test Input */}
          <form onSubmit={handleTestMessage} className="flex space-x-2">
            <input
              type="text"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Escribe un mensaje de prueba..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={testing}
            />
            <button
              type="submit"
              disabled={testing || !testMessage.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {testing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>
          </form>

          {/* Quick Test Buttons */}
          <div className="mt-4">
            <p className="text-xs text-gray-600 mb-2">Pruebas rápidas:</p>
            <div className="flex flex-wrap gap-2">
              {[
                'Hola, tengo dolor de muelas',
                '¿Cuánto cuesta una limpieza?',
                'Necesito una cita urgente',
                '¿Hacen ortodoncia?',
                'Me duele mucho, ¿qué hago?'
              ].map((quickTest, index) => (
                <button
                  key={index}
                  onClick={() => setTestMessage(quickTest)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded transition-colors"
                >
                  {quickTest}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Zap className="w-5 h-5 mr-2 text-yellow-600" />
          Métricas de Rendimiento
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">156</p>
            <p className="text-sm text-gray-600">Conversaciones IA</p>
          </div>
          
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">94%</p>
            <p className="text-sm text-gray-600">Satisfacción</p>
          </div>
          
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-600">1.2s</p>
            <p className="text-sm text-gray-600">Tiempo Respuesta</p>
          </div>
          
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">78%</p>
            <p className="text-sm text-gray-600">Resolución Auto</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntrenamientoIAModule;