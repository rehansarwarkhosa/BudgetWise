import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { IoAdd, IoTrash, IoCheckmarkCircle, IoCloseCircle, IoChevronForward, IoCreate, IoCopy, IoFlash, IoCheckmarkDone, IoCalendar } from 'react-icons/io5';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import useFetch from '../hooks/useFetch';
import useSwipeTabs from '../hooks/useSwipeTabs';

import { formatDateTime, formatDate } from '../utils/format';
import {
  getRoutines, createRoutine, deleteRoutine, updateRoutine,
  getRoutineEntries, logRoutineEntry, deleteRoutineEntry, batchLogRoutineEntries,
  getRoutineNotes, addRoutineNote, updateRoutineNote, deleteRoutineNote,
} from '../api';
import { useSettings } from '../context/SettingsContext';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const RICH_COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#9B59B6', '#FF8C00', '#1A1A2E', '#F1F1F6'];

function getNextLogLabel(nextLogDate) {
  if (!nextLogDate) return null;
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const tmrw = new Date(now);
  tmrw.setDate(tmrw.getDate() + 1);
  const tmrwStr = `${tmrw.getFullYear()}-${String(tmrw.getMonth() + 1).padStart(2, '0')}-${String(tmrw.getDate()).padStart(2, '0')}`;
  if (nextLogDate === todayStr) return 'Today';
  if (nextLogDate === tmrwStr) return 'Tomorrow';
  const d = new Date(nextLogDate + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
}

function getRoutineHighlight(text, highlights) {
  if (!highlights?.length) return null;
  const lower = text.toLowerCase();
  for (const h of highlights) {
    if (lower.includes(h.keyword.toLowerCase())) return h.color;
  }
  return null;
}

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return tmp.textContent || tmp.innerText || '';
}

export default function Routines() {
  const { settings } = useSettings();
  const routineHighlights = settings?.routineHighlights || [];
  const { data: routines, loading, refetch } = useFetch(getRoutines);
  const [createModal, setCreateModal] = useState(false);
  const [detailRoutine, setDetailRoutine] = useState(null);
  const [cloneSource, setCloneSource] = useState(null);
  const tabSwipeEnabled = settings?.tabSwipeRoutines !== false;
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'done_today' | 'scheduled' | 'expired'
  const swipe = useSwipeTabs(['pending', 'done_today', 'scheduled', 'expired'], activeTab, setActiveTab, undefined, tabSwipeEnabled);

  if (loading && !routines) return <Spinner />;

  // Segregate routines
  // Scheduled: not expired, not active today (today is not a reminder day)
  const scheduledRoutines = routines?.filter(r => !r.isExpired && r.isActiveToday === false) || [];
  const pendingRoutines = routines?.filter(r => !r.isExpired && r.isActiveToday !== false && !r.isDoneForToday) || [];
  const doneTodayRoutines = routines?.filter(r => !r.isExpired && r.isActiveToday !== false && r.isDoneForToday) || [];
  const expiredRoutines = routines?.filter(r => r.isExpired) || [];

  const tabs = [
    { key: 'pending', label: 'Pending', count: pendingRoutines.length },
    { key: 'done_today', label: 'Done', count: doneTodayRoutines.length },
    { key: 'scheduled', label: 'Scheduled', count: scheduledRoutines.length },
    { key: 'expired', label: 'Expired', count: expiredRoutines.length },
  ];

  const currentList = activeTab === 'pending' ? pendingRoutines
    : activeTab === 'done_today' ? doneTodayRoutines
    : activeTab === 'scheduled' ? scheduledRoutines
    : expiredRoutines;

  return (
    <div className="page" onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd}>
      <h1 className="page-title">Routines</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid var(--border)' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: '10px 0', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: 'none', border: 'none',
              color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -2,
            }}>
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {currentList.length === 0 ? (
        <EmptyState
          icon={activeTab === 'pending' ? '📋' : activeTab === 'done_today' ? '✅' : activeTab === 'scheduled' ? '📅' : '📁'}
          title={activeTab === 'pending' ? 'No pending routines'
            : activeTab === 'done_today' ? 'Nothing completed today yet'
            : activeTab === 'scheduled' ? 'No scheduled routines'
            : 'No expired routines'}
          subtitle={activeTab === 'pending' ? 'All caught up! Create a routine to track tasks'
            : activeTab === 'scheduled' ? 'Routines with interval or specific date reminders will appear here on non-active days'
            : undefined}
        />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {currentList.map((r) => {
            const hlColor = getRoutineHighlight(r.name, routineHighlights);
            return (
            <div key={r._id} className="card" style={{
              cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              ...(hlColor ? { background: hlColor + '20', borderLeft: `3px solid ${hlColor}` } : {}),
            }}
              onClick={() => setDetailRoutine(r)}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600 }}>{r.name}</h3>
                  {r.isExpired && <span className="badge badge-danger">Expired</span>}
                  {r.isDoneForToday && !r.isExpired && r.isActiveToday !== false && (
                    <span className="badge" style={{
                      background: 'var(--success)', color: 'white', fontSize: 10, padding: '2px 6px',
                    }}>
                      Done
                    </span>
                  )}
                  {r.isActiveToday === false && !r.isExpired && (
                    <span className="badge" style={{
                      background: 'var(--text-muted)', color: 'white', fontSize: 10, padding: '2px 6px',
                    }}>
                      <IoCalendar size={9} style={{ marginRight: 3, verticalAlign: -1 }} />
                      Scheduled
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {r.completedEntries}/{r.targetEntries} entries ({r.progress}%)
                  {r.lastEntry && <> &middot; Last: {formatDateTime(r.lastEntry.date)}</>}
                </p>
                {!r.isExpired && r.isActiveToday !== false && (
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Today: {r.todayCompleteCount}/{r.maxDailyEntries} daily
                    {r.dueDate && <> &middot; Due: <span style={{ color: 'var(--warning)' }}>{formatDate(r.dueDate)}</span></>}
                    {r.nextLogDate && r.isDoneForToday && (() => {
                      const lbl = getNextLogLabel(r.nextLogDate);
                      return lbl && lbl !== 'Today' ? <> &middot; Next: <span style={{ color: 'var(--primary)' }}>{lbl}</span></> : null;
                    })()}
                  </p>
                )}
                {!r.isExpired && r.isActiveToday === false && (
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {r.nextLogDate && (
                      <>
                        <IoCalendar size={10} style={{ verticalAlign: -1, marginRight: 3 }} />
                        Next log: <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{getNextLogLabel(r.nextLogDate)}</span>
                      </>
                    )}
                    {r.dueDate && <> &middot; Due: <span style={{ color: 'var(--warning)' }}>{formatDate(r.dueDate)}</span></>}
                  </p>
                )}
                {r.isExpired && r.dueDate && (
                  <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }}>
                    Due: {formatDate(r.dueDate)}
                  </p>
                )}
                {/* Mini progress bar */}
                <div style={{ marginTop: 4, height: 4, background: 'var(--bg-input)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2, transition: 'width 0.3s',
                    width: `${Math.min(r.progress, 100)}%`,
                    background: r.progress >= 100 ? 'var(--success)' : 'var(--primary)',
                  }} />
                </div>
              </div>
              <IoChevronForward size={18} color="var(--text-muted)" />
            </div>
          );
          })}
        </div>
      )}

      <button className="fab" onClick={() => setCreateModal(true)}><IoAdd /></button>

      <CreateRoutineModal open={createModal} onClose={() => setCreateModal(false)} onDone={refetch}
        cloneSource={cloneSource} onCloneUsed={() => setCloneSource(null)} />
      <RoutineDetailModal open={!!detailRoutine} routine={detailRoutine}
        onClose={() => setDetailRoutine(null)} onDone={refetch}
        onClone={(r) => { setCloneSource(r); setDetailRoutine(null); setCreateModal(true); }} />
    </div>
  );
}

function ReminderEditor({ reminders, setReminders }) {
  const addReminder = () => {
    setReminders([...reminders, { type: 'daily', time: '09:00', days: [], dates: [], enabled: true, intervalDays: '', intervalStartDate: '', intervalEndDate: '', intervalIncludeStart: true }]);
  };

  const updateReminder = (idx, key, val) => {
    const updated = [...reminders];
    updated[idx] = { ...updated[idx], [key]: val };
    setReminders(updated);
  };

  const removeReminder = (idx) => {
    setReminders(reminders.filter((_, i) => i !== idx));
  };

  const toggleDay = (idx, day) => {
    const current = reminders[idx].days || [];
    const updated = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
    updateReminder(idx, 'days', updated);
  };

  const addCustomDate = (idx, dateStr) => {
    if (!dateStr) return;
    const current = reminders[idx].dates || [];
    updateReminder(idx, 'dates', [...current, dateStr]);
  };

  const removeCustomDate = (idx, dateIdx) => {
    const current = reminders[idx].dates || [];
    updateReminder(idx, 'dates', current.filter((_, i) => i !== dateIdx));
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Reminders</label>
        <button type="button" className="btn-ghost" onClick={addReminder}
          style={{ color: 'var(--primary)', fontSize: 13 }}>+ Add Reminder</button>
      </div>
      {reminders.map((rem, idx) => (
        <div key={idx} style={{ background: 'var(--bg-input)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <select value={rem.type} onChange={(e) => updateReminder(idx, 'type', e.target.value)}
              style={{ flex: 1 }}>
              <option value="once">Once</option>
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays</option>
              <option value="custom_days">Custom Days</option>
              <option value="custom_dates">Custom Dates</option>
              <option value="interval">Every N Days</option>
            </select>
            <input type="time" value={rem.time} onChange={(e) => updateReminder(idx, 'time', e.target.value)}
              style={{ flex: '0 0 120px' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <input type="checkbox" checked={rem.enabled !== false}
                onChange={(e) => updateReminder(idx, 'enabled', e.target.checked)}
                style={{ width: 14, height: 14 }} />
              On
            </label>
            <button type="button" className="btn-ghost" onClick={() => removeReminder(idx)}
              style={{ color: 'var(--danger)', padding: 4 }}><IoTrash size={16} /></button>
          </div>

          {rem.type === 'once' && rem.fired && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 4 }}>
              Already fired
            </div>
          )}

          {rem.type === 'interval' && (
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Every</label>
                <input type="number" min="1" placeholder="N" value={rem.intervalDays || ''}
                  onChange={(e) => updateReminder(idx, 'intervalDays', Number(e.target.value) || '')}
                  style={{ width: 70 }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>days</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>From</label>
                <input type="date" value={rem.intervalStartDate ? (typeof rem.intervalStartDate === 'string' && rem.intervalStartDate.includes('T') ? rem.intervalStartDate.split('T')[0] : rem.intervalStartDate) : ''}
                  onChange={(e) => updateReminder(idx, 'intervalStartDate', e.target.value)}
                  style={{ flex: 1 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Until</label>
                <input type="date" value={rem.intervalEndDate ? (typeof rem.intervalEndDate === 'string' && rem.intervalEndDate.includes('T') ? rem.intervalEndDate.split('T')[0] : rem.intervalEndDate) : ''}
                  onChange={(e) => updateReminder(idx, 'intervalEndDate', e.target.value)}
                  style={{ flex: 1 }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={rem.intervalIncludeStart !== false}
                  onChange={(e) => updateReminder(idx, 'intervalIncludeStart', e.target.checked)}
                  style={{ width: 14, height: 14 }} />
                Log entry on start day
              </label>
              {rem.intervalDays > 0 && rem.intervalStartDate && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                  <IoCalendar size={10} style={{ verticalAlign: -1, marginRight: 4 }} />
                  {rem.intervalIncludeStart !== false ? 'First entry on start day, then' : 'First entry'} every {rem.intervalDays} day{rem.intervalDays > 1 ? 's' : ''}{rem.intervalIncludeStart === false ? ` after ${typeof rem.intervalStartDate === 'string' && rem.intervalStartDate.includes('T') ? rem.intervalStartDate.split('T')[0] : rem.intervalStartDate}` : ` from ${typeof rem.intervalStartDate === 'string' && rem.intervalStartDate.includes('T') ? rem.intervalStartDate.split('T')[0] : rem.intervalStartDate}`}
                  {rem.intervalEndDate && <> until {typeof rem.intervalEndDate === 'string' && rem.intervalEndDate.includes('T') ? rem.intervalEndDate.split('T')[0] : rem.intervalEndDate}</>}
                </p>
              )}
            </div>
          )}

          {rem.type === 'custom_days' && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {DAY_LABELS.map((label, dayIdx) => (
                <button key={dayIdx} type="button"
                  onClick={() => toggleDay(idx, dayIdx)}
                  style={{
                    width: 32, height: 32, borderRadius: '50%', fontSize: 12, fontWeight: 600,
                    border: '1px solid var(--border)', cursor: 'pointer',
                    background: (rem.days || []).includes(dayIdx) ? 'var(--primary)' : 'transparent',
                    color: (rem.days || []).includes(dayIdx) ? 'white' : 'var(--text-secondary)',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {rem.type === 'custom_dates' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <input type="date" id={`rem-date-${idx}`} style={{ flex: 1 }} />
                <button type="button" className="btn-outline" style={{ width: 'auto', padding: '8px 12px', fontSize: 13 }}
                  onClick={() => {
                    const input = document.getElementById(`rem-date-${idx}`);
                    addCustomDate(idx, input.value);
                    input.value = '';
                  }}>Add</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {(rem.dates || []).map((d, di) => (
                  <span key={di} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: 'var(--bg-card)', borderRadius: 12, padding: '2px 8px', fontSize: 11,
                  }}>
                    {formatDate(d)}
                    <button type="button" onClick={() => removeCustomDate(idx, di)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0, fontSize: 14 }}>
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function calcEntriesFromReminders(dueDate, reminders) {
  if (!dueDate || reminders.length === 0) return 0;
  const nowPKT = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
  const currentHour = nowPKT.getHours();
  const currentMin = nowPKT.getMinutes();
  const nowMins = currentHour * 60 + currentMin;
  const today = new Date(nowPKT);
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T23:59:59');
  if (due < today) return 0;

  const isToday = (d) => d.getTime() === today.getTime();

  let total = 0;
  for (const rem of reminders) {
    if (!rem.enabled) continue;

    // Only daily reminders skip past times on creation day
    // Weekdays, custom_days, custom_dates use natural full-day counting
    if (rem.type === 'daily') {
      const days = Math.floor((due - today) / 86400000) + 1;
      const [rh, rm] = (rem.time || '00:00').split(':').map(Number);
      const timePast = nowMins > (rh * 60 + rm);
      total += timePast ? days - 1 : days;
    } else if (rem.type === 'weekdays') {
      let d = new Date(today);
      while (d <= due) {
        const dow = d.getDay();
        if (dow >= 1 && dow <= 5) total++;
        d.setDate(d.getDate() + 1);
      }
    } else if (rem.type === 'custom_days') {
      if (!rem.days?.length) continue;
      let d = new Date(today);
      while (d <= due) {
        if (rem.days.includes(d.getDay())) total++;
        d.setDate(d.getDate() + 1);
      }
    } else if (rem.type === 'custom_dates') {
      if (!rem.dates?.length) continue;
      for (const dateStr of rem.dates) {
        const cd = new Date(dateStr);
        cd.setHours(0, 0, 0, 0);
        if (cd >= today && cd <= due) total++;
      }
    } else if (rem.type === 'once') {
      total += 1;
    } else if (rem.type === 'interval') {
      if (!rem.intervalDays || rem.intervalDays < 1 || !rem.intervalStartDate) continue;
      const rawStart = typeof rem.intervalStartDate === 'string' && rem.intervalStartDate.includes('T') ? rem.intervalStartDate.split('T')[0] : rem.intervalStartDate;
      const startD = new Date(rawStart);
      startD.setHours(0, 0, 0, 0);
      const rawEnd = rem.intervalEndDate ? (typeof rem.intervalEndDate === 'string' && rem.intervalEndDate.includes('T') ? rem.intervalEndDate.split('T')[0] : rem.intervalEndDate) : null;
      const endD = rawEnd ? new Date(rawEnd) : new Date(due);
      endD.setHours(0, 0, 0, 0);
      const effectiveStart = startD < today ? today : startD;
      const effectiveEnd = endD > due ? due : endD;
      if (effectiveStart > effectiveEnd) continue;
      let d = new Date(effectiveStart);
      while (d <= effectiveEnd) {
        const diffFromStart = Math.round((d - startD) / 86400000);
        const isMatch = diffFromStart % rem.intervalDays === 0;
        // Skip start day if intervalIncludeStart is false
        if (isMatch && diffFromStart === 0 && rem.intervalIncludeStart === false) {
          d.setDate(d.getDate() + 1);
          continue;
        }
        if (isMatch) total++;
        d.setDate(d.getDate() + 1);
      }
    }
  }
  return total;
}

function calcDaysRemaining(dueDate) {
  if (!dueDate) return 0;
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T23:59:59');
  if (due < today) return 0;
  return Math.floor((due - today) / 86400000) + 1;
}

function calcMaxDailyEntries(targetEntries, dueDate, reminders) {
  if (reminders && reminders.length > 0) {
    const enabled = reminders.filter(r => r.enabled);
    if (enabled.length > 0) {
      // Schedule-based types (interval, custom_dates, once) always allow 1 entry per active day
      const scheduleOnly = enabled.every(r => ['interval', 'custom_dates', 'once'].includes(r.type));
      if (scheduleOnly) return 1;
      // For daily/weekdays/custom_days, max daily = count of enabled reminders
      return enabled.length;
    }
  }
  const days = calcDaysRemaining(dueDate);
  if (days <= 0) return 1;
  return Math.ceil(targetEntries / days);
}

function CreateRoutineModal({ open, onClose, onDone, cloneSource, onCloneUsed }) {
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [targetEntries, setTargetEntries] = useState('');
  const [maxDailyEntries, setMaxDailyEntries] = useState('');
  const [fields, setFields] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const skipAutoCalcRef = useRef(false);
  const skipDailyCalcRef = useRef(false);

  const autoCalc = calcEntriesFromReminders(dueDate, reminders);
  const autoDaily = calcMaxDailyEntries(Number(targetEntries) || 0, dueDate, reminders);

  // Auto-fill target entries when dueDate or reminders change
  const remindersKey = JSON.stringify(reminders.map(r => ({ type: r.type, time: r.time, days: r.days, dates: r.dates, enabled: r.enabled, intervalDays: r.intervalDays, intervalStartDate: r.intervalStartDate, intervalEndDate: r.intervalEndDate, intervalIncludeStart: r.intervalIncludeStart })));
  useEffect(() => {
    if (!initialized || skipAutoCalcRef.current) return;
    if (reminders.length > 0 && dueDate) {
      setTargetEntries(String(autoCalc || 0));
      skipAutoCalcRef.current = false;
    }
  }, [dueDate, remindersKey]);

  // Auto-fill max daily entries when targetEntries or dueDate or reminders change
  useEffect(() => {
    if (!initialized || skipDailyCalcRef.current) return;
    if (dueDate) {
      setMaxDailyEntries(String(autoDaily));
    }
  }, [targetEntries, dueDate, remindersKey]);

  // Initialize from clone source
  if (open && cloneSource && !initialized) {
    setName(cloneSource.name + ' (Copy)');
    setDueDate(cloneSource.dueDate ? cloneSource.dueDate.split('T')[0] : '');
    setTargetEntries(cloneSource.targetEntries || '');
    setMaxDailyEntries(cloneSource.maxDailyEntries || '1');
    setFields(cloneSource.fields?.map(f => ({ label: f.label, type: f.type, options: [...(f.options || [])] })) || []);
    setReminders(cloneSource.reminders?.map(r => ({
      type: r.type, time: r.time, days: [...(r.days || [])],
      dates: [...(r.dates || [])], enabled: r.enabled ?? true,
      fired: false, intervalDays: r.intervalDays || '',
      intervalStartDate: r.intervalStartDate ? (typeof r.intervalStartDate === 'string' && r.intervalStartDate.includes('T') ? r.intervalStartDate.split('T')[0] : r.intervalStartDate) : '',
      intervalEndDate: r.intervalEndDate ? (typeof r.intervalEndDate === 'string' && r.intervalEndDate.includes('T') ? r.intervalEndDate.split('T')[0] : r.intervalEndDate) : '',
      intervalIncludeStart: r.intervalIncludeStart ?? true,
    })) || []);
    setInitialized(true);
    skipAutoCalcRef.current = true;
    skipDailyCalcRef.current = true;
    onCloneUsed?.();
  }

  if (open && !cloneSource && !initialized) {
    setInitialized(true);
  }

  if (!open && initialized) {
    setTimeout(() => {
      setName(''); setDueDate(''); setTargetEntries(''); setMaxDailyEntries('');
      setFields([]); setReminders([]);
      setInitialized(false); skipAutoCalcRef.current = false; skipDailyCalcRef.current = false;
    }, 0);
  }

  const addField = () => {
    setFields([...fields, { label: '', type: 'text', options: [] }]);
  };

  const updateField = (idx, key, val) => {
    const updated = [...fields];
    updated[idx] = { ...updated[idx], [key]: val };
    setFields(updated);
  };

  const removeField = (idx) => {
    setFields(fields.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const hasOptions = (t) => t === 'radio' || t === 'checkbox';
      const validFields = fields.filter((f) => f.label.trim());
      await createRoutine({
        name,
        dueDate,
        targetEntries: Number(targetEntries),
        maxDailyEntries: Number(maxDailyEntries) || 1,
        fields: validFields.map((f) => ({
          ...f,
          options: hasOptions(f.type) ? f.options.filter((o) => o.trim()) : [],
        })),
        reminders,
      });
      toast.success('Routine created');
      setName(''); setDueDate(''); setTargetEntries(''); setMaxDailyEntries('');
      setFields([]); setReminders([]);
      setInitialized(false);
      onClose(); onDone();
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={cloneSource ? 'Clone Routine' : 'Create Routine'}>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Routine Name</label>
          <input type="text" placeholder="e.g., Morning Workout" value={name}
            onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Due Date</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Target Entries</label>
          <input type="number" placeholder="e.g., 30" value={targetEntries}
            onChange={(e) => { setTargetEntries(e.target.value); skipAutoCalcRef.current = true; }} required min="1" />
          {autoCalc > 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Calculated from reminders: <strong style={{ color: 'var(--primary)' }}>{autoCalc}</strong> entries
              {String(targetEntries) !== String(autoCalc) && <span style={{ color: 'var(--warning)' }}> (modified)</span>}
            </p>
          )}
        </div>
        <div className="form-group">
          <label>Max Daily Entries</label>
          <input type="number" placeholder="e.g., 3" value={maxDailyEntries}
            onChange={(e) => { setMaxDailyEntries(e.target.value); skipDailyCalcRef.current = true; }} required min="1" />
          {Number(targetEntries) > 0 && dueDate && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Calculated: <strong style={{ color: 'var(--primary)' }}>{autoDaily}</strong>/day to meet target
              {String(maxDailyEntries) !== String(autoDaily) && <span style={{ color: 'var(--warning)' }}> (modified)</span>}
            </p>
          )}
        </div>

        <ReminderEditor reminders={reminders} setReminders={setReminders} />

        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Fields</label>
            <button type="button" className="btn-ghost" onClick={addField}
              style={{ color: 'var(--primary)', fontSize: 13 }}>+ Add Field</button>
          </div>
          {fields.map((field, idx) => (
            <div key={idx} style={{ background: 'var(--bg-input)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input type="text" placeholder="Field label" value={field.label}
                  onChange={(e) => updateField(idx, 'label', e.target.value)}
                  style={{ flex: 1 }} />
                <select value={field.type} onChange={(e) => updateField(idx, 'type', e.target.value)}
                  style={{ width: 'auto', flex: '0 0 110px' }}>
                  <option value="text">Text</option>
                  <option value="textarea">Textarea</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="time">Time</option>
                  <option value="rating">Rating</option>
                  <option value="radio">Radio</option>
                  <option value="checkbox">Checkbox</option>
                </select>
                <button type="button" className="btn-ghost" onClick={() => removeField(idx)}
                  style={{ color: 'var(--danger)', padding: 4 }}><IoTrash size={16} /></button>
              </div>
              {(field.type === 'radio' || field.type === 'checkbox') && (
                <div>
                  <input type="text" placeholder="Options (comma-separated)"
                    value={field.options.join(', ')}
                    onChange={(e) => updateField(idx, 'options', e.target.value.split(',').map((s) => s.trim()))}
                    style={{ fontSize: 13 }} />
                </div>
              )}
            </div>
          ))}
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Creating...' : cloneSource ? 'Clone Routine' : 'Create Routine'}
        </button>
      </form>
    </Modal>
  );
}

function RoutineDetailModal({ open, routine, onClose, onDone, onClone }) {
  const { settings: detailSettings } = useSettings();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [logModal, setLogModal] = useState(false);
  const [batchModal, setBatchModal] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editTargetEntries, setEditTargetEntries] = useState('');
  const [editMaxDailyEntries, setEditMaxDailyEntries] = useState('');
  const [editReminders, setEditReminders] = useState([]);
  const editReadyRef = useRef(false);
  const skipEditAutoCalcRef = useRef(false);
  const skipEditDailyCalcRef = useRef(false);

  // Notes state
  const [detailTab, setDetailTab] = useState('info');
  const [notes, setNotes] = useState([]);
  const [notesFetched, setNotesFetched] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const noteEditorRef = useRef(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState('#3AAFB9');
  const detailSwipe = useSwipeTabs(['info', 'notes'], detailTab, setDetailTab, undefined, detailSettings?.tabSwipeRoutines !== false);

  const editAutoCalc = calcEntriesFromReminders(editDueDate, editReminders);
  const editAutoDaily = calcMaxDailyEntries(Number(editTargetEntries) || 0, editDueDate, editReminders);
  const editRemindersKey = JSON.stringify(editReminders.map(r => ({ type: r.type, time: r.time, days: r.days, dates: r.dates, enabled: r.enabled, intervalDays: r.intervalDays, intervalStartDate: r.intervalStartDate, intervalEndDate: r.intervalEndDate, intervalIncludeStart: r.intervalIncludeStart })));

  useEffect(() => {
    if (!editing || !editReadyRef.current || skipEditAutoCalcRef.current) return;
    if (editReminders.length > 0 && editDueDate) {
      setEditTargetEntries(String(editAutoCalc || 0));
      skipEditAutoCalcRef.current = false;
    }
  }, [editDueDate, editRemindersKey]);

  useEffect(() => {
    if (!editing || !editReadyRef.current || skipEditDailyCalcRef.current) return;
    if (editDueDate) {
      setEditMaxDailyEntries(String(editAutoDaily));
    }
  }, [editTargetEntries, editDueDate, editRemindersKey]);

  const fetchEntries = async () => {
    if (!routine?._id) return;
    setLoading(true);
    try {
      const res = await getRoutineEntries(routine._id);
      setEntries(res.data);
      setFetched(true);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  if (open && routine?._id && !fetched && !loading) {
    fetchEntries();
  }

  const fetchNotes = async () => {
    if (!routine?._id) return;
    try {
      const res = await getRoutineNotes(routine._id);
      setNotes(res.data);
      setNotesFetched(true);
    } catch (err) { toast.error(err.message); }
  };

  useEffect(() => {
    if (open && routine?._id && detailTab === 'notes' && !notesFetched) {
      fetchNotes();
    }
  }, [detailTab, open, routine?._id]);

  const handleAddNote = async () => {
    const content = noteEditorRef.current?.innerHTML;
    if (!content?.trim() || !stripHtml(content).trim()) return;
    try {
      if (editingNoteId) {
        await updateRoutineNote(editingNoteId, { content });
        setEditingNoteId(null);
        toast.success('Note updated');
      } else {
        await addRoutineNote(routine._id, { content });
        toast.success('Note added');
      }
      if (noteEditorRef.current) noteEditorRef.current.innerHTML = '';
      const notesRes = await getRoutineNotes(routine._id);
      setNotes(notesRes.data);
    } catch (err) { toast.error(err.message); }
  };

  const handleEditNote = (note) => {
    setEditingNoteId(note._id);
    if (noteEditorRef.current) noteEditorRef.current.innerHTML = note.content;
    setDetailTab('notes');
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await deleteRoutineNote(noteId);
      setNotes(prev => prev.filter(n => n._id !== noteId));
      toast.success('Note deleted');
    } catch (err) { toast.error(err.message); }
  };

  const execCmd = (cmd, val) => {
    document.execCommand(cmd, false, val);
    noteEditorRef.current?.focus();
  };

  const handleClose = () => {
    setEntries([]); setFetched(false); setEditing(false);
    setNotes([]); setNotesFetched(false); setDetailTab('info');
    setEditingNoteId(null); setShowColorPicker(false);
    onClose();
  };

  const handleDelete = async () => {
    try {
      await deleteRoutine(routine._id);
      toast.success('Routine deleted');
      handleClose(); onDone();
    } catch (err) { toast.error(err.message); }
  };

  const handleDeleteEntry = async () => {
    if (!confirmDeleteEntry) return;
    try {
      await deleteRoutineEntry(confirmDeleteEntry._id);
      toast.success('Entry deleted');
      setConfirmDeleteEntry(null);
      fetchEntries();
    } catch (err) { toast.error(err.message); }
  };

  const handleSaveEdit = async () => {
    try {
      await updateRoutine(routine._id, {
        name: editName,
        dueDate: editDueDate || null,
        targetEntries: Number(editTargetEntries),
        maxDailyEntries: Number(editMaxDailyEntries) || 1,
        reminders: editReminders,
      });
      toast.success('Routine updated');
      setEditing(false);
      onDone();
    } catch (err) { toast.error(err.message); }
  };

  // Compute stats
  const completedCount = entries.filter(e => e.status === 'complete').length;
  const incompleteCount = entries.filter(e => e.status === 'incomplete').length;
  const targetEntries = routine?.targetEntries || entries.length || 1;
  const progress = Math.round((completedCount / targetEntries) * 100);
  const isExpired = routine?.isExpired;
  const maxDailyEntries = routine?.maxDailyEntries || 1;
  // Account for today's missed entries (auto-incomplete only runs for yesterday)
  const todayMissed = isExpired ? 0 : Math.max(0, maxDailyEntries - (routine?.todayCompleteCount || 0));
  const totalMissed = incompleteCount + todayMissed;
  const effectiveTotal = completedCount + incompleteCount + todayMissed;
  const completionRate = effectiveTotal > 0 ? Math.round((completedCount / effectiveTotal) * 100) : 0;

  // Streak: consecutive complete entries from most recent
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  for (const entry of entries) {
    if (entry.status === 'complete') {
      tempStreak++;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  }
  for (const entry of entries) {
    if (entry.status === 'complete') currentStreak++;
    else break;
  }

  return (
    <Modal open={open} onClose={handleClose} title={routine?.name}>
      <div onTouchStart={e => { e.stopPropagation(); detailSwipe.onTouchStart(e); }} onTouchEnd={e => { e.stopPropagation(); detailSwipe.onTouchEnd(e); }}>
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderBottom: '2px solid var(--border)' }}>
        {[{ key: 'info', label: 'Info' }, { key: 'notes', label: `Notes${notes.length ? ` (${notes.length})` : ''}` }].map(t => (
          <button key={t.key} onClick={() => setDetailTab(t.key)}
            style={{
              flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'none', border: 'none',
              color: detailTab === t.key ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: detailTab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -2,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {detailTab === 'info' && (<>
      {/* Expired badge */}
      {isExpired && (
        <div style={{ marginBottom: 12 }}>
          <span className="badge badge-danger" style={{ fontSize: 13, padding: '4px 12px' }}>Expired</span>
        </div>
      )}

      {/* Done for today badge */}
      {routine?.isDoneForToday && !isExpired && (
        <div style={{ marginBottom: 12 }}>
          <span className="badge" style={{
            background: 'var(--success)', color: 'white', fontSize: 13, padding: '4px 12px',
          }}>
            Done for today ({routine.todayCompleteCount}/{maxDailyEntries})
          </span>
        </div>
      )}

      {/* Daily progress info */}
      {!isExpired && fetched && (
        <div style={{
          padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 8,
          fontSize: 12, color: 'var(--text-muted)', marginBottom: 12,
        }}>
          Daily target: <strong>{maxDailyEntries}</strong> entries/day
          &middot; Today: <strong style={{ color: routine?.isDoneForToday ? 'var(--success)' : 'var(--warning)' }}>
            {routine?.todayCompleteCount || 0}/{maxDailyEntries}
          </strong>
          {routine?.nextLogDate && (() => {
            const lbl = getNextLogLabel(routine.nextLogDate);
            if (!lbl) return null;
            const isToday = lbl === 'Today';
            return (
              <>
                <br />
                <IoCalendar size={11} style={{ verticalAlign: -1, marginRight: 3 }} />
                Next log: <strong style={{ color: isToday ? 'var(--success)' : 'var(--primary)' }}>{lbl}</strong>
              </>
            );
          })()}
        </div>
      )}

      {/* Progress bar */}
      {fetched && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            <span>{completedCount}/{targetEntries} entries</span>
            <span>{progress}%</span>
          </div>
          <div style={{ height: 8, background: 'var(--bg-input)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4, transition: 'width 0.3s',
              width: `${Math.min(progress, 100)}%`,
              background: progress >= 100 ? 'var(--success)' : progress >= 75 ? 'var(--primary-light)' : 'var(--primary)',
            }} />
          </div>
        </div>
      )}

      {/* Stats bar */}
      {fetched && entries.length > 0 && (
        <div style={{
          display: 'flex', gap: 8, marginBottom: 16,
          padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 8,
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>{completionRate}%</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Rate</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>{currentStreak}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Streak</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning)' }}>{longestStreak}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Best</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>{totalMissed}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Missed</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{entries.length}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Total</div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {!isExpired && !routine?.isDoneForToday && (
          <>
            <button className="btn-primary" style={{ flex: 1 }} onClick={() => setLogModal(true)}>
              Log Entry
            </button>
            <button className="btn-outline" style={{ width: 'auto', padding: '12px 14px' }}
              title="Quick Batch"
              onClick={() => setBatchModal(true)}>
              <IoFlash size={16} />
            </button>
          </>
        )}
        <button className="btn-outline" style={{ width: 'auto', padding: '12px 14px' }}
          onClick={() => {
            editReadyRef.current = false;
            skipEditAutoCalcRef.current = false;
            skipEditDailyCalcRef.current = false;
            setEditing(true);
            setEditName(routine?.name || '');
            setEditDueDate(routine?.dueDate ? routine.dueDate.split('T')[0] : '');
            setEditTargetEntries(routine?.targetEntries || '');
            setEditMaxDailyEntries(routine?.maxDailyEntries || '1');
            setEditReminders(routine?.reminders?.map(r => ({
              type: r.type, time: r.time, days: [...(r.days || [])],
              dates: [...(r.dates || [])], enabled: r.enabled ?? true,
              fired: r.fired || false, intervalDays: r.intervalDays || '',
              intervalStartDate: r.intervalStartDate ? (typeof r.intervalStartDate === 'string' && r.intervalStartDate.includes('T') ? r.intervalStartDate.split('T')[0] : r.intervalStartDate) : '',
              intervalEndDate: r.intervalEndDate ? (typeof r.intervalEndDate === 'string' && r.intervalEndDate.includes('T') ? r.intervalEndDate.split('T')[0] : r.intervalEndDate) : '',
              intervalIncludeStart: r.intervalIncludeStart ?? true,
            })) || []);
            requestAnimationFrame(() => { editReadyRef.current = true; });
          }}>
          <IoCreate size={16} />
        </button>
        <button className="btn-outline" style={{ width: 'auto', padding: '12px 14px' }}
          onClick={() => onClone(routine)}>
          <IoCopy size={16} />
        </button>
        <button className="btn-danger" style={{ width: 'auto', padding: '12px 14px' }}
          onClick={() => setConfirmDelete(true)}>
          <IoTrash size={16} />
        </button>
      </div>

      {/* Edit section */}
      {editing && (
        <div style={{ background: 'var(--bg-input)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div className="form-group">
            <label>Name</label>
            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Due Date</label>
            <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Target Entries</label>
            <input type="number" value={editTargetEntries} min="1"
              onChange={(e) => { setEditTargetEntries(e.target.value); skipEditAutoCalcRef.current = true; }} />
            {editAutoCalc > 0 && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Calculated from reminders: <strong style={{ color: 'var(--primary)' }}>{editAutoCalc}</strong> entries
                {String(editTargetEntries) !== String(editAutoCalc) && <span style={{ color: 'var(--warning)' }}> (modified)</span>}
              </p>
            )}
          </div>
          <div className="form-group">
            <label>Max Daily Entries</label>
            <input type="number" value={editMaxDailyEntries} min="1"
              onChange={(e) => { setEditMaxDailyEntries(e.target.value); skipEditDailyCalcRef.current = true; }} />
            {Number(editTargetEntries) > 0 && editDueDate && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Calculated: <strong style={{ color: 'var(--primary)' }}>{editAutoDaily}</strong>/day to meet target
                {String(editMaxDailyEntries) !== String(editAutoDaily) && <span style={{ color: 'var(--warning)' }}> (modified)</span>}
              </p>
            )}
          </div>
          <ReminderEditor reminders={editReminders} setReminders={setEditReminders} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={handleSaveEdit}>Save</button>
            <button className="btn-outline" style={{ flex: 1 }} onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <Spinner /> : entries.length === 0 ? (
        <EmptyState title="No entries yet" subtitle="Log your first entry" />
      ) : (() => {
        const todayStrPKT = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
        const grouped = {};
        for (const entry of entries) {
          const dateKey = new Date(entry.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
          if (!grouped[dateKey]) grouped[dateKey] = [];
          grouped[dateKey].push(entry);
        }
        const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
        return (
          <div style={{ display: 'grid', gap: 4 }}>
            {sortedKeys.map(dateKey => (
              <div key={dateKey}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: dateKey === todayStrPKT ? 'var(--primary)' : 'var(--text-secondary)',
                  padding: '8px 0 4px', borderBottom: '2px solid var(--border)', marginBottom: 4,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span>{dateKey === todayStrPKT ? 'Today' : formatDate(dateKey)}</span>
                  <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>
                    {grouped[dateKey].length} {grouped[dateKey].length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
                {grouped[dateKey].map((entry) => (
                  <div key={entry._id} style={{
                    padding: '8px 0 8px 12px', borderBottom: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        {entry.status === 'complete'
                          ? <IoCheckmarkCircle size={16} color="var(--success)" />
                          : <IoCloseCircle size={16} color="var(--danger)" />}
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{entry.status}</span>
                        {entry.manualDate && <span className="badge badge-warning">Manual</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDateTime(entry.date)}</div>
                      {entry.fieldValues?.length > 0 && (
                        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                          {entry.fieldValues.map((fv, i) => (
                            <div key={i}>{fv.label}: <strong>{
                              Array.isArray(fv.value) ? fv.value.join(', ')
                              : typeof fv.value === 'number' && fv.value >= 1 && fv.value <= 5
                                ? '★'.repeat(fv.value) + '☆'.repeat(5 - fv.value)
                                : String(fv.value)
                            }</strong></div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button className="btn-ghost" style={{ color: 'var(--danger)', padding: 4 }}
                      onClick={() => setConfirmDeleteEntry(entry)}>
                      <IoTrash size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })()}
      </>)}

      {detailTab === 'notes' && (
        <div>
          {/* Rich Text Toolbar */}
          <div style={{
            display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6,
            padding: '4px 0', borderBottom: '1px solid var(--border)',
          }}>
            <button type="button" className="btn-ghost" onClick={() => execCmd('bold')}
              style={{ padding: '4px 8px', fontSize: 12, fontWeight: 700 }}>B</button>
            <button type="button" className="btn-ghost" onClick={() => execCmd('italic')}
              style={{ padding: '4px 8px', fontSize: 12, fontStyle: 'italic' }}>I</button>
            <button type="button" className="btn-ghost" onClick={() => execCmd('underline')}
              style={{ padding: '4px 8px', fontSize: 12, textDecoration: 'underline' }}>U</button>
            <div style={{ position: 'relative' }}>
              <button type="button" className="btn-ghost" onClick={() => setShowColorPicker(!showColorPicker)}
                style={{ padding: '4px 8px', fontSize: 12 }}>
                A<span style={{ display: 'inline-block', width: 10, height: 3, background: customColor, marginLeft: 2, verticalAlign: 'bottom' }} />
              </button>
              {showColorPicker && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 20,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', padding: 8,
                  display: 'flex', gap: 4, flexWrap: 'wrap', width: 160,
                }}>
                  {RICH_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => { execCmd('foreColor', c); setCustomColor(c); setShowColorPicker(false); }}
                      style={{ width: 24, height: 24, borderRadius: 4, background: c, border: '2px solid var(--border)', cursor: 'pointer' }} />
                  ))}
                  <input type="color" value={customColor}
                    onChange={e => { execCmd('foreColor', e.target.value); setCustomColor(e.target.value); setShowColorPicker(false); }}
                    style={{ width: 24, height: 24, padding: 0, border: 'none', cursor: 'pointer' }} />
                </div>
              )}
            </div>
          </div>

          {/* Editor */}
          <div ref={noteEditorRef} contentEditable suppressContentEditableWarning
            style={{
              minHeight: 80, padding: 10, background: 'var(--bg-input)',
              borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
              fontSize: 13, lineHeight: 1.5, marginBottom: 8, color: 'var(--text)',
              outline: 'none',
            }}
            data-placeholder="Add a note..."
          />

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {editingNoteId && (
              <button className="btn-ghost" onClick={() => { setEditingNoteId(null); if (noteEditorRef.current) noteEditorRef.current.innerHTML = ''; }}
                style={{ flex: 1, fontSize: 12 }}>Cancel</button>
            )}
            <button className="btn-primary" onClick={handleAddNote}
              style={{ flex: 1, fontSize: 12, width: 'auto' }}>
              {editingNoteId ? 'Update Note' : 'Add Note'}
            </button>
          </div>

          {/* Notes List */}
          {notes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>No notes yet</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {notes.map(note => (
                <div key={note._id} className="card" style={{ padding: 10 }}>
                  <div dangerouslySetInnerHTML={{ __html: note.content }}
                    style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 6, wordBreak: 'break-word' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {formatDateTime(note.createdAt)}
                      {note.updatedAt !== note.createdAt && (
                        <span> · edited {formatDateTime(note.updatedAt)}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-ghost" style={{ padding: 3 }} onClick={() => handleEditNote(note)}>
                        <IoCreate size={13} color="var(--text-muted)" />
                      </button>
                      <button className="btn-ghost" style={{ padding: 3 }} onClick={() => handleDeleteNote(note._id)}>
                        <IoTrash size={13} color="var(--danger)" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {logModal && (
        <LogEntryModal open={logModal} routine={routine}
          onClose={() => setLogModal(false)} onDone={() => { fetchEntries(); onDone(); }} />
      )}

      {batchModal && (
        <BatchLogModal open={batchModal} routine={routine}
          onClose={() => setBatchModal(false)} onDone={() => { fetchEntries(); onDone(); }} />
      )}

      <ConfirmModal open={confirmDelete} onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete routine?"
        message={`Delete "${routine?.name}" and all its ${entries.length} entries? This cannot be undone.`} />

      <ConfirmModal open={!!confirmDeleteEntry} onClose={() => setConfirmDeleteEntry(null)}
        onConfirm={handleDeleteEntry}
        title="Delete entry?"
        message="Are you sure you want to delete this entry?" />
      </div>
    </Modal>
  );
}

function LogEntryModal({ open, routine, onClose, onDone }) {
  const [manualDate, setManualDate] = useState(false);
  const [date, setDate] = useState('');
  const [fieldValues, setFieldValues] = useState({});
  const [loading, setLoading] = useState(false);

  const handleFieldChange = (fieldId, label, value) => {
    setFieldValues({ ...fieldValues, [fieldId]: { fieldId, label, value } });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await logRoutineEntry(routine._id, {
        manualDate,
        date: manualDate ? date : undefined,
        fieldValues: Object.values(fieldValues),
      });
      toast.success('Entry logged');
      onClose(); onDone();
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Log Entry">
      <form onSubmit={handleSubmit}>
        <div style={{
          padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 8,
          fontSize: 12, color: 'var(--text-muted)', marginBottom: 12,
        }}>
          Entry will be logged as <strong style={{ color: 'var(--success)' }}>complete</strong>.
          Missing entries are automatically marked incomplete at end of day.
        </div>

        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={manualDate} onChange={(e) => setManualDate(e.target.checked)} />
          <label style={{ margin: 0 }}>Set date manually</label>
        </div>

        {manualDate && (
          <div className="form-group">
            <label>Date</label>
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
        )}

        {routine?.fields?.map((field) => (
          <div key={field._id} className="form-group">
            <label>{field.label}</label>
            {field.type === 'text' ? (
              <input type="text" placeholder={field.label}
                onChange={(e) => handleFieldChange(field._id, field.label, e.target.value)} />
            ) : field.type === 'textarea' ? (
              <textarea placeholder={field.label} rows={3}
                style={{ resize: 'vertical' }}
                onChange={(e) => handleFieldChange(field._id, field.label, e.target.value)} />
            ) : field.type === 'number' ? (
              <input type="number" placeholder={field.label}
                onChange={(e) => handleFieldChange(field._id, field.label, e.target.value)} />
            ) : field.type === 'date' ? (
              <input type="date"
                onChange={(e) => handleFieldChange(field._id, field.label, e.target.value)} />
            ) : field.type === 'time' ? (
              <input type="time"
                onChange={(e) => handleFieldChange(field._id, field.label, e.target.value)} />
            ) : field.type === 'rating' ? (
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} type="button"
                    onClick={() => handleFieldChange(field._id, field.label, star)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, padding: 2,
                      color: (fieldValues[field._id]?.value || 0) >= star ? '#FFD93D' : 'var(--text-muted)',
                    }}>
                    ★
                  </button>
                ))}
              </div>
            ) : field.type === 'radio' ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {field.options.map((opt) => (
                  <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, cursor: 'pointer' }}>
                    <input type="radio" name={field._id} value={opt}
                      onChange={(e) => handleFieldChange(field._id, field.label, e.target.value)} />
                    {opt}
                  </label>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {field.options.map((opt) => (
                  <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, cursor: 'pointer' }}>
                    <input type="checkbox" value={opt}
                      onChange={(e) => {
                        const current = fieldValues[field._id]?.value || [];
                        const newVal = e.target.checked
                          ? [...current, opt]
                          : current.filter((v) => v !== opt);
                        handleFieldChange(field._id, field.label, newVal);
                      }} />
                    {opt}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Logging...' : 'Log Complete Entry'}
        </button>
      </form>
    </Modal>
  );
}

function BatchLogModal({ open, routine, onClose, onDone }) {
  const maxDaily = routine?.maxDailyEntries || 1;
  const todayDone = routine?.todayCompleteCount || 0;
  const remaining = Math.max(0, maxDaily - todayDone);

  const [count, setCount] = useState(Math.min(1, remaining));
  const [loading, setLoading] = useState(false);

  // Reset count when modal opens with new remaining value
  useEffect(() => {
    if (open) setCount(Math.min(1, remaining));
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (remaining <= 0) { toast.error('Daily limit already reached'); return; }
    setLoading(true);
    try {
      await batchLogRoutineEntries(routine._id, { count });
      toast.success(`${count} complete entr${count > 1 ? 'ies' : 'y'} logged`);
      onClose(); onDone();
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Quick Batch Log">
      <form onSubmit={handleSubmit}>
        <div style={{
          padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 8,
          fontSize: 12, color: 'var(--text-muted)', marginBottom: 12,
        }}>
          Daily limit: <strong>{maxDaily}</strong> &middot; Done today: <strong>{todayDone}</strong> &middot;
          Remaining: <strong style={{ color: remaining > 0 ? 'var(--success)' : 'var(--danger)' }}>{remaining}</strong>
        </div>

        <div className="form-group">
          <label>How many entries?</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" className="btn-outline"
              style={{ width: 40, height: 40, padding: 0, fontSize: 20, fontWeight: 700 }}
              onClick={() => setCount(c => Math.max(1, c - 1))}>−</button>
            <span style={{ fontSize: 28, fontWeight: 700, minWidth: 40, textAlign: 'center' }}>{count}</span>
            <button type="button" className="btn-outline"
              style={{ width: 40, height: 40, padding: 0, fontSize: 20, fontWeight: 700 }}
              onClick={() => setCount(c => Math.min(remaining, c + 1))}>+</button>
          </div>
        </div>

        <div style={{
          padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 8,
          fontSize: 13, color: 'var(--text-muted)', marginBottom: 16,
        }}>
          This will log <strong style={{ color: 'var(--text-primary)' }}>{count}</strong>{' '}
          <span style={{ color: 'var(--success)' }}>complete</span>{' '}
          entr{count > 1 ? 'ies' : 'y'} right now.
        </div>

        <button type="submit" className="btn-primary" disabled={loading || remaining <= 0}>
          {loading ? 'Logging...' : remaining <= 0 ? 'Daily Limit Reached' : `Log ${count} Entr${count > 1 ? 'ies' : 'y'}`}
        </button>
      </form>
    </Modal>
  );
}
