import { useEffect, useState } from 'react';
import { cuentasAPI } from '../services/api';

const ELEMENTOS = [
  { num: 1, name: 'Activo Disponible y Exigible' },
  { num: 2, name: 'Activo Realizable' },
  { num: 3, name: 'Activo Inmovilizado' },
  { num: 4, name: 'Pasivo' },
  { num: 5, name: 'Patrimonio' },
  { num: 6, name: 'Gastos por Naturaleza' },
  { num: 7, name: 'Ingresos' },
];

export default function Dashboard() {
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cuentasAPI.getAll({ limit: 500 })
      .then(r => setCuentas(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const total = cuentas.length;
  const activas = cuentas.filter(c => c.activo).length;
  const deudoras = cuentas.filter(c => c.tipo_saldo === 'deudor').length;
  const acreedoras = cuentas.filter(c => c.tipo_saldo === 'acreedor').length;

  const byElemento = ELEMENTOS.map(e => ({
    ...e,
    count: cuentas.filter(c => c.elemento === e.num).length,
  }));

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-sub">Plan Contable General Empresarial — Vista general</div>
      </div>

      <div className="cards-grid">
        <div className="card accent">
          <div className="card-label">Total Cuentas</div>
          <div className="card-value">{loading ? '—' : total}</div>
          <div className="card-sub">Cuentas PCGE registradas</div>
        </div>
        <div className="card">
          <div className="card-label">Activas</div>
          <div className="card-value" style={{color:'#22c55e'}}>{loading ? '—' : activas}</div>
          <div className="card-sub">En uso</div>
        </div>
        <div className="card">
          <div className="card-label">Deudoras</div>
          <div className="card-value" style={{color:'#4f8ef7'}}>{loading ? '—' : deudoras}</div>
          <div className="card-sub">Naturaleza deudora</div>
        </div>
        <div className="card">
          <div className="card-label">Acreedoras</div>
          <div className="card-value" style={{color:'#a78bfa'}}>{loading ? '—' : acreedoras}</div>
          <div className="card-sub">Naturaleza acreedora</div>
        </div>
      </div>

      <div className="page-header" style={{marginBottom:16}}>
        <div className="page-title" style={{fontSize:15}}>Cuentas por Elemento</div>
      </div>

      <div className="elementos-grid">
        {byElemento.map(e => (
          <div key={e.num} className="elemento-card">
            <div className="elemento-num">{e.num}</div>
            <div style={{fontSize:20, fontWeight:700, color:'var(--text)', margin:'4px 0'}}>{loading ? '—' : e.count}</div>
            <div className="elemento-name">{e.name}</div>
          </div>
        ))}
      </div>

      <div className="page-header" style={{marginBottom:16}}>
        <div className="page-title" style={{fontSize:15}}>Últimas cuentas registradas</div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Elemento</th>
              <th>Tipo Saldo</th>
              <th>Categoría</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="loading">Cargando...</td></tr>
            ) : cuentas.slice(0, 10).map(c => (
              <tr key={c.id}>
                <td className="codigo-cell">{c.codigo}</td>
                <td>{c.nombre}</td>
                <td>{c.elemento}</td>
                <td>
                  <span className={`badge badge-${c.tipo_saldo}`}>{c.tipo_saldo}</span>
                </td>
                <td>{c.categoria}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
