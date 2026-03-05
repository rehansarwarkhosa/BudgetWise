import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useSettings } from '../context/SettingsContext';
import Spinner from '../components/Spinner';
import ConfirmModal from '../components/ConfirmModal';
import { IoSunny, IoMoon, IoTrash, IoAdd } from 'react-icons/io5';
import { updateSettings, deleteAllData, exportAllData, importAllData, deleteAllTrails, getAuditLogs, clearAuditLogs, getBudgetCategories, addBudgetCategory, deleteBudgetCategory } from '../api';
import { formatDate } from '../utils/format';

export default function Settings() {
  const { settings, loading, refetchSettings } = useSettings();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmDeleteTrails, setConfirmDeleteTrails] = useState(false);
  const [deletingTrails, setDeletingTrails] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const [mode, setMode] = useState(settings?.mode || 'monthly');
  const [negativeLimit, setNegativeLimit] = useState(settings?.negativeLimit ?? 0);
  const [notificationEmail, setNotificationEmail] = useState(settings?.notificationEmail || '');
  const [theme, setTheme] = useState(settings?.theme || 'dark');
  const [initialized, setInitialized] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPages, setAuditPages] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [confirmClearAudit, setConfirmClearAudit] = useState(false);
  const [categories, setCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState(null);
  const [trailBoldText, setTrailBoldText] = useState(false);
  const [trailHighlights, setTrailHighlights] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [newColor, setNewColor] = useState('#ef4444');

  useEffect(() => {
    if (settings && !initialized) {
      setMode(settings.mode || 'monthly');
      setNegativeLimit(settings.negativeLimit ?? 0);
      setNotificationEmail(settings.notificationEmail || '');
      setTheme(settings.theme || 'dark');
      setTrailBoldText(settings.trailBoldText || false);
      setTrailHighlights(settings.trailHighlights || []);
      setInitialized(true);
    }
  }, [settings, initialized]);

  const fetchAuditLogs = async (page = 1) => {
    setAuditLoading(true);
    try {
      const res = await getAuditLogs(page);
      setAuditLogs(res.data.logs);
      setAuditTotal(res.data.total);
      setAuditPages(res.data.pages);
      setAuditPage(res.data.page);
    } catch (err) { toast.error(err.message); }
    finally { setAuditLoading(false); }
  };

  const handleClearAuditLogs = async () => {
    try {
      await clearAuditLogs();
      setAuditLogs([]);
      setAuditTotal(0);
      toast.success('Audit logs cleared');
    } catch (err) { toast.error(err.message); }
  };

  const fetchCategories = async () => {
    try {
      const res = await getBudgetCategories();
      setCategories(res.data);
    } catch (err) { toast.error(err.message); }
  };

  useEffect(() => {
    if (settings) fetchCategories();
  }, [settings]);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setCategoryLoading(true);
    try {
      await addBudgetCategory({ name: newCategoryName.trim() });
      toast.success('Category added');
      setNewCategoryName('');
      fetchCategories();
    } catch (err) { toast.error(err.message); }
    finally { setCategoryLoading(false); }
  };

  const handleDeleteCategory = async () => {
    if (!confirmDeleteCategory) return;
    try {
      await deleteBudgetCategory(confirmDeleteCategory._id);
      toast.success('Category deleted');
      fetchCategories();
    } catch (err) { toast.error(err.message); }
  };

  const handleToggleTrailBold = async () => {
    const next = !trailBoldText;
    setTrailBoldText(next);
    try {
      await updateSettings({ trailBoldText: next });
      await refetchSettings();
      setInitialized(false);
    } catch (err) { toast.error(err.message); setTrailBoldText(!next); }
  };

  const handleAddHighlight = async (e) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    const updated = [...trailHighlights, { keyword: newKeyword.trim().toLowerCase(), color: newColor }];
    setTrailHighlights(updated);
    setNewKeyword('');
    try {
      await updateSettings({ trailHighlights: updated });
      await refetchSettings();
      setInitialized(false);
      toast.success('Highlight rule added');
    } catch (err) { toast.error(err.message); }
  };

  const handleRemoveHighlight = async (index) => {
    const updated = trailHighlights.filter((_, i) => i !== index);
    setTrailHighlights(updated);
    try {
      await updateSettings({ trailHighlights: updated });
      await refetchSettings();
      setInitialized(false);
      toast.success('Highlight rule removed');
    } catch (err) { toast.error(err.message); }
  };

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

      {/* Budget Categories */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Budget Categories</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Add or remove categories that appear when creating budgets.
        </p>
        <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input type="text" placeholder="New category name" value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)} style={{ flex: 1 }} />
          <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 16px' }} disabled={categoryLoading}>
            <IoAdd size={18} />
          </button>
        </form>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {categories.map((cat) => (
            <div key={cat._id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 20,
              background: 'var(--bg-input)', fontSize: 13, fontWeight: 500,
            }}>
              {cat.name}
              <button className="btn-ghost" style={{ padding: 2 }} onClick={() => setConfirmDeleteCategory(cat)}>
                <IoTrash size={12} color="var(--danger)" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <ConfirmModal open={!!confirmDeleteCategory} onClose={() => setConfirmDeleteCategory(null)}
        onConfirm={handleDeleteCategory}
        title="Delete category?"
        message={`Delete budget category "${confirmDeleteCategory?.name}"? Existing budgets with this category will not be affected.`} />

      {/* Trail Settings */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Trail Formatting</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Customize how trail entries look.
        </p>

        {/* Bold toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 14 }}>Bold entry text</span>
          <button onClick={handleToggleTrailBold} style={{
            width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: trailBoldText ? 'var(--primary)' : 'var(--bg-input)',
            position: 'relative', transition: 'background 0.2s',
          }}>
            <span style={{
              position: 'absolute', top: 2, left: trailBoldText ? 22 : 2,
              width: 20, height: 20, borderRadius: '50%', background: 'white',
              transition: 'left 0.2s',
            }} />
          </button>
        </div>

        {/* Keyword highlights */}
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'block' }}>
            Keyword Color Highlights
          </label>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            If a trail entry contains a keyword, its background changes to the chosen color.
          </p>
          <form onSubmit={handleAddHighlight} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input type="text" placeholder="Keyword (e.g. milk)" value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)} style={{ flex: 1 }} />
            <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
              style={{ width: 40, height: 40, padding: 2, border: '2px solid var(--border)', borderRadius: 8, cursor: 'pointer', background: 'transparent' }} />
            <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 16px' }}>
              <IoAdd size={18} />
            </button>
          </form>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {trailHighlights.map((h, i) => (
              <div key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: 500,
                background: h.color + '25', border: `1px solid ${h.color}50`,
              }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: h.color, display: 'inline-block' }} />
                {h.keyword}
                <button className="btn-ghost" style={{ padding: 2 }} onClick={() => handleRemoveHighlight(i)}>
                  <IoTrash size={12} color="var(--danger)" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Guide */}
      <div className="card" style={{ marginBottom: 16, cursor: 'pointer' }} onClick={() => navigate('/guide')}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Financial Module Guide</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Learn how income, budgets, expenses, savings, and rollover work together.
        </p>
      </div>

      {/* Audit Log */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Audit Log</h3>
          {showAuditLog && auditLogs.length > 0 && (
            <button className="btn-ghost" style={{ fontSize: 12, color: 'var(--danger)' }}
              onClick={() => setConfirmClearAudit(true)}>
              Clear All
            </button>
          )}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Track every action performed in the app.
        </p>
        {!showAuditLog ? (
          <button className="btn-outline" onClick={() => { setShowAuditLog(true); fetchAuditLogs(1); }}>
            View Audit Log
          </button>
        ) : auditLoading ? (
          <Spinner />
        ) : auditLogs.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>No audit logs yet</p>
        ) : (
          <>
            <div style={{ display: 'grid', gap: 0 }}>
              {auditLogs.map((log) => (
                <div key={log._id} style={{
                  padding: '10px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                      background: log.action === 'DELETE' ? 'rgba(239,68,68,0.15)' : log.action === 'CREATE' ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.15)',
                      color: log.action === 'DELETE' ? 'var(--danger)' : log.action === 'CREATE' ? 'var(--success)' : 'var(--primary)',
                      whiteSpace: 'nowrap',
                    }}>
                      {log.action}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {formatDate(log.timestamp)}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>{log.details}</div>
                </div>
              ))}
            </div>
            {auditPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                <button className="btn-outline" style={{ fontSize: 12 }}
                  disabled={auditPage <= 1}
                  onClick={() => fetchAuditLogs(auditPage - 1)}>
                  Previous
                </button>
                <span style={{ fontSize: 12, lineHeight: '32px', color: 'var(--text-muted)' }}>
                  {auditPage} / {auditPages}
                </span>
                <button className="btn-outline" style={{ fontSize: 12 }}
                  disabled={auditPage >= auditPages}
                  onClick={() => fetchAuditLogs(auditPage + 1)}>
                  Next
                </button>
              </div>
            )}
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
              {auditTotal} total entries
            </p>
          </>
        )}
      </div>

      <ConfirmModal open={confirmClearAudit} onClose={() => setConfirmClearAudit(false)}
        onConfirm={handleClearAuditLogs}
        title="Clear audit logs?"
        message="This will permanently delete all audit log entries. This action cannot be undone."
        confirmText="Clear All" />

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

      {/* Delete Trail Entries */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Trail Data</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Delete all quick trail entries.
        </p>
        <button className="btn-danger" onClick={() => setConfirmDeleteTrails(true)} disabled={deletingTrails}>
          {deletingTrails ? 'Deleting...' : 'Delete All Trail Entries'}
        </button>
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

      <ConfirmModal open={confirmDeleteTrails} onClose={() => setConfirmDeleteTrails(false)}
        onConfirm={async () => {
          setDeletingTrails(true);
          try {
            await deleteAllTrails();
            toast.success('All trail entries deleted');
          } catch (err) { toast.error(err.message); }
          finally { setDeletingTrails(false); }
        }}
        title="Delete all trail entries?"
        message="This will permanently delete all your quick trail entries. This action cannot be undone." />
    </div>
  );
}
