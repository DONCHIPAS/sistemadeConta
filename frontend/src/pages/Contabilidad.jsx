import { useState, useEffect } from 'react';
import { cuentasAPI } from '../services/api';
import * as XLSX from 'xlsx';

const fmt = (n) => 'S/ ' + (n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const fmtN = (n) => (n||0).toFixed(2);

const clasificarCuenta = (codigo) => {
  const c = parseInt(codigo);
  // INVENTARIO: clasifica TODAS las cuentas de balance general (10-59), no solo el saldo final
  const esActivo = c >= 10 && c <= 39;
  const esPasPat = c >= 40 && c <= 59;
  // NATURALEZA: gastos e ingresos por naturaleza (60-79), incluye costo de ventas 69
  const esPerdidaNat = c >= 60 && c <= 69;
  const esGananciaNat = c >= 70 && c <= 79;
  // FUNCIÓN: solo se activa cuando existe el asiento de destino (69, 94, 95)
  const esPerdidaFun = c === 69 || c === 94 || c === 95;
  const esGananciaFun = c >= 70 && c <= 79;
  return { esActivo, esPasPat, esPerdidaNat, esGananciaNat, esPerdidaFun, esGananciaFun };
};

// Cuentas que disparan el asiento de destino de gastos (elemento 6, naturaleza)
// Se basa en el ELEMENTO (primeros 2 dígitos del código), no en el valor numérico completo,
// para que detecte subcuentas como 637, 6211, 6361, etc.
const esGastoPorNaturaleza = (codigo) => {
  const cod = String(codigo);
  if (cod.length < 2) return false;
  const elemento = parseInt(cod.slice(0, 2));
  return elemento >= 60 && elemento <= 68 && elemento !== 61 && elemento !== 60;
};

// Cuentas de compras que disparan el ingreso de mercaderías
const esCuentaCompras = (codigo) => {
  const cod = String(codigo);
  return cod.startsWith('60'); // 60, 601, 6011...
};

const STORAGE_KEY = 'sistema_contable_estado_v1';

const loadEstado = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export default function Contabilidad() {
  const estadoGuardado = loadEstado();

  const [pcge, setPcge] = useState({});
  const [tab, setTab] = useState('diario');
  const [asientos, setAsientos] = useState(estadoGuardado?.asientos || []);
  const [nextId, setNextId] = useState(estadoGuardado?.nextId || 1);
  const [kardexRows, setKardexRows] = useState(estadoGuardado?.kardexRows || []);
  const [kForm, setKForm] = useState({ fecha:'', tipo:'E', glosa:'', cant:'', cu:'' });
  const [kMetodo, setKMetodo] = useState(estadoGuardado?.kMetodo || 'peps');
  const [kProducto, setKProducto] = useState(estadoGuardado?.kProducto || 'Mercaderías');
  const [dropdowns, setDropdowns] = useState({});
  const [empresa, setEmpresa] = useState(estadoGuardado?.empresa || 'Comercial Amazonas S.A.C.');
  const [periodo, setPeriodo] = useState(estadoGuardado?.periodo || '2026-05');
  const [destinoModal, setDestinoModal] = useState(null); // {asientoId, lineaIdx, cuenta, monto, glosa, fecha}
  const [guardadoOk, setGuardadoOk] = useState(false);

  useEffect(() => {
    cuentasAPI.getAll({ limit: 500 }).then(r => {
      const map = {};
      r.data.forEach(c => { map[c.codigo] = c.nombre; });
      setPcge(map);
    });
  }, []);

  // Guarda automáticamente en localStorage cada vez que algo cambia
  useEffect(() => {
    const estado = { asientos, nextId, kardexRows, kMetodo, kProducto, empresa, periodo };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
      setGuardadoOk(true);
      const t = setTimeout(() => setGuardadoOk(false), 1200);
      return () => clearTimeout(t);
    } catch (e) {
      console.error('No se pudo guardar el estado', e);
    }
  }, [asientos, nextId, kardexRows, kMetodo, kProducto, empresa, periodo]);

  const limpiarTodo = () => {
    if (!window.confirm('¿Seguro que deseas borrar todos los asientos, el kárdex y empezar de cero? Esta acción no se puede deshacer.')) return;
    setAsientos([]);
    setNextId(1);
    setKardexRows([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const searchCuenta = (q) => {
    if (!q || q.length < 1) return [];
    const ql = q.toLowerCase();
    return Object.entries(pcge)
      .filter(([k,v]) => k.startsWith(q) || v.toLowerCase().includes(ql))
      .slice(0, 8);
  };

  const addAsiento = (presetLineas, presetGlosa, presetFecha, autoGenerado) => {
    const id = nextId;
    setNextId(id + 1);
    setAsientos(prev => [...prev, {
      id,
      fecha: presetFecha || '',
      glosa: presetGlosa || '',
      autoGenerado: !!autoGenerado,
      lineas: presetLineas || [
        {cuenta:'',nombre:'',debe:'',haber:''},
        {cuenta:'',nombre:'',debe:'',haber:''}
      ]
    }]);
    return id;
  };

  const removeAsiento = (id) => setAsientos(prev => prev.filter(a => a.id !== id));
  const updateAsiento = (id, field, val) => setAsientos(prev => prev.map(a => a.id===id ? {...a,[field]:val} : a));

  const addLinea = (id) => setAsientos(prev => prev.map(a => a.id===id ? {...a, lineas:[...a.lineas,{cuenta:'',nombre:'',debe:'',haber:''}]} : a));

  const removeLinea = (id, i) => {
    setAsientos(prev => prev.map(a => {
      if (a.id!==id || a.lineas.length<=2) return a;
      const lineas = [...a.lineas]; lineas.splice(i,1);
      return {...a, lineas};
    }));
  };

  const updateLinea = (id, i, field, val) => {
    setAsientos(prev => prev.map(a => {
      if (a.id!==id) return a;
      const lineas = a.lineas.map((l,idx) => {
        if (idx!==i) return l;
        const updated = {...l, [field]:val};
        if (field==='cuenta' && pcge[val]) updated.nombre = pcge[val];
        return updated;
      });
      return {...a, lineas};
    }));
    if (field==='cuenta') {
      const results = searchCuenta(val);
      setDropdowns(prev => ({...prev, [`${id}-${i}`]: results.length ? results : null}));
    }
  };

  // Detecta si una línea recién completada debe disparar un asiento automático
  const checkAutoAsiento = (asientoId, i) => {
    const a = asientos.find(x => x.id === asientoId);
    if (!a) return;
    const l = a.lineas[i];
    if (!l.cuenta || !l.haber) return; // el gasto/compra se registra normalmente en el HABER de caja/banco/proveedores, así que miramos el DEBE de la cuenta de gasto/compra
  };

  const selectCuenta = (id, i, cod, nom) => {
    setAsientos(prev => prev.map(a => {
      if (a.id!==id) return a;
      const lineas = a.lineas.map((l,idx) => idx===i ? {...l, cuenta:cod, nombre:nom} : l);
      return {...a, lineas};
    }));
    setDropdowns(prev => ({...prev, [`${id}-${i}`]: null}));
  };

  // Dispara el modal de destino leyendo el estado ACTUAL (no el capturado en closures viejos)
  const handleDebeBlur = (id, i) => {
    setAsientos(prev => {
      const a = prev.find(x => x.id === id);
      if (!a) return prev;
      const l = a.lineas[i];
      const monto = parseFloat(l.debe) || 0;
      if (!l.cuenta || monto <= 0) return prev;
      // Evita re-disparar si esta línea ya generó su asiento de destino
      if (l._destinoResuelto) return prev;

      if (esGastoPorNaturaleza(l.cuenta)) {
        setTimeout(() => setDestinoModal({ tipo:'gasto', cuenta:l.cuenta, nombre:l.nombre, monto, asientoId:id, lineaIdx:i, fecha:a.fecha, glosa:a.glosa }), 0);
      } else if (esCuentaCompras(l.cuenta)) {
        setTimeout(() => setDestinoModal({ tipo:'compra', cuenta:l.cuenta, nombre:l.nombre, monto, asientoId:id, lineaIdx:i, fecha:a.fecha, glosa:a.glosa }), 0);
      }
      return prev;
    });
  };

  const marcarLineaResuelta = (asientoId, lineaIdx) => {
    setAsientos(prev => prev.map(a => {
      if (a.id !== asientoId) return a;
      const lineas = a.lineas.map((l,idx) => idx===lineaIdx ? {...l, _destinoResuelto:true} : l);
      return {...a, lineas};
    }));
  };

  const [montoAdmin, setMontoAdmin] = useState('');
  const [montoVentas, setMontoVentas] = useState('');

  const confirmarDestinoGasto = (destino) => {
    // destino: '94' o '95'
    const d = destinoModal;
    addAsiento(
      [
        { cuenta:'79', nombre: pcge['79']||'Cargas imputables a cuentas de costos y gastos', debe:'', haber: d.monto.toFixed(2) },
        { cuenta: destino, nombre: pcge[destino]||(destino==='94'?'Gastos Administrativos':'Gastos de Ventas'), debe: d.monto.toFixed(2), haber:'' }
      ],
      `Destino de gasto: ${d.nombre} → ${destino==='94'?'Administración':'Ventas'}`,
      d.fecha,
      true
    );
    if (d.asientoId != null && d.lineaIdx != null) marcarLineaResuelta(d.asientoId, d.lineaIdx);
    setDestinoModal(null);
    setMontoAdmin(''); setMontoVentas('');
  };

  const confirmarDestinoGastoDividido = () => {
    const d = destinoModal;
    const mAdmin = parseFloat(montoAdmin) || 0;
    const mVentas = parseFloat(montoVentas) || 0;
    const suma = mAdmin + mVentas;
    if (Math.abs(suma - d.monto) > 0.01) {
      alert(`La suma de ambos montos (${fmt(suma)}) debe ser igual al total del gasto (${fmt(d.monto)}).`);
      return;
    }
    const lineasDestino = [{ cuenta:'79', nombre: pcge['79']||'Cargas imputables a cuentas de costos y gastos', debe:'', haber: d.monto.toFixed(2) }];
    if (mAdmin > 0) lineasDestino.push({ cuenta:'94', nombre: pcge['94']||'Gastos Administrativos', debe: mAdmin.toFixed(2), haber:'' });
    if (mVentas > 0) lineasDestino.push({ cuenta:'95', nombre: pcge['95']||'Gastos de Ventas', debe: mVentas.toFixed(2), haber:'' });
    addAsiento(
      lineasDestino,
      `Destino de gasto: ${d.nombre} → Administración ${fmt(mAdmin)} / Ventas ${fmt(mVentas)}`,
      d.fecha,
      true
    );
    if (d.asientoId != null && d.lineaIdx != null) marcarLineaResuelta(d.asientoId, d.lineaIdx);
    setDestinoModal(null);
    setMontoAdmin(''); setMontoVentas('');
  };

  const confirmarDestinoCompra = () => {
    const d = destinoModal;
    addAsiento(
      [
        { cuenta:'61', nombre: pcge['61']||'Variación de inventarios', debe:'', haber: d.monto.toFixed(2) },
        { cuenta:'20', nombre: pcge['20']||'Mercaderías', debe: d.monto.toFixed(2), haber:'' }
      ],
      `Ingreso de mercaderías a almacén — ${d.nombre}`,
      d.fecha,
      true
    );
    if (d.asientoId != null && d.lineaIdx != null) marcarLineaResuelta(d.asientoId, d.lineaIdx);
    setDestinoModal(null);
  };

  const omitirDestino = () => {
    const d = destinoModal;
    if (d && d.asientoId != null && d.lineaIdx != null) marcarLineaResuelta(d.asientoId, d.lineaIdx);
    setDestinoModal(null);
    setMontoAdmin(''); setMontoVentas('');
  };

  const generarAjusteCostoVentas = () => {
    if (kCV <= 0) { alert('No hay costo de ventas calculado en el Kárdex todavía.'); return; }
    addAsiento(
      [
        { cuenta:'69', nombre: pcge['69']||'Costo de ventas', debe: kCV.toFixed(2), haber:'' },
        { cuenta:'20', nombre: pcge['20']||'Mercaderías', debe:'', haber: kCV.toFixed(2) }
      ],
      `Ajuste final — Costo de ventas según Kárdex (${kProducto})`,
      '',
      true
    );
    setTab('diario');
  };

  const getMayor = () => {
    const m = {};
    asientos.forEach(a => a.lineas.forEach(l => {
      if (!l.cuenta) return;
      if (!m[l.cuenta]) m[l.cuenta] = {nombre:l.nombre||pcge[l.cuenta]||'', debe:0, haber:0, movs:[]};
      const d = parseFloat(l.debe)||0, h = parseFloat(l.haber)||0;
      m[l.cuenta].debe += d; m[l.cuenta].haber += h;
      if (!m[l.cuenta].nombre && l.nombre) m[l.cuenta].nombre = l.nombre;
      if (d||h) m[l.cuenta].movs.push({fecha:a.fecha, glosa:a.glosa, debe:d, haber:h});
    }));
    return m;
  };

  const calcKardex = () => {
    let stock = []; const rows = [];
    kardexRows.forEach((r) => {
      const cant = parseFloat(r.cant)||0, cu = parseFloat(r.cu)||0;
      let eC='',eCU='',eT='',sC='',sCU='',sT='';
      if (r.tipo==='E') {
        stock.push({cant, cu});
        eC=cant; eCU=cu.toFixed(2); eT=(cant*cu).toFixed(2);
      } else {
        let rem=cant, costeSalida=0;
        if (kMetodo==='peps') {
          const st2 = stock.map(s=>({...s}));
          while(rem>0&&st2.length){
            const lote=st2[0];
            if(lote.cant<=rem){rem-=lote.cant;costeSalida+=lote.cant*lote.cu;st2.shift();}
            else{costeSalida+=rem*lote.cu;lote.cant-=rem;rem=0;}
          }
          stock = st2;
        } else {
          const tc=stock.reduce((s,l)=>s+l.cant,0);
          const tv=stock.reduce((s,l)=>s+l.cant*l.cu,0);
          const pcu=tc?tv/tc:0;
          costeSalida=cant*pcu;
          let remS=cant;
          stock=stock.map(l=>{if(remS<=0)return l;const q=Math.min(l.cant,remS);remS-=q;return{...l,cant:l.cant-q};}).filter(l=>l.cant>0);
        }
        sC=cant; sCU=cant?((costeSalida/cant).toFixed(2)):'0'; sT=costeSalida.toFixed(2);
      }
      const fC=stock.reduce((s,l)=>s+l.cant,0);
      const fV=stock.reduce((s,l)=>s+l.cant*l.cu,0);
      const fCU=fC?fV/fC:0;
      rows.push({...r,eC,eCU,eT,sC,sCU,sT,fC,fCU:fCU.toFixed(2),fT:fV.toFixed(2)});
    });
    const fC=stock.reduce((s,l)=>s+l.cant,0);
    const fV=stock.reduce((s,l)=>s+l.cant*l.cu,0);
    const fCU=fC?fV/fC:0;
    const cv=rows.filter(r=>r.tipo==='S').reduce((s,r)=>s+parseFloat(r.sT||0),0);
    return {rows, saldo:{cant:fC, cu:fCU.toFixed(2), total:fV.toFixed(2)}, cv};
  };

  const mayor = getMayor();
  const mayorKeys = Object.keys(mayor).sort();
  const { rows: kRows, saldo: kSaldo, cv: kCV } = calcKardex();
  const totalDebe = asientos.reduce((s,a)=>s+a.lineas.reduce((ss,l)=>ss+(parseFloat(l.debe)||0),0),0);
  const totalHaber = asientos.reduce((s,a)=>s+a.lineas.reduce((ss,l)=>ss+(parseFloat(l.haber)||0),0),0);

  const getBalanceRows = () => {
    return mayorKeys.map(k => {
      const c = mayor[k];
      const debe = c.debe, haber = c.haber;
      const saldoD = Math.max(0, debe - haber);
      const saldoH = Math.max(0, haber - debe);
      const cl = clasificarCuenta(k);
      const invActivo = cl.esActivo ? saldoD : 0;
      const invPasPat = cl.esPasPat ? saldoH : 0;
      const natPerdida = cl.esPerdidaNat ? saldoD : 0;
      const natGanancia = cl.esGananciaNat ? saldoH : 0;
      const funPerdida = cl.esPerdidaFun ? saldoD : 0;
      const funGanancia = cl.esGananciaFun ? saldoH : 0;
      return { codigo:k, nombre:c.nombre, debe, haber, saldoD, saldoH, invActivo, invPasPat, natPerdida, natGanancia, funPerdida, funGanancia };
    });
  };

  const balanceRows = getBalanceRows();
  const sumBal = (field) => balanceRows.reduce((s,r)=>s+(r[field]||0),0);

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();

    const diarioData = [['#Asiento','Fecha','Glosa','Cuenta','Denominación','Debe','Haber','Origen']];
    asientos.forEach(a => {
      a.lineas.forEach((l,i) => {
        diarioData.push([
          i===0?`Asiento #${a.id}`:'',
          i===0?a.fecha:'',
          i===0?a.glosa:'',
          l.cuenta, l.nombre,
          parseFloat(l.debe)||0,
          parseFloat(l.haber)||0,
          i===0?(a.autoGenerado?'Automático':'Manual'):''
        ]);
      });
      diarioData.push(['','','','','','','','']);
    });
    const wsDiario = XLSX.utils.aoa_to_sheet(diarioData);
    XLSX.utils.book_append_sheet(wb, wsDiario, 'Libro Diario');

    const mayorData = [['Cuenta','Denominación','Fecha','Descripción','Debe','Haber']];
    mayorKeys.forEach(k => {
      const c = mayor[k];
      c.movs.forEach((mv,i) => {
        mayorData.push([i===0?k:'', i===0?c.nombre:'', mv.fecha, mv.glosa, mv.debe, mv.haber]);
      });
      mayorData.push(['','','','Total',c.debe,c.haber]);
      mayorData.push(['','','','','','']);
    });
    const wsMayor = XLSX.utils.aoa_to_sheet(mayorData);
    XLSX.utils.book_append_sheet(wb, wsMayor, 'Mayor');

    const balData = [
      [empresa],
      ['BALANCE DE COMPROBACIÓN'],
      [`Período: ${periodo}`],
      [''],
      ['CUENTA','DETALLE','SUMAS DEL MAYOR','','SALDOS','','INVENTARIO','','NATURALEZA','','FUNCIÓN',''],
      ['','','DEBE','HABER','DEUDOR','ACREEDOR','ACTIVO','PAS. Y PAT.','PÉRDIDA','GANANCIA','PÉRDIDA','GANANCIA'],
    ];
    balanceRows.forEach(r => {
      balData.push([
        r.codigo, r.nombre,
        r.debe||'', r.haber||'',
        r.saldoD||'', r.saldoH||'',
        r.invActivo||'', r.invPasPat||'',
        r.natPerdida||'', r.natGanancia||'',
        r.funPerdida||'', r.funGanancia||''
      ]);
    });
    balData.push(['','TOTAL',
      sumBal('debe'), sumBal('haber'),
      sumBal('saldoD'), sumBal('saldoH'),
      sumBal('invActivo'), sumBal('invPasPat'),
      sumBal('natPerdida'), sumBal('natGanancia'),
      sumBal('funPerdida'), sumBal('funGanancia')
    ]);
    const wsBalance = XLSX.utils.aoa_to_sheet(balData);
    XLSX.utils.book_append_sheet(wb, wsBalance, 'Balance de Comprobación');

    const kardexData = [
      [empresa],
      [`KÁRDEX - ${kProducto} - Método: ${kMetodo==='peps'?'PEPS (FIFO)':'Promedio Ponderado'}`],
      [''],
      ['Fecha','Glosa','ENT.Cant','ENT.C.U.','ENT.Total','SAL.Cant','SAL.C.U.','SAL.Total','SALDO Cant','SALDO C.U.','SALDO Total']
    ];
    kRows.forEach(r => {
      kardexData.push([
        r.fecha||'', r.glosa||'',
        r.eC||'', r.eCU||'', r.eT?parseFloat(r.eT):'',
        r.sC||'', r.sCU||'', r.sT?parseFloat(r.sT):'',
        r.fC, r.fCU, parseFloat(r.fT||0)
      ]);
    });
    kardexData.push(['','SALDO FINAL','','','',kSaldo.cant,kSaldo.cu,parseFloat(kSaldo.total||0)]);
    kardexData.push(['','COSTO DE VENTAS','','','','','',kCV]);
    const wsKardex = XLSX.utils.aoa_to_sheet(kardexData);
    XLSX.utils.book_append_sheet(wb, wsKardex, 'Kárdex');

    XLSX.writeFile(wb, `${empresa.replace(/\s/g,'_')}_${periodo}.xlsx`);
  };

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <div className="page-title">Sistema Contable</div>
          <div className="page-sub">
            Diario · Mayor · Balance de Comprobación · Kárdex
            <span style={{marginLeft:10,fontSize:11,color: guardadoOk ? '#22c55e' : 'var(--text3)'}}>
              {guardadoOk ? '✓ Guardado automáticamente' : '· Tus datos se guardan en este navegador'}
            </span>
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-ghost" onClick={generarAjusteCostoVentas}>⚙ Ajuste de cierre (Costo de Ventas)</button>
          <button className="btn btn-primary" onClick={exportarExcel}>⬇ Exportar Excel</button>
          <button className="btn btn-danger" onClick={limpiarTodo}>🗑 Limpiar todo</button>
        </div>
      </div>

      <div style={{display:'flex',gap:4,borderBottom:'1px solid var(--border)',marginBottom:20}}>
        {['diario','mayor','balance','kardex'].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            padding:'8px 16px',border:'none',background:'none',cursor:'pointer',
            fontSize:13,fontWeight:tab===t?600:400,
            color:tab===t?'var(--text)':'var(--text2)',
            borderBottom:tab===t?'2px solid var(--accent)':'2px solid transparent',
            marginBottom:-1,fontFamily:'Inter,sans-serif'
          }}>{t==='kardex'?'Kárdex':t==='balance'?'Balance de Comprobación':t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>

      {tab==='diario' && (
        <div>
          <div style={{display:'flex',gap:12,marginBottom:16,alignItems:'flex-end'}}>
            <div><label className="form-label">Empresa</label><input className="form-input" value={empresa} onChange={e=>setEmpresa(e.target.value)} style={{width:260}}/></div>
            <div><label className="form-label">Período</label><input className="form-input" value={periodo} onChange={e=>setPeriodo(e.target.value)} style={{width:110}}/></div>
            <button className="btn btn-primary" onClick={()=>addAsiento()}>+ Nuevo asiento</button>
          </div>

          <div style={{fontSize:12,color:'var(--text2)',background:'var(--surface2)',padding:'8px 12px',borderRadius:8,marginBottom:14}}>
            💡 Si registras una cuenta de <strong>gasto (60-68)</strong> o de <strong>compras (60)</strong> con un monto en el Debe, el sistema te preguntará automáticamente el asiento de destino.
          </div>

          {!asientos.length && <div className="empty">Sin asientos. Haz clic en "+ Nuevo asiento" para comenzar.</div>}

          {asientos.map(a=>{
            const td=a.lineas.reduce((s,l)=>s+(parseFloat(l.debe)||0),0);
            const th=a.lineas.reduce((s,l)=>s+(parseFloat(l.haber)||0),0);
            const ok=Math.abs(td-th)<0.01;
            return(
            <div key={a.id} style={{border:a.autoGenerado?'1px solid var(--accent)':'1px solid var(--border)',borderRadius:12,padding:16,marginBottom:12,background:a.autoGenerado?'rgba(79,142,247,0.04)':'transparent'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <span style={{fontSize:12,color:'var(--text2)',fontWeight:600}}>
                  Asiento #{a.id} {a.autoGenerado && <span style={{fontSize:10,padding:'2px 7px',borderRadius:4,background:'rgba(79,142,247,0.15)',color:'var(--accent)',marginLeft:6}}>⚙ AUTOMÁTICO</span>}
                </span>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <span style={{fontSize:11,padding:'2px 8px',borderRadius:4,background:ok?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)',color:ok?'#22c55e':'#ef4444'}}>{ok?'✓ Cuadrado':'✗ Sin cuadrar'}</span>
                  <button className="btn btn-danger" style={{padding:'3px 10px',fontSize:11}} onClick={()=>removeAsiento(a.id)}>Eliminar</button>
                </div>
              </div>
              <div style={{display:'flex',gap:12,marginBottom:12}}>
                <div><label className="form-label">Fecha</label><input type="date" className="form-input" value={a.fecha} onChange={e=>updateAsiento(a.id,'fecha',e.target.value)} style={{width:140}}/></div>
                <div style={{flex:1}}><label className="form-label">Glosa</label><input className="form-input" value={a.glosa} onChange={e=>updateAsiento(a.id,'glosa',e.target.value)} placeholder="Descripción del asiento"/></div>
              </div>
              <table style={{marginBottom:8}}>
                <thead><tr><th style={{width:100}}>Código</th><th>Denominación</th><th style={{width:120,textAlign:'right'}}>Debe (S/)</th><th style={{width:120,textAlign:'right'}}>Haber (S/)</th><th style={{width:30}}></th></tr></thead>
                <tbody>
                  {a.lineas.map((l,i)=>(
                    <tr key={i}>
                      <td style={{position:'relative'}}>
                        <input value={l.cuenta} onChange={e=>updateLinea(a.id,i,'cuenta',e.target.value)}
                          style={{width:88,fontFamily:'JetBrains Mono,monospace',fontSize:12,padding:'4px 6px',border:'1px solid var(--border)',borderRadius:6,background:'var(--surface2)',color:'var(--text)'}}
                          placeholder="Ej: 1011"/>
                        {dropdowns[`${a.id}-${i}`]?.length>0&&(
                          <div style={{position:'absolute',top:'100%',left:0,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,zIndex:99,minWidth:300,maxHeight:200,overflowY:'auto',boxShadow:'0 8px 24px rgba(0,0,0,0.4)'}}>
                            {dropdowns[`${a.id}-${i}`].map(([k,v])=>(
                              <div key={k} onMouseDown={()=>selectCuenta(a.id,i,k,v)}
                                style={{padding:'7px 12px',cursor:'pointer',fontSize:12,display:'flex',gap:10}}
                                onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                <span style={{fontFamily:'JetBrains Mono,monospace',color:'var(--accent)',minWidth:50}}>{k}</span>
                                <span style={{color:'var(--text2)'}}>{v}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td><input value={l.nombre} onChange={e=>updateLinea(a.id,i,'nombre',e.target.value)} style={{width:'100%',padding:'4px 6px',border:'1px solid var(--border)',borderRadius:6,background:'var(--surface2)',color:'var(--text)',fontSize:13}} placeholder="Nombre de cuenta"/></td>
                      <td><input type="number" value={l.debe} onChange={e=>updateLinea(a.id,i,'debe',e.target.value)} onBlur={()=>handleDebeBlur(a.id,i)} style={{width:110,textAlign:'right',padding:'4px 6px',border:'1px solid var(--border)',borderRadius:6,background:'var(--surface2)',color:'var(--text)',fontSize:13}} placeholder="0.00" step="0.01"/></td>
                      <td><input type="number" value={l.haber} onChange={e=>updateLinea(a.id,i,'haber',e.target.value)} style={{width:110,textAlign:'right',padding:'4px 6px',border:'1px solid var(--border)',borderRadius:6,background:'var(--surface2)',color:'var(--text)',fontSize:13}} placeholder="0.00" step="0.01"/></td>
                      <td><button onClick={()=>removeLinea(a.id,i)} style={{padding:'2px 6px',fontSize:13,color:'var(--text3)',border:'none',background:'none',cursor:'pointer'}}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <button className="btn btn-ghost" style={{fontSize:11,padding:'4px 10px'}} onClick={()=>addLinea(a.id)}>+ Línea</button>
                <div style={{display:'flex',gap:16,fontSize:12}}>
                  <span style={{color:'var(--text2)'}}>Debe: <strong style={{color:'var(--text)'}}>{fmt(td)}</strong></span>
                  <span style={{color:'var(--text2)'}}>Haber: <strong style={{color:'var(--text)'}}>{fmt(th)}</strong></span>
                  <span style={{color:'var(--text2)'}}>Dif: <strong style={{color:ok?'#22c55e':'#ef4444'}}>{fmt(Math.abs(td-th))}</strong></span>
                </div>
              </div>
            </div>
          )})}

          <div className="cards-grid" style={{marginTop:16}}>
            <div className="card accent"><div className="card-label">Total Debe</div><div className="card-value">{fmt(totalDebe)}</div></div>
            <div className="card"><div className="card-label">Total Haber</div><div className="card-value">{fmt(totalHaber)}</div></div>
            <div className="card"><div className="card-label">Diferencia</div><div className="card-value" style={{color:Math.abs(totalDebe-totalHaber)<0.01?'#22c55e':'#ef4444'}}>{fmt(Math.abs(totalDebe-totalHaber))}</div></div>
            <div className="card"><div className="card-label">Asientos</div><div className="card-value">{asientos.length}</div></div>
          </div>
        </div>
      )}

      {tab==='mayor' && (
        <div>
          {!mayorKeys.length ? <div className="empty">Sin movimientos en el diario.</div> :
          mayorKeys.map(k=>{
            const c=mayor[k];
            const sd=Math.max(0,c.debe-c.haber), sh=Math.max(0,c.haber-c.debe);
            return(<div key={k} style={{marginBottom:14,border:'1px solid var(--border)',borderRadius:10,overflow:'hidden'}}>
              <div style={{padding:'8px 14px',background:'var(--surface2)',display:'flex',justifyContent:'space-between'}}>
                <span style={{fontWeight:600,fontSize:13}}>{k} — {c.nombre||'Sin nombre'}</span>
                <span style={{fontSize:12,color:'var(--text2)'}}>Saldo: <strong style={{color:sd>0?'var(--accent)':'#a78bfa'}}>{sd>0?fmt(sd)+' D':fmt(sh)+' H'}</strong></span>
              </div>
              <table>
                <thead><tr><th>Fecha</th><th>Descripción</th><th style={{textAlign:'right'}}>Debe</th><th style={{textAlign:'right'}}>Haber</th></tr></thead>
                <tbody>
                  {c.movs.map((mv,i)=><tr key={i}><td>{mv.fecha||'—'}</td><td>{mv.glosa||'—'}</td><td style={{textAlign:'right'}}>{mv.debe?fmt(mv.debe):''}</td><td style={{textAlign:'right'}}>{mv.haber?fmt(mv.haber):''}</td></tr>)}
                  <tr style={{background:'var(--surface2)',fontWeight:600}}><td colSpan={2}>TOTAL</td><td style={{textAlign:'right'}}>{fmt(c.debe)}</td><td style={{textAlign:'right'}}>{fmt(c.haber)}</td></tr>
                </tbody>
              </table>
            </div>);
          })}
        </div>
      )}

      {tab==='balance' && (
        <div>
          <div style={{marginBottom:14,fontSize:13,color:'var(--text2)'}}>
            Balance de Comprobación completo — {empresa} — Período {periodo}
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{minWidth:900,fontSize:12}}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{width:70}}>CUENTA</th>
                  <th rowSpan={2}>DETALLE</th>
                  <th colSpan={2} style={{textAlign:'center',background:'rgba(79,142,247,0.1)'}}>SUMAS DEL MAYOR</th>
                  <th colSpan={2} style={{textAlign:'center',background:'rgba(124,58,237,0.1)'}}>SALDOS</th>
                  <th colSpan={2} style={{textAlign:'center',background:'rgba(34,197,94,0.1)'}}>INVENTARIO</th>
                  <th colSpan={2} style={{textAlign:'center',background:'rgba(245,158,11,0.1)'}}>NATURALEZA</th>
                  <th colSpan={2} style={{textAlign:'center',background:'rgba(239,68,68,0.1)'}}>FUNCIÓN</th>
                </tr>
                <tr>
                  <th style={{textAlign:'right',background:'rgba(79,142,247,0.05)'}}>DEBE</th>
                  <th style={{textAlign:'right',background:'rgba(79,142,247,0.05)'}}>HABER</th>
                  <th style={{textAlign:'right',background:'rgba(124,58,237,0.05)'}}>DEUDOR</th>
                  <th style={{textAlign:'right',background:'rgba(124,58,237,0.05)'}}>ACREEDOR</th>
                  <th style={{textAlign:'right',background:'rgba(34,197,94,0.05)'}}>ACTIVO</th>
                  <th style={{textAlign:'right',background:'rgba(34,197,94,0.05)'}}>PAS. Y PAT.</th>
                  <th style={{textAlign:'right',background:'rgba(245,158,11,0.05)'}}>PÉRDIDA</th>
                  <th style={{textAlign:'right',background:'rgba(245,158,11,0.05)'}}>GANANCIA</th>
                  <th style={{textAlign:'right',background:'rgba(239,68,68,0.05)'}}>PÉRDIDA</th>
                  <th style={{textAlign:'right',background:'rgba(239,68,68,0.05)'}}>GANANCIA</th>
                </tr>
              </thead>
              <tbody>
                {!balanceRows.length?<tr><td colSpan={12} className="empty">Sin movimientos</td></tr>:
                balanceRows.map(r=>(
                  <tr key={r.codigo}>
                    <td className="codigo-cell">{r.codigo}</td>
                    <td>{r.nombre}</td>
                    <td style={{textAlign:'right'}}>{r.debe?fmtN(r.debe):'—'}</td>
                    <td style={{textAlign:'right'}}>{r.haber?fmtN(r.haber):'—'}</td>
                    <td style={{textAlign:'right',color:'var(--accent)'}}>{r.saldoD?fmtN(r.saldoD):'—'}</td>
                    <td style={{textAlign:'right',color:'#a78bfa'}}>{r.saldoH?fmtN(r.saldoH):'—'}</td>
                    <td style={{textAlign:'right',color:'#22c55e'}}>{r.invActivo?fmtN(r.invActivo):'—'}</td>
                    <td style={{textAlign:'right',color:'#22c55e'}}>{r.invPasPat?fmtN(r.invPasPat):'—'}</td>
                    <td style={{textAlign:'right',color:'#f59e0b'}}>{r.natPerdida?fmtN(r.natPerdida):'—'}</td>
                    <td style={{textAlign:'right',color:'#f59e0b'}}>{r.natGanancia?fmtN(r.natGanancia):'—'}</td>
                    <td style={{textAlign:'right',color:'#ef4444'}}>{r.funPerdida?fmtN(r.funPerdida):'—'}</td>
                    <td style={{textAlign:'right',color:'#ef4444'}}>{r.funGanancia?fmtN(r.funGanancia):'—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{background:'var(--surface2)',fontWeight:600}}>
                  <td colSpan={2}>TOTALES</td>
                  <td style={{textAlign:'right'}}>{fmtN(sumBal('debe'))}</td>
                  <td style={{textAlign:'right'}}>{fmtN(sumBal('haber'))}</td>
                  <td style={{textAlign:'right'}}>{fmtN(sumBal('saldoD'))}</td>
                  <td style={{textAlign:'right'}}>{fmtN(sumBal('saldoH'))}</td>
                  <td style={{textAlign:'right'}}>{fmtN(sumBal('invActivo'))}</td>
                  <td style={{textAlign:'right'}}>{fmtN(sumBal('invPasPat'))}</td>
                  <td style={{textAlign:'right'}}>{fmtN(sumBal('natPerdida'))}</td>
                  <td style={{textAlign:'right'}}>{fmtN(sumBal('natGanancia'))}</td>
                  <td style={{textAlign:'right'}}>{fmtN(sumBal('funPerdida'))}</td>
                  <td style={{textAlign:'right'}}>{fmtN(sumBal('funGanancia'))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {tab==='kardex' && (
        <div>
          <div style={{display:'flex',gap:12,marginBottom:14}}>
            <div><label className="form-label">Producto</label><input className="form-input" value={kProducto} onChange={e=>setKProducto(e.target.value)} style={{width:180}}/></div>
            <div><label className="form-label">Método</label>
              <select className="form-input" value={kMetodo} onChange={e=>setKMetodo(e.target.value)} style={{width:220}}>
                <option value="peps">PEPS (FIFO)</option>
                <option value="prom">Promedio ponderado</option>
              </select>
            </div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'flex-end',padding:12,background:'var(--surface)',borderRadius:10,marginBottom:12,border:'1px solid var(--border)'}}>
            <div><label className="form-label">Fecha</label><input type="date" className="form-input" value={kForm.fecha} onChange={e=>setKForm(f=>({...f,fecha:e.target.value}))} style={{width:140}}/></div>
            <div><label className="form-label">Tipo</label>
              <select className="form-input" value={kForm.tipo} onChange={e=>setKForm(f=>({...f,tipo:e.target.value}))} style={{width:110}}>
                <option value="E">Entrada</option><option value="S">Salida</option>
              </select>
            </div>
            <div style={{flex:1}}><label className="form-label">Glosa</label><input className="form-input" value={kForm.glosa} onChange={e=>setKForm(f=>({...f,glosa:e.target.value}))} placeholder="Descripción"/></div>
            <div><label className="form-label">Cantidad</label><input type="number" className="form-input" value={kForm.cant} onChange={e=>setKForm(f=>({...f,cant:e.target.value}))} style={{width:90}}/></div>
            <div><label className="form-label">Costo unit.</label><input type="number" className="form-input" value={kForm.cu} onChange={e=>setKForm(f=>({...f,cu:e.target.value}))} style={{width:100}} step="0.01" placeholder="Solo entradas"/></div>
            <button className="btn btn-primary" onClick={()=>{
              if(!kForm.cant){return;}
              setKardexRows(prev=>[...prev,{...kForm}]);
              setKForm(f=>({...f,glosa:'',cant:'',cu:''}));
            }}>Agregar</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th rowSpan={2}>Fecha</th><th rowSpan={2}>Glosa</th>
                  <th colSpan={3} style={{textAlign:'center',borderLeft:'1px solid var(--border)'}}>Entradas</th>
                  <th colSpan={3} style={{textAlign:'center',borderLeft:'1px solid var(--border)'}}>Salidas</th>
                  <th colSpan={3} style={{textAlign:'center',borderLeft:'1px solid var(--border)'}}>Saldo final</th>
                  <th rowSpan={2}></th>
                </tr>
                <tr>
                  <th style={{borderLeft:'1px solid var(--border)'}}>Cant.</th><th>C.U.</th><th>Total</th>
                  <th style={{borderLeft:'1px solid var(--border)'}}>Cant.</th><th>C.U.</th><th>Total</th>
                  <th style={{borderLeft:'1px solid var(--border)'}}>Cant.</th><th>C.U.</th><th>Total</th>
                </tr>
              </thead>
              <tbody>
                {!kRows.length?<tr><td colSpan={12} className="empty">Sin movimientos</td></tr>:
                kRows.map((r,i)=><tr key={i}>
                  <td>{r.fecha||'—'}</td><td>{r.glosa||'—'}</td>
                  <td style={{borderLeft:'1px solid var(--border)'}}>{r.eC||''}</td><td>{r.eCU||''}</td><td>{r.eT?fmt(parseFloat(r.eT)):''}</td>
                  <td style={{borderLeft:'1px solid var(--border)'}}>{r.sC||''}</td><td>{r.sCU||''}</td><td>{r.sT?fmt(parseFloat(r.sT)):''}</td>
                  <td style={{borderLeft:'1px solid var(--border)'}}>{r.fC}</td><td>{r.fCU}</td><td>{fmt(parseFloat(r.fT||0))}</td>
                  <td><button onClick={()=>setKardexRows(prev=>prev.filter((_,idx)=>idx!==i))} style={{color:'var(--text3)',border:'none',background:'none',cursor:'pointer',fontSize:13}}>×</button></td>
                </tr>)}
              </tbody>
            </table>
          </div>
          <div className="cards-grid" style={{marginTop:14}}>
            <div className="card"><div className="card-label">Saldo final cant.</div><div className="card-value">{kSaldo.cant}</div></div>
            <div className="card"><div className="card-label">Costo unitario</div><div className="card-value">S/ {kSaldo.cu}</div></div>
            <div className="card accent"><div className="card-label">Saldo final S/</div><div className="card-value">{fmt(parseFloat(kSaldo.total||0))}</div></div>
            <div className="card"><div className="card-label">Costo de ventas</div><div className="card-value">{fmt(kCV)}</div></div>
          </div>
        </div>
      )}

      {destinoModal && destinoModal.tipo==='gasto' && (
        <div className="modal-overlay" onClick={omitirDestino}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{width:440}}>
            <div className="modal-title">⚙ Asiento de Destino de Gasto</div>
            <p style={{fontSize:13,color:'var(--text2)',marginBottom:16}}>
              Registraste un gasto en la cuenta <strong style={{color:'var(--accent)'}}>{destinoModal.cuenta} — {destinoModal.nombre}</strong> por <strong>{fmt(destinoModal.monto)}</strong>.
              <br/>¿A qué destino corresponde este gasto?
            </p>
            <div style={{display:'flex',gap:10,marginBottom:14}}>
              <button className="btn btn-primary" style={{flex:1,padding:'14px'}} onClick={()=>confirmarDestinoGasto('94')}>
                94 — Administrativos
              </button>
              <button className="btn btn-primary" style={{flex:1,padding:'14px'}} onClick={()=>confirmarDestinoGasto('95')}>
                95 — Ventas
              </button>
            </div>

            <div style={{borderTop:'1px solid var(--border)',paddingTop:14}}>
              <div style={{fontSize:12,color:'var(--text2)',marginBottom:10}}>O repartir entre ambas cuentas:</div>
              <div style={{display:'flex',gap:10,marginBottom:8}}>
                <div style={{flex:1}}>
                  <label className="form-label">94 — Administrativos</label>
                  <input type="number" className="form-input" value={montoAdmin}
                    onChange={e=>setMontoAdmin(e.target.value)} placeholder="0.00" step="0.01"/>
                </div>
                <div style={{flex:1}}>
                  <label className="form-label">95 — Ventas</label>
                  <input type="number" className="form-input" value={montoVentas}
                    onChange={e=>setMontoVentas(e.target.value)} placeholder="0.00" step="0.01"/>
                </div>
              </div>
              <div style={{fontSize:11,color:'var(--text3)',marginBottom:10}}>
                Suma actual: {fmt((parseFloat(montoAdmin)||0)+(parseFloat(montoVentas)||0))} — Debe ser igual a {fmt(destinoModal.monto)}
              </div>
              <button className="btn btn-primary" style={{width:'100%'}} onClick={confirmarDestinoGastoDividido}>
                Repartir en ambas cuentas
              </button>
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={omitirDestino}>Omitir (no generar destino)</button>
            </div>
          </div>
        </div>
      )}

      {destinoModal && destinoModal.tipo==='compra' && (
        <div className="modal-overlay" onClick={omitirDestino}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">⚙ Ingreso de Mercaderías a Almacén</div>
            <p style={{fontSize:13,color:'var(--text2)',marginBottom:16}}>
              Registraste una compra en la cuenta <strong style={{color:'var(--accent)'}}>{destinoModal.cuenta} — {destinoModal.nombre}</strong> por <strong>{fmt(destinoModal.monto)}</strong>.
              <br/>¿Generar automáticamente el asiento de ingreso al almacén (61 → 20)?
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={omitirDestino}>Omitir</button>
              <button className="btn btn-primary" onClick={confirmarDestinoCompra}>Sí, generar asiento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}