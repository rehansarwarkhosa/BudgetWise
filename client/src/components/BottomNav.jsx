import { useRef, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { IoWallet, IoRepeat, IoSave, IoTime, IoSettings, IoDocumentText, IoFlash } from 'react-icons/io5';
import { useSettings } from '../context/SettingsContext';

const tabs = [
  { path: '/', icon: IoFlash, label: 'Trail' },
  { path: '/budget', icon: IoWallet, label: 'Budget' },
  { path: '/routines', icon: IoRepeat, label: 'Routines' },
  { path: '/savings', icon: IoSave, label: 'Savings' },
  { path: '/notes', icon: IoDocumentText, label: 'Notes' },
  { path: '/history', icon: IoTime, label: 'History' },
  { path: '/settings', icon: IoSettings, label: 'Settings' },
];

const MENU_ORDER = tabs.map(t => t.path);

export default function BottomNav() {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const touchStartRef = useRef(null);
  const touchStartYRef = useRef(null);

  const onTouchStart = useCallback((e) => {
    touchStartRef.current = e.changedTouches[0].clientX;
    touchStartYRef.current = e.changedTouches[0].clientY;
  }, []);

  const onTouchEnd = useCallback((e) => {
    if (settings?.menuSwipeEnabled === false) return;
    if (touchStartRef.current === null) return;

    const diffX = touchStartRef.current - e.changedTouches[0].clientX;
    const diffY = touchStartYRef.current - e.changedTouches[0].clientY;
    touchStartRef.current = null;
    touchStartYRef.current = null;

    if (Math.abs(diffX) < 50 || Math.abs(diffY) > Math.abs(diffX)) return;

    const currentIdx = MENU_ORDER.indexOf(location.pathname);
    if (currentIdx === -1) return;

    if (diffX > 0 && currentIdx < MENU_ORDER.length - 1) {
      navigate(MENU_ORDER[currentIdx + 1]);
    } else if (diffX < 0 && currentIdx > 0) {
      navigate(MENU_ORDER[currentIdx - 1]);
    }
  }, [location.pathname, navigate, settings?.menuSwipeEnabled]);

  return (
    <nav
      className="bottom-nav"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
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
          <span className="nav-label" style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
