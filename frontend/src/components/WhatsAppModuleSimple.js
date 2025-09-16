import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  MessageCircle, Send, Smartphone, CheckCircle, 
  Clock, User, RefreshCw, Settings
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
      const response = await axios.get(`${API}/whatsapp/messages`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });

      // Group messages by phone number
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
            unread: msg.message_type === 'incoming' && !msg.status?.includes('read')
          });
        } else {
          const conv = conversationsMap.get(key);
          if (new Date(msg.timestamp) > conv.timestamp) {
            conv.lastMessage = msg.message;
            conv.timestamp = new Date(msg.timestamp);
          }
        }
      });
      
      setConversations(Array.from(conversationsMap.values()));
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
          unread: true
        }
      ]);
    }
  };

  // Send message
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    try {
      const authToken = localStorage.getItem('token');
      await axios.post(`${API}/whatsapp/send-real`, {
        phone_number: selectedChat.phone,
        message: newMessage
      }, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });

      // Add message to local state
      setMessages(prev => [...prev, {
        id: Date.now(),
        message: newMessage,
        timestamp: new Date(),
        type: 'outgoing',
        status: 'sent'
      }]);

      setNewMessage('');
      console.log('✅ Message sent successfully');
    } catch (error) {
      console.error('❌ Error sending message:', error);
      alert('Error al enviar mensaje');
    }
  };

  // Load messages for selected chat
  const loadMessages = async (chatId) => {
    try {
      const authToken = localStorage.getItem('token');
      console.log('📨 Loading messages for chat:', chatId);
      
      // Get all messages first
      const response = await axios.get(`${API}/whatsapp/messages`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      
      console.log('📨 All messages received:', response.data.length);
      
      // Filter messages for this specific contact
      const messagesData = response.data
        .filter(msg => msg.phone_number === chatId)
        .map(msg => ({
          id: msg.id || Date.now() + Math.random(),
          message: msg.message,
          timestamp: new Date(msg.timestamp),
          type: msg.message_type === 'incoming' ? 'incoming' : 'outgoing',
          status: msg.status || 'sent'
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
      
      console.log('📨 Filtered messages for', chatId, ':', messagesData.length);
      setMessages(messagesData);
      
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      setMessages([]);
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
              <h3 className="font-semibold text-gray-900">Conversaciones</h3>
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
                      <p className="text-sm text-gray-500">{selectedChat.phone}</p>
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
                          <p className={`text-xs mt-1 ${
                            message.type === 'outgoing' ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {message.timestamp.toLocaleTimeString()}
                          </p>
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
    </div>
  );
};

export default WhatsAppModuleSimple;