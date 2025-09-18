// src/pages/Insumos.jsx
import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import {
  Package, Plus, Edit, Trash2, AlertTriangle, Pill,
  Calendar, MapPin, Barcode, Truck, RotateCcw, Bell, Box,
  Tag // Nuevo icono para categoría
} from 'lucide-react';
import api from '../api/fhirApi';

const Insumos = () => {
  const [insumos, setInsumos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [alertasStock, setAlertasStock] = useState([]);
  const [alertasVencimiento, setAlertasVencimiento] = useState([]);
  const [filtroActivo, setFiltroActivo] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalEditarAbierto, setModalEditarAbierto] = useState(false);
  const [modalAlertasAbierto, setModalAlertasAbierto] = useState(false);
  const [insumoEditando, setInsumoEditando] = useState(null);
  const [cargando, setCargando] = useState(true);

  // --- Estados para lotes ---
  const [modalLotesOpen, setModalLotesOpen] = useState(false);
  const [selectedInsumo, setSelectedInsumo] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [lotesLoading, setLotesLoading] = useState(false);
  const [loteForm, setLoteForm] = useState({
    lote: '',
    cantidad: '',
    fecha_vencimiento: '',
    precio_unitario: '',
    ubicacion: ''
  });

  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    stock: '',
    stock_minimo: '',
    precio: '',
    unidad_medida: '',
    codigo_referencia: '',
    proveedor_id: '',
    fecha_vencimiento: '',
    lote: '',
    ubicacion_almacen: '',
    activo: true,
    categoria: '' // Nuevo campo
  });

  // Opciones de categoría
  const categorias = [
    'Habitacion y Alimentacion',
    'Honorarios Medicos',
    'Cirugia',
    'Insumos Quirurgicos',
    'Monitoreo y Oxigeno',
    'Soluciones IV',
    'Ampollas',
    'Antibioticos',
    'Tabletas',
    'Medicamentos Especiales',
    'Insumos Generales',
    'Nebulizaciones',
    'Laboratorios',
    'Estudios Especiales',
    'Procedimientos',
    'Patologia',
    'Medicamentos Ambulatorios',
    'Varios'
  ];

  // Helper: format ISO-like date into DD/MM/YYYY without timezone shifts
  const formatDateForDisplay = (iso) => {
    if (!iso) return '';
    try {
      const datePart = String(iso).split('T')[0];
      const [y, m, d] = datePart.split('-');
      return `${d}/${m}/${y}`;
    } catch (e) {
      return String(iso);
    }
  };

  // Normaliza lote recibido del backend: asegura fecha YYYY-MM-DD
  const normalizeLote = (raw) => {
    if (!raw) return raw;
    let fecha = null;
    if (raw.fecha_vencimiento) {
      if (raw.fecha_vencimiento instanceof Date) {
        fecha = raw.fecha_vencimiento.toISOString().split('T')[0];
      } else {
        fecha = String(raw.fecha_vencimiento).split('T')[0];
      }
    }
    return {
      ...raw,
      fecha_vencimiento: fecha,
    };
  };

  const fetchInsumos = async () => {
    try {
      const res = await api.get(`/insumos`);
      setInsumos(res.data || []);
      setCargando(false);
    } catch (err) {
      console.error('Error al obtener insumos:', err.message || err);
      setCargando(false);
    }
  };

  const fetchProveedores = async () => {
    try {
      const res = await api.get(`/proveedores`);
      setProveedores(res.data || []);
    } catch (err) {
      console.error('Error al obtener proveedores:', err.message || err);
    }
  };

  const fetchAlertas = async () => {
    try {
      const [stockRes, vencimientoRes] = await Promise.all([
        api.get(`/insumos/alertas/stock-minimo`),
        api.get(`/insumos/alertas/proximos-vencer?dias=30`)
      ]);
      setAlertasStock(stockRes.data || []);
      setAlertasVencimiento(vencimientoRes.data || []);
    } catch (err) {
      console.error('Error al obtener alertas:', err.message || err);
    }
  };

  // --- Lotes: fetch, open/close, add, consumir ---
  const fetchLotes = async (insumoId) => {
    setLotesLoading(true);
    try {
      const res = await api.get(`/insumosFarmacia/${insumoId}/lotes`);
      const data = res.data || [];
      const normalized = data.map(normalizeLote);
      normalized.sort((a, b) => {
        if (!a.fecha_vencimiento) return 1;
        if (!b.fecha_vencimiento) return -1;
        return a.fecha_vencimiento.localeCompare(b.fecha_vencimiento);
      });
      setLotes(normalized);
    } catch (err) {
      console.error('Error obtener lotes:', err.response?.data || err.message || err);
      setLotes([]);
    } finally {
      setLotesLoading(false);
    }
  };

  const openLotesModal = async (insumo) => {
    setSelectedInsumo(insumo);
    setModalLotesOpen(true);
    await fetchLotes(insumo.id);
  };

  const closeLotesModal = () => {
    setModalLotesOpen(false);
    setSelectedInsumo(null);
    setLotes([]);
    setLoteForm({ lote: '', cantidad: '', fecha_vencimiento: '', precio_unitario: '', ubicacion: '' });
  };

  const handleLoteChange = e => {
    const { name, value } = e.target;
    setLoteForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAgregarLote = async (e) => {
    e.preventDefault();
    if (!selectedInsumo) return alert('Selecciona un insumo');
    if (!loteForm.lote || !loteForm.cantidad) return alert('Lote y cantidad son obligatorios');

    try {
      const payload = {
        lote: loteForm.lote,
        cantidad: parseInt(loteForm.cantidad, 10),
        fecha_vencimiento: loteForm.fecha_vencimiento ? loteForm.fecha_vencimiento : null,
        precio_unitario: loteForm.precio_unitario === '' ? null : parseFloat(loteForm.precio_unitario),
        ubicacion: loteForm.ubicacion || null
      };
      await api.post(`/insumosFarmacia/${selectedInsumo.id}/lotes`, payload);
      // refrescar
      await Promise.all([fetchInsumos(), fetchAlertas(), fetchLotes(selectedInsumo.id)]);
      // limpiar form
      setLoteForm({ lote: '', cantidad: '', fecha_vencimiento: '', precio_unitario: '', ubicacion: '' });
    } catch (err) {
      // Manejo de errores similar al componente de InsumosMedicos
      if (err.response) {
        console.error('Error response:', {
          status: err.response.status,
          statusText: err.response.statusText,
          url: err.config?.url,
          method: err.config?.method,
          headers: err.response.headers,
          data: err.response.data,
        });

        const serverMsg = err.response.data?.error || err.response.data?.message || (typeof err.response.data === 'string' ? err.response.data : null);

        alert(
          `Error ${err.response.status} ${err.response.statusText}\n` +
          `${serverMsg ? serverMsg + '\n' : ''}` +
          `Revisa la consola (console.error) para más detalles.`
        );
      } else if (err.request) {
        console.error('No response received (err.request):', err.request);
        alert('No se recibió respuesta del servidor. Revisa la conexión o el servidor.');
      } else {
        console.error('Request setup error:', err.message, err);
        alert(err.message || 'Error desconocido al construir la petición');
      }
      if (err.stack) console.debug('Stack trace:', err.stack);
    }
  };

  const handleConsumirLote = async (loteId) => {
    if (!selectedInsumo) return;
    try {
      await api.patch(`/insumosFarmacia/${selectedInsumo.id}/consumir`, { loteId });
      await Promise.all([fetchInsumos(), fetchAlertas(), fetchLotes(selectedInsumo.id)]);
      alert('Lote consumido exitosamente');
    } catch (err) {
      console.error('Error al consumir lote:', err.response?.data || err.message || err);
      alert(err.response?.data?.error || 'Error al consumir lote');
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/insumos`, {
        ...form,
        stock: form.stock === '' ? 0 : parseInt(form.stock, 10),
        stock_minimo: form.stock_minimo === '' ? 0 : parseInt(form.stock_minimo, 10),
        precio: form.precio === '' ? null : parseFloat(form.precio),
        proveedor_id: form.proveedor_id ? parseInt(form.proveedor_id, 10) : null,
        fecha_vencimiento: form.fecha_vencimiento ? form.fecha_vencimiento : null
      });

      resetForm();
      setModalAbierto(false);
      await fetchInsumos();
      await fetchAlertas();
    } catch (err) {
      console.error('Error al crear insumo:', err.response?.data || err.message || err);
      alert(err.response?.data?.error || 'Error al crear insumo');
    }
  };

  const abrirModalEditar = (insumo) => {
    setInsumoEditando(insumo);

    // Use the date part directly (YYYY-MM-DD) to avoid timezone adjustments
    let fechaFormateada = '';
    if (insumo && insumo.fecha_vencimiento) {
      fechaFormateada = String(insumo.fecha_vencimiento).split('T')[0];
    }

    setForm({
      nombre: insumo.nombre,
      descripcion: insumo.descripcion || '',
      stock: (insumo.stock ?? 0).toString(),
      stock_minimo: (insumo.stock_minimo ?? 0).toString(),
      precio: insumo.precio != null ? insumo.precio.toString() : '',
      unidad_medida: insumo.unidad_medida || '',
      codigo_referencia: insumo.codigo_referencia || '',
      proveedor_id: insumo.proveedor_id ? insumo.proveedor_id.toString() : '',
      fecha_vencimiento: fechaFormateada,
      lote: insumo.lote || '',
      ubicacion_almacen: insumo.ubicacion_almacen || '',
      activo: insumo.activo,
      categoria: insumo.categoria || '' // Nuevo campo
    });

    setModalEditarAbierto(true);
  };

  const handleActualizar = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        stock: form.stock === '' ? 0 : parseInt(form.stock, 10),
        stock_minimo: form.stock_minimo === '' ? 0 : parseInt(form.stock_minimo, 10),
        precio: form.precio === '' ? null : parseFloat(form.precio),
        proveedor_id: form.proveedor_id ? parseInt(form.proveedor_id, 10) : null,
        fecha_vencimiento: form.fecha_vencimiento ? form.fecha_vencimiento : null
      };

      await api.put(`/insumos/${insumoEditando.id}`, payload);

      // Refresh full list to ensure associations (Proveedor) are present
      await fetchInsumos();

      setModalEditarAbierto(false);
      resetForm();
      await fetchAlertas();
    } catch (err) {
      console.error('Error al actualizar insumo:', err.response?.data || err.message || err);
      alert(err.response?.data?.error || 'Error al actualizar insumo');
    }
  };

  const handleEliminar = async (id) => {
    if (window.confirm('¿Estás seguro de que quieres marcar este insumo como inactivo?')) {
      try {
        await api.delete(`/insumos/${id}`);
        await fetchInsumos();
        await fetchAlertas();
      } catch (err) {
        console.error('Error al eliminar insumo:', err.message || err);
      }
    }
  };

  const handleReactivar = async (id) => {
    try {
      await api.put(`/insumos/${id}`, { activo: true });
      await fetchInsumos();
      await fetchAlertas();
    } catch (err) {
      console.error('Error al reactivar insumo:', err.message || err);
    }
  };

  const resetForm = () => {
    setForm({
      nombre: '',
      descripcion: '',
      stock: '',
      stock_minimo: '',
      precio: '',
      unidad_medida: '',
      codigo_referencia: '',
      proveedor_id: '',
      fecha_vencimiento: '',
      lote: '',
      ubicacion_almacen: '',
      activo: true,
      categoria: '' // Nuevo campo
    });
    setInsumoEditando(null);
  };

  const insumosFiltrados = insumos.filter(insumo =>
    filtroActivo ? insumo.activo : !insumo.activo
  );

  const totalAlertas = (alertasStock?.length || 0) + (alertasVencimiento?.length || 0);

  useEffect(() => {
    fetchInsumos();
    fetchProveedores();
    fetchAlertas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (cargando) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando insumos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-3 rounded-xl">
                <Pill className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Farmacia - Insumos</h1>
                <p className="text-gray-600">Gestión de inventario farmacéutico</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setModalAlertasAbierto(true)}
                className="relative bg-white border border-red-200 text-red-700 hover:bg-red-50 px-4 py-2 rounded-lg shadow transition-all duration-200 flex items-center space-x-2"
              >
                <Bell className="w-5 h-5" />
                <span>Alertas</span>
                {totalAlertas > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center">
                    {totalAlertas}
                  </span>
                )}
              </button>

              <div className="bg-gray-100 rounded-lg p-1 flex">
                <button
                  onClick={() => setFiltroActivo(true)}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${filtroActivo ? 'bg-white shadow-sm' : 'text-gray-600'}`}
                >
                  Activos
                </button>
                <button
                  onClick={() => setFiltroActivo(false)}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${!filtroActivo ? 'bg-white shadow-sm' : 'text-gray-600'}`}
                >
                  Inactivos
                </button>
              </div>

              <button
                onClick={() => setModalAbierto(true)}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-4 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>Agregar Insumo</span>
              </button>
            </div>
          </div>
        </div>

        {insumosFiltrados.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="text-gray-400 mb-4">
              <Package className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {filtroActivo ? 'No hay insumos activos' : 'No hay insumos inactivos'}
            </h3>
            <p className="text-gray-600 mb-6">
              {filtroActivo
                ? 'Comienza agregando tu primer insumo al inventario de farmacia'
                : 'Todos los insumos están activos'}
            </p>
            {filtroActivo && (
              <button
                onClick={() => setModalAbierto(true)}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2 mx-auto"
              >
                <Plus className="w-5 h-5" />
                <span>Agregar Primer Insumo</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {insumosFiltrados.map((insumo) => (
              <div key={insumo.id} className={`bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden ${!insumo.activo ? 'opacity-70' : ''}`}>
                {/* Header de la tarjeta */}
                <div className={`px-6 py-4 ${insumo.activo ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gray-500'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Pill className="w-6 h-6 text-white" />
                      <h3 className="text-lg font-semibold text-white truncate">{insumo.nombre}</h3>
                    </div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => abrirModalEditar(insumo)}
                        className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-all duration-200"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => openLotesModal(insumo)}
                        className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-all duration-200"
                        title="Lotes"
                      >
                        <Box className="w-4 h-4" />
                      </button>

                      {insumo.activo ? (
                        <button
                          onClick={() => handleEliminar(insumo.id)}
                          className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-all duration-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivar(insumo.id)}
                          className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-all duration-200"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {insumo.codigo_referencia && (
                    <div className="flex items-center mt-2 text-white/90">
                      <Barcode className="w-4 h-4 mr-1" />
                      <span className="text-sm">{insumo.codigo_referencia}</span>
                    </div>
                  )}
                </div>

                {/* Contenido de la tarjeta */}
                <div className="p-6">
                  <p className="text-gray-600 mb-4 text-sm">{insumo.descripcion || 'Sin descripción'}</p>

                  {/* Información adicional (sin stock_minimo arriba) */}
                  <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                    {insumo.unidad_medida && (
                      <div className="flex items-center">
                        <span className="text-gray-700 font-medium">Unidad:</span>
                        <span className="ml-1 text-gray-900">{insumo.unidad_medida}</span>
                      </div>
                    )}

                    {insumo.categoria && (
                      <div className="flex items-center">
                        <Tag className="w-4 h-4 text-gray-500 mr-1" />
                        <span className="text-gray-700 font-medium">Categoría:</span>
                        <span className="ml-1 text-gray-900 truncate">{insumo.categoria}</span>
                      </div>
                    )}

                    {insumo.Proveedor && (
                      <div className="flex items-center col-span-2">
                        <Truck className="w-4 h-4 text-gray-500 mr-1" />
                        <span className="text-gray-700 font-medium">Proveedor:</span>
                        <span className="ml-1 text-gray-900 truncate">{insumo.Proveedor.nombre}</span>
                      </div>
                    )}

                    {insumo.lote && (
                      <div className="flex items-center">
                        <span className="text-gray-700 font-medium">Lote:</span>
                        <span className="ml-1 text-gray-900">{insumo.lote}</span>
                      </div>
                    )}

                    {insumo.fecha_vencimiento && (
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 text-gray-500 mr-1" />
                        <span className="text-gray-700 font-medium">Vence:</span>
                        <span className="ml-1 text-gray-900">{formatDateForDisplay(insumo.fecha_vencimiento)}</span>
                      </div>
                    )}

                    {insumo.ubicacion_almacen && (
                      <div className="flex items-center col-span-2">
                        <MapPin className="w-4 h-4 text-gray-500 mr-1" />
                        <span className="text-gray-700 font-medium">Ubicación:</span>
                        <span className="ml-1 text-gray-900">{insumo.ubicacion_almacen}</span>
                      </div>
                    )}
                  </div>

                  {/* Información del stock y precio */}
                  <div className="space-y-3 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Stock disponible:</span>
                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          insumo.stock_minimo > 0 && insumo.stock <= insumo.stock_minimo
                            ? 'bg-red-100 text-red-800'
                            : insumo.stock <= (insumo.stock_minimo > 0 ? insumo.stock_minimo * 2 : 25)
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {insumo.stock} unidades
                        </span>
                        {insumo.stock_minimo > 0 && insumo.stock <= insumo.stock_minimo && (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    </div>

                    {/* Aquí mostramos el stock mínimo (movido abajo) */}
                    {insumo.stock_minimo != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Stock mínimo:</span>
                        <span className="text-sm text-gray-600">{insumo.stock_minimo} {insumo.unidad_medida ? '' : ''}</span>
                      </div>
                    )}

                    {insumo.precio != null && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Precio unitario:</span>
                          <span className="text-lg font-bold text-green-600">Q{insumo.precio}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Valor total:</span>
                          <span className="text-sm font-semibold text-gray-900">Q{(Number(insumo.stock || 0) * Number(insumo.precio || 0)).toFixed(2)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Indicador de estado */}
                  {!insumo.activo && (
                    <div className="mt-4 p-3 bg-gray-100 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-800">Insumo inactivo</span>
                      </div>
                    </div>
                  )}

                  {insumo.activo && insumo.stock_minimo > 0 && insumo.stock <= insumo.stock_minimo && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium text-red-800">Stock bajo</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal para crear nuevo insumo */}
        <Modal isOpen={modalAbierto} onClose={() => { setModalAbierto(false); resetForm(); }}>
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-emerald-600 p-2 rounded-lg">
              <Pill className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Nuevo Insumo de Farmacia</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  name="descripcion"
                  value={form.descripcion}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock *</label>
                <input
                  type="number"
                  name="stock"
                  value={form.stock}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                  required
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Mínimo *</label>
                <input
                  type="number"
                  name="stock_minimo"
                  value={form.stock_minimo}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                  required
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio</label>
                <input
                  type="number"
                  step="0.01"
                  name="precio"
                  value={form.precio}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unidad de Medida *</label>
                <select
                  name="unidad_medida"
                  value={form.unidad_medida}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                  required
                >
                  <option value="">Seleccionar unidad</option>
                  <option value="unidad">Unidad</option>
                  <option value="caja">Caja</option>
                  <option value="blister">Blister</option>
                  <option value="frasco">Frasco</option>
                  <option value="ampolla">Ampolla</option>
                  <option value="jeringa">Jeringa</option>
                  <option value="mg">mg</option>
                  <option value="ml">ml</option>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="l">L</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código de Referencia *</label>
                <input
                  type="text"
                  name="codigo_referencia"
                  value={form.codigo_referencia}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select
                  name="categoria"
                  value={form.categoria}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                >
                  <option value="">Seleccionar categoría</option>
                  {categorias.map((categoria, index) => (
                    <option key={index} value={categoria}>
                      {categoria}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                <select
                  name="proveedor_id"
                  value={form.proveedor_id}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                >
                  <option value="">Seleccionar proveedor</option>
                  {proveedores.map(proveedor => (
                    <option key={proveedor.id} value={proveedor.id}>
                      {proveedor.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Vencimiento</label>
                <input
                  type="date"
                  name="fecha_vencimiento"
                  value={form.fecha_vencimiento}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lote</label>
                <input
                  type="text"
                  name="lote"
                  value={form.lote}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación en Almacén</label>
                <input
                  type="text"
                  name="ubicacion_almacen"
                  value={form.ubicacion_almacen}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div className="md:col-span-2 flex items-center">
                <input
                  type="checkbox"
                  name="activo"
                  checked={form.activo}
                  onChange={handleChange}
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">Insumo activo</label>
              </div>
            </div>

            <div className="flex justify-end pt-4 gap-3">
              <button
                type="button"
                onClick={() => { setModalAbierto(false); resetForm(); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all duration-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2"
              >
                <Package className="w-5 h-5" />
                <span>Guardar</span>
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal para editar insumo */}
        <Modal isOpen={modalEditarAbierto} onClose={() => { setModalEditarAbierto(false); resetForm(); }}>
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-yellow-600 p-2 rounded-lg">
              <Edit className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Editar Insumo</h3>
          </div>

          <form onSubmit={handleActualizar} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  name="descripcion"
                  value={form.descripcion}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200 resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock *</label>
                <input
                  type="number"
                  name="stock"
                  value={form.stock}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                  required
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Mínimo *</label>
                <input
                  type="number"
                  name="stock_minimo"
                  value={form.stock_minimo}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                  required
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio</label>
                <input
                  type="number"
                  step="0.01"
                  name="precio"
                  value={form.precio}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unidad de Medida *</label>
                <select
                  name="unidad_medida"
                  value={form.unidad_medida}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                  required
                >
                  <option value="">Seleccionar unidad</option>
                  <option value="unidad">Unidad</option>
                  <option value="caja">Caja</option>
                  <option value="blister">Blister</option>
                  <option value="frasco">Frasco</option>
                  <option value="ampolla">Ampolla</option>
                  <option value="jeringa">Jeringa</option>
                  <option value="mg">mg</option>
                  <option value="ml">ml</option>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="l">L</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código de Referencia *</label>
                <input
                  type="text"
                  name="codigo_referencia"
                  value={form.codigo_referencia}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select
                  name="categoria"
                  value={form.categoria}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                >
                  <option value="">Seleccionar categoría</option>
                  {categorias.map((categoria, index) => (
                    <option key={index} value={categoria}>
                      {categoria}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                <select
                  name="proveedor_id"
                  value={form.proveedor_id}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                >
                  <option value="">Seleccionar proveedor</option>
                  {proveedores.map(proveedor => (
                    <option key={proveedor.id} value={proveedor.id}>
                      {proveedor.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Vencimiento</label>
                <input
                  type="date"
                  name="fecha_vencimiento"
                  value={form.fecha_vencimiento}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lote</label>
                <input
                  type="text"
                  name="lote"
                  value={form.lote}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación en Almacén</label>
                <input
                  type="text"
                  name="ubicacion_almacen"
                  value={form.ubicacion_almacen}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div className="md:col-span-2 flex items-center">
                <input
                  type="checkbox"
                  name="activo"
                  checked={form.activo}
                  onChange={handleChange}
                  className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">Insumo activo</label>
              </div>
            </div>

            <div className="flex justify-end pt-4 gap-3">
              <button
                type="button"
                onClick={() => { setModalEditarAbierto(false); resetForm(); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all duration-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2"
              >
                <Edit className="w-5 h-5" />
                <span>Actualizar</span>
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal Lotes */}
        <Modal isOpen={modalLotesOpen} onClose={closeLotesModal} size="lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="bg-emerald-600 p-2 rounded-lg">
                <Box className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedInsumo ? `Lotes - ${selectedInsumo.nombre}` : 'Lotes'}</h3>
                <p className="text-sm text-gray-600">Stock actual: {selectedInsumo?.stock || 0} {selectedInsumo?.unidad_medida || ''}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (!selectedInsumo) return;
                  await Promise.all([fetchInsumos(), fetchAlertas(), fetchLotes(selectedInsumo.id)]);
                }}
                className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              >
                Refrescar
              </button>
              <button
                onClick={closeLotesModal}
                className="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Lista de lotes */}
            <div className="bg-white p-4 rounded-lg shadow">
              <h4 className="font-semibold mb-3">Lotes disponibles</h4>
              {lotesLoading ? (
                <p className="text-sm text-gray-600">Cargando lotes...</p>
              ) : lotes.length === 0 ? (
                <p className="text-sm text-gray-600">No hay lotes registrados para este insumo.</p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                  {lotes.map(l => (
                    <div key={l.id} className={`p-3 border rounded ${l.cantidad_restante > 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{l.lote}</p>
                            {l.precio_unitario && (
                              <span className="text-xs text-gray-500">(Q{l.precio_unitario})</span>
                            )}
                          </div>
                          <p className="text-gray-600 text-xs mt-1"><span className="font-medium">Cantidad:</span> {l.cantidad_restante} / {l.cantidad}</p>
                          {l.fecha_vencimiento && (
                            <p className="text-gray-600 text-xs"><span className="font-medium">Vence:</span> {formatDateForDisplay(l.fecha_vencimiento)}</p>
                          )}
                          {l.ubicacion && (
                            <p className="text-gray-600 text-xs"><span className="font-medium">Ubicación:</span> {l.ubicacion}</p>
                          )}
                        </div>
                        <div className="text-right">
                          {!l.activo && <span className="text-xs text-gray-500 block">Inactivo</span>}
                          {l.cantidad_restante === 0 && (
                            <span className="text-xs text-red-600 block mt-1">Agotado</span>
                          )}
                          {l.cantidad_restante > 0 && selectedInsumo?.stock === 0 && (
                            <button onClick={() => handleConsumirLote(l.id)} className="mt-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs transition-colors">Consumir</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form: agregar lote + información de consumo */}
            <div className="bg-white p-4 rounded-lg shadow space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Agregar nuevo lote</h4>
                <form onSubmit={handleAgregarLote} className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input name="lote" placeholder="Nombre de lote" value={loteForm.lote} onChange={handleLoteChange} className="px-3 py-2 border rounded text-sm" required />
                    <input name="cantidad" type="number" placeholder="Cantidad" value={loteForm.cantidad} onChange={handleLoteChange} className="px-3 py-2 border rounded text-sm" min="1" required />
                    <input name="fecha_vencimiento" type="date" placeholder="Fecha vencimiento" value={loteForm.fecha_vencimiento} onChange={handleLoteChange} className="px-3 py-2 border rounded text-sm" />
                    <input name="precio_unitario" type="number" step="0.01" placeholder="Precio unitario" value={loteForm.precio_unitario} onChange={handleLoteChange} className="px-3 py-2 border rounded text-sm" />
                  </div>

                  <input name="ubicacion" placeholder="Ubicación" value={loteForm.ubicacion} onChange={handleLoteChange} className="w-full px-3 py-2 border rounded text-sm" />

                  <div className="flex justify-end">
                    <button type="submit" className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-4 py-2 rounded text-sm transition-colors">Agregar Lote</button>
                  </div>
                </form>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">Información de consumo</h4>
                {selectedInsumo?.stock === 0 ? (
                  <div>
                    <p className="text-xs text-gray-600 mb-2">El stock del insumo está agotado. Puedes consumir un lote completo haciendo clic en el botón "Consumir" junto a cada lote disponible.</p>
                    <p className="text-xs text-gray-600">Al consumir un lote, toda su cantidad se transferirá al stock del insumo y se actualizará la información (precio, fecha de vencimiento, etc.).</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-gray-600">El stock actual del insumo es de {selectedInsumo?.stock || 0} unidades. Solo podrás consumir lotes cuando el stock llegue a 0.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Modal>

        {/* Modal de Alertas */}
        <Modal isOpen={modalAlertasAbierto} onClose={() => setModalAlertasAbierto(false)} size="lg">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-red-600 p-2 rounded-lg">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Alertas del Sistema</h3>
          </div>

          <div className="space-y-6">
            {alertasStock.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
                  Insumos con stock bajo
                </h4>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  {alertasStock.map(insumo => (
                    <div key={insumo.id} className="flex justify-between items-center py-2 border-b border-red-100 last:border-b-0">
                      <div>
                        <p className="font-medium text-red-800">{insumo.nombre}</p>
                        <p className="text-sm text-red-700">Stock actual: {insumo.stock} unidades</p>
                        <p className="text-sm text-red-700">Stock mínimo: {insumo.stock_minimo} unidades</p>
                      </div>
                      <button
                        onClick={() => {
                          abrirModalEditar(insumo);
                          setModalAlertasAbierto(false);
                        }}
                        className="text-red-700 hover:text-red-900 text-sm font-medium"
                      >
                        Reabastecer
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {alertasVencimiento.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Calendar className="w-5 h-5 text-amber-500 mr-2" />
                  Insumos próximos a vencer
                </h4>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  {alertasVencimiento.map(insumo => (
                    <div key={insumo.id} className="py-2 border-b border-amber-100 last:border-b-0">
                      <p className="font-medium text-amber-800">{insumo.nombre}</p>
                      <p className="text-sm text-amber-700">Vence: {formatDateForDisplay(insumo.fecha_vencimiento)} | Lote: {insumo.lote}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {totalAlertas === 0 && (
              <div className="text-center py-8">
                <div className="bg-green-100 text-green-800 p-4 rounded-lg">
                  <p className="font-medium">¡No hay alertas en este momento!</p>
                  <p className="text-sm mt-1">Todo está bajo control en el inventario.</p>
                </div>
              </div>
            )}
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default Insumos;
