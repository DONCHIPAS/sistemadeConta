import { useEffect, useState } from 'react';
import { cuentasAPI } from '../services/api';

const CATEGORIAS = ['cuenta', 'subcuenta', 'divisionaria', 'subdivisionaria'];
const TIPOS_SALDO = ['deudor', 'acreedor'];
const ELEMENTOS_NOMBRES = {
  1: 'Activo Disponible', 2: 'Activo Realizable', 3: 'Activo Inmovilizado',
  4: 'Pasivo', 5: 'Patrimonio', 6: 'Gastos', 7: 'Ingresos',
};
const PAGE_SIZE = 20;

export default function PlanCuentas() {
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroElemento, setFiltroElemento] = useState('');
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ codigo: '', nombre: '', tipo_saldo: 'deudor', elemento: 1, categoria: 'cuenta' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchCuentas = () => {
    setLoading(true);
    cuentasAPI.getAll({ limit: 500, ...(filtroElemento ? { elemento: filtroElemento } : {}) })
      .then(r => setCuentas(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCuentas(); setPage(0); }, [filtroElemento]);

  const filtered = cuentas.filter(c =>
    c.codigo.includes(search) || c.nombre.toLowerCase().includes(search.toLowerCase())
  );
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const openCreate = () => {
    setForm({ codigo: '', nombre: '', tipo_saldo: 'deudor', elemento: 1, categoria: 'cuenta' });
    setError(''); setModal('create');
  };
  const openEdit = (c) => {
    setSelected(c);
    setForm({ codigo: c.codigo, nombre: c.nombre, tipo_saldo: c.tipo_saldo, elemento: c.elemento, categoria: c.categoria });
    setError(''); setModal('edit');
  };
  const openDelete = (c) => { setSelected(c); setError(''); setModal('delete'); };

  const handleSave = async () => {
    if (!form.codigo || !form.nombre) { setError('Código y nombre son requeridos.'); return; }
    setSaving(true); setError('');
    try {
      if (modal === 'create') await cuentasAPI.create(form);
      else await cuentasAPI.update(selected.codigo, { nombre: form.nombre, tipo_saldo: form.tipo_saldo, elemento: form.elemento, categoria: form.categoria });
      setModal(null); fetchCuentas();
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al guardar.');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await cuentasAPI.delete(selected.codigo);
      setModal(null); fetchCuentas();
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al eliminar.');
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Plan de Cuentas PCGE</div>
        <div className="page-sub">Plan Contable General Empresarial — {filtered.length} cuentas</div>
      </div>
      <div className="toolbar">
        <input className="search-input" placeholder="Buscar por código o nombre..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }} />
        <select className="filter-select" value={filtroElemento} onChange={e => setFiltroElemento(e.target.value)}>
          <option value="">Todos los elementos</option>
          {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>Elemento {n} — {ELEMENTOS_NOMBRES[n]}</option>)}
        </select>
        <button className="btn btn-primary" onClick={openCreate}>+ Nueva Cuenta</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Código</th><th>Nombre</th><th>Elemento</th>
              <th>Tipo Saldo</th><th>Categoría</th><th>Estado</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="loading">Cargando cuentas...</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={7} className="empty">No se encontraron cuentas</td></tr>
            ) : paginated.map(c => (
              <tr key={c.id}>
                <td className="codigo-cell">{c.codigo}</td>
                <td>{c.nombre}</td>
                <td>{c.elemento}</td>
                <td><span className={`badge badge-${c.tipo_saldo}`}>{c.tipo_saldo}</span></td>
                <td>{c.categoria}</td>
                <td><span className={`badge ${c.activo ? 'badge-active' : 'badge-inactive'}`}>{c.activo ? 'Activa' : 'Inactiva'}</span></td>
                <td>
                  <div style={{display:'flex',gap:6}}>
                    <button className="btn btn-ghost" style={{padding:'4px 10px',fontSize:12}} onClick={() => openEdit(c)}>Editar</button>
                    <button className="btn btn-danger" style={{padding:'4px 10px',fontSize:12}} onClick={() => openDelete(c)}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="pagination">
            <span>Mostrando {page * PAGE_SIZE + 1}–{Math.min((page+1)*PAGE_SIZE, filtered.length)} de {filtered.length}</span>
            <div className="pagination-btns">
              <button className="page-btn" onClick={() => setPage(p => p-1)} disabled={page === 0}>← Anterior</button>
              <button className="page-btn" onClick={() => setPage(p => p+1)} disabled={page >= totalPages-1}>Siguiente →</button>
            </div>
          </div>
        )}
      </div>

      {(modal === 'create' || modal === 'edit') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{modal === 'create' ? 'Nueva Cuenta Contable' : 'Editar Cuenta'}</div>
            <div className="form-group">
              <label className="form-label">Código</label>
              <input className="form-input" value={form.codigo}
                onChange={e => setForm(f => ({...f, codigo: e.target.value}))}
                disabled={modal === 'edit'} placeholder="Ej: 1011"
                style={{fontFamily:'JetBrains Mono, monospace'}} />
            </div>
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input className="form-input" value={form.nombre}
                onChange={e => setForm(f => ({...f, nombre: e.target.value}))}
                placeholder="Nombre de la cuenta" />
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div className="form-group">
                <label className="form-label">Elemento</label>
                <select className="form-input" value={form.elemento} onChange={e => setForm(f => ({...f, elemento: Number(e.target.value)}))}>
                  {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n} — {ELEMENTOS_NOMBRES[n]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de Saldo</label>
                <select className="form-input" value={form.tipo_saldo} onChange={e => setForm(f => ({...f, tipo_saldo: e.target.value}))}>
                  {TIPOS_SALDO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select className="form-input" value={form.categoria} onChange={e => setForm(f => ({...f, categoria: e.target.value}))}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {error && <div style={{color:'var(--red)',fontSize:13,marginBottom:8}}>{error}</div>}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : modal === 'create' ? 'Crear Cuenta' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'delete' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Eliminar Cuenta</div>
            <p style={{color:'var(--text2)',fontSize:14,marginBottom:8}}>¿Estás seguro de desactivar la cuenta:</p>
            <p style={{color:'var(--accent)',fontFamily:'JetBrains Mono, monospace',fontSize:14,marginBottom:20}}>
              {selected?.codigo} — {selected?.nombre}
            </p>
            {error && <div style={{color:'var(--red)',fontSize:13,marginBottom:8}}>{error}</div>}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={saving}>
                {saving ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
