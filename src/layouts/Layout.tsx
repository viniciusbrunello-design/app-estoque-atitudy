import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, Boxes, ArrowRightLeft, Bot } from 'lucide-react';
import './Layout.css';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/produtos', label: 'Produtos', icon: Package },
  { path: '/estoque', label: 'Estoque', icon: Boxes },
  { path: '/movimentacoes', label: 'Movimentações', icon: ArrowRightLeft },
  { path: '/assistente', label: 'Assistente', icon: Bot },
];

export default function Layout() {
  return (
    <div className="layout-container">
      {/* Sidebar Desktop */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="logo-text">Estoque Atitudy</h1>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Header Mobile */}
      <header className="mobile-header">
        <h1 className="logo-text">Estoque Atitudy</h1>
      </header>

      {/* Main Content */}
      <main className="main-area">
        <div className="content-wrapper">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation (optional, replacing menu) */}
      <nav className="mobile-bottom-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span className="bottom-nav-label">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
