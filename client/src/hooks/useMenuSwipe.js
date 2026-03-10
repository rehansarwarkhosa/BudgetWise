import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';

const MENU_ORDER = ['/', '/budget', '/routines', '/savings', '/notes', '/history', '/settings'];

export default function useMenuSwipe() {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();

  const onOverflow = useCallback((direction) => {
    if (settings?.menuSwipeEnabled === false) return;

    const currentIdx = MENU_ORDER.indexOf(location.pathname);
    if (currentIdx === -1) return;

    if (direction === 'right' && currentIdx < MENU_ORDER.length - 1) {
      navigate(MENU_ORDER[currentIdx + 1]);
    } else if (direction === 'left' && currentIdx > 0) {
      navigate(MENU_ORDER[currentIdx - 1]);
    }
  }, [location.pathname, navigate, settings?.menuSwipeEnabled]);

  return onOverflow;
}
