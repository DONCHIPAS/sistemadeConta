
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import PlanCuentas from './pages/PlanCuentas';
import Dashboard from './pages/Dashboard';
import Contabilidad from './pages/Contabilidad';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <aside className="sidebar">
          <div className="logo">
            <span className="logo-icon">⬡</span>
            <div>
              <div className="logo-title">SisContable</div>
              <div className="logo-sub">Perú · PCGE</div>
            </div>
          </div>
          <nav>
            <NavLink to="/" end className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}>
              <span>▦</span> Dashboard
            </NavLink>
            <NavLink to="/cuentas" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}>
              <span>≡</span> Plan de Cuentas
            </NavLink>
            <NavLink to="/contabilidad" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}>
              <span>⊞</span> Contabilidad
            </NavLink>
          </nav>
          <div className="sidebar-footer">PCGE · NIC · NIIF</div>
        </aside>
        <main className="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/cuentas" element={<PlanCuentas />} />
            <Route path="/contabilidad" element={<Contabilidad />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
