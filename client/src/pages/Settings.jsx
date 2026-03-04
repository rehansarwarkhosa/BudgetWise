import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useSettings } from '../context/SettingsContext';
import Spinner from '../components/Spinner';
import ConfirmModal from '../components/ConfirmModal';
import { IoSunny, IoMoon } from 'react-icons/io5';
import { updateSettings, deleteAllData, exportAllData, importAllData } from '../api';

export default function Settings() {
  const { settings, loading, refetchSettings } = useSettings();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const [mode, setMode] = useState(settings?.mode || 'monthly');
  const [negativeLimit, setNegativeLimit] = useState(settings?.negativeLimit ?? 0);
  const [notificationEmail, setNotificationEmail] = useState(settings?.notificationEmail || '');
  const [theme, setTheme] = useState(settings?.theme || 'dark');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (settings && !initialized) {
      setMode(settings.mode || 'monthly');
      setNegativeLimit(settings.negativeLimit ?? 0);
      setNotificationEmail(settings.notificationEmail || '');
      setTheme(settings.theme || 'dark');
      setInitialized(true);
    }
  }, [settings, initialized]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({ mode, negativeLimit: Number(negativeLimit), notificationEmail, theme });
      await refetchSettings();
      setInitialized(false);
      toast.success('Settings saved');
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      await deleteAllData();
      await refetchSettings();
      toast.success('All data deleted');
    } catch (err) { toast.error(err.message); }
    finally { setDeleting(false); }
  };

  const handleExport = async () => {
    try {
      const res = await exportAllData();
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `budgetwise-backup-${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' })}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup downloaded');
    } catch (err) { toast.error(err.message); }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.version) throw new Error('Invalid backup file');
      await importAllData(data);
      await refetchSettings();
      toast.success('Data restored successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to import');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>

      {/* Theme Toggle */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-group">
          <label>Appearance</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['light', 'dark'].map((t) => (
              <button key={t} type="button" onClick={async () => {
                setTheme(t);
                document.documentElement.setAttribute('data-theme', t);
                try {
                  await updateSettings({ theme: t });
                  await refetchSettings();
                  setInitialized(false);
                } catch {}
              }} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 600,
                border: `2px solid ${theme === t ? 'var(--primary)' : 'var(--border)'}`,
                background: theme === t ? 'var(--primary)' : 'transparent',
                color: theme === t ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer', transition: 'all 0.2s',
              }}>
                {t === 'light' ? <IoSunny size={18} /> : <IoMoon size={18} />}
                {t === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-group">
          <label>Budget Mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        <div className="form-group">
          <label>Negative Limit (PKR)</label>
          <input type="number" value={negativeLimit} min="0"
            onChange={(e) => setNegativeLimit(e.target.value)}
            placeholder="How far income can go negative" />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Maximum amount your income pool can go into the negative when allocating budgets.
          </p>
        </div>

        <div className="form-group">
          <label>Current Period</label>
          <p style={{ fontSize: 14, fontWeight: 500 }}>
            {settings?.currentPeriod?.month}/{settings?.currentPeriod?.year}
          </p>
        </div>

        <div className="form-group">
          <label>Notification Email</label>
          <input type="email" value={notificationEmail}
            onChange={(e) => setNotificationEmail(e.target.value)}
            placeholder="Email for routine reminders" />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Routine reminders will be sent to this email via the cron job.
          </p>
        </div>

        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Guide */}
      <div className="card" style={{ marginBottom: 16, cursor: 'pointer' }} onClick={() => navigate('/guide')}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Financial Module Guide</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Learn how income, budgets, expenses, savings, and rollover work together.
        </p>
      </div>

      {/* Backup & Restore */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
          Backup & Restore
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Export your data as a backup file, or restore from a previous backup.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary" style={{ flex: 1 }} onClick={handleExport}>
            Export Backup
          </button>
          <button className="btn-outline" style={{ flex: 1 }} disabled={importing}
            onClick={() => fileInputRef.current?.click()}>
            {importing ? 'Importing...' : 'Import Backup'}
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport}
            style={{ display: 'none' }} />
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--danger)', marginBottom: 8 }}>
          Danger Zone
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Delete all data and reset the application. Consider exporting a backup first.
        </p>
        <button className="btn-danger" onClick={() => setConfirmDeleteAll(true)} disabled={deleting}>
          {deleting ? 'Deleting...' : 'Delete All Data'}
        </button>
      </div>

      <ConfirmModal open={confirmDeleteAll} onClose={() => setConfirmDeleteAll(false)}
        onConfirm={handleDeleteAll}
        title="Delete all data?"
        message="This will permanently delete ALL data (income, budgets, expenses, routines, savings, notes, tags). This action cannot be undone. Consider exporting a backup first."
        confirmText="Delete Everything" />
    </div>
  );
}
