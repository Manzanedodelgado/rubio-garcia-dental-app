import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  MessageCircle, Send, Smartphone, CheckCircle, 
  Clock, User, RefreshCw, Settings, Plus, Search, X
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const WhatsAppModuleSimple = () => {
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [connectedUser, setConnectedUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [pendingMessages, setPendingMessages] = useState([]); // Messages waiting to be confirmed
  const messagesEndRef = useRef(null); // Reference for auto-scroll
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualName, setManualName] = useState('');
  const [showOptionsMenu, setShowOptionsMenu] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }
  };

  // Auto-scroll effect
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check connection status
  const checkConnection = async () => {
    try {
      const authToken = localStorage.getItem('token');
      const response = await axios.get(`${API}/whatsapp/status`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });

      console.log('📡 WhatsApp Status:', response.data);
      
      setConnectionStatus(response.data.status);
      setConnectedUser(response.data.user);
      
      // For JMD user, ensure stable connection
      const currentUser = localStorage.getItem('currentUser');
      if (currentUser === 'JMD' && response.data.status === 'connected') {
        localStorage.setItem('whatsapp_stable_connection', 'true');
      }
      
    } catch (error) {
      console.error('❌ Error checking connection:', error);
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  };

  // Load conversations
  const loadConversations = async () => {
    try {
      const authToken = localStorage.getItem('token');
      
      // Load messages and patients in parallel
      const [messagesResponse, patientsResponse] = await Promise.all([
        axios.get(`${API}/whatsapp/messages`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        }),
        axios.get(`${API}/patients`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        })
      ]);

      const messagesData = messagesResponse.data;
      const patientsData = patientsResponse.data;
      
      // Create a map of phone numbers to patient names
      const patientNamesMap = new Map();
      patientsData.forEach(patient => {
        if (patient.tel_movil) {
          // Clean phone number for comparison
          const cleanPhone = patient.tel_movil.replace(/\D/g, '');
          patientNamesMap.set(cleanPhone, `${patient.nombre} ${patient.apellidos}`);
        }
      });

      console.log('📋 Patient names map created:', patientNamesMap.size);

      // Group messages by phone number to create conversations
      const conversationsMap = new Map();
      
      messagesData.forEach(msg => {
        const key = msg.phone_number;
        const cleanKey = key.replace(/\D/g, '');
        
        // Use patient name if available, otherwise use contact_name or phone number
        let displayName = msg.contact_name || key;
        if (patientNamesMap.has(cleanKey)) {
          displayName = patientNamesMap.get(cleanKey);
        } else if (patientNamesMap.has(key)) {
          displayName = patientNamesMap.get(key);
        }
        
        if (!conversationsMap.has(key)) {
          conversationsMap.set(key, {
            id: key,
            contact: displayName,
            phone: key,
            lastMessage: msg.message,
            timestamp: new Date(msg.timestamp),
            unread: msg.message_type === 'incoming' && !msg.status?.includes('read'),
            messageCount: 1
          });
        } else {
          const conv = conversationsMap.get(key);
          conv.messageCount++;
          // Update display name if we found a better one
          if (displayName !== key && conv.contact === key) {
            conv.contact = displayName;
          }
          if (new Date(msg.timestamp) > conv.timestamp) {
            conv.lastMessage = msg.message;
            conv.timestamp = new Date(msg.timestamp);
            conv.unread = msg.message_type === 'incoming' && !msg.status?.includes('read');
          }
        }
      });
      
      // Sort conversations by timestamp (newest first)
      const sortedConversations = Array.from(conversationsMap.values())
        .sort((a, b) => b.timestamp - a.timestamp);
      
      setConversations(sortedConversations);
      console.log('📋 Conversations loaded with patient names:', sortedConversations.length);
      
    } catch (error) {
      console.error('❌ Error loading conversations:', error);
      // Use fallback data
      setConversations([
        {
          id: '34648085696',
          contact: '34648085696',
          phone: '34648085696',
          lastMessage: 'Hola',
          timestamp: new Date(),
          unread: true,
          messageCount: 1
        }
      ]);
    }
  };

  // Send message
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    const tempMessage = {
      id: Date.now(),
      message: newMessage,
      timestamp: new Date(),
      type: 'outgoing',
      status: 'sending',
      temp: true // Mark as temporary
    };

    // Add to pending messages
    setPendingMessages(prev => [...prev, tempMessage]);
    
    // Add to messages immediately for UI
    setMessages(prev => [...prev, tempMessage]);
    
    const messageText = newMessage;
    setNewMessage('');

    // Scroll to bottom immediately after adding message
    setTimeout(scrollToBottom, 50);

    try {
      const authToken = localStorage.getItem('token');
      
      // Send via WhatsApp
      await axios.post(`${API}/whatsapp/send-real`, {
        phone_number: selectedChat.phone,
        message: messageText
      }, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });

      // Save to database
      await axios.post(`${API}/whatsapp/messages`, {
        contact_id: selectedChat.id,
        contact_name: selectedChat.contact,
        phone_number: selectedChat.phone,
        message: messageText,
        message_type: 'outgoing',
        status: 'sent'
      }, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });

      // Update message status to sent
      setMessages(prev => prev.map(m => 
        m.id === tempMessage.id ? { ...m, status: 'sent', temp: false } : m
      ));
      
      // Remove from pending
      setPendingMessages(prev => prev.filter(m => m.id !== tempMessage.id));

      console.log('✅ Message sent and saved successfully');
    } catch (error) {
      console.error('❌ Error sending message:', error);
      
      // Update message status to error
      setMessages(prev => prev.map(m => 
        m.id === tempMessage.id ? { ...m, status: 'error' } : m
      ));
      
      alert('Error al enviar mensaje');
    }
  };

  // Load messages for selected chat
  const loadMessages = async (chatId) => {
    try {
      const authToken = localStorage.getItem('token');
      console.log('📨 Loading messages for chat:', chatId);
      
      // Get all messages from backend
      const response = await axios.get(`${API}/whatsapp/messages`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      
      console.log('📨 All messages received:', response.data.length);
      
      // Filter messages for this specific contact from backend
      const backendMessages = response.data
        .filter(msg => msg.phone_number === chatId)
        .map(msg => ({
          id: msg.id || `backend-${Date.now()}-${Math.random()}`,
          message: msg.message,
          timestamp: new Date(msg.timestamp),
          type: msg.message_type === 'incoming' ? 'incoming' : 'outgoing',
          status: msg.status || 'sent',
          temp: false
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
      
      // Get current pending messages for this chat
      const currentPendingMessages = pendingMessages.filter(msg => 
        messages.some(m => m.id === msg.id && m.temp)
      );
      
      // Combine backend messages with pending messages, avoiding duplicates
      const combinedMessages = [...backendMessages];
      
      // Add pending messages that aren't already in backend
      currentPendingMessages.forEach(pendingMsg => {
        const exists = backendMessages.some(backendMsg => 
          backendMsg.message === pendingMsg.message && 
          Math.abs(backendMsg.timestamp - pendingMsg.timestamp) < 10000 // Within 10 seconds
        );
        
        if (!exists) {
          combinedMessages.push(pendingMsg);
        }
      });
      
      // Sort all messages by timestamp
      combinedMessages.sort((a, b) => a.timestamp - b.timestamp);
      
      console.log('📨 Final combined messages for', chatId, ':', combinedMessages.length);
      setMessages(combinedMessages);
      
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      // Keep existing messages on error to avoid losing pending messages
    }
  };

  // Initialize
  useEffect(() => {
    const currentUser = localStorage.getItem('currentUser');
    console.log('🚀 Initializing WhatsApp module for user:', currentUser);
    
    checkConnection();
    loadConversations();
    
    // For JMD user, check connection more frequently
    const connectionInterval = setInterval(() => {
      if (currentUser === 'JMD') {
        checkConnection();
        loadConversations();
        
        // If there's a selected chat, refresh its messages
        if (selectedChat) {
          loadMessages(selectedChat.id);
        }
      }
    }, 10000); // Check every 10 seconds for new messages
    
    return () => clearInterval(connectionInterval);
  }, [selectedChat]);

  // Separate effect for message polling when chat is selected
  useEffect(() => {
    if (selectedChat && connectionStatus === 'connected') {
      console.log('📨 Starting message polling for:', selectedChat.id);
      
      // Load messages immediately
      loadMessages(selectedChat.id);
      
      // Set up polling for this specific chat
      const messageInterval = setInterval(() => {
        loadMessages(selectedChat.id);
      }, 5000); // Check for new messages every 5 seconds
      
      return () => {
        console.log('📨 Stopping message polling for:', selectedChat.id);
        clearInterval(messageInterval);
      };
    }
  }, [selectedChat, connectionStatus]);

  // Select chat
  const selectChat = (chat) => {
    setSelectedChat(chat);
    loadMessages(chat.id);
    // Scroll to bottom when selecting a new chat
    setTimeout(scrollToBottom, 100);
  };

  // Load patients for new conversation
  const loadPatients = async () => {
    try {
      const authToken = localStorage.getItem('token');
      const response = await axios.get(`${API}/patients`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      setPatients(response.data);
      console.log('📋 Patients loaded:', response.data.length);
    } catch (error) {
      console.error('❌ Error loading patients:', error);
      setPatients([]);
    }
  };

  // Start new conversation with patient
  const startConversationWithPatient = (patient) => {
    if (!patient.tel_movil) {
      alert('Este paciente no tiene número de teléfono registrado');
      return;
    }
    
    const newChat = {
      id: patient.tel_movil,
      contact: `${patient.nombre} ${patient.apellidos}`,
      phone: patient.tel_movil,
      lastMessage: 'Nueva conversación iniciada',
      timestamp: new Date(),
      unread: false
    };

    // Add to conversations if not exists
    setConversations(prev => {
      const exists = prev.find(c => c.id === newChat.id);
      if (exists) {
        return prev;
      }
      return [newChat, ...prev];
    });

    // Select the new chat
    selectChat(newChat);
    setShowNewChatDialog(false);
    setPatientSearch('');
    
    console.log('✅ New conversation started with patient:', patient.nombre);
  };

  // Start manual conversation
  const startManualConversation = () => {
    if (!manualPhone.trim()) {
      alert('Por favor ingresa un número de teléfono');
      return;
    }

    const cleanPhone = manualPhone.replace(/\D/g, ''); // Remove non-digits
    const displayName = manualName.trim() || cleanPhone;
    
    const newChat = {
      id: cleanPhone,
      contact: displayName,
      phone: cleanPhone,
      lastMessage: 'Nueva conversación iniciada',
      timestamp: new Date(),
      unread: false
    };

    // Add to conversations if not exists
    setConversations(prev => {
      const exists = prev.find(c => c.id === newChat.id);
      if (exists) {
        return prev;
      }
      return [newChat, ...prev];
    });

    // Select the new chat
    selectChat(newChat);
    setShowNewChatDialog(false);
    setManualPhone('');
    setManualName('');
    
    console.log('✅ New manual conversation started with:', cleanPhone);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3">Cargando WhatsApp...</span>
      </div>
    );
  }

  return (
    <div className="h-full bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <MessageCircle className="w-8 h-8 text-green-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">WhatsApp Business</h1>
              <div className="flex items-center space-x-2">
                {connectionStatus === 'connected' ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-600">Conectado</span>
                    {connectedUser && (
                      <span className="text-xs text-gray-500">
                        ({connectedUser.id?.split(':')[0] || connectedUser.phone})
                      </span>
                    )}
                  </>
                ) : connectionStatus === 'checking' ? (
                  <>
                    <Clock className="w-4 h-4 text-blue-500 animate-pulse" />
                    <span className="text-sm text-blue-600">Verificando...</span>
                  </>
                ) : (
                  <>
                    <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                    <span className="text-sm text-red-600">Desconectado</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={checkConnection}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              title="Actualizar estado"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {connectionStatus === 'connected' ? (
        <div className="flex h-96">
          {/* Conversations List */}
          <div className="w-1/3 border-r border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Conversaciones</h3>
                <button
                  onClick={() => {
                    setShowNewChatDialog(true);
                    loadPatients();
                  }}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Nueva conversación"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="overflow-y-auto h-80">
              {conversations.map(chat => (
                <div
                  key={chat.id}
                  onClick={() => selectChat(chat)}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                    selectedChat?.id === chat.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-semibold">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{chat.contact}</p>
                      <p className="text-sm text-gray-500 truncate">{chat.lastMessage}</p>
                      <p className="text-xs text-gray-400">
                        {chat.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                    {chat.unread && (
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    )}
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
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{selectedChat.contact}</h3>
                      <p className="text-sm text-gray-500">
                        {selectedChat.phone} • {messages.length} mensajes
                      </p>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length > 0 ? (
                    messages.map(message => (
                      <div
                        key={message.id}
                        className={`flex ${message.type === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs px-4 py-2 rounded-lg ${
                            message.type === 'outgoing'
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 text-gray-900'
                          }`}
                        >
                          <p className="text-sm">{message.message}</p>
                          <div className="flex items-center justify-between mt-1">
                            <p className={`text-xs ${
                              message.type === 'outgoing' ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                              {message.timestamp.toLocaleTimeString()}
                            </p>
                            {message.type === 'outgoing' && (
                              <span className={`text-xs ml-2 ${
                                message.status === 'sending' ? 'text-blue-200' :
                                message.status === 'sent' ? 'text-blue-100' :
                                message.status === 'error' ? 'text-red-200' : 'text-blue-100'
                              }`}>
                                {message.status === 'sending' ? '⏳' :
                                 message.status === 'sent' ? '✓' :
                                 message.status === 'error' ? '✗' : '✓'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <MessageCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>No hay mensajes aún</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Los mensajes aparecerán aquí cuando lleguen
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Auto-scroll reference */}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="p-4 border-t border-gray-200">
                  <form onSubmit={sendMessage} className="flex space-x-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Escribe un mensaje..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>Selecciona una conversación para comenzar</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Smartphone className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              WhatsApp no está conectado
            </h3>
            <p className="text-gray-600 mb-4">
              El servicio de WhatsApp no está disponible en este momento
            </p>
            <button
              onClick={checkConnection}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              Verificar Conexión
            </button>
          </div>
        </div>
      )}

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
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Manual Number Input */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                  <Smartphone className="w-5 h-5 mr-2 text-blue-600" />
                  Número Manual
                </h3>
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
                    disabled={!manualPhone.trim()}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Iniciar Conversación
                  </button>
                </div>
              </div>

              {/* Patient Search */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                  <User className="w-5 h-5 mr-2 text-green-600" />
                  Buscar Paciente Existente
                </h3>
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre, apellido o teléfono..."
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {patients
                      .filter(patient => 
                        patient.nombre?.toLowerCase().includes(patientSearch.toLowerCase()) ||
                        patient.apellidos?.toLowerCase().includes(patientSearch.toLowerCase()) ||
                        patient.tel_movil?.includes(patientSearch)
                      )
                      .slice(0, 10)
                      .map(patient => (
                        <div
                          key={patient.id}
                          onClick={() => startConversationWithPatient(patient)}
                          className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium text-gray-900 group-hover:text-blue-600">
                                {patient.nombre} {patient.apellidos}
                              </p>
                              <p className="text-sm text-gray-600">
                                {patient.tel_movil || 'Sin teléfono registrado'}
                              </p>
                              {patient.num_pac && (
                                <p className="text-xs text-gray-500">#{patient.num_pac}</p>
                              )}
                            </div>
                            {patient.tel_movil ? (
                              <MessageCircle className="w-5 h-5 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            ) : (
                              <div className="w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center">
                                <X className="w-3 h-3 text-gray-500" />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    
                    {patients.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <User className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>No se encontraron pacientes</p>
                        <p className="text-sm">Cargando lista de pacientes...</p>
                      </div>
                    )}
                    
                    {patients.length > 0 && patientSearch && 
                     patients.filter(patient => 
                       patient.nombre?.toLowerCase().includes(patientSearch.toLowerCase()) ||
                       patient.apellidos?.toLowerCase().includes(patientSearch.toLowerCase()) ||
                       patient.tel_movil?.includes(patientSearch)
                     ).length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Search className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>No se encontraron pacientes con "{patientSearch}"</p>
                        <p className="text-sm">Intenta con otro término de búsqueda</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Info Note */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <MessageCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Cómo funciona:</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Los pacientes también pueden iniciarte una conversación enviándote un mensaje</li>
                      <li>Las conversaciones aparecerán automáticamente en tu lista</li>
                      <li>Puedes buscar pacientes registrados para contactarlos directamente</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppModuleSimple;