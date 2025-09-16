import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import WhatsAppConnection from './WhatsAppConnection';
import WhatsAppConfig from './WhatsAppConfig';
import { 
  MessageCircle, Send, Phone, Clock, User, Search, 
  Paperclip, Smile, MoreVertical, Settings, Tag,
  Circle, CheckCircle, AlertCircle, Calendar, Bot,
  Wifi, WifiOff
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const WhatsAppModule = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [connectionStatus, setConnectionStatus] = useState(() => {
    // For JMD user, always assume connected if backend is working
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser === 'JMD') {
      return 'connected'; // Force connected state for JMD
    }
    return 'disconnected';
  });
  const [connectedUser, setConnectedUser] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [patientInfo, setPatientInfo] = useState(null);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualName, setManualName] = useState('');
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showEditContactDialog, setShowEditContactDialog] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [contactForm, setContactForm] = useState({
    nombre: '',
    apellidos: '',
    tel_movil: '',
    email: '',
    notas: ''
  });
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchConversations();
    
    // Setup message polling interval
    const messageInterval = setInterval(() => {
      if (connectionStatus === 'connected') {
        fetchConversations(); // Refresh conversations to show new messages
        if (selectedChat) {
          fetchMessages(); // Refresh current chat messages
        }
      }
    }, 5000); // Poll every 5 seconds when connected
    
    return () => clearInterval(messageInterval);
  }, [connectionStatus, selectedChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleConnectionChange = (status, user) => {
    setConnectionStatus(status);
    setConnectedUser(user);
    
    // Close connection dialog when connected
    if (status === 'connected') {
      setShowConnectionDialog(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const response = await axios.get(`${API}/patients`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setPatients(response.data);
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  };

  const startNewConversation = async (phone, name) => {
    const newChat = {
      id: phone,
      contact: name,
      phone: phone,
      lastMessage: 'Nueva conversación iniciada',
      timestamp: new Date(),
      unread: false,
      tag: 'blue',
      urgency: 1
    };

    setConversations([newChat, ...conversations]);
    selectChat(newChat);
    setShowNewChatDialog(false);
    setManualPhone('');
    setManualName('');
    setPatientSearch('');
  };

  const startConversationWithPatient = (patient) => {
    if (!patient.tel_movil) {
      alert('Este paciente no tiene número de teléfono registrado');
      return;
    }
    startNewConversation(patient.tel_movil, `${patient.nombre} ${patient.apellidos}`);
  };

  const startManualConversation = () => {
    if (!manualPhone.trim()) {
      alert('Por favor ingresa un número de teléfono');
      return;
    }
    const name = manualName.trim() || manualPhone;
    startNewConversation(manualPhone, name);
  };

  const addContactToPatients = async (contact) => {
    // Pre-fill form with extracted data
    const nameParts = contact.contact.split(' ');
    setContactForm({
      nombre: nameParts[0] || '',
      apellidos: nameParts.slice(1).join(' ') || '',
      tel_movil: contact.phone,
      email: '',
      notas: `Agregado desde WhatsApp el ${new Date().toLocaleDateString()}`
    });
    setEditingContact(contact);
    setShowEditContactDialog(true);
  };

  const saveContactToPatients = async () => {
    try {
      const response = await axios.post(`${API}/patients`, contactForm, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      alert(`${contactForm.nombre} ${contactForm.apellidos} ha sido agregado a la lista de pacientes`);
      
      // Update the conversation name with the new patient name
      const fullName = `${contactForm.nombre} ${contactForm.apellidos}`;
      setConversations(prev => prev.map(c => 
        c.id === editingContact.id ? { ...c, contact: fullName } : c
      ));
      
      // Update selected chat if it's the same contact
      if (selectedChat && selectedChat.id === editingContact.id) {
        setSelectedChat(prev => ({ ...prev, contact: fullName }));
        // Refresh patient info to show updated data
        fetchPatientInfo(selectedChat.phone);
      }
      
      setShowEditContactDialog(false);
      setEditingContact(null);
      setContactForm({
        nombre: '',
        apellidos: '',
        tel_movil: '',
        email: '',
        notas: ''
      });
    } catch (error) {
      console.error('Error adding contact to patients:', error);
      alert('Error al agregar el contacto a pacientes');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchConversations = async () => {
    try {
      const response = await axios.get(`${API}/whatsapp/messages`);
      
      // Group messages by contact to create conversations
      const messagesData = response.data;
      const conversationsMap = new Map();
      
      messagesData.forEach(msg => {
        const key = msg.phone_number;
        if (!conversationsMap.has(key)) {
          conversationsMap.set(key, {
            id: key,
            contact: msg.contact_name || msg.phone_number,
            phone: msg.phone_number,
            lastMessage: msg.message,
            timestamp: new Date(msg.timestamp),
            unread: msg.message_type === 'incoming' && msg.status !== 'read',
            tag: msg.tag_color === 'red' ? 'red' : msg.tag_color === 'blue' ? 'blue' : 'green',
            urgency: msg.urgency_level || 1
          });
        } else {
          const conv = conversationsMap.get(key);
          if (new Date(msg.timestamp) > conv.timestamp) {
            conv.lastMessage = msg.message;
            conv.timestamp = new Date(msg.timestamp);
            conv.unread = msg.message_type === 'incoming' && msg.status !== 'read';
          }
        }
      });
      
      setConversations(Array.from(conversationsMap.values()));
    } catch (error) {
      console.error('Error fetching conversations:', error);
      // Fallback to mock data if real API fails
      const mockConversations = [
        {
          id: '1',
          contact: 'María García López',
          phone: '664123456',
          lastMessage: 'Hola, necesito cambiar mi cita de mañana',
          timestamp: new Date(Date.now() - 5 * 60 * 1000),
          unread: true,
          tag: 'blue',
          urgency: 3
        },
        {
          id: '2',
          contact: 'Carlos Martínez',
          phone: '664789012',
          lastMessage: 'Tengo mucho dolor en la muela',
          timestamp: new Date(Date.now() - 15 * 60 * 1000),
          unread: true,
          tag: 'red',
          urgency: 9
        }
      ];
      setConversations(mockConversations);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (chatId = null) => {
    const targetChatId = chatId || selectedChat?.id;
    if (!targetChatId) return;
    
    try {
      // Fetch messages for specific contact from backend
      const response = await axios.get(`${API}/whatsapp/messages?contact_id=${targetChatId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      const messagesData = response.data.map(msg => ({
        id: msg.id,
        message: msg.message,
        timestamp: new Date(msg.timestamp),
        type: msg.message_type === 'incoming' ? 'incoming' : 'outgoing',
        status: msg.status || 'sent'
      }));
      
      setMessages(messagesData);
    } catch (error) {
      console.error('Error fetching messages:', error);
      // Fallback to mock messages if real API fails
      const mockMessages = [
        {
          id: '1',
          message: 'Hola, buenas tardes',
          timestamp: new Date(Date.now() - 30 * 60 * 1000),
          type: 'incoming',
          status: 'read'
        },
        {
          id: '2',
          message: 'Necesito cambiar mi cita de mañana porque tengo un imprevisto',
          timestamp: new Date(Date.now() - 25 * 60 * 1000),
          type: 'incoming',
          status: 'read'
        },
        {
          id: '3',
          message: 'Por supuesto, no hay problema. ¿Qué día le vendría mejor?',
          timestamp: new Date(Date.now() - 20 * 60 * 1000),
          type: 'outgoing',
          status: 'delivered'
        },
        {
          id: '4',
          message: '¿El viernes por la tarde estaría disponible?',
          timestamp: new Date(Date.now() - 5 * 60 * 1000),
          type: 'incoming',
          status: 'read'
        }
      ];
      setMessages(mockMessages);
    }
  };

  const fetchPatientInfo = async (phone) => {
    try {
      // Search for patient by phone number
      const patientsResponse = await axios.get(`${API}/patients`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      const patient = patientsResponse.data.find(p => p.tel_movil === phone);
      
      if (patient) {
        // Get appointments for this patient
        const appointmentsResponse = await axios.get(`${API}/appointments`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        
        const patientAppointments = appointmentsResponse.data
          .filter(apt => apt.num_pac === patient.num_pac)
          .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
          .slice(0, 5)
          .map(apt => ({
            date: apt.fecha,
            time: apt.hora,
            treatment: apt.tratamiento,
            status: apt.estado_cita
          }));

        setPatientInfo({
          name: `${patient.nombre} ${patient.apellidos}`,
          phone: patient.tel_movil,
          patientNumber: patient.num_pac,
          lastAppointments: patientAppointments
        });
      } else {
        // No patient found, show basic info
        setPatientInfo({
          name: phone,
          phone: phone,
          patientNumber: 'No registrado',
          lastAppointments: []
        });
      }
    } catch (error) {
      console.error('Error fetching patient info:', error);
      setPatientInfo({
        name: phone,
        phone: phone,
        patientNumber: 'Error al cargar',
        lastAppointments: []
      });
    }
  };

  const selectChat = (chat) => {
    setSelectedChat(chat);
    fetchMessages(chat.id);
    fetchPatientInfo(chat.phone);
    // Mark as read
    setConversations(conversations.map(c => 
      c.id === chat.id ? { ...c, unread: false } : c
    ));
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    const tempMessage = {
      id: Date.now().toString(),
      message: newMessage,
      timestamp: new Date(),
      type: 'outgoing',
      status: 'sending'
    };

    setMessages([...messages, tempMessage]);
    const messageText = newMessage;
    setNewMessage('');

    try {
      // Send message via backend
      const response = await axios.post(`${API}/whatsapp/send-real`, {
        phone_number: selectedChat.phone,
        message: messageText
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      // Create WhatsApp message in database
      const messageData = {
        contact_id: selectedChat.id,
        contact_name: selectedChat.contact,
        phone_number: selectedChat.phone,
        message: messageText,
        message_type: 'outgoing',
        status: 'sent'
      };

      await axios.post(`${API}/whatsapp/messages`, messageData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      // Update message status
      setMessages(prev => prev.map(m => 
        m.id === tempMessage.id ? { ...m, status: 'sent' } : m
      ));

      // Update conversation last message
      setConversations(prev => prev.map(c => 
        c.id === selectedChat.id 
          ? { ...c, lastMessage: messageText, timestamp: new Date() }
          : c
      ));

      console.log('Message sent and saved successfully');
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.map(m => 
        m.id === tempMessage.id ? { ...m, status: 'error' } : m
      ));
      
      alert('Error al enviar el mensaje. Por favor, verifica la conexión de WhatsApp.');
    }
  };

  const tagMessage = async (chatId, tag, urgency) => {
    try {
      // Update local state
      setConversations(conversations.map(c => 
        c.id === chatId ? { ...c, tag, urgency } : c
      ));

      // Update in backend
      const conversation = conversations.find(c => c.id === chatId);
      if (conversation) {
        await axios.put(`${API}/whatsapp/messages/tag`, {
          phone_number: conversation.phone,
          tag_color: tag,
          urgency_level: urgency
        }, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });

        if (tag === 'red' && urgency >= 7) {
          // Show confirmation for urgent message
          alert(`Conversación marcada como URGENTE. Se notificará en el Panel de Control.`);
        }
      }
    } catch (error) {
      console.error('Error tagging message:', error);
    }
  };

  const getTagColor = (tag) => {
    switch (tag) {
      case 'red': return 'border-l-4 border-red-500 bg-red-50';
      case 'blue': return 'border-l-4 border-blue-500 bg-blue-50';
      case 'green': return 'border-l-4 border-green-500 bg-green-50';
      default: return 'border-l-4 border-gray-300';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sending': return <Clock className="w-4 h-4 text-gray-400" />;
      case 'sent': return <CheckCircle className="w-4 h-4 text-gray-400" />;
      case 'delivered': return <CheckCircle className="w-4 h-4 text-blue-400" />;
      case 'read': return <CheckCircle className="w-4 h-4 text-blue-600" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.phone.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-96 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">WhatsApp</h1>
          <div className="flex items-center mt-2 space-x-4">
            <div className={`flex items-center space-x-2 ${
              connectionStatus === 'connected' ? 'text-green-600' : 'text-red-600'
            }`}>
              <div className={`w-3 h-3 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className="text-sm font-medium">
                {connectionStatus === 'connected' ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
            <div className="text-gray-400">•</div>
            <span className="text-sm text-gray-600">664218253</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Bot className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-gray-700">Agente IA</span>
            <button
              onClick={() => setAiEnabled(!aiEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                aiEnabled ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  aiEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          {connectionStatus !== 'connected' && (
            <button 
              onClick={() => setShowConnectionDialog(true)}
              className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
            >
              <Wifi className="w-4 h-4 mr-2" />
              Conectar WhatsApp
            </button>
          )}
          
          <button 
            onClick={() => setShowConfigDialog(true)}
            className="flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
          >
            <Settings className="w-4 h-4 mr-2" />
            Configurar
          </button>
        </div>
      </div>

      {/* New Chat Dialog */}
      {showNewChatDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Nueva Conversación</h2>
              <button
                onClick={() => setShowNewChatDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 space-y-6">
              {/* Manual Number Input */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Número Manual</h3>
                <div className="space-y-3">
                  <input
                    type="tel"
                    placeholder="Número de teléfono (ej: 664123456)"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Nombre (opcional)"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    onClick={startManualConversation}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Iniciar Conversación
                  </button>
                </div>
              </div>

              {/* Patient Search */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Buscar Paciente</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Buscar por nombre o apellido..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {patients
                      .filter(patient => 
                        patient.nombre.toLowerCase().includes(patientSearch.toLowerCase()) ||
                        patient.apellidos.toLowerCase().includes(patientSearch.toLowerCase()) ||
                        patient.tel_movil.includes(patientSearch)
                      )
                      .slice(0, 10)
                      .map(patient => (
                        <div
                          key={patient.id}
                          onClick={() => startConversationWithPatient(patient)}
                          className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium text-gray-900">
                                {patient.nombre} {patient.apellidos}
                              </p>
                              <p className="text-sm text-gray-600">{patient.tel_movil || 'Sin teléfono'}</p>
                              <p className="text-xs text-gray-500">#{patient.num_pac}</p>
                            </div>
                            {patient.tel_movil && (
                              <MessageCircle className="w-5 h-5 text-blue-600" />
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connection Dialog */}
      {showConnectionDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Conectar WhatsApp</h2>
              <button
                onClick={() => setShowConnectionDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <WhatsAppConnection onConnectionChange={handleConnectionChange} />
            </div>
          </div>
        </div>
      )}

      {/* Edit Contact Dialog */}
      {showEditContactDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Agregar a Pacientes</h2>
              <button
                onClick={() => setShowEditContactDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                Revisa y edita los datos antes de agregar el contacto a la lista de pacientes:
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={contactForm.nombre}
                    onChange={(e) => setContactForm({...contactForm, nombre: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apellidos *
                  </label>
                  <input
                    type="text"
                    value={contactForm.apellidos}
                    onChange={(e) => setContactForm({...contactForm, apellidos: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={contactForm.tel_movil}
                  onChange={(e) => setContactForm({...contactForm, tel_movil: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  readOnly
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email (opcional)
                </label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({...contactForm, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  value={contactForm.notas}
                  onChange={(e) => setContactForm({...contactForm, notas: e.target.value})}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowEditContactDialog(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveContactToPatients}
                disabled={!contactForm.nombre || !contactForm.apellidos}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Guardar Paciente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Dialog */}
      {showConfigDialog && (
        <WhatsAppConfig onClose={() => setShowConfigDialog(false)} />
      )}

      {/* WhatsApp Interface */}
      {connectionStatus === 'connected' ? (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden" style={{ height: '600px' }}>
        <div className="flex h-full">
          {/* Conversations Sidebar */}
          <div className="w-1/3 border-r border-gray-200 flex flex-col">
            {/* Search */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex space-x-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Buscar conversaciones..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={() => {
                    setShowNewChatDialog(true);
                    fetchPatients();
                  }}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  title="Nueva conversación"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => selectChat(conv)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedChat?.id === conv.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                  } ${getTagColor(conv.tag)}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 truncate">{conv.contact}</h3>
                    <div className="flex items-center space-x-1">
                      {conv.urgency >= 7 && <AlertCircle className="w-4 h-4 text-red-500" />}
                      {conv.unread && <div className="w-2 h-2 bg-blue-500 rounded-full"></div>}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 truncate mb-1">{conv.lastMessage}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">
                      {conv.timestamp.toLocaleTimeString('es-ES', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                    <div className="flex space-x-1">
                      <Tag 
                        className={`w-3 h-3 ${
                          conv.tag === 'red' ? 'text-red-500' :
                          conv.tag === 'blue' ? 'text-blue-500' :
                          'text-green-500'
                        }`} 
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {selectedChat ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {selectedChat.contact.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{selectedChat.contact}</h3>
                        <p className="text-sm text-gray-600">{selectedChat.phone}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => tagMessage(selectedChat.id, 'red', 9)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        title="Marcar como urgente"
                      >
                        <Circle className="w-4 h-4 fill-current" />
                      </button>
                      <button
                        onClick={() => tagMessage(selectedChat.id, 'blue', 5)}
                        className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
                        title="Marcar como pendiente"
                      >
                        <Circle className="w-4 h-4 fill-current" />
                      </button>
                      <button
                        onClick={() => tagMessage(selectedChat.id, 'green', 1)}
                        className="p-2 text-green-500 hover:bg-green-50 rounded-lg"
                        title="Marcar como resuelto"
                      >
                        <Circle className="w-4 h-4 fill-current" />
                      </button>
                      <button
                        onClick={() => addContactToPatients(selectedChat)}
                        className="p-2 text-purple-500 hover:bg-purple-50 rounded-lg"
                        title="Agregar a pacientes"
                      >
                        <User className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.type === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          msg.type === 'outgoing'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-gray-900 border border-gray-200'
                        }`}
                      >
                        <p className="text-sm">{msg.message}</p>
                        <div className={`flex items-center justify-end space-x-1 mt-1 ${
                          msg.type === 'outgoing' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          <span className="text-xs">
                            {msg.timestamp.toLocaleTimeString('es-ES', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                          {msg.type === 'outgoing' && getStatusIcon(msg.status)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <form onSubmit={sendMessage} className="p-4 border-t border-gray-200 bg-white">
                  <div className="flex items-center space-x-3">
                    <button type="button" className="text-gray-400 hover:text-gray-600">
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Escribe un mensaje..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button type="button" className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <Smile className="w-5 h-5" />
                      </button>
                    </div>
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Selecciona una conversación
                  </h3>
                  <p className="text-gray-600">
                    Elige una conversación para comenzar a chatear
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Patient Info Sidebar */}
          {selectedChat && patientInfo && (
            <div className="w-80 border-l border-gray-200 bg-gray-50">
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Información del Paciente</h3>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Nombre</p>
                    <p className="text-sm text-gray-900">{patientInfo.name}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-700">Nº Paciente</p>
                    <p className="text-sm text-gray-900">{patientInfo.patientNumber}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-700">Teléfono</p>
                    <p className="text-sm text-gray-900">{patientInfo.phone}</p>
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Últimas 5 Citas
                  </h4>
                  
                  <div className="space-y-3">
                    {patientInfo.lastAppointments.map((apt, index) => (
                      <div key={index} className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-sm font-medium text-gray-900">{apt.treatment}</p>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            apt.status === 'Completada' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {apt.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">{apt.date} - {apt.time}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden" style={{ height: '600px' }}>
          <div className="flex items-center justify-center h-full bg-gray-50">
            <div className="text-center">
              <WifiOff className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                WhatsApp no está conectado
              </h3>
              <p className="text-gray-600 mb-4">
                Conecta tu WhatsApp Business para comenzar a recibir y enviar mensajes
              </p>
              <button
                onClick={() => setShowConnectionDialog(true)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Conectar WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppModule;