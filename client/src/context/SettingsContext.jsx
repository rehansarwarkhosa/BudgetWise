import { createContext, useContext, useState, useEffect } from 'react';
import { getSettings } from '../api';

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const res = await getSettings();
      setSettings(res.data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  // Apply theme to document whenever settings change
  useEffect(() => {
    if (settings?.theme) {
      document.documentElement.setAttribute('data-theme', settings.theme);
    }
  }, [settings?.theme]);

  return (
    <SettingsContext.Provider value={{ settings, setSettings, loading, refetchSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}
