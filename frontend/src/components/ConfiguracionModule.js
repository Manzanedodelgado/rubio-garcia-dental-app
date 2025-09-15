import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Settings, Upload, Save, User, Users, Shield, Palette,
  Image, Globe, Bell, Database, Key, Eye, EyeOff, Plus,
  Edit, Trash2, Check, X, Camera, Building
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ConfiguracionModule = () => {
  const [activeTab, setActiveTab] = useState('clinic');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [showNewUser, setShowNewUser] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState({});

  const [clinicSettings, setClinicSettings] = useState({
    clinic_name: 'Rubio García Dental',
    logo_url: '',
    icon_url: '',
    primary_color: '#007AFF',
    secondary_color: '#FFFFFF',
    accent_color: '#F2F2F7',
    whatsapp_number: '664218253',
    email: 'info@rubiogarciadental.com',
    address: 'Calle Mayor 19, Alcorcón, 28921 Madrid',
    website: 'www.rubiogarciadental.com',
    instagram: '@rubiogarciadental'
  });

  const [newUserData, setNewUserData] = useState({
    username: '',
    password: '',
    role: 'recepcionista',
    permissions: {
      dashboard: 'editor',
      agenda: 'editor',
      pacientes: 'editor',
      whatsapp: 'editor',
      recordatorios: 'editor',
      plantillas: 'reader',
      automatizaciones: 'reader',
      entrenamiento_ia: 'reader',
      configuracion: 'reader'
    }
  });

  const modules = [
    { id: 'dashboard', name: 'Panel de Control', icon: '📊' },
    { id: 'agenda', name: 'Agenda', icon: '📅' },
    { id: 'pacientes', name: 'Pacientes', icon: '👥' },
    { id: 'whatsapp', name: 'WhatsApp', icon: '💬' },
    { id: 'recordatorios', name: 'Recordatorios', icon: '📨' },
    { id: 'plantillas', name: 'Plantillas', icon: '📝' },
    { id: 'automatizaciones', name: 'Automatizaciones', icon: '⚙️' },
    { id: 'entrenamiento_ia', name: 'Entrenamiento IA', icon: '🤖' },
    { id: 'configuracion', name: 'Configuración', icon: '⚙️' }
  ];

  const colorPresets = [
    { name: 'Azul Clínica', primary: '#007AFF', secondary: '#4A90E2', accent: '#E3F2FD' },
    { name: 'Verde Médico', primary: '#10B981', secondary: '#34D399', accent: '#D1FAE5' },
    { name: 'Púrpura Moderno', primary: '#8B5CF6', secondary: '#A78BFA', accent: '#EDE9FE' },
    { name: 'Naranja Energético', primary: '#F59E0B', secondary: '#FBBF24', accent: '#FEF3C7' },
    { name: 'Rosa Elegante', primary: '#EC4899', secondary: '#F472B6', accent: '#FCE7F3' }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [settingsRes, usersRes] = await Promise.all([
        axios.get(`${API}/settings`).catch(() => ({ data: clinicSettings })),
        axios.get(`${API}/users`).catch(() => ({ data: [] }))
      ]);

      setClinicSettings(settingsRes.data);
      
      // Mock users for demo
      const mockUsers = [
        {
          id: '1',
          username: 'JMD',
          role: 'admin',
          permissions: {
            dashboard: 'editor',
            agenda: 'editor',
            pacientes: 'editor',
            whatsapp: 'editor',
            recordatorios: 'editor',
            plantillas: 'editor',
            automatizaciones: 'editor',
            entrenamiento_ia: 'editor',
            configuracion: 'editor'
          },
          created_at: new Date('2024-01-01'),
          last_login: new Date()
        },
        {
          id: '2',
          username: 'MGarcia',
          role: 'recepcionista',
          permissions: {
            dashboard: 'editor',
            agenda: 'editor',
            pacientes: 'editor',
            whatsapp: 'editor',
            recordatorios: 'editor',
            plantillas: 'reader',
            automatizaciones: 'reader',
            entrenamiento_ia: 'reader',
            configuracion: 'reader'
          },
          created_at: new Date('2024-01-15'),
          last_login: new Date(Date.now() - 2 * 60 * 60 * 1000)
        }
      ];
      
      setUsers([...mockUsers, ...usersRes.data]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveClinicSettings = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, clinicSettings);
      alert('Configuración guardada exitosamente');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/users`, newUserData);
      setShowNewUser(false);
      setNewUserData({
        username: '',
        password: '',
        role: 'recepcionista',
        permissions: {
          dashboard: 'editor',
          agenda: 'editor',
          pacientes: 'editor',
          whatsapp: 'editor',
          recordatorios: 'editor',
          plantillas: 'reader',
          automatizaciones: 'reader',
          entrenamiento_ia: 'reader',
          configuracion: 'reader'
        }
      });
      fetchData();
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Error al crear el usuario');
    }
  };

  const updateUserPermission = async (userId, module, permission) => {
    try {
      const user = users.find(u => u.id === userId);
      const updatedPermissions = { ...user.permissions, [module]: permission };
      
      await axios.put(`${API}/users/${userId}`, {
        ...user,
        permissions: updatedPermissions
      });
      
      setUsers(users.map(u => 
        u.id === userId 
          ? { ...u, permissions: updatedPermissions }
          : u
      ));
    } catch (error) {
      console.error('Error updating user permission:', error);
    }
  };

  const handleLogoUpload = async (event, type) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/settings/upload-${type}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setClinicSettings(prev => ({
        ...prev,
        [`${type}_url`]: response.data[`${type}_url`]
      }));
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      alert(`Error al subir el ${type}`);
    }
    
    event.target.value = '';
  };

  const applyColorPreset = (preset) => {
    setClinicSettings(prev => ({
      ...prev,
      primary_color: preset.primary,
      secondary_color: preset.secondary,
      accent_color: preset.accent
    }));
  };

  const tabs = [
    { id: 'clinic', name: 'Información de la Clínica', icon: Building },
    { id: 'appearance', name: 'Apariencia', icon: Palette },
    { id: 'users', name: 'Gestión de Usuarios', icon: Users },
    { id: 'backup', name: 'Backup y Seguridad', icon: Database }
  ];

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
          <h1 className="text-3xl font-bold text-gray-900">Configuración</h1>
          <p className="text-gray-600 mt-1">Personalización del sistema y gestión de usuarios</p>
        </div>
        {activeTab === 'clinic' && (
          <button
            onClick={handleSaveClinicSettings}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <TabIcon className="w-4 h-4" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Clinic Information Tab */}
          {activeTab === 'clinic' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Clínica</label>
                  <input
                    type="text"
                    value={clinicSettings.clinic_name}
                    onChange={(e) => setClinicSettings({...clinicSettings, clinic_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email de Contacto</label>
                  <input
                    type="email"
                    value={clinicSettings.email}
                    onChange={(e) => setClinicSettings({...clinicSettings, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono WhatsApp</label>
                  <input
                    type="tel"
                    value={clinicSettings.whatsapp_number}
                    onChange={(e) => setClinicSettings({...clinicSettings, whatsapp_number: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sitio Web</label>
                  <input
                    type="url"
                    value={clinicSettings.website}
                    onChange={(e) => setClinicSettings({...clinicSettings, website: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <textarea
                  value={clinicSettings.address}
                  onChange={(e) => setClinicSettings({...clinicSettings, address: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows="2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
                <input
                  type="text"
                  value={clinicSettings.instagram}
                  onChange={(e) => setClinicSettings({...clinicSettings, instagram: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="@rubiogarciadental"
                />
              </div>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              {/* Logo Upload */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Logo Principal</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                    {clinicSettings.logo_url ? (
                      <div className="space-y-3">
                        <img src={clinicSettings.logo_url} alt="Logo" className="h-16 mx-auto" />
                        <button className="text-sm text-blue-600 hover:text-blue-800">Cambiar Logo</button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Camera className="w-12 h-12 text-gray-400 mx-auto" />
                        <div>
                          <label className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
                            Subir Logo
                            <input type="file" accept="image/*" onChange={(e) => handleLogoUpload(e, 'logo')} className="hidden" />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Icono/Favicon</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                    {clinicSettings.icon_url ? (
                      <div className="space-y-3">
                        <img src={clinicSettings.icon_url} alt="Icono" className="h-12 w-12 mx-auto" />
                        <button className="text-sm text-blue-600 hover:text-blue-800">Cambiar Icono</button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Image className="w-12 h-12 text-gray-400 mx-auto" />
                        <div>
                          <label className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
                            Subir Icono
                            <input type="file" accept="image/*" onChange={(e) => handleLogoUpload(e, 'icon')} className="hidden" />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Color Presets */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Paletas de Colores Predefinidas</label>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {colorPresets.map((preset, index) => (
                    <button
                      key={index}
                      onClick={() => applyColorPreset(preset)}
                      className="p-4 border border-gray-300 rounded-lg hover:border-gray-400 transition-colors text-left"
                    >
                      <div className="flex space-x-2 mb-2">
                        <div className="w-6 h-6 rounded" style={{ backgroundColor: preset.primary }}></div>
                        <div className="w-6 h-6 rounded" style={{ backgroundColor: preset.secondary }}></div>
                        <div className="w-6 h-6 rounded" style={{ backgroundColor: preset.accent }}></div>
                      </div>
                      <p className="text-sm font-medium text-gray-900">{preset.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Colors */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color Primario</label>
                  <div className="flex space-x-2">
                    <input
                      type="color"
                      value={clinicSettings.primary_color}
                      onChange={(e) => setClinicSettings({...clinicSettings, primary_color: e.target.value})}
                      className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={clinicSettings.primary_color}
                      onChange={(e) => setClinicSettings({...clinicSettings, primary_color: e.target.value})}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color Secundario</label>
                  <div className="flex space-x-2">
                    <input
                      type="color"
                      value={clinicSettings.secondary_color}
                      onChange={(e) => setClinicSettings({...clinicSettings, secondary_color: e.target.value})}
                      className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={clinicSettings.secondary_color}
                      onChange={(e) => setClinicSettings({...clinicSettings, secondary_color: e.target.value})}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color de Acento</label>
                  <div className="flex space-x-2">
                    <input
                      type="color"
                      value={clinicSettings.accent_color}
                      onChange={(e) => setClinicSettings({...clinicSettings, accent_color: e.target.value})}
                      className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={clinicSettings.accent_color}
                      onChange={(e) => setClinicSettings({...clinicSettings, accent_color: e.target.value})}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Gestión de Usuarios</h3>
                <button
                  onClick={() => setShowNewUser(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Usuario
                </button>
              </div>

              {/* Users Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Último Acceso</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Permisos</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold mr-3">
                              {user.username.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{user.username}</p>
                              <p className="text-xs text-gray-500">Creado: {user.created_at.toLocaleDateString('es-ES')}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            user.role === 'admin' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {user.role === 'admin' ? 'Administrador' : 'Recepcionista'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {user.last_login ? user.last_login.toLocaleString('es-ES') : 'Nunca'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            {modules.slice(0, 3).map((module) => (
                              <div key={module.id} className="flex items-center justify-between text-xs">
                                <span className="text-gray-600">{module.name}:</span>
                                <select
                                  value={user.permissions[module.id] || 'reader'}
                                  onChange={(e) => updateUserPermission(user.id, module.id, e.target.value)}
                                  className="text-xs border-0 bg-transparent focus:ring-0 p-0"
                                  disabled={user.role === 'admin'}
                                >
                                  <option value="reader">Lector</option>
                                  <option value="editor">Editor</option>
                                </select>
                              </div>
                            ))}
                            <button className="text-xs text-blue-600 hover:text-blue-800">Ver todos</button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex space-x-2">
                            <button className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Editar">
                              <Edit className="w-4 h-4" />
                            </button>
                            {user.role !== 'admin' && (
                              <button className="p-1 text-red-600 hover:bg-red-50 rounded" title="Eliminar">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Backup Tab */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 rounded-lg p-6">
                  <div className="flex items-center mb-4">
                    <Database className="w-6 h-6 text-blue-600 mr-2" />
                    <h3 className="text-lg font-semibold text-gray-900">Backup Automático</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Los backups se realizan automáticamente todos los días a las 00:00h
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Último backup:</span>
                      <span className="font-medium">Hoy 00:00</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Estado:</span>
                      <span className="text-green-600 font-medium">Exitoso</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tamaño:</span>
                      <span className="font-medium">2.3 MB</span>
                    </div>
                  </div>
                  <button className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors">
                    Crear Backup Manual
                  </button>
                </div>

                <div className="bg-green-50 rounded-lg p-6">
                  <div className="flex items-center mb-4">
                    <Shield className="w-6 h-6 text-green-600 mr-2" />
                    <h3 className="text-lg font-semibold text-gray-900">Seguridad</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Encriptación de datos</span>
                      <span className="text-green-600 text-sm font-medium">Activa</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Autenticación 2FA</span>
                      <span className="text-yellow-600 text-sm font-medium">Pendiente</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Logs de acceso</span>
                      <span className="text-green-600 text-sm font-medium">Habilitados</span>
                    </div>
                  </div>
                  <button className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition-colors">
                    Configurar Seguridad
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New User Modal */}
      {showNewUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Nuevo Usuario</h2>
              <button
                onClick={() => setShowNewUser(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de usuario</label>
                <input
                  type="text"
                  value={newUserData.username}
                  onChange={(e) => setNewUserData({...newUserData, username: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                <input
                  type="password"
                  value={newUserData.password}
                  onChange={(e) => setNewUserData({...newUserData, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select
                  value={newUserData.role}
                  onChange={(e) => setNewUserData({...newUserData, role: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="recepcionista">Recepcionista</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors"
                >
                  Crear Usuario
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewUser(false)}
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

export default ConfiguracionModule;