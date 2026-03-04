import { NavLink } from 'react-router-dom';
import { IoWallet, IoRepeat, IoSave, IoTime, IoSettings, IoDocumentText } from 'react-icons/io5';

const tabs = [
  { path: '/', icon: IoWallet, label: 'Budget' },
  { path: '/routines', icon: IoRepeat, label: 'Routines' },
  { path: '/savings', icon: IoSave, label: 'Savings' },
  { path: '/notes', icon: IoDocumentText, label: 'Notes' },
  { path: '/history', icon: IoTime, label: 'History' },
  { path: '/settings', icon: IoSettings, label: 'Settings' },
];

export default function BottomNav() {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 'var(--max-width)',
      height: 'var(--nav-height)', background: 'var(--bg-nav)',
      borderTop: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      zIndex: 90, padding: '0 4px',
    }}>
      {tabs.map(({ path, icon: Icon, label }) => (
        <NavLink
          key={path}
          to={path}
          end={path === '/'}
          style={({ isActive }) => ({
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 2, textDecoration: 'none', padding: '8px 0',
            minWidth: 48,
            color: isActive ? 'var(--primary)' : 'var(--text-muted)',
            transition: 'color 0.2s',
          })}
        >
          <Icon size={22} />
          <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
