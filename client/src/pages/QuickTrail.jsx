import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { IoSend, IoTrash, IoCopy, IoSearch, IoClose, IoAlarm, IoFilter, IoDocumentText, IoAdd, IoChevronDown, IoChevronForward, IoTime, IoCreate, IoCheckmark } from 'react-icons/io5';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import ConfirmModal from '../components/ConfirmModal';
import RichTextEditor from '../components/RichTextEditor';
import { useSettings } from '../context/SettingsContext';
import useSwipeTabs from '../hooks/useSwipeTabs';

import { IoReorderThree } from 'react-icons/io5';
import { getTrails, createTrail, updateTrail, deleteTrail, getTrailNotes, addTrailNote, updateTrailNote, deleteTrailNote, reorderTrails } from '../api';
import { formatDateTime } from '../utils/format';
import KanbanBoard from './KanbanBoard';
import Reminders from './Reminders';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return tmp.textContent || tmp.innerText || '';
}

function getDateLabel(dateStr) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  if (dateStr === todayStr) return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function groupByDate(entries) {
  const groups = [];
  let currentDate = null;
  let currentGroup = null;
  for (const entry of entries) {
    const d = new Date(new Date(entry.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (dateStr !== currentDate) {
      currentDate = dateStr;
      currentGroup = { date: dateStr, label: getDateLabel(dateStr), entries: [] };
      groups.push(currentGroup);
    }
    currentGroup.entries.push(entry);
  }
  // Sort entries within each day by sortOrder, then by createdAt desc
  for (const g of groups) {
    g.entries.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || new Date(b.createdAt) - new Date(a.createdAt));
  }
  return groups;
}

function getEntryHighlight(text, highlights) {
  if (!highlights?.length) return null;
  const lower = text.toLowerCase();
  for (const h of highlights) {
    if (lower.includes(h.keyword.toLowerCase())) return h.color;
  }
  return null;
}

export default function QuickTrail() {
  const { settings } = useSettings();
  const trailBold = settings?.trailBoldText || false;
  const trailHighlights = useMemo(() => settings?.trailHighlights || [], [settings?.trailHighlights]);
  const reorderEnabled = settings?.trailReorderEnabled !== false;
  const reorderTapsNeeded = settings?.trailReorderTaps || 2;
  const detailEnabled = settings?.trailDetailEnabled !== false;
  const detailTapsNeeded = settings?.trailDetailTaps || 3;
  const [entries, setEntries] = useState([]);
  const [text, setText] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'with_reminders', 'plain'
  const [dateFilter, setDateFilter] = useState(''); // '', 'today', 'YYYY-MM-DD'
  const [showFilter, setShowFilter] = useState(false);
  const [detailEntry, setDetailEntry] = useState(null);
  const [activeTab, setActiveTab] = useState('trail');
  const tabSwipeEnabled = settings?.tabSwipeTrail !== false;
  const swipe = useSwipeTabs(['trail', 'board', 'reminders'], activeTab, setActiveTab, undefined, tabSwipeEnabled);
  const inputRef = useRef(null);
  const searchRef = useRef(null);
  const searchTimeout = useRef(null);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [quickEditId, setQuickEditId] = useState(null);
  const [quickEditText, setQuickEditText] = useState('');
  const [quickEditSaving, setQuickEditSaving] = useState(false);
  const quickEditRef = useRef(null);

  // Reorder state: triple-tap to unlock an entry, then drag to reorder
  const [reorderEntryId, setReorderEntryId] = useState(null);
  const reorderTapCount = useRef({});
  const reorderTapTimer = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const handleReorderTap = useCallback((entryId) => {
    if (!reorderEnabled) return;
    const now = Date.now();
    const prev = reorderTapCount.current[entryId] || { count: 0, last: 0 };
    if (now - prev.last < 400) {
      prev.count++;
    } else {
      prev.count = 1;
    }
    prev.last = now;
    reorderTapCount.current[entryId] = prev;
    clearTimeout(reorderTapTimer.current);
    if (prev.count >= reorderTapsNeeded) {
      if (reorderEntryId === entryId) {
        setReorderEntryId(null);
        toast('Reorder locked', { icon: '🔒', duration: 1000 });
      } else {
        setReorderEntryId(entryId);
        toast('Drag to reorder', { icon: '🔓', duration: 1500 });
      }
      prev.count = 0;
    } else {
      reorderTapTimer.current = setTimeout(() => {
        reorderTapCount.current[entryId] = { count: 0, last: 0 };
      }, 500);
    }
  }, [reorderEntryId, reorderEnabled, reorderTapsNeeded]);

  const handleDrop = useCallback(async (groupEntries, fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    const reordered = [...groupEntries];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const orderedIds = reordered.map(e => e._id);
    // Optimistic update
    setEntries(prev => {
      const updated = [...prev];
      for (let i = 0; i < orderedIds.length; i++) {
        const entry = updated.find(e => e._id === orderedIds[i]);
        if (entry) entry.sortOrder = i;
      }
      return [...updated];
    });
    setReorderEntryId(null);
    setDragOverIdx(null);
    try {
      await reorderTrails(orderedIds);
    } catch (err) { toast.error('Reorder failed'); fetchTrails(); }
  }, []);

  const todayStr = useMemo(() => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const toggleGroup = useCallback((date) => {
    setCollapsedGroups(prev => {
      const currentState = prev[date] !== undefined ? prev[date] : (date !== todayStr);
      return { ...prev, [date]: !currentState };
    });
  }, [todayStr]);

  const fetchTrails = async (p = 1, append = false, search = searchQuery, filter = filterMode, date = dateFilter) => {
    try {
      const res = await getTrails(p, search || undefined, filter, date || undefined);
      const data = res.data;
      setEntries(prev => append ? [...prev, ...data.entries] : data.entries);
      setPage(data.page);
      setHasMore(data.hasMore ?? false);
    } catch (err) { toast.error(err.message); }
  };

  useEffect(() => {
    fetchTrails(1, false, '', 'all', '').finally(() => setLoading(false));
  }, []);

  // Auto-focus trail input when trail tab is active
  // On Android, programmatic focus() doesn't open the keyboard unless it
  // happens within a user gesture. We attach a one-time touchstart listener
  // that focuses the input on the first tap anywhere on the page.
  const keyboardTriggered = useRef(false);
  useEffect(() => {
    if (activeTab === 'trail' && !searchMode) {
      // Try immediate focus (works on desktop, sets cursor on mobile)
      inputRef.current?.focus();
      // Reset the one-time touch trigger when switching to trail tab
      keyboardTriggered.current = false;
      const handler = () => {
        if (!keyboardTriggered.current && inputRef.current && document.activeElement !== inputRef.current) {
          inputRef.current.focus();
          keyboardTriggered.current = true;
        }
      };
      document.addEventListener('touchstart', handler, { once: true, passive: true });
      return () => document.removeEventListener('touchstart', handler);
    }
  }, [activeTab, searchMode, loading]);

  useEffect(() => {
    if (!searchMode) return;
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchTrails(1, false, searchQuery, filterMode, dateFilter);
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery]);

  const handleFilterChange = (f, d = dateFilter) => {
    setFilterMode(f);
    setShowFilter(false);
    fetchTrails(1, false, searchQuery, f, d);
  };

  const handleDateFilter = (d) => {
    setDateFilter(d);
    setShowFilter(false);
    fetchTrails(1, false, searchQuery, filterMode, d);
  };

  const toggleSearch = () => {
    if (searchMode) {
      setSearchMode(false);
      setSearchQuery('');
      fetchTrails(1, false, '', filterMode, dateFilter);
    } else {
      setSearchMode(true);
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await createTrail({ text: text.trim() });
      setEntries(prev => [res.data, ...prev]);
      setText('');
      inputRef.current?.focus();
    } catch (err) { toast.error(err.message); }
    finally { setSending(false); }
  };

  const startQuickEdit = (entry) => {
    setQuickEditId(entry._id);
    setQuickEditText(entry.text);
    setTimeout(() => quickEditRef.current?.focus(), 50);
  };

  const handleQuickEditSave = async () => {
    if (!quickEditId || !quickEditText.trim() || quickEditSaving) return;
    setQuickEditSaving(true);
    try {
      const res = await updateTrail(quickEditId, { text: quickEditText.trim() });
      setEntries(prev => prev.map(e => e._id === quickEditId ? { ...e, text: res.data.text } : e));
      setQuickEditId(null);
      toast.success('Updated');
    } catch (err) { toast.error(err.message); }
    finally { setQuickEditSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteTrail(confirmDelete._id);
      setEntries(prev => prev.filter(e => e._id !== confirmDelete._id));
      toast.success('Deleted');
    } catch (err) { toast.error(err.message); }
  };

  const handleCopy = (entry) => {
    const formatted = `${entry.text}\n${formatDateTime(entry.createdAt)}`;
    navigator.clipboard.writeText(formatted);
    toast.success('Copied');
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await fetchTrails(page + 1, true, searchQuery, filterMode, dateFilter);
    setLoadingMore(false);
  };

  const tripleTapRef = useRef({});
  const handleMultiTap = (entry) => {
    if (!detailEnabled) return;
    const now = Date.now();
    const prev = tripleTapRef.current[entry._id] || { count: 0, last: 0 };
    if (now - prev.last < 400) {
      prev.count++;
    } else {
      prev.count = 1;
    }
    prev.last = now;
    tripleTapRef.current[entry._id] = prev;
    if (prev.count >= detailTapsNeeded) {
      prev.count = 0;
      setDetailEntry(entry);
    }
  };

  const handleEntryUpdated = (updated) => {
    setEntries(prev => prev.map(e => e._id === updated._id ? updated : e));
  };

  if (loading && activeTab === 'trail') return (
    <div className="page"><h1 className="page-title">Trail</h1><Spinner /></div>
  );

  return (
    <div className="page" onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Trail</h1>
        {activeTab === 'trail' && (
          <div style={{ display: 'flex', gap: 4 }}>
            <div style={{ position: 'relative' }}>
              <button className="btn-ghost" onClick={() => setShowFilter(!showFilter)}
                style={{ padding: 6, borderRadius: 8, background: (filterMode !== 'all' || dateFilter) ? 'var(--bg-input)' : 'transparent' }}>
                <IoFilter size={18} color={(filterMode !== 'all' || dateFilter) ? 'var(--primary)' : undefined} />
              </button>
              {showFilter && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, zIndex: 20,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: 6, minWidth: 180, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', padding: '4px 8px', textTransform: 'uppercase' }}>Type</div>
                  {[
                    { key: 'all', label: 'All Items' },
                    { key: 'with_reminders', label: 'With Reminders' },
                    { key: 'plain', label: 'Plain Items' },
                  ].map(f => (
                    <button key={f.key} onClick={() => handleFilterChange(f.key)}
                      style={{
                        display: 'block', width: '100%', padding: '7px 10px', border: 'none',
                        background: filterMode === f.key ? 'var(--primary)' : 'transparent',
                        color: filterMode === f.key ? 'white' : 'var(--text-primary)',
                        fontSize: 13, textAlign: 'left', cursor: 'pointer', borderRadius: 6,
                      }}>
                      {f.label}
                    </button>
                  ))}
                  <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', padding: '4px 8px', textTransform: 'uppercase' }}>Date</div>
                  {[
                    { key: '', label: 'All Dates' },
                    { key: 'today', label: 'Today' },
                  ].map(d => (
                    <button key={d.key} onClick={() => handleDateFilter(d.key)}
                      style={{
                        display: 'block', width: '100%', padding: '7px 10px', border: 'none',
                        background: dateFilter === d.key ? 'var(--primary)' : 'transparent',
                        color: dateFilter === d.key ? 'white' : 'var(--text-primary)',
                        fontSize: 13, textAlign: 'left', cursor: 'pointer', borderRadius: 6,
                      }}>
                      {d.label}
                    </button>
                  ))}
                  <div style={{ padding: '4px 8px' }}>
                    <input type="date" value={dateFilter && dateFilter !== 'today' ? dateFilter : ''}
                      onChange={e => handleDateFilter(e.target.value)}
                      style={{ width: '100%', fontSize: 12, padding: '5px 6px', borderRadius: 6 }} />
                  </div>
                  {dateFilter && (
                    <button onClick={() => handleDateFilter('')}
                      style={{
                        display: 'block', width: '100%', padding: '7px 10px', border: 'none',
                        background: 'transparent', color: 'var(--danger)',
                        fontSize: 12, textAlign: 'center', cursor: 'pointer', borderRadius: 6,
                      }}>
                      Clear Date Filter
                    </button>
                  )}
                </div>
              )}
            </div>
            <button className="btn-ghost" onClick={toggleSearch}
              style={{ padding: 6, borderRadius: 8, background: searchMode ? 'var(--bg-input)' : 'transparent' }}>
              {searchMode ? <IoClose size={20} /> : <IoSearch size={20} />}
            </button>
          </div>
        )}
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
        {[{ key: 'trail', label: 'Trail' }, { key: 'board', label: 'Board' }, { key: 'reminders', label: 'Reminders' }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{
              flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: activeTab === t.key ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: activeTab === 'trail' ? 'block' : 'none' }}>
        {/* Search bar */}
        {searchMode && (
          <input ref={searchRef} type="text" placeholder="Search trails..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            style={{ marginBottom: 12, width: '100%' }} />
        )}

        {/* Input bar */}
        <form onSubmit={handleSend} style={{
          display: 'flex', gap: 8, marginBottom: 16,
          position: 'sticky', top: 0, zIndex: 10,
          background: 'var(--bg-page)', paddingBottom: 8,
        }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Quick thought..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ flex: 1 }}
            autoFocus
            inputMode="text"
            enterKeyHint="send"
          />
          <button type="submit" className="btn-primary"
            disabled={sending || !text.trim()}
            style={{ width: 'auto', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <IoSend size={18} />
          </button>
        </form>

        {/* Active filter badges */}
        {(filterMode !== 'all' || dateFilter) && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {filterMode !== 'all' && (
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, background: 'var(--primary)', color: 'white', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {filterMode === 'with_reminders' ? 'Reminders' : 'Plain'}
                <button onClick={() => handleFilterChange('all')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
              </span>
            )}
            {dateFilter && (
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, background: 'var(--primary)', color: 'white', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {dateFilter === 'today' ? 'Today' : dateFilter}
                <button onClick={() => handleDateFilter('')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
              </span>
            )}
          </div>
        )}

        {/* Entries grouped by date */}
        {entries.length === 0 ? (
          <EmptyState icon={searchMode ? "🔍" : "⚡"} title={searchMode ? "No results" : "No entries yet"} subtitle={searchMode ? `Nothing found for "${searchQuery}"` : "Type something and hit send"} />
        ) : (
          <div>
            {groupByDate(entries).map(group => {
              const isToday = group.date === todayStr;
              // Default: today expanded, others collapsed (unless user toggled)
              const isCollapsed = collapsedGroups[group.date] !== undefined
                ? collapsedGroups[group.date]
                : !isToday;
              return (
              <div key={group.date}>
                <div
                  onClick={() => toggleGroup(group.date)}
                  style={{
                    fontSize: 12, fontWeight: 700, color: 'var(--primary)',
                    padding: '8px 0 6px', position: 'sticky', top: 56, zIndex: 5,
                    background: 'var(--bg-page)',
                    borderBottom: '1px solid var(--border)', marginBottom: 8,
                    display: 'flex', alignItems: 'center', cursor: 'pointer',
                    userSelect: 'none',
                  }}>
                  {isCollapsed
                    ? <IoChevronForward size={14} style={{ marginRight: 4, flexShrink: 0 }} />
                    : <IoChevronDown size={14} style={{ marginRight: 4, flexShrink: 0 }} />
                  }
                  {group.label}
                  <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                    {group.entries.length} item{group.entries.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {!isCollapsed && (
                <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                  {group.entries.map((entry, entryIdx) => {
                    const hlColor = getEntryHighlight(entry.text, trailHighlights);
                    const hasReminders = entry.reminders?.length > 0;
                    const isUnlocked = reorderEntryId === entry._id;
                    return (
                    <div key={entry._id}>
                      {/* Drop target above */}
                      {reorderEntryId && reorderEntryId !== entry._id && dragOverIdx === entryIdx && (
                        <div style={{ height: 4, background: 'var(--primary)', borderRadius: 2, marginBottom: 4 }} />
                      )}
                      <div className="card" style={{
                        position: 'relative',
                        ...(hlColor ? { background: hlColor + '20', borderLeft: `3px solid ${hlColor}` } : {}),
                        ...(isUnlocked ? { outline: '2px solid var(--primary)', outlineOffset: 1 } : {}),
                      }}
                        onClick={() => {
                          if (reorderEntryId && reorderEntryId !== entry._id) {
                            // Drop the unlocked entry at this position
                            const fromIdx = group.entries.findIndex(e => e._id === reorderEntryId);
                            if (fromIdx !== -1) handleDrop(group.entries, fromIdx, entryIdx);
                            return;
                          }
                          handleReorderTap(entry._id);
                          handleMultiTap(entry);
                        }}
                        draggable={isUnlocked}
                        onDragStart={(e) => {
                          if (!isUnlocked) { e.preventDefault(); return; }
                          e.dataTransfer.setData('text/plain', entry._id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(e) => {
                          if (!reorderEntryId) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          setDragOverIdx(entryIdx);
                        }}
                        onDragLeave={() => setDragOverIdx(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          const fromIdx = group.entries.findIndex(en => en._id === reorderEntryId);
                          if (fromIdx !== -1) handleDrop(group.entries, fromIdx, entryIdx);
                        }}
                      >
                        <div style={{ display: 'flex', gap: 8 }}>
                          {/* Drag handle - shows when any entry is unlocked */}
                          {reorderEntryId && (
                            <div style={{
                              display: 'flex', alignItems: 'center', flexShrink: 0,
                              color: isUnlocked ? 'var(--primary)' : 'var(--text-muted)',
                              cursor: isUnlocked ? 'grab' : 'pointer',
                              opacity: isUnlocked ? 1 : 0.5,
                              paddingRight: 4,
                            }}>
                              <IoReorderThree size={20} />
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {quickEditId === entry._id ? (
                              <div onClick={e => e.stopPropagation()}>
                                <textarea ref={quickEditRef} value={quickEditText}
                                  onChange={e => setQuickEditText(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuickEditSave(); } if (e.key === 'Escape') setQuickEditId(null); }}
                                  style={{ width: '100%', fontSize: 14, lineHeight: 1.5, padding: 8, borderRadius: 6, border: '1.5px solid var(--primary)', background: 'var(--bg-input)', color: 'var(--text)', resize: 'vertical', fontFamily: 'inherit', minHeight: 50 }} />
                                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                  <button className="btn-primary" onClick={handleQuickEditSave} disabled={quickEditSaving}
                                    style={{ padding: '4px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, borderRadius: 6, width: 'auto' }}>
                                    <IoCheckmark size={14} /> {quickEditSaving ? 'Saving...' : 'Save'}
                                  </button>
                                  <button className="btn-ghost" onClick={() => setQuickEditId(null)}
                                    style={{ padding: '4px 12px', fontSize: 12, borderRadius: 6 }}>
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 8, whiteSpace: 'pre-wrap', ...(trailBold ? { fontWeight: 700 } : {}) }}>
                                  {entry.text}
                                </p>
                              </>
                            )}
                            {quickEditId !== entry._id && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  {formatDateTime(entry.createdAt)}
                                </span>
                                {entry.adjustedAt && (
                                  <IoTime size={12} color="#F59E0B" title="Time adjusted" />
                                )}
                                {hasReminders && (
                                  <IoAlarm size={12} color="var(--primary)" title="Has reminders" />
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn-ghost" style={{ padding: 4 }} onClick={(e) => { e.stopPropagation(); startQuickEdit(entry); }}>
                                  <IoCreate size={14} color="var(--text-muted)" />
                                </button>
                                <button className="btn-ghost" style={{ padding: 4 }} onClick={(e) => { e.stopPropagation(); setDetailEntry(entry); }}>
                                  <IoDocumentText size={14} color="var(--text-muted)" />
                                </button>
                                <button className="btn-ghost" style={{ padding: 4 }} onClick={(e) => { e.stopPropagation(); handleCopy(entry); }}>
                                  <IoCopy size={14} color="var(--text-muted)" />
                                </button>
                                <button className="btn-ghost" style={{ padding: 4 }} onClick={(e) => { e.stopPropagation(); setConfirmDelete(entry); }}>
                                  <IoTrash size={14} color="var(--danger)" />
                                </button>
                              </div>
                            </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                  {/* Drop target at end */}
                  {reorderEntryId && dragOverIdx === group.entries.length && (
                    <div style={{ height: 4, background: 'var(--primary)', borderRadius: 2 }} />
                  )}
                </div>
                )}
              </div>
              );
            })}

            {hasMore && (
              <button className="btn-outline" onClick={handleLoadMore} disabled={loadingMore}
                style={{ marginTop: 4 }}>
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            )}
          </div>
        )}

        <ConfirmModal open={!!confirmDelete} onClose={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
          title="Delete entry?"
          message={`Delete "${confirmDelete?.text?.slice(0, 50)}${confirmDelete?.text?.length > 50 ? '...' : ''}"?`} />
      </div>
      <div style={{ display: activeTab === 'board' ? 'block' : 'none' }}>
        <KanbanBoard />
      </div>

      <div style={{ display: activeTab === 'reminders' ? 'block' : 'none' }}>
        <Reminders />
      </div>

      {detailEntry && (
        <TrailDetailModal
          entry={detailEntry}
          onClose={() => setDetailEntry(null)}
          onUpdated={handleEntryUpdated}
        />
      )}
    </div>
  );
}

// ─── Trail Detail Modal ───

const modalBackdrop = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.5)', zIndex: 100,
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
};
const modalContent = {
  background: 'var(--bg-card)', borderRadius: '16px 16px 0 0',
  padding: 20, width: '100%', maxWidth: 'var(--max-width)',
};

function TrailDetailModal({ entry, onClose, onUpdated }) {
  const { settings: detailSettings } = useSettings();
  const [tab, setTab] = useState('reminders');
  const detailSwipe = useSwipeTabs(['reminders', 'adjust', 'notes'], tab, setTab, undefined, detailSettings?.tabSwipeTrail !== false);

  // Notes
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [richEditorOpen, setRichEditorOpen] = useState(false);
  const [richEditorContent, setRichEditorContent] = useState('');
  const [richEditorSaving, setRichEditorSaving] = useState(false);
  const [confirmDeleteNote, setConfirmDeleteNote] = useState(null);

  // Reminders
  const [reminders, setReminders] = useState(entry.reminders || []);
  const [remindersDirty, setRemindersDirty] = useState(false);
  const [savingReminders, setSavingReminders] = useState(false);

  // Adjust time
  const [adjustTime, setAdjustTime] = useState('');
  const [adjustDate, setAdjustDate] = useState('');
  const [savingAdjust, setSavingAdjust] = useState(false);

  useEffect(() => {
    loadNotes();
    setReminders(entry.reminders || []);
    // Initialize adjust time/date from entry's createdAt
    const d = new Date(new Date(entry.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
    setAdjustTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    setAdjustDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }, [entry._id]);

  const loadNotes = async () => {
    try {
      const res = await getTrailNotes(entry._id);
      setNotes(res.data);
    } catch (err) { toast.error(err.message); }
    finally { setNotesLoading(false); }
  };

  // Notes handlers
  const handleSaveNote = async (htmlContent) => {
    if (!htmlContent?.trim() || !stripHtml(htmlContent).trim()) return;
    setRichEditorSaving(true);
    try {
      if (editingNoteId) {
        await updateTrailNote(editingNoteId, { content: htmlContent });
        toast.success('Note updated');
      } else {
        await addTrailNote(entry._id, { content: htmlContent });
        toast.success('Note added');
      }
      setEditingNoteId(null);
      setRichEditorOpen(false);
      setRichEditorContent('');
      loadNotes();
    } catch (err) { toast.error(err.message); }
    finally { setRichEditorSaving(false); }
  };

  const handleEditNote = (note) => {
    setEditingNoteId(note._id);
    setRichEditorContent(note.content);
    setRichEditorOpen(true);
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await deleteTrailNote(noteId);
      setNotes(prev => prev.filter(n => n._id !== noteId));
      toast.success('Note deleted');
    } catch (err) { toast.error(err.message); }
  };

  // Reminder handlers
  const addReminder = () => {
    setReminders(prev => [...prev, { type: 'once', time: '09:00', days: [], dates: [], enabled: true }]);
    setRemindersDirty(true);
  };

  const updateReminder = (idx, field, value) => {
    setReminders(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    setRemindersDirty(true);
  };

  const removeReminder = (idx) => {
    setReminders(prev => prev.filter((_, i) => i !== idx));
    setRemindersDirty(true);
  };

  const saveReminders = async () => {
    setSavingReminders(true);
    try {
      const res = await updateTrail(entry._id, { reminders });
      onUpdated(res.data);
      setRemindersDirty(false);
      toast.success('Reminders saved');
    } catch (err) { toast.error(err.message); }
    finally { setSavingReminders(false); }
  };

  const handleAdjustTime = async () => {
    if (!adjustDate || !adjustTime) return;
    setSavingAdjust(true);
    try {
      const adjustedAt = new Date(`${adjustDate}T${adjustTime}:00+05:00`).toISOString();
      const res = await updateTrail(entry._id, { adjustedAt });
      onUpdated(res.data);
      toast.success('Time adjusted');
      onClose();
    } catch (err) { toast.error(err.message); }
    finally { setSavingAdjust(false); }
  };

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={{ ...modalContent, maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}
        onTouchStart={e => { e.stopPropagation(); detailSwipe.onTouchStart(e); }}
        onTouchEnd={e => { e.stopPropagation(); detailSwipe.onTouchEnd(e); }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
              {entry.text.length > 100 ? entry.text.slice(0, 100) + '...' : entry.text}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDateTime(entry.createdAt)}</span>
              {entry.adjustedAt && <IoTime size={11} color="#F59E0B" title="Time adjusted" />}
            </div>
          </div>
          <button className="btn-ghost" onClick={onClose} style={{ padding: 4 }}><IoClose size={20} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
          {[{ key: 'reminders', label: 'Reminders' }, { key: 'adjust', label: 'Adjust' }, { key: 'notes', label: 'Notes' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: tab === t.key ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
              }}>
              {t.label}
              {t.key === 'reminders' && reminders.length > 0 && (
                <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--primary)' }}>({reminders.length})</span>
              )}
              {t.key === 'notes' && notes.length > 0 && (
                <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--primary)' }}>({notes.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Adjust Time Tab */}
        <div style={{ display: tab === 'adjust' ? 'block' : 'none' }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Adjust the time/date of this entry to place it in the correct position.
          </p>

          {/* Time input - primary focus */}
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>Time</label>
            <input type="time" value={adjustTime} onChange={e => setAdjustTime(e.target.value)}
              autoFocus
              style={{ width: '100%', fontSize: 16, padding: '10px 12px', borderRadius: 8 }} />
          </div>

          {/* Date input - secondary */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-muted)' }}>Date <span style={{ fontSize: 11, fontWeight: 400 }}>(change only if needed)</span></label>
            <input type="date" value={adjustDate} onChange={e => setAdjustDate(e.target.value)}
              style={{ width: '100%', fontSize: 14, padding: '8px 12px', borderRadius: 8 }} />
          </div>

          {entry.adjustedAt && (
            <p style={{ fontSize: 11, color: '#F59E0B', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <IoTime size={12} /> Previously adjusted on {formatDateTime(entry.adjustedAt)}
            </p>
          )}

          <button className="btn-primary" onClick={handleAdjustTime} disabled={savingAdjust || !adjustTime || !adjustDate}
            style={{ width: '100%', fontSize: 14, fontWeight: 700, padding: '12px 0' }}>
            {savingAdjust ? 'Saving...' : 'Save Adjusted Time'}
          </button>
        </div>

        {/* Notes Tab */}
        <div style={{ display: tab === 'notes' ? 'block' : 'none' }}>
          <button className="btn-primary" onClick={() => { setEditingNoteId(null); setRichEditorContent(''); setRichEditorOpen(true); }}
            style={{ width: '100%', marginBottom: 12, fontSize: 13 }}>
            <IoAdd size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> Add Note
          </button>

          {/* Notes list */}
          {notesLoading ? <Spinner /> : notes.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>No notes yet</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {notes.map(note => (
                <div key={note._id} style={{
                  padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 8, cursor: 'pointer',
                }} onClick={() => handleEditNote(note)}>
                  <div dangerouslySetInnerHTML={{ __html: note.content }}
                    style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 6, wordBreak: 'break-word' }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatDateTime(note.createdAt)}</span>
                    <button className="btn-ghost" style={{ padding: 3 }}
                      onClick={e => { e.stopPropagation(); setConfirmDeleteNote(note._id); }}>
                      <IoTrash size={12} color="var(--danger)" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <RichTextEditor
            open={richEditorOpen}
            initialContent={richEditorContent}
            onSave={handleSaveNote}
            onClose={() => { setRichEditorOpen(false); setEditingNoteId(null); }}
            title={editingNoteId ? 'Edit Note' : 'New Note'}
            saving={richEditorSaving}
          />
        </div>

        {/* Reminders Tab */}
        <div style={{ display: tab === 'reminders' ? 'block' : 'none' }}>
          {reminders.map((r, idx) => (
            <ReminderRow key={idx} reminder={r} idx={idx}
              onUpdate={updateReminder} onRemove={removeReminder} />
          ))}

          <button className="btn-ghost" onClick={addReminder}
            style={{ color: 'var(--primary)', fontSize: 13, marginBottom: 12 }}>
            <IoAdd size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> Add Reminder
          </button>

          {remindersDirty && (
            <button className="btn-primary" style={{ width: '100%', fontSize: 13 }}
              onClick={saveReminders} disabled={savingReminders}>
              {savingReminders ? 'Saving...' : 'Save Reminders'}
            </button>
          )}
        </div>

        <ConfirmModal open={!!confirmDeleteNote} onClose={() => setConfirmDeleteNote(null)}
          onConfirm={() => { handleDeleteNote(confirmDeleteNote); setConfirmDeleteNote(null); }}
          title="Delete note?"
          message="Delete this note? This cannot be undone." />
      </div>
    </div>
  );
}

// ─── Reminder Row (shared pattern with kanban/routines + once option) ───

function ReminderRow({ reminder, idx, onUpdate, onRemove }) {
  return (
    <div style={{
      background: 'var(--bg-input)', borderRadius: 8, padding: 10, marginBottom: 8,
      opacity: reminder.enabled ? 1 : 0.5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input type="checkbox" checked={reminder.enabled}
            onChange={e => onUpdate(idx, 'enabled', e.target.checked)}
            style={{ width: 16, height: 16 }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>On</span>
        </label>
        <select value={reminder.type}
          onChange={e => onUpdate(idx, 'type', e.target.value)}
          style={{ flex: 1, fontSize: 12, padding: '4px 6px' }}>
          <option value="once">Once</option>
          <option value="daily">Daily</option>
          <option value="weekdays">Weekdays</option>
          <option value="custom_days">Custom Days</option>
          <option value="custom_dates">Custom Dates</option>
        </select>
        <input type="time" value={reminder.time}
          onChange={e => onUpdate(idx, 'time', e.target.value)}
          style={{ fontSize: 12, padding: '4px 6px' }} />
        <button className="btn-ghost" style={{ padding: 4 }} onClick={() => onRemove(idx)}>
          <IoTrash size={14} color="var(--danger)" />
        </button>
      </div>

      {reminder.type === 'once' && reminder.fired && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 4 }}>
          Already fired
        </div>
      )}

      {reminder.type === 'custom_days' && (
        <div style={{ display: 'flex', gap: 4 }}>
          {DAY_LABELS.map((label, dayIdx) => (
            <button key={dayIdx} type="button"
              onClick={() => {
                const days = reminder.days || [];
                const newDays = days.includes(dayIdx) ? days.filter(d => d !== dayIdx) : [...days, dayIdx];
                onUpdate(idx, 'days', newDays);
              }}
              style={{
                width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 600,
                background: (reminder.days || []).includes(dayIdx) ? 'var(--primary)' : 'var(--bg-card)',
                color: (reminder.days || []).includes(dayIdx) ? 'white' : 'var(--text-muted)',
              }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {reminder.type === 'custom_dates' && (
        <div>
          <input type="date"
            onChange={e => {
              if (!e.target.value) return;
              const dates = reminder.dates || [];
              const newDate = new Date(e.target.value);
              if (!dates.some(d => new Date(d).toISOString().split('T')[0] === e.target.value)) {
                onUpdate(idx, 'dates', [...dates, newDate]);
              }
              e.target.value = '';
            }}
            style={{ fontSize: 12, padding: '4px 6px', marginBottom: 4 }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {(reminder.dates || []).map((d, dIdx) => {
              const ds = new Date(d).toISOString().split('T')[0];
              return (
                <span key={dIdx} style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 10,
                  background: 'var(--primary)', color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  {ds}
                  <button style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, fontSize: 13 }}
                    onClick={() => onUpdate(idx, 'dates', (reminder.dates || []).filter((_, i) => i !== dIdx))}>×</button>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
