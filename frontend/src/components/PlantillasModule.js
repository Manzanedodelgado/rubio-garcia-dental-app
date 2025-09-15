import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  FileText, Plus, Edit, Trash2, Eye, Copy, Search, 
  Save, X, MessageSquare, Tag, User, Calendar, Clock
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PlantillasModule = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [previewMode, setPreviewMode] = useState(false);

  const [templateData, setTemplateData] = useState({
    name: '',
    content: '',
    category: 'general',
    variables: []
  });

  const categories = [
    { id: 'general', name: 'General', color: 'bg-gray-100 text-gray-800' },
    { id: 'recordatorio', name: 'Recordatorios', color: 'bg-blue-100 text-blue-800' },
    { id: 'cuestionario', name: 'Cuestionarios', color: 'bg-green-100 text-green-800' },
    { id: 'consentimiento', name: 'Consentimientos', color: 'bg-purple-100 text-purple-800' },
    { id: 'seguimiento', name: 'Seguimiento', color: 'bg-orange-100 text-orange-800' }
  ];

  const availableVariables = [
    { name: 'nombre', description: 'Nombre del paciente', example: 'María' },
    { name: 'apellido', description: 'Apellidos del paciente', example: 'García López' },
    { name: 'fecha_cita', description: 'Fecha de la cita', example: '20/12/2024' },
    { name: 'hora_cita', description: 'Hora de la cita', example: '10:30' },
    { name: 'tratamiento', description: 'Tipo de tratamiento', example: 'Limpieza dental' },
    { name: 'odontologo', description: 'Nombre del odontólogo', example: 'Dr. Rubio García' },
    { name: 'clinica', description: 'Nombre de la clínica', example: 'Rubio García Dental' },
    { name: 'telefono_clinica', description: 'Teléfono de la clínica', example: '664218253' }
  ];

  const predefinedTemplates = [
    {
      id: 'reminder_24h',
      name: 'Recordatorio 24h antes',
      category: 'recordatorio',
      content: `Hola {{nombre}},

Le recordamos que tiene una cita programada para mañana {{fecha_cita}} a las {{hora_cita}} en {{clinica}}.

Tratamiento: {{tratamiento}}
Odontólogo: {{odontologo}}

Si necesita cambiar la cita, por favor contacte con nosotros al {{telefono_clinica}}.

¡Le esperamos!`,
      variables: ['nombre', 'fecha_cita', 'hora_cita', 'tratamiento', 'odontologo', 'clinica', 'telefono_clinica']
    },
    {
      id: 'satisfaction_survey',
      name: 'Cuestionario de Satisfacción',
      category: 'cuestionario',
      content: `Hola {{nombre}},

Esperamos que se encuentre bien después de su tratamiento de {{tratamiento}}.

¿Podría ayudarnos respondiendo estas preguntas?

1. ¿Cómo calificaría su experiencia? (Excelente/Buena/Regular/Mala)
2. ¿Recomendaría nuestros servicios? (Sí/No)
3. ¿Algún comentario adicional?

Su opinión es muy importante para nosotros.

Gracias,
{{clinica}}`,
      variables: ['nombre', 'tratamiento', 'clinica']
    },
    {
      id: 'post_surgery_care',
      name: 'Cuidados Post-Cirugía',
      category: 'seguimiento',
      content: `Hola {{nombre}},

Esperamos que se esté recuperando bien de su cirugía.

RECORDATORIO DE MEDICACIÓN:
- Tome su antibiótico cada 8 horas
- Analgésico según necesidad (máximo cada 6 horas)
- Enjuague con agua salada después de 24 horas

CUIDADOS:
- No fume durante las primeras 48 horas
- Evite comidas calientes el primer día
- Si hay sangrado excesivo, contacte inmediatamente

¿Cómo se siente? ¿Tiene alguna molestia?

{{odontologo}}
{{clinica}} - {{telefono_clinica}}`,
      variables: ['nombre', 'odontologo', 'clinica', 'telefono_clinica']
    }
  ];

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await axios.get(`${API}/templates`);
      // Combine with predefined templates for demo
      const combinedTemplates = [...predefinedTemplates, ...response.data];
      setTemplates(combinedTemplates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      setTemplates(predefinedTemplates);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    try {
      if (editingTemplate) {
        await axios.put(`${API}/templates/${editingTemplate.id}`, templateData);
      } else {
        await axios.post(`${API}/templates`, templateData);
      }
      
      setShowEditor(false);
      setEditingTemplate(null);
      setTemplateData({ name: '', content: '', category: 'general', variables: [] });
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
    }
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateData({
      name: template.name,
      content: template.content,
      category: template.category,
      variables: template.variables || []
    });
    setShowEditor(true);
  };

  const handleDeleteTemplate = async (templateId) => {
    if (window.confirm('¿Está seguro de eliminar esta plantilla?')) {
      try {
        await axios.delete(`${API}/templates/${templateId}`);
        fetchTemplates();
      } catch (error) {
        console.error('Error deleting template:', error);
      }
    }
  };

  const insertVariable = (variable) => {
    const textarea = document.getElementById('template-content');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = templateData.content;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const newContent = before + `{{${variable}}}` + after;
    
    setTemplateData({ ...templateData, content: newContent });
    
    // Update variables list if not already included
    if (!templateData.variables.includes(variable)) {
      setTemplateData(prev => ({
        ...prev,
        variables: [...prev.variables, variable]
      }));
    }
  };

  const previewTemplate = (template) => {
    let preview = template.content;
    const sampleData = {
      nombre: 'María',
      apellido: 'García López',
      fecha_cita: '20/12/2024',
      hora_cita: '10:30',
      tratamiento: 'Limpieza dental',
      odontologo: 'Dr. Rubio García',
      clinica: 'Rubio García Dental',
      telefono_clinica: '664218253'
    };

    Object.keys(sampleData).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      preview = preview.replace(regex, sampleData[key]);
    });

    return preview;
  };

  const duplicateTemplate = (template) => {
    setTemplateData({
      name: `${template.name} (Copia)`,
      content: template.content,
      category: template.category,
      variables: template.variables || []
    });
    setEditingTemplate(null);
    setShowEditor(true);
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryInfo = (categoryId) => {
    return categories.find(cat => cat.id === categoryId) || categories[0];
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
          <h1 className="text-3xl font-bold text-gray-900">Plantillas</h1>
          <p className="text-gray-600 mt-1">Diseño y gestión de plantillas de mensajes</p>
        </div>
        <button
          onClick={() => setShowEditor(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium transition-colors flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva Plantilla
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar plantillas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Todas las categorías</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => {
          const categoryInfo = getCategoryInfo(template.category);
          return (
            <div key={template.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{template.name}</h3>
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${categoryInfo.color}`}>
                      {categoryInfo.name}
                    </span>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => {setPreviewMode(template); setShowEditor(true);}}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Vista previa"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => duplicateTemplate(template)}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Duplicar"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <p className="text-sm text-gray-700 line-clamp-4">
                    {template.content.substring(0, 150)}
                    {template.content.length > 150 && '...'}
                  </p>
                </div>
                
                {template.variables && template.variables.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2">Variables utilizadas:</p>
                    <div className="flex flex-wrap gap-1">
                      {template.variables.slice(0, 3).map((variable) => (
                        <span key={variable} className="inline-flex px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {variable}
                        </span>
                      ))}
                      {template.variables.length > 3 && (
                        <span className="inline-flex px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                          +{template.variables.length - 3} más
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditTemplate(template)}
                    className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors text-sm font-medium"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="flex items-center justify-center px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        
        {filteredTemplates.length === 0 && (
          <div className="col-span-full">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay plantillas</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || selectedCategory !== 'all' 
                  ? 'No se encontraron plantillas con los filtros aplicados'
                  : 'Crea tu primera plantilla para comenzar'
                }
              </p>
              {!searchTerm && selectedCategory === 'all' && (
                <button
                  onClick={() => setShowEditor(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Crear Plantilla
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Template Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-90vh overflow-y-auto">
            <div className="flex">
              {/* Editor */}
              <div className="flex-1 p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {previewMode ? 'Vista Previa' : editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowEditor(false);
                      setEditingTemplate(null);
                      setPreviewMode(false);
                      setTemplateData({ name: '', content: '', category: 'general', variables: [] });
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                {previewMode ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{previewMode.name}</h3>
                      <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getCategoryInfo(previewMode.category).color}`}>
                        {getCategoryInfo(previewMode.category).name}
                      </span>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Vista Previa con Datos de Ejemplo:</h4>
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <pre className="whitespace-pre-wrap text-sm text-gray-900 font-sans">
                          {previewTemplate(previewMode)}
                        </pre>
                      </div>
                    </div>
                    
                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          handleEditTemplate(previewMode);
                          setPreviewMode(false);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        Editar Plantilla
                      </button>
                      <button
                        onClick={() => {
                          duplicateTemplate(previewMode);
                          setPreviewMode(false);
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        Duplicar Plantilla
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSaveTemplate} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la plantilla *</label>
                        <input
                          type="text"
                          value={templateData.name}
                          onChange={(e) => setTemplateData({...templateData, name: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Ej: Recordatorio de cita"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                        <select
                          value={templateData.category}
                          onChange={(e) => setTemplateData({...templateData, category: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          {categories.map(category => (
                            <option key={category.id} value={category.id}>{category.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contenido del mensaje *</label>
                      <textarea
                        id="template-content"
                        value={templateData.content}
                        onChange={(e) => setTemplateData({...templateData, content: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        rows="12"
                        placeholder="Escriba el contenido de su plantilla aquí. Use {{variable}} para insertar variables dinámicas."
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Tip: Haga clic en las variables de la derecha para insertarlas automáticamente
                      </p>
                    </div>
                    
                    <div className="flex space-x-3">
                      <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {editingTemplate ? 'Actualizar' : 'Crear'} Plantilla
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowEditor(false);
                          setEditingTemplate(null);
                          setTemplateData({ name: '', content: '', category: 'general', variables: [] });
                        }}
                        className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Variables Sidebar */}
              {!previewMode && (
                <div className="w-80 bg-gray-50 p-6 border-l border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Variables Disponibles</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Haga clic en una variable para insertarla en el cursor
                  </p>
                  
                  <div className="space-y-2">
                    {availableVariables.map((variable) => (
                      <button
                        key={variable.name}
                        type="button"
                        onClick={() => insertVariable(variable.name)}
                        className="w-full text-left p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-blue-600">
                            {`{{${variable.name}}}`}
                          </span>
                          <Tag className="w-4 h-4 text-gray-400" />
                        </div>
                        <p className="text-xs text-gray-600 mb-1">{variable.description}</p>
                        <p className="text-xs text-gray-500">Ej: {variable.example}</p>
                      </button>
                    ))}
                  </div>
                  
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Consejos</h4>
                    <ul className="text-xs text-blue-800 space-y-1">
                      <li>• Use variables para personalizar mensajes</li>
                      <li>• Las variables se reemplazan automáticamente</li>
                      <li>• Puede combinar texto libre con variables</li>
                      <li>• Revise la vista previa antes de guardar</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlantillasModule;