import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Smartphone, RefreshCw, CheckCircle, XCircle, 
  Clock, AlertCircle, Wifi, WifiOff, Phone 
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const WhatsAppConnection = ({ onConnectionChange }) => {
  const [qrCode, setQrCode] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(() => {
    // For JMD user, try to restore connection status from localStorage
    const currentUser = localStorage.getItem('currentUser');
    const savedStatus = localStorage.getItem('whatsapp_status');
    if (currentUser === 'JMD' && savedStatus) {
      return savedStatus;
    }
    return 'disconnected';
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [connectedUser, setConnectedUser] = useState(null);
  const [qrExpiry, setQrExpiry] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const canvasRef = useRef(null);

  useEffect(() => {
    let intervalId;
    let isPageVisible = !document.hidden;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 3;

    const fetchConnectionStatusRobust = async () => {
      try {
        await fetchConnectionStatus();
        reconnectAttempts = 0; // Reset on successful fetch
      } catch (error) {
        console.warn('WhatsApp connection check failed:', error);
        reconnectAttempts++;
        
        if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
          console.log(`Retry attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
          setTimeout(fetchConnectionStatus, 2000 * reconnectAttempts);
        }
      }
    };

    const startPolling = () => {
      console.log('🔄 WhatsApp: Starting connection polling');
      fetchConnectionStatusRobust();
      intervalId = setInterval(fetchConnectionStatusRobust, 3000); // More frequent polling
    };

    const stopPolling = () => {
      if (intervalId) {
        console.log('⏹️ WhatsApp: Stopping connection polling');
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    // Handle visibility changes
    const handleVisibilityChange = () => {
      const nowVisible = !document.hidden;
      
      if (nowVisible && !isPageVisible) {
        // Page became visible - aggressive reconnection
        console.log('👁️ WhatsApp: Page visible - forcing connection check');
        stopPolling();
        setTimeout(() => {
          startPolling();
        }, 100);
      }
      
      isPageVisible = nowVisible;
    };

    // Handle window focus
    const handleWindowFocus = () => {
      console.log('🎯 WhatsApp: Window focused - checking connection');
      if (isPageVisible) {
        fetchConnectionStatusRobust();
      }
    };

    // Start initial polling
    startPolling();
    
    // Add all event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('pageshow', handleWindowFocus);
    
    // Cleanup
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('pageshow', handleWindowFocus);
    };
  }, []);

  useEffect(() => {
    if (onConnectionChange) {
      onConnectionChange(connectionStatus, connectedUser);
    }
  }, [connectionStatus, connectedUser, onConnectionChange]);

  // Generate QR code on canvas when qrCode changes
  useEffect(() => {
    if (qrCode && canvasRef.current) {
      generateQRCode(qrCode);
    }
  }, [qrCode]);

  const generateQRCode = async (data) => {
    try {
      const QRCode = await import('qrcode');
      const canvas = canvasRef.current;
      await QRCode.toCanvas(canvas, data, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  // Timer for QR expiry
  useEffect(() => {
    if (!qrExpiry) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const left = Math.max(0, Math.floor((qrExpiry - now) / 1000));
      setTimeLeft(left);

      if (left === 0) {
        setQrCode(null);
        setQrExpiry(null);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [qrExpiry]);

  const fetchConnectionStatus = async () => {
    try {
      setError(null);
      
      // Always check both status and QR with proper auth headers
      const authToken = localStorage.getItem('token');
      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
      
      const [statusResponse, qrResponse] = await Promise.all([
        axios.get(`${API}/whatsapp/status`, { headers }),
        axios.get(`${API}/whatsapp/qr`, { headers })
      ]);

      const status = statusResponse.data;
      const qrData = qrResponse.data;

      console.log('🔍 Connection status received:', status);
      
      setConnectionStatus(status.status);
      setConnectedUser(status.user);
      setLastUpdate(new Date());

      // For JMD user, persist connection status
      const currentUser = localStorage.getItem('currentUser');
      if (currentUser === 'JMD') {
        localStorage.setItem('whatsapp_status', status.status);
      }

      if (qrData.qr && (status.status === 'connecting' || status.status === 'disconnected')) {
        setQrCode(qrData.qr);
        setQrExpiry(qrData.expires_at);
      } else if (status.status === 'connected') {
        setQrCode(null);
        setQrExpiry(null);
      }

    } catch (error) {
      console.error('Error fetching WhatsApp status:', error);
      setError('Error al conectar con el servicio de WhatsApp');
      // Don't set to error immediately, might be temporary
      if (connectionStatus === 'disconnected') {
        setConnectionStatus('error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchConnectionStatus();
  };

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          icon: <CheckCircle className="w-8 h-8 text-green-500" />,
          title: 'WhatsApp Conectado',
          subtitle: connectedUser ? `Conectado como: ${connectedUser.id?.split(':')[0] || 'Usuario'}` : 'Conectado exitosamente',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200'
        };
      case 'connecting':
        return {
          icon: <Clock className="w-8 h-8 text-blue-500 animate-pulse" />,
          title: 'Conectando...',
          subtitle: 'Escanea el código QR con WhatsApp',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200'
        };
      case 'disconnected':
        return {
          icon: <WifiOff className="w-8 h-8 text-gray-500" />,
          title: 'WhatsApp Desconectado',
          subtitle: 'Inicia sesión para comenzar a usar WhatsApp',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200'
        };
      case 'error':
        return {
          icon: <XCircle className="w-8 h-8 text-red-500" />,
          title: 'Error de Conexión',
          subtitle: error || 'No se pudo conectar con WhatsApp',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200'
        };
      default:
        return {
          icon: <AlertCircle className="w-8 h-8 text-yellow-500" />,
          title: 'Estado Desconocido',
          subtitle: 'Verificando conexión...',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200'
        };
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading && !qrCode && !connectedUser) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Verificando estado de WhatsApp...</span>
      </div>
    );
  }

  const statusConfig = getStatusConfig();

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className={`p-6 ${statusConfig.bgColor} ${statusConfig.borderColor} border-b`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {statusConfig.icon}
            <div>
              <h2 className={`text-xl font-semibold ${statusConfig.color}`}>
                {statusConfig.title}
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                {statusConfig.subtitle}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <span className="text-xs text-gray-500">
              Última actualización: {lastUpdate.toLocaleTimeString()}
            </span>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* QR Code Section */}
        {qrCode && connectionStatus === 'connecting' && (
          <div className="text-center">
            <div className="bg-white p-6 rounded-lg border-2 border-dashed border-gray-300 inline-block">
              <canvas 
                ref={canvasRef}
                className="mx-auto"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-center space-x-2">
                <Smartphone className="w-5 h-5 text-green-500" />
                <span className="text-sm font-medium text-gray-700">
                  Pasos para conectar WhatsApp:
                </span>
              </div>
              
              <ol className="text-sm text-gray-600 space-y-1 max-w-md mx-auto text-left">
                <li>1. Abre WhatsApp en tu teléfono</li>
                <li>2. Ve a Menú → WhatsApp Web</li>
                <li>3. Escanea este código QR</li>
                <li>4. ¡Listo! Tu WhatsApp estará conectado</li>
              </ol>

              {timeLeft > 0 && (
                <div className="flex items-center justify-center space-x-2 mt-4">
                  <Clock className="w-4 h-4 text-orange-500" />
                  <span className="text-sm text-orange-600 font-medium">
                    Código expira en: {formatTime(timeLeft)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Connected State */}
        {connectionStatus === 'connected' && connectedUser && (
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto">
              <Phone className="w-10 h-10" />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                ¡WhatsApp Conectado Exitosamente!
              </h3>
              <p className="text-gray-600 mt-1">
                Número conectado: <span className="font-medium">{connectedUser.id?.split(':')[0] || 'Usuario'}</span>
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-md mx-auto">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div className="text-sm text-green-700">
                  <p className="font-medium">Servicio activo</p>
                  <p>Los mensajes se procesarán automáticamente</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {connectionStatus === 'error' && (
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Error de Conexión</h3>
              <p className="text-gray-600 mt-1">{error}</p>
            </div>

            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              Reintentar Conexión
            </button>
          </div>
        )}

        {/* Disconnected State */}
        {connectionStatus === 'disconnected' && (
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
              <WifiOff className="w-10 h-10 text-gray-400" />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900">WhatsApp Desconectado</h3>
              <p className="text-gray-600 mt-1">Inicia sesión para comenzar a recibir mensajes</p>
            </div>

            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Iniciar Conexión
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Servicio: WhatsApp Business - 664218253</span>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' :
              connectionStatus === 'connecting' ? 'bg-blue-500 animate-pulse' :
              'bg-gray-400'
            }`}></div>
            <span className="capitalize">{connectionStatus}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppConnection;