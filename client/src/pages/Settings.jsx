import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useSettings } from '../context/SettingsContext';
import Spinner from '../components/Spinner';
import ConfirmModal from '../components/ConfirmModal';
import { IoSunny, IoMoon, IoTrash, IoAdd } from 'react-icons/io5';
import { updateSettings, deleteAllData, exportAllData, importAllData, deleteAllTrails, getAuditLogs, clearAuditLogs, getBudgetCategories, addBudgetCategory, updateBudgetCategory, deleteBudgetCategory, sendTestEmail } from '../api';
import { formatDate, formatDateTime } from '../utils/format';

const PRESET_COLORS = [
  { name: 'Red', hex: '#ef4444' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Pink', hex: '#ec4899' },
];

function HighlightEditor({ highlights, newKeyword, setNewKeyword, newColor, setNewColor, onAdd, onRemove, onUpdateColor, description }) {
  const [hexInput, setHexInput] = useState(newColor);
  const colorPickerRef = useRef(null);
  const editPickerRef = useRef(null);
  const [editingIdx, setEditingIdx] = useState(null);

  // Keep hexInput in sync when newColor changes (from presets or native picker)
  useEffect(() => {
    setHexInput(newColor);
  }, [newColor]);

  const handleHexInputChange = (val) => {
    setHexInput(val);
    // Auto-apply if valid hex
    const clean = val.startsWith('#') ? val : '#' + val;
    if (/^#[0-9A-Fa-f]{6}$/.test(clean)) {
      setNewColor(clean.toLowerCase());
    }
  };

  const handlePresetClick = (hex) => {
    setNewColor(hex);
    setHexInput(hex);
  };

  const handleNativeColorChange = (e) => {
    const c = e.target.value.toLowerCase();
    setNewColor(c);
    setHexInput(c);
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'block' }}>
        Keyword Color Highlights
      </label>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
        {description || 'If an entry contains a keyword, its background changes to the chosen color.'}
      </p>

      {/* Keyword input */}
      <div style={{ marginBottom: 8 }}>
        <input type="text" placeholder="Keyword (e.g. milk)" value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)} style={{ width: '100%' }} />
      </div>

      {/* Preset colors */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {PRESET_COLORS.map((p) => (
          <button key={p.hex} type="button" onClick={() => handlePresetClick(p.hex)}
            style={{
              width: 28, height: 28, borderRadius: '50%', border: newColor === p.hex ? '3px solid var(--text-primary)' : '2px solid var(--border)',
              background: p.hex, cursor: 'pointer', transition: 'border 0.15s',
              outline: newColor === p.hex ? '2px solid var(--primary)' : 'none',
              outlineOffset: 1,
            }}
            title={`${p.name} (${p.hex})`}
          />
        ))}
      </div>

      {/* Color picker + hex input row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ position: 'relative' }}>
          <input ref={colorPickerRef} type="color" value={newColor} onChange={handleNativeColorChange}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
          <button type="button" onClick={() => colorPickerRef.current?.click()}
            style={{
              width: 36, height: 36, borderRadius: 8, border: '2px solid var(--border)',
              background: newColor, cursor: 'pointer', transition: 'background 0.15s',
            }}
            title="Custom color" />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 0,
          background: 'var(--bg-input)', borderRadius: 8, border: '1px solid var(--border)',
          overflow: 'hidden', flex: 1,
        }}>
          <span style={{
            padding: '8px 8px 8px 10px', fontSize: 13, color: 'var(--text-muted)',
            fontFamily: 'monospace', userSelect: 'none',
          }}>#</span>
          <input type="text" value={hexInput.replace('#', '')}
            onChange={(e) => handleHexInputChange('#' + e.target.value.replace('#', ''))}
            maxLength={6}
            placeholder="ef4444"
            style={{
              flex: 1, border: 'none', background: 'transparent', padding: '8px 10px 8px 0',
              fontSize: 13, fontFamily: 'monospace', letterSpacing: 1,
              outline: 'none', color: 'var(--text-primary)',
            }} />
        </div>
        <div style={{
          width: 16, height: 16, borderRadius: 4, background: newColor,
          border: '1px solid var(--border)', flexShrink: 0,
        }} />
      </div>

      {/* Add button */}
      <form onSubmit={onAdd} style={{ marginBottom: 12 }}>
        <button type="submit" className="btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <IoAdd size={18} /> Add Highlight
        </button>
      </form>

      {/* Hidden color picker for editing existing highlights */}
      <input ref={editPickerRef} type="color" style={{ position: 'fixed', top: -100, left: -100, opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
        onChange={(e) => {
          if (editingIdx !== null) onUpdateColor(editingIdx, e.target.value.toLowerCase());
        }} />

      {/* Saved highlights */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {highlights.map((h, i) => (
          <div key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: 500,
            background: h.color + '25', border: `1px solid ${h.color}50`,
          }}>
            <button type="button" onClick={() => {
              setEditingIdx(i);
              if (editPickerRef.current) { editPickerRef.current.value = h.color; editPickerRef.current.click(); }
            }} style={{
              width: 14, height: 14, borderRadius: '50%', background: h.color, border: '2px solid var(--border)',
              cursor: 'pointer', padding: 0, flexShrink: 0,
            }} title="Change color" />
            {h.keyword}
            <span style={{
              fontSize: 10, fontFamily: 'monospace', color: h.color, opacity: 0.8,
              letterSpacing: 0.5,
            }}>{h.color}</span>
            <button className="btn-ghost" style={{ padding: 2 }} onClick={() => onRemove(i)}>
              <IoTrash size={12} color="var(--danger)" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryColorEditor({ categories, newName, setNewName, newColor, setNewColor, onAdd, onDelete, onUpdateColor, loading }) {
  const [hexInput, setHexInput] = useState(newColor);
  const colorPickerRef = useRef(null);
  const editPickerRef = useRef(null);
  const [editingCatId, setEditingCatId] = useState(null);

  useEffect(() => {
    setHexInput(newColor);
  }, [newColor]);

  const handleHexInputChange = (val) => {
    setHexInput(val);
    const clean = val.startsWith('#') ? val : '#' + val;
    if (/^#[0-9A-Fa-f]{6}$/.test(clean)) {
      setNewColor(clean.toLowerCase());
    }
  };

  const handlePresetClick = (hex) => {
    setNewColor(hex);
    setHexInput(hex);
  };

  const handleNativeColorChange = (e) => {
    const c = e.target.value.toLowerCase();
    setNewColor(c);
    setHexInput(c);
  };

  return (
    <div>
      {/* Name input */}
      <div style={{ marginBottom: 8 }}>
        <input type="text" placeholder="Category name (e.g. Travel)" value={newName}
          onChange={(e) => setNewName(e.target.value)} style={{ width: '100%' }} />
      </div>

      {/* Preset colors */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {PRESET_COLORS.map((p) => (
          <button key={p.hex} type="button" onClick={() => handlePresetClick(p.hex)}
            style={{
              width: 28, height: 28, borderRadius: '50%', border: newColor === p.hex ? '3px solid var(--text-primary)' : '2px solid var(--border)',
              background: p.hex, cursor: 'pointer', transition: 'border 0.15s',
              outline: newColor === p.hex ? '2px solid var(--primary)' : 'none',
              outlineOffset: 1,
            }}
            title={`${p.name} (${p.hex})`}
          />
        ))}
      </div>

      {/* Color picker + hex input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ position: 'relative' }}>
          <input ref={colorPickerRef} type="color" value={newColor} onChange={handleNativeColorChange}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
          <button type="button" onClick={() => colorPickerRef.current?.click()}
            style={{
              width: 36, height: 36, borderRadius: 8, border: '2px solid var(--border)',
              background: newColor, cursor: 'pointer', transition: 'background 0.15s',
            }}
            title="Custom color" />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 0,
          background: 'var(--bg-input)', borderRadius: 8, border: '1px solid var(--border)',
          overflow: 'hidden', flex: 1,
        }}>
          <span style={{
            padding: '8px 8px 8px 10px', fontSize: 13, color: 'var(--text-muted)',
            fontFamily: 'monospace', userSelect: 'none',
          }}>#</span>
          <input type="text" value={hexInput.replace('#', '')}
            onChange={(e) => handleHexInputChange('#' + e.target.value.replace('#', ''))}
            maxLength={6}
            placeholder="6C63FF"
            style={{
              flex: 1, border: 'none', background: 'transparent', padding: '8px 10px 8px 0',
              fontSize: 13, fontFamily: 'monospace', letterSpacing: 1,
              outline: 'none', color: 'var(--text-primary)',
            }} />
        </div>
        <div style={{
          width: 16, height: 16, borderRadius: 4, background: newColor,
          border: '1px solid var(--border)', flexShrink: 0,
        }} />
      </div>

      {/* Add button */}
      <form onSubmit={onAdd} style={{ marginBottom: 12 }}>
        <button type="submit" className="btn-primary" disabled={loading}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <IoAdd size={18} /> Add Category
        </button>
      </form>

      {/* Hidden color picker for editing existing categories */}
      <input ref={editPickerRef} type="color" style={{ position: 'fixed', top: -100, left: -100, opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
        onChange={(e) => {
          if (editingCatId) onUpdateColor(editingCatId, e.target.value.toLowerCase());
        }} />

      {/* Saved categories */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {categories.map((cat) => {
          const cc = cat.color || '#3AAFB9';
          return (
            <div key={cat._id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: 500,
              background: cc + '25', border: `1px solid ${cc}50`,
            }}>
              <button type="button" onClick={() => {
                setEditingCatId(cat._id);
                if (editPickerRef.current) { editPickerRef.current.value = cc; editPickerRef.current.click(); }
              }} style={{
                width: 14, height: 14, borderRadius: '50%', background: cc, border: '2px solid var(--border)',
                cursor: 'pointer', padding: 0, flexShrink: 0,
              }} title="Change color" />
              {cat.name}
              <span style={{
                fontSize: 10, fontFamily: 'monospace', color: cc, opacity: 0.8,
                letterSpacing: 0.5,
              }}>{cc}</span>
              <button className="btn-ghost" style={{ padding: 2 }} onClick={() => onDelete(cat)}>
                <IoTrash size={12} color="var(--danger)" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Settings() {
  const { settings, loading, refetchSettings } = useSettings();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmDeleteTrails, setConfirmDeleteTrails] = useState(false);
  const [deletingTrails, setDeletingTrails] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
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
  const [newCategoryColor, setNewCategoryColor] = useState('#3AAFB9');
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState(null);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);
  const [trailBoldText, setTrailBoldText] = useState(false);
  const [trailHighlights, setTrailHighlights] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [newColor, setNewColor] = useState('#ef4444');
  const [routineHighlights, setRoutineHighlights] = useState([]);
  const [newRoutineKeyword, setNewRoutineKeyword] = useState('');
  const [newRoutineColor, setNewRoutineColor] = useState('#ef4444');
  const [kanbanColorRules, setKanbanColorRules] = useState([
    { days: 3, color: '#f59e0b', label: 'Warning' },
    { days: 1, color: '#ef4444', label: 'Danger' },
  ]);
  const [kanbanOverdueColor, setKanbanOverdueColor] = useState('#dc2626');
  const [menuSwipeEnabled, setMenuSwipeEnabled] = useState(true);
  const [tabSwipeTrail, setTabSwipeTrail] = useState(true);
  const [tabSwipeBudget, setTabSwipeBudget] = useState(true);
  const [tabSwipeRoutines, setTabSwipeRoutines] = useState(true);
  const [tabSwipeNotes, setTabSwipeNotes] = useState(true);
  const [trailReorderEnabled, setTrailReorderEnabled] = useState(true);
  const [trailReorderTaps, setTrailReorderTaps] = useState(2);
  const [trailDetailEnabled, setTrailDetailEnabled] = useState(true);
  const [trailDetailTaps, setTrailDetailTaps] = useState(3);

  useEffect(() => {
    if (settings && !initialized) {
      setMode(settings.mode || 'monthly');
      setNegativeLimit(settings.negativeLimit ?? 0);
      setNotificationEmail(settings.notificationEmail || '');
      setTheme(settings.theme || 'dark');
      setEmailNotificationsEnabled(settings.emailNotificationsEnabled ?? true);
      setTrailBoldText(settings.trailBoldText || false);
      setTrailHighlights(settings.trailHighlights || []);
      setRoutineHighlights(settings.routineHighlights || []);
      const kdc = settings.kanbanDueDateColors || {};
      if (kdc.rules?.length) {
        setKanbanColorRules(kdc.rules.map(r => ({ days: r.days, color: r.color, label: r.label || '' })));
      } else if (kdc.warningDays !== undefined) {
        // Migrate old format
        setKanbanColorRules([
          { days: kdc.warningDays ?? 3, color: kdc.warningColor || '#f59e0b', label: 'Warning' },
          { days: kdc.dangerDays ?? 1, color: kdc.dangerColor || '#ef4444', label: 'Danger' },
        ]);
      }
      setKanbanOverdueColor(kdc.overdueColor || '#dc2626');
      setMenuSwipeEnabled(settings.menuSwipeEnabled ?? true);
      setTabSwipeTrail(settings.tabSwipeTrail ?? true);
      setTabSwipeBudget(settings.tabSwipeBudget ?? true);
      setTabSwipeRoutines(settings.tabSwipeRoutines ?? true);
      setTabSwipeNotes(settings.tabSwipeNotes ?? true);
      setTrailReorderEnabled(settings.trailReorderEnabled ?? true);
      setTrailReorderTaps(settings.trailReorderTaps ?? 2);
      setTrailDetailEnabled(settings.trailDetailEnabled ?? true);
      setTrailDetailTaps(settings.trailDetailTaps ?? 3);
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
      await addBudgetCategory({ name: newCategoryName.trim(), color: newCategoryColor });
      toast.success('Category added');
      setNewCategoryName('');
      setNewCategoryColor('#3AAFB9');
      fetchCategories();
    } catch (err) { toast.error(err.message); }
    finally { setCategoryLoading(false); }
  };

  const handleUpdateCategoryColor = async (catId, color) => {
    try {
      await updateBudgetCategory(catId, { color });
      setCategories(prev => prev.map(c => c._id === catId ? { ...c, color } : c));
      toast.success('Color updated');
    } catch (err) { toast.error(err.message); }
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

  const handleUpdateHighlightColor = async (index, color) => {
    const updated = trailHighlights.map((h, i) => i === index ? { ...h, color } : h);
    setTrailHighlights(updated);
    try {
      await updateSettings({ trailHighlights: updated });
      await refetchSettings();
      setInitialized(false);
      toast.success('Color updated');
    } catch (err) { toast.error(err.message); }
  };

  const handleAddRoutineHighlight = async (e) => {
    e.preventDefault();
    if (!newRoutineKeyword.trim()) return;
    const updated = [...routineHighlights, { keyword: newRoutineKeyword.trim().toLowerCase(), color: newRoutineColor }];
    setRoutineHighlights(updated);
    setNewRoutineKeyword('');
    try {
      await updateSettings({ routineHighlights: updated });
      await refetchSettings();
      setInitialized(false);
      toast.success('Highlight rule added');
    } catch (err) { toast.error(err.message); }
  };

  const handleRemoveRoutineHighlight = async (index) => {
    const updated = routineHighlights.filter((_, i) => i !== index);
    setRoutineHighlights(updated);
    try {
      await updateSettings({ routineHighlights: updated });
      await refetchSettings();
      setInitialized(false);
      toast.success('Highlight rule removed');
    } catch (err) { toast.error(err.message); }
  };

  const handleUpdateRoutineHighlightColor = async (index, color) => {
    const updated = routineHighlights.map((h, i) => i === index ? { ...h, color } : h);
    setRoutineHighlights(updated);
    try {
      await updateSettings({ routineHighlights: updated });
      await refetchSettings();
      setInitialized(false);
      toast.success('Color updated');
    } catch (err) { toast.error(err.message); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({ mode, negativeLimit: Number(negativeLimit), notificationEmail, theme, menuSwipeEnabled });
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

  if (loading && !settings) return <Spinner />;

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

      {/* Menu Swipe */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 500 }}>Menu Swipe Navigation</span>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Swipe between menus when at the edge of tabs</p>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, flexShrink: 0 }}>
            <input type="checkbox" checked={menuSwipeEnabled} onChange={async (e) => {
              const val = e.target.checked;
              setMenuSwipeEnabled(val);
              try {
                await updateSettings({ menuSwipeEnabled: val });
                await refetchSettings();
                setInitialized(false);
              } catch {}
            }} style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{
              position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
              background: menuSwipeEnabled ? 'var(--primary)' : 'var(--bg-input)',
              borderRadius: 24, transition: '0.2s',
            }}>
              <span style={{
                position: 'absolute', height: 18, width: 18, left: menuSwipeEnabled ? 22 : 3, bottom: 3,
                background: 'white', borderRadius: '50%', transition: '0.2s',
              }} />
            </span>
          </label>
        </div>
      </div>

      {/* Tab Swipe Navigation */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Tab Swipe Navigation</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          Enable or disable swiping between tabs within each menu. Disabling also disables child tab swiping.
        </p>
        {[
          { key: 'tabSwipeTrail', label: 'Trail', desc: 'Trail & Board tabs, detail sub-tabs', state: tabSwipeTrail, setter: setTabSwipeTrail },
          { key: 'tabSwipeBudget', label: 'Budget', desc: 'Budgets, Templates, Prices, Stock tabs & detail sub-tabs', state: tabSwipeBudget, setter: setTabSwipeBudget },
          { key: 'tabSwipeRoutines', label: 'Routines', desc: 'Pending, Done, Scheduled, Expired tabs & detail sub-tabs', state: tabSwipeRoutines, setter: setTabSwipeRoutines },
          { key: 'tabSwipeNotes', label: 'Notes', desc: 'Tree & Recent tabs', state: tabSwipeNotes, setter: setTabSwipeNotes },
        ].map(({ key, label, desc, state, setter }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{desc}</p>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, flexShrink: 0 }}>
              <input type="checkbox" checked={state} onChange={async (e) => {
                const val = e.target.checked;
                setter(val);
                try {
                  await updateSettings({ [key]: val });
                  await refetchSettings();
                  setInitialized(false);
                } catch {}
              }} style={{ opacity: 0, width: 0, height: 0 }} />
              <span style={{
                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                background: state ? 'var(--primary)' : 'var(--bg-input)',
                borderRadius: 24, transition: '0.2s',
              }}>
                <span style={{
                  position: 'absolute', height: 18, width: 18, left: state ? 22 : 3, bottom: 3,
                  background: 'white', borderRadius: '50%', transition: '0.2s',
                }} />
              </span>
            </label>
          </div>
        ))}
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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 500 }}>Email Notifications</span>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {emailNotificationsEnabled ? 'Routine reminders are active' : 'All email notifications are paused'}
            </p>
          </div>
          <button type="button" onClick={async () => {
            const next = !emailNotificationsEnabled;
            setEmailNotificationsEnabled(next);
            try {
              await updateSettings({ emailNotificationsEnabled: next });
              await refetchSettings();
              setInitialized(false);
              toast.success(next ? 'Notifications enabled' : 'Notifications disabled');
            } catch (err) { toast.error(err.message); setEmailNotificationsEnabled(!next); }
          }} style={{
            width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: emailNotificationsEnabled ? 'var(--success)' : 'var(--bg-input)',
            position: 'relative', transition: 'background 0.2s',
          }}>
            <span style={{
              position: 'absolute', top: 2, left: emailNotificationsEnabled ? 22 : 2,
              width: 20, height: 20, borderRadius: '50%', background: 'white',
              transition: 'left 0.2s',
            }} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button className="btn-outline" style={{ flex: 'none', padding: '10px 14px' }}
            disabled={sendingTest}
            onClick={async () => {
              setSendingTest(true);
              try {
                await sendTestEmail();
                toast.success('Test email sent! Check your inbox.');
              } catch (err) { toast.error(err.response?.data?.error || err.message); }
              finally { setSendingTest(false); }
            }}>
            {sendingTest ? 'Sending...' : 'Test Email'}
          </button>
        </div>
      </div>

      {/* Budget Categories */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Budget Categories</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Add or remove categories with colors. Budget groups use these colors.
        </p>
        <CategoryColorEditor
          categories={categories}
          newName={newCategoryName}
          setNewName={setNewCategoryName}
          newColor={newCategoryColor}
          setNewColor={setNewCategoryColor}
          onAdd={handleAddCategory}
          onDelete={(cat) => setConfirmDeleteCategory(cat)}
          onUpdateColor={handleUpdateCategoryColor}
          loading={categoryLoading}
        />
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
        <HighlightEditor
          highlights={trailHighlights}
          newKeyword={newKeyword}
          setNewKeyword={setNewKeyword}
          newColor={newColor}
          setNewColor={setNewColor}
          onAdd={handleAddHighlight}
          onRemove={handleRemoveHighlight}
          onUpdateColor={handleUpdateHighlightColor}
        />
      </div>

      {/* Trail Interactions */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Trail Interactions</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Configure tap-based reorder and detail popup behavior.
        </p>

        {/* Reorder toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 14 }}>Tap to reorder</span>
          <button onClick={async () => {
            const next = !trailReorderEnabled;
            setTrailReorderEnabled(next);
            try { await updateSettings({ trailReorderEnabled: next }); await refetchSettings(); setInitialized(false); }
            catch (err) { toast.error(err.message); setTrailReorderEnabled(!next); }
          }} style={{
            width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: trailReorderEnabled ? 'var(--primary)' : 'var(--bg-input)',
            position: 'relative', transition: 'background 0.2s',
          }}>
            <span style={{
              position: 'absolute', top: 2, left: trailReorderEnabled ? 22 : 2,
              width: 20, height: 20, borderRadius: '50%', background: 'white',
              transition: 'left 0.2s',
            }} />
          </button>
        </div>
        {trailReorderEnabled && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingLeft: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Taps to unlock reorder</span>
            <select value={trailReorderTaps} onChange={async (e) => {
              const val = parseInt(e.target.value);
              setTrailReorderTaps(val);
              try { await updateSettings({ trailReorderTaps: val }); await refetchSettings(); setInitialized(false); }
              catch (err) { toast.error(err.message); }
            }} style={{ fontSize: 13, padding: '4px 8px', width: 60 }}>
              {[2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}

        {/* Detail popup toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 14 }}>Tap to open detail</span>
          <button onClick={async () => {
            const next = !trailDetailEnabled;
            setTrailDetailEnabled(next);
            try { await updateSettings({ trailDetailEnabled: next }); await refetchSettings(); setInitialized(false); }
            catch (err) { toast.error(err.message); setTrailDetailEnabled(!next); }
          }} style={{
            width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: trailDetailEnabled ? 'var(--primary)' : 'var(--bg-input)',
            position: 'relative', transition: 'background 0.2s',
          }}>
            <span style={{
              position: 'absolute', top: 2, left: trailDetailEnabled ? 22 : 2,
              width: 20, height: 20, borderRadius: '50%', background: 'white',
              transition: 'left 0.2s',
            }} />
          </button>
        </div>
        {trailDetailEnabled && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, paddingLeft: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Taps to open detail</span>
            <select value={trailDetailTaps} onChange={async (e) => {
              const val = parseInt(e.target.value);
              setTrailDetailTaps(val);
              try { await updateSettings({ trailDetailTaps: val }); await refetchSettings(); setInitialized(false); }
              catch (err) { toast.error(err.message); }
            }} style={{ fontSize: 13, padding: '4px 8px', width: 60 }}>
              {[2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Routine Highlights */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Routine Formatting</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Highlight routine cards by keyword with custom colors.
        </p>
        <HighlightEditor
          highlights={routineHighlights}
          newKeyword={newRoutineKeyword}
          setNewKeyword={setNewRoutineKeyword}
          newColor={newRoutineColor}
          setNewColor={setNewRoutineColor}
          onAdd={handleAddRoutineHighlight}
          onRemove={handleRemoveRoutineHighlight}
          onUpdateColor={handleUpdateRoutineHighlightColor}
        />
      </div>

      {/* Kanban Card Colors */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Kanban Card Colors</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Add rules for work order card colors based on days remaining to due date.
        </p>

        {kanbanColorRules.map((rule, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, background: 'var(--bg-input)', borderRadius: 8, padding: '8px 10px' }}>
            <input type="text" value={rule.label} placeholder="Label"
              onChange={e => setKanbanColorRules(prev => prev.map((r, i) => i === idx ? { ...r, label: e.target.value } : r))}
              style={{ width: 70, fontSize: 12, padding: '4px 6px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>&#8804;</span>
              <input type="number" value={rule.days} min="0"
                onChange={e => setKanbanColorRules(prev => prev.map((r, i) => i === idx ? { ...r, days: Number(e.target.value) } : r))}
                style={{ width: 50, fontSize: 12, textAlign: 'center', padding: '4px' }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>days</span>
            </div>
            <input type="color" value={rule.color}
              onChange={e => setKanbanColorRules(prev => prev.map((r, i) => i === idx ? { ...r, color: e.target.value } : r))}
              style={{ width: 26, height: 26, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
            <input type="text" value={rule.color}
              onChange={e => setKanbanColorRules(prev => prev.map((r, i) => i === idx ? { ...r, color: e.target.value } : r))}
              style={{ width: 70, fontSize: 11, fontFamily: 'monospace', padding: '4px 6px' }} />
            <button className="btn-ghost" style={{ padding: 4, color: 'var(--danger)' }}
              onClick={() => setKanbanColorRules(prev => prev.filter((_, i) => i !== idx))}>
              <IoTrash size={14} />
            </button>
          </div>
        ))}

        <button className="btn-ghost" style={{ color: 'var(--primary)', fontSize: 13, marginBottom: 10 }}
          onClick={() => setKanbanColorRules(prev => [...prev, { days: 7, color: '#3b82f6', label: '' }])}>
          <IoAdd size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> Add Rule
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Overdue</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>(past due)</span>
          </div>
          <input type="color" value={kanbanOverdueColor} onChange={e => setKanbanOverdueColor(e.target.value)}
            style={{ width: 26, height: 26, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
          <input type="text" value={kanbanOverdueColor} onChange={e => setKanbanOverdueColor(e.target.value)}
            style={{ width: 70, fontSize: 11, fontFamily: 'monospace', padding: '4px 6px' }} />
        </div>

        {/* Preview */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
          {[...kanbanColorRules].sort((a, b) => b.days - a.days).map((rule, idx) => (
            <div key={idx} style={{
              flex: 1, minWidth: 60, padding: '6px 4px', borderRadius: 6, textAlign: 'center',
              fontSize: 10, fontWeight: 600, color: rule.color,
              background: rule.color + '20', border: `1.5px solid ${rule.color}`,
              borderLeft: `3px solid ${rule.color}`,
            }}>
              {rule.label || `${rule.days}d`}
            </div>
          ))}
          <div style={{
            flex: 1, minWidth: 60, padding: '6px 4px', borderRadius: 6, textAlign: 'center',
            fontSize: 10, fontWeight: 600, color: kanbanOverdueColor,
            background: kanbanOverdueColor + '20', border: `1.5px solid ${kanbanOverdueColor}`,
            borderLeft: `3px solid ${kanbanOverdueColor}`,
          }}>
            Overdue
          </div>
        </div>

        <button className="btn-primary" style={{ width: '100%', fontSize: 13 }}
          onClick={async () => {
            try {
              await updateSettings({
                kanbanDueDateColors: {
                  rules: kanbanColorRules.map(r => ({ days: r.days, color: r.color, label: r.label })),
                  overdueColor: kanbanOverdueColor,
                },
              });
              await refetchSettings();
              setInitialized(false);
              toast.success('Kanban colors saved');
            } catch (err) { toast.error(err.message); }
          }}>
          Save Kanban Colors
        </button>
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
              {(() => {
                // Group audit logs by date
                const groups = [];
                let currentDate = null;
                let currentGroup = null;
                const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
                const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

                for (const log of auditLogs) {
                  const d = new Date(new Date(log.timestamp).toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
                  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  if (dateStr !== currentDate) {
                    currentDate = dateStr;
                    let label = dateStr === todayStr ? 'Today' : dateStr === yesterdayStr ? 'Yesterday' : new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                    currentGroup = { date: dateStr, label, logs: [] };
                    groups.push(currentGroup);
                  }
                  currentGroup.logs.push(log);
                }

                return groups.map(group => (
                  <div key={group.date}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: 'var(--primary)',
                      padding: '10px 0 6px', borderBottom: '1px solid var(--border)',
                      position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1,
                    }}>
                      {group.label}
                      <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                        {group.logs.length} entr{group.logs.length !== 1 ? 'ies' : 'y'}
                      </span>
                    </div>
                    {group.logs.map(log => (
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
                            {formatDateTime(log.timestamp)}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, marginTop: 4 }}>{log.details}</div>
                      </div>
                    ))}
                  </div>
                ));
              })()}
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
