import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  IoAdd, IoTrash, IoChevronForward, IoChevronDown, IoSearch, IoArrowBack,
  IoClose, IoPricetag, IoCreate, IoColorPalette, IoTime,
  IoLockClosed, IoLockOpen, IoCalendar, IoNotifications, IoNotificationsOff,
  IoChevronUp, IoFolder, IoFolderOpen, IoFlash, IoDocumentText,
} from 'react-icons/io5';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import {
  getTopics, createTopic, updateTopic, deleteTopic,
  getSubTopics, createSubTopic, updateSubTopic, deleteSubTopic,
  getNotes, createNote, updateNote, deleteNote,
  getTags, createTag, updateTag, deleteTag,
  searchNotes, getRecentNotes, getNotesTree,
  getEventFolders, createEventFolder, updateEventFolder, deleteEventFolder,
  getEvents, createEvent, updateEvent, deleteEvent,
  getEventContainers, createEventContainer, updateEventContainer, deleteEventContainer,
  getEventEntries, createEventEntry, updateEventEntry, deleteEventEntry,
  getSettings, updateSettings, aiNotesSearch,
} from '../api';
import { formatDateTime, formatDate, formatPKR } from '../utils/format';
import useSwipeTabs from '../hooks/useSwipeTabs';
import useBackClose from '../hooks/useBackClose';

import { useSettings } from '../context/SettingsContext';

// ─── Main Page ───

export default function Notes() {
  const { settings: appSettings } = useSettings();
  // Parent tab: 'notes' | 'events'
  const [parentTab, _setParentTab] = useState(() => sessionStorage.getItem('notes_parent_tab') || 'notes');
  const setParentTab = useCallback((t) => { _setParentTab(t); sessionStorage.setItem('notes_parent_tab', t); }, []);

  return (
    <div className="page">
      {/* Parent Tab Bar */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
        {[{ key: 'notes', label: 'Notes' }, { key: 'events', label: 'Events' }].map(t => (
          <button key={t.key} onClick={() => setParentTab(t.key)} style={{
            flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
            background: parentTab === t.key ? 'var(--primary)' : 'transparent',
            color: parentTab === t.key ? 'white' : 'var(--text-secondary)',
            transition: 'all 0.2s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {parentTab === 'notes' ? <NotesSection appSettings={appSettings} /> : <EventsSection appSettings={appSettings} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// ─── Notes Section (existing functionality) ───
// ════════════════════════════════════════════════════════════

function NotesSection({ appSettings }) {
  const [tab, _setTab] = useState(() => sessionStorage.getItem('notes_tab') || 'tree');
  const setTab = useCallback((t) => { _setTab(t); sessionStorage.setItem('notes_tab', t); }, []);
  const swipe = useSwipeTabs(['tree', 'recent'], tab, setTab, undefined, appSettings?.tabSwipeNotes !== false);

  const [tree, setTree] = useState([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [expandedTopics, setExpandedTopics] = useState({});
  const [expandedSubs, setExpandedSubs] = useState({});
  const [recentNotes, setRecentNotes] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [createTopicModal, setCreateTopicModal] = useState(false);
  const [createSubTopicModal, setCreateSubTopicModal] = useState(null);
  const [noteEditorModal, setNoteEditorModal] = useState(null);
  const [tagManagerModal, setTagManagerModal] = useState(false);
  useBackClose(!!noteEditorModal, () => setNoteEditorModal(null));
  useBackClose(!!createTopicModal, () => setCreateTopicModal(false));
  useBackClose(!!createSubTopicModal, () => setCreateSubTopicModal(null));
  useBackClose(!!tagManagerModal, () => setTagManagerModal(false));

  const [searchQuery, setSearchQuery] = useState('');
  const [searchTag, setSearchTag] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [allTags, setAllTags] = useState([]);
  const [editItem, setEditItem] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const aiEnabled = appSettings?.aiEnabled || false;
  const [aiSearchMode, setAiSearchMode] = useState(false);
  const [aiSearchResults, setAiSearchResults] = useState(null);
  const [aiSearchLoading, setAiSearchLoading] = useState(false);
  const topicColorRef = useRef(null);
  const [editingTopicColor, setEditingTopicColor] = useState(null);

  const handleTopicColorClick = (topicId) => {
    setEditingTopicColor(topicId);
    setTimeout(() => topicColorRef.current?.click(), 0);
  };

  const handleTopicColorChange = async (e) => {
    const color = e.target.value;
    if (!editingTopicColor) return;
    try {
      await updateTopic(editingTopicColor, { color });
      setTree(prev => prev.map(t => t._id === editingTopicColor ? { ...t, color } : t));
    } catch (err) { toast.error(err.message); }
    setEditingTopicColor(null);
  };

  const fetchTree = useCallback(async () => {
    setTreeLoading(true);
    try {
      const res = await getNotesTree();
      setTree(res.data);
    } catch (err) { toast.error(err.message); }
    finally { setTreeLoading(false); }
  }, []);

  const recentFetched = useRef(false);
  const fetchRecent = useCallback(async () => {
    if (!recentFetched.current) setRecentLoading(true);
    try {
      const res = await getRecentNotes();
      setRecentNotes(res.data);
      recentFetched.current = true;
    } catch (err) { toast.error(err.message); }
    finally { setRecentLoading(false); }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const res = await getTags();
      setAllTags(res.data);
    } catch (err) { /* silent */ }
  }, []);

  useEffect(() => { fetchTree(); fetchTags(); }, []);
  useEffect(() => {
    if (tab === 'recent' && !recentFetched.current) fetchRecent();
  }, [tab]);

  const toggleTopic = (topicId) => setExpandedTopics(prev => ({ ...prev, [topicId]: !prev[topicId] }));
  const toggleSub = (subId) => setExpandedSubs(prev => ({ ...prev, [subId]: !prev[subId] }));

  const doSearch = async () => {
    if (!searchQuery && !searchTag) return;
    setSearchLoading(true);
    try {
      const params = {};
      if (searchQuery) params.q = searchQuery;
      if (searchTag) params.tag = searchTag;
      const res = await searchNotes(params);
      setSearchResults(res.data);
    } catch (err) { toast.error(err.message); }
    finally { setSearchLoading(false); }
  };

  const doAiSearch = async () => {
    if (!searchQuery.trim() || aiSearchLoading) return;
    setAiSearchLoading(true);
    setAiSearchResults(null);
    try {
      // Get all notes for AI to search through
      const treeRes = await getNotesTree();
      const allNotes = [];
      for (const topic of treeRes.data) {
        for (const sub of topic.subTopics || []) {
          for (const note of sub.notes || []) {
            allNotes.push({ _id: note._id, title: note.title, content: note.content || '', topicName: topic.name, subTopicName: sub.name, subTopicId: sub._id });
          }
        }
      }
      if (allNotes.length === 0) { toast.error('No notes to search'); setAiSearchLoading(false); return; }
      const res = await aiNotesSearch(searchQuery, allNotes.slice(0, 50));
      const matched = (res.data.results || []).map(r => {
        const note = allNotes.find(n => n._id === r.id);
        return note ? { ...note, reason: r.reason } : null;
      }).filter(Boolean);
      setAiSearchResults({ results: matched, summary: res.data.summary });
    } catch (err) { toast.error(err.response?.data?.error || err.message); }
    finally { setAiSearchLoading(false); }
  };

  useEffect(() => {
    if (tab === 'search' && !aiSearchMode) {
      const timer = setTimeout(doSearch, 400);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, searchTag, tab, aiSearchMode]);

  const handleRename = async () => {
    if (!editItem) return;
    try {
      if (editItem.type === 'topic') await updateTopic(editItem.id, { name: editItem.name });
      else if (editItem.type === 'subtopic') await updateSubTopic(editItem.id, { name: editItem.name });
      toast.success('Renamed');
      fetchTree();
    } catch (err) { toast.error(err.message); }
    setEditItem(null);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.type === 'topic') { await deleteTopic(confirmDelete.id); toast.success('Topic deleted'); }
      else if (confirmDelete.type === 'subtopic') { await deleteSubTopic(confirmDelete.id); toast.success('SubTopic deleted'); }
      else if (confirmDelete.type === 'note') { await deleteNote(confirmDelete.id); toast.success('Note deleted'); }
      fetchTree();
    } catch (err) { toast.error(err.message); }
  };

  const refreshAll = () => { fetchTree(); fetchTags(); if (tab === 'recent') fetchRecent(); };

  if (treeLoading && tree.length === 0) return <Spinner />;

  return (
    <div onTouchStart={tab !== 'search' ? swipe.onTouchStart : undefined} onTouchEnd={tab !== 'search' ? swipe.onTouchEnd : undefined}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {tab === 'search' && (
          <button className="btn-ghost" style={{ padding: 4 }}
            onClick={() => { setTab('tree'); setSearchResults([]); setSearchQuery(''); setSearchTag(''); }}>
            <IoArrowBack size={20} />
          </button>
        )}
        <h1 className="page-title" style={{ margin: 0, flex: 1 }}>
          {tab === 'search' ? 'Search Notes' : 'Notes'}
        </h1>
        <button className="btn-ghost" style={{ padding: 4 }} onClick={() => setTagManagerModal(true)}>
          <IoPricetag size={18} />
        </button>
        <button className="btn-ghost" style={{ padding: 4 }}
          onClick={() => { setTab(tab === 'search' ? 'tree' : 'search'); if (tab === 'search') { setSearchResults([]); setSearchQuery(''); setSearchTag(''); } }}>
          <IoSearch size={18} />
        </button>
      </div>

      {/* Tab bar (tree / recent) */}
      {tab !== 'search' && (
        <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {[{ key: 'tree', label: 'All Notes' }, { key: 'recent', label: 'Recent' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: tab === t.key ? 'var(--primary)' : 'transparent',
              color: tab === t.key ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.2s',
            }}>
              {t.key === 'recent' && <IoTime size={13} style={{ marginRight: 4, verticalAlign: -2 }} />}
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Search UI */}
      {tab === 'search' && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <input type="text" placeholder={aiSearchMode ? "Describe what you're looking for..." : "Search notes..."} value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); if (aiSearchMode) setAiSearchResults(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && aiSearchMode) doAiSearch(); }}
              style={{ display: 'block', width: '100%', height: 46, fontSize: 15, padding: '12px 14px', boxSizing: 'border-box' }} autoFocus />
            {aiSearchMode && (
              <button className="btn-primary" onClick={doAiSearch} disabled={aiSearchLoading || !searchQuery.trim()}
                style={{ marginTop: 8, padding: '10px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                {aiSearchLoading && <Spinner size={14} />}
                {aiSearchLoading ? 'Searching...' : 'Search'}
              </button>
            )}
          </div>
          {aiEnabled && (
            <button onClick={() => { setAiSearchMode(!aiSearchMode); setAiSearchResults(null); setSearchResults([]); }}
              style={{
                padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                border: 'none', cursor: 'pointer', marginBottom: 8,
                background: aiSearchMode ? 'var(--warning)' : 'var(--bg-input)',
                color: aiSearchMode ? '#000' : 'var(--text-secondary)',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
              <IoFlash size={12} /> {aiSearchMode ? 'AI Smart Search' : 'Use AI Search'}
            </button>
          )}
          {!aiSearchMode && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {allTags.map((t) => (
                <button key={t._id}
                  onClick={() => setSearchTag(searchTag === t._id ? '' : t._id)}
                  style={{
                    padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                    border: 'none', cursor: 'pointer',
                    background: searchTag === t._id ? t.color : 'var(--bg-input)',
                    color: searchTag === t._id ? '#fff' : 'var(--text-secondary)',
                  }}>
                  {t.name}
                </button>
              ))}
            </div>
          )}
          {/* Regular search results */}
          {!aiSearchMode && (searchLoading ? <Spinner /> : searchResults.length > 0 ? (
            <div className="desktop-grid-2" style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {searchResults.map((note) => {
                const topicColor = note.subTopicId?.topicId?.color;
                return (
                <div key={note._id} className="card" style={{
                  cursor: 'pointer',
                  ...(topicColor ? { background: topicColor + '0D', borderLeft: `3px solid ${topicColor}40` } : {}),
                }}
                  onClick={() => setNoteEditorModal({ note, subTopicId: note.subTopicId?._id })}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    {note.subTopicId?.topicId?.name || '?'} / {note.subTopicId?.name || '?'}
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 600 }}>{note.title}</h3>
                  {note.tags?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {note.tags.map((tag) => (
                        <span key={tag._id} style={{
                          padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                          background: tag.color + '33', color: tag.color,
                        }}>{tag.name}</span>
                      ))}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          ) : (searchQuery || searchTag) ? (
            <EmptyState title="No results" subtitle="Try different search terms" />
          ) : null)}
          {/* AI search results */}
          {aiSearchMode && (aiSearchLoading ? <Spinner /> : aiSearchResults ? (
            <div style={{ marginTop: 12 }}>
              {aiSearchResults.summary && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 8 }}>
                  <IoFlash size={12} color="var(--warning)" style={{ verticalAlign: -2, marginRight: 4 }} />
                  {aiSearchResults.summary}
                </div>
              )}
              {aiSearchResults.results.length > 0 ? (
                <div className="desktop-grid-2" style={{ display: 'grid', gap: 8 }}>
                  {aiSearchResults.results.map((note) => (
                    <div key={note._id} className="card" style={{ cursor: 'pointer' }}
                      onClick={() => setNoteEditorModal({ note: { _id: note._id, title: note.title }, subTopicId: note.subTopicId })}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                        {note.topicName || '?'} / {note.subTopicName || '?'}
                      </div>
                      <h3 style={{ fontSize: 14, fontWeight: 600 }}>{note.title}</h3>
                      {note.reason && (
                        <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 4, fontStyle: 'italic' }}>
                          {note.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No matches" subtitle="AI couldn't find notes matching your description" />
              )}
            </div>
          ) : null)}
        </div>
      )}

      {/* Recent Notes */}
      <div style={{ display: tab === 'recent' ? 'block' : 'none' }}>
          {recentLoading ? <Spinner /> : recentNotes.length === 0 ? (
            <EmptyState icon="clock" title="No recent notes" subtitle="Notes you edit will appear here" />
          ) : (
            <div className="desktop-grid-2" style={{ display: 'grid', gap: 8 }}>
              {recentNotes.map((note) => {
                const topicColor = note.subTopicId?.topicId?.color;
                return (
                <div key={note._id} className="card" style={{
                  cursor: 'pointer', padding: '10px 14px',
                  ...(topicColor ? { background: topicColor + '0D', borderLeft: `3px solid ${topicColor}40` } : {}),
                }}
                  onClick={() => setNoteEditorModal({ note, subTopicId: note.subTopicId?._id })}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                    {note.subTopicId?.topicId?.name || '?'} / {note.subTopicId?.name || '?'}
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
                    {note.locked && <IoLockClosed size={12} color="var(--warning)" style={{ marginRight: 4, verticalAlign: -1 }} />}
                    {note.title}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {formatDateTime(note.updatedAt)}
                    </span>
                    {note.tags?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {note.tags.map((tag) => (
                          <span key={tag._id} style={{
                            padding: '1px 6px', borderRadius: 8, fontSize: 9, fontWeight: 600,
                            background: tag.color + '33', color: tag.color,
                          }}>{tag.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
      </div>

      {/* Tree View */}
      <div style={{ display: tab === 'tree' ? 'block' : 'none' }}>
          {tree.length === 0 ? (
            <EmptyState icon="doc" title="No topics yet" subtitle="Create a topic to organize your notes" />
          ) : (
            <div style={{ display: 'grid', gap: 0 }}>
              {tree.map((topic) => (
                <div key={topic._id}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '10px 8px',
                    borderBottom: '1px solid var(--border)',
                    background: topic.color ? topic.color + '0D' : 'transparent',
                    borderLeft: topic.color ? `3px solid ${topic.color}40` : 'none',
                    borderRadius: 4,
                  }}>
                    <button className="btn-ghost" style={{ padding: 2 }} onClick={() => toggleTopic(topic._id)}>
                      {expandedTopics[topic._id]
                        ? <IoChevronDown size={16} color={topic.color || 'var(--primary)'} />
                        : <IoChevronForward size={16} color="var(--text-muted)" />}
                    </button>
                    {editItem?.type === 'topic' && editItem.id === topic._id ? (
                      <form onSubmit={(e) => { e.preventDefault(); handleRename(); }} style={{ flex: 1, display: 'flex', gap: 6 }}>
                        <input type="text" value={editItem.name} autoFocus
                          onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                          style={{ flex: 1, padding: '4px 8px' }} />
                        <button type="submit" className="btn-ghost" style={{ color: 'var(--primary)', fontSize: 11 }}>Save</button>
                        <button type="button" className="btn-ghost" onClick={() => setEditItem(null)} style={{ fontSize: 11 }}>Cancel</button>
                      </form>
                    ) : (
                      <>
                        <span onClick={() => handleTopicColorClick(topic._id)}
                          title="Change color" style={{
                            width: 14, height: 14, borderRadius: '50%', background: topic.color || '#3AAFB9',
                            border: '1px solid var(--border)', cursor: 'pointer', flexShrink: 0,
                          }} />
                        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => toggleTopic(topic._id)}>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{topic.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
                            {topic.subTopics.length} sub &middot; {topic.subTopics.reduce((a, s) => a + s.notes.length, 0)} notes
                          </span>
                        </div>
                        <button className="btn-ghost" style={{ padding: 2 }}
                          onClick={() => setCreateSubTopicModal(topic._id)} title="Add subtopic">
                          <IoAdd size={15} color="var(--primary)" />
                        </button>
                        <button className="btn-ghost" style={{ padding: 2 }}
                          onClick={() => setEditItem({ type: 'topic', id: topic._id, name: topic.name })}>
                          <IoCreate size={14} color="var(--text-muted)" />
                        </button>
                        <button className="btn-ghost" style={{ padding: 2 }}
                          onClick={() => setConfirmDelete({ type: 'topic', id: topic._id, name: topic.name })}>
                          <IoTrash size={14} color="var(--danger)" />
                        </button>
                      </>
                    )}
                  </div>
                  {expandedTopics[topic._id] && (
                    <div style={{ paddingLeft: 20 }}>
                      {topic.subTopics.length === 0 ? (
                        <div style={{ padding: '8px 0', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          No subtopics
                        </div>
                      ) : topic.subTopics.map((sub) => (
                        <div key={sub._id}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 6px',
                            borderBottom: '1px solid var(--border)',
                            background: topic.color ? topic.color + '08' : 'transparent',
                            borderRadius: 3,
                          }}>
                            <button className="btn-ghost" style={{ padding: 2 }} onClick={() => toggleSub(sub._id)}>
                              {expandedSubs[sub._id]
                                ? <IoChevronDown size={14} color="var(--primary)" />
                                : <IoChevronForward size={14} color="var(--text-muted)" />}
                            </button>
                            {editItem?.type === 'subtopic' && editItem.id === sub._id ? (
                              <form onSubmit={(e) => { e.preventDefault(); handleRename(); }} style={{ flex: 1, display: 'flex', gap: 6 }}>
                                <input type="text" value={editItem.name} autoFocus
                                  onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                                  style={{ flex: 1, padding: '3px 6px' }} />
                                <button type="submit" className="btn-ghost" style={{ color: 'var(--primary)', fontSize: 11 }}>Save</button>
                                <button type="button" className="btn-ghost" onClick={() => setEditItem(null)} style={{ fontSize: 11 }}>Cancel</button>
                              </form>
                            ) : (
                              <>
                                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => toggleSub(sub._id)}>
                                  <span style={{ fontSize: 13, fontWeight: 500 }}>{sub.name}</span>
                                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>
                                    {sub.notes.length} note{sub.notes.length !== 1 ? 's' : ''}
                                  </span>
                                </div>
                                <button className="btn-ghost" style={{ padding: 2 }}
                                  onClick={() => setNoteEditorModal({ note: null, subTopicId: sub._id })} title="Add note">
                                  <IoAdd size={14} color="var(--primary)" />
                                </button>
                                <button className="btn-ghost" style={{ padding: 2 }}
                                  onClick={() => setEditItem({ type: 'subtopic', id: sub._id, name: sub.name })}>
                                  <IoCreate size={13} color="var(--text-muted)" />
                                </button>
                                <button className="btn-ghost" style={{ padding: 2 }}
                                  onClick={() => setConfirmDelete({ type: 'subtopic', id: sub._id, name: sub.name })}>
                                  <IoTrash size={13} color="var(--danger)" />
                                </button>
                              </>
                            )}
                          </div>
                          {expandedSubs[sub._id] && (
                            <div style={{ paddingLeft: 20 }}>
                              {sub.notes.length === 0 ? (
                                <div style={{ padding: '6px 0', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  No notes
                                </div>
                              ) : sub.notes.map((note) => (
                                <div key={note._id} style={{
                                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 6px',
                                  borderBottom: '1px solid var(--border)', cursor: 'pointer',
                                  background: topic.color ? topic.color + '06' : 'transparent',
                                  borderRadius: 3,
                                }} onClick={() => setNoteEditorModal({ note, subTopicId: sub._id })}>
                                  {note.locked && <IoLockClosed size={12} color="var(--warning)" style={{ flexShrink: 0 }} />}
                                  <div style={{ flex: 1 }}>
                                    <span style={{ fontSize: 13, fontWeight: 500 }}>{note.title}</span>
                                    {note.tags?.length > 0 && (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
                                        {note.tags.map((tag) => (
                                          <span key={tag._id} style={{
                                            padding: '1px 6px', borderRadius: 8, fontSize: 9, fontWeight: 600,
                                            background: tag.color + '33', color: tag.color,
                                          }}>{tag.name}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  {!note.locked && (
                                    <button className="btn-ghost" style={{ padding: 2 }}
                                      onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'note', id: note._id, name: note.title }); }}>
                                      <IoTrash size={12} color="var(--danger)" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <button className="fab" onClick={() => setCreateTopicModal(true)}>
            <IoAdd />
          </button>
      </div>

      <input ref={topicColorRef} type="color"
        value={tree.find(t => t._id === editingTopicColor)?.color || '#3AAFB9'}
        onChange={handleTopicColorChange}
        style={{ position: 'fixed', top: -100, left: -100, width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} />

      <CreateTopicModal open={createTopicModal} onClose={() => setCreateTopicModal(false)} onDone={refreshAll} />
      <CreateSubTopicModal open={!!createSubTopicModal} topicId={createSubTopicModal}
        onClose={() => setCreateSubTopicModal(null)} onDone={refreshAll} />
      {noteEditorModal && (
        <NoteEditorModal note={noteEditorModal.note} subTopicId={noteEditorModal.subTopicId}
          allTags={allTags} onClose={() => setNoteEditorModal(null)} onDone={refreshAll} onTagsChanged={fetchTags} />
      )}
      <TagManagerModal open={tagManagerModal} tags={allTags}
        onClose={() => setTagManagerModal(false)} onDone={fetchTags} />
      <ConfirmModal open={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={handleConfirmDelete}
        title={`Delete ${confirmDelete?.type}?`}
        message={`Are you sure you want to delete "${confirmDelete?.name}"?${confirmDelete?.type === 'topic' ? ' All subtopics and notes will also be deleted.' : confirmDelete?.type === 'subtopic' ? ' All notes inside will also be deleted.' : ''}`} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// ─── Events Section ───
// ════════════════════════════════════════════════════════════

function EventsSection() {
  const [transactionTypes, setTransactionTypes] = useState(['Given', 'Received']);

  // Navigation stack: folders → folder detail (events) → event detail
  const [folders, setFolders] = useState([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Folder creation
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDesc, setNewFolderDesc] = useState('');
  const [folderSaving, setFolderSaving] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);
  const [confirmDelFolder, setConfirmDelFolder] = useState(null);

  // Event note editor
  const [eventNoteEditor, setEventNoteEditor] = useState(null);

  // Back button support - each level independently tracks its own history entry
  useBackClose(!!selectedFolder, () => { setSelectedFolder(null); setSelectedEvent(null); setEventNoteEditor(null); });
  useBackClose(!!selectedEvent, () => { setSelectedEvent(null); setEventNoteEditor(null); });
  useBackClose(!!eventNoteEditor, () => setEventNoteEditor(null));

  const fetchFolders = useCallback(async () => {
    setFoldersLoading(true);
    try {
      const res = await getEventFolders();
      setFolders(res.data);
    } catch (err) { toast.error(err.message); }
    finally { setFoldersLoading(false); }
  }, []);

  const fetchTypes = useCallback(async () => {
    try {
      const res = await getSettings();
      const types = res.data.eventTransactionTypes;
      if (types && types.length > 0) setTransactionTypes(types);
    } catch { /* use defaults */ }
  }, []);

  useEffect(() => { fetchFolders(); fetchTypes(); }, []);

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setFolderSaving(true);
    try {
      await createEventFolder({ name: newFolderName.trim(), description: newFolderDesc.trim() });
      toast.success('Folder created');
      setNewFolderName(''); setNewFolderDesc(''); setShowAddFolder(false);
      fetchFolders();
    } catch (err) { toast.error(err.response?.data?.error || err.message); }
    finally { setFolderSaving(false); }
  };

  const handleUpdateFolder = async (e) => {
    e.preventDefault();
    if (!editingFolder || !newFolderName.trim()) return;
    setFolderSaving(true);
    try {
      await updateEventFolder(editingFolder._id, { name: newFolderName.trim(), description: newFolderDesc.trim() });
      toast.success('Folder updated');
      setNewFolderName(''); setNewFolderDesc(''); setEditingFolder(null);
      fetchFolders();
    } catch (err) { toast.error(err.response?.data?.error || err.message); }
    finally { setFolderSaving(false); }
  };

  const handleDeleteFolder = async () => {
    if (!confirmDelFolder) return;
    try {
      await deleteEventFolder(confirmDelFolder._id);
      toast.success('Folder deleted');
      fetchFolders();
    } catch (err) { toast.error(err.message); }
  };

  // ─── Render: Rich Note Editor ───
  if (eventNoteEditor) {
    return (
      <RichNoteEditor
        initialContent={eventNoteEditor.content}
        onSave={(html) => { eventNoteEditor.onSave(html); setEventNoteEditor(null); }}
        onClose={() => setEventNoteEditor(null)}
      />
    );
  }

  // ─── Render: Event Detail View ───
  if (selectedEvent) {
    return (
      <EventDetailView
        event={selectedEvent}
        onBack={() => { setSelectedEvent(null); }}
        onOpenNoteEditor={(content, onSave) => setEventNoteEditor({ content, onSave })}
        transactionTypes={transactionTypes}
      />
    );
  }

  // ─── Render: Folder Detail (events inside a folder) ───
  if (selectedFolder) {
    return (
      <FolderDetailView
        folder={selectedFolder}
        onBack={() => { setSelectedFolder(null); fetchFolders(); }}
        onSelectEvent={setSelectedEvent}
        transactionTypes={transactionTypes}
      />
    );
  }

  // ─── Render: Folders List (default view) ───
  return (
    <div>
      {/* Add Folder Button */}
      <button className="btn-primary" style={{ width: '100%', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        onClick={() => { setShowAddFolder(true); setNewFolderName(''); setNewFolderDesc(''); }}>
        <IoAdd size={16} /> New Event Folder
      </button>

      {/* Add/Edit Folder Form */}
      {(showAddFolder || editingFolder) && (
        <div className="card" style={{ padding: '14px 16px', marginBottom: 12, background: 'rgba(118, 210, 219, 0.06)', border: '1px solid rgba(118, 210, 219, 0.2)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
            {editingFolder ? 'Edit Folder' : 'New Event Folder'}
          </div>
          <form onSubmit={editingFolder ? handleUpdateFolder : handleCreateFolder}>
            <input type="text" placeholder="Folder name *" value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)} autoFocus required
              style={{ width: '100%', marginBottom: 8 }} />
            <input type="text" placeholder="Description (optional)" value={newFolderDesc}
              onChange={(e) => setNewFolderDesc(e.target.value)}
              style={{ width: '100%', marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={folderSaving}>
                {folderSaving ? 'Saving...' : editingFolder ? 'Update' : 'Create Folder'}
              </button>
              <button type="button" className="btn-ghost" style={{ padding: '10px 14px' }}
                onClick={() => { setShowAddFolder(false); setEditingFolder(null); setNewFolderName(''); setNewFolderDesc(''); }}>
                <IoClose size={18} />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Folders List */}
      {foldersLoading ? <Spinner /> : folders.length === 0 ? (
        <EmptyState icon="folder" title="No event folders yet" subtitle="Create a folder to organize your events" />
      ) : (
        <div className="desktop-grid-2" style={{ display: 'grid', gap: 8 }}>
          {folders.map((f) => (
            <div key={f._id} className="card" style={{ padding: '12px 14px', cursor: 'pointer' }}
              onClick={() => setSelectedFolder(f)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <IoFolder size={22} color="var(--primary)" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{f.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>{f.eventCount || 0} event{f.eventCount !== 1 ? 's' : ''}</span>
                    {f.description && <span>· {f.description.length > 40 ? f.description.substring(0, 40) + '...' : f.description}</span>}
                  </div>
                </div>
                <button className="btn-ghost" style={{ padding: 4 }}
                  onClick={(e) => { e.stopPropagation(); setEditingFolder(f); setNewFolderName(f.name); setNewFolderDesc(f.description || ''); }}>
                  <IoCreate size={14} color="var(--text-muted)" />
                </button>
                <button className="btn-ghost" style={{ padding: 4 }}
                  onClick={(e) => { e.stopPropagation(); setConfirmDelFolder(f); }}>
                  <IoTrash size={14} color="var(--danger)" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal open={!!confirmDelFolder} onClose={() => setConfirmDelFolder(null)}
        onConfirm={handleDeleteFolder}
        title="Delete folder?"
        message={`Delete "${confirmDelFolder?.name}" and all its events, occasions, and entries?`} />
    </div>
  );
}

// ─── Folder Detail View (Events inside a folder) ───

function FolderDetailView({ folder, onBack, onSelectEvent, transactionTypes }) {
  const [tab, _setTab] = useState(() => sessionStorage.getItem('events_tab') || 'all');
  const setTab = useCallback((t) => { _setTab(t); sessionStorage.setItem('events_tab', t); }, []);

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEvents(folder._id);
      setEvents(res.data);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [folder._id]);

  useEffect(() => { fetchEvents(); }, []);

  return (
    <div>
      {/* Header */}
      <div className="card" style={{ padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn-ghost" style={{ padding: 4 }} onClick={onBack}>
            <IoArrowBack size={20} />
          </button>
          <IoFolderOpen size={20} color="var(--primary)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, wordBreak: 'break-word' }}>{folder.name}</h2>
            {folder.description && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{folder.description}</div>
            )}
          </div>
        </div>
      </div>

      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
        {[{ key: 'all', label: 'Events' }, { key: 'add', label: 'Add Event' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
            background: tab === t.key ? 'var(--primary)' : 'transparent',
            color: tab === t.key ? 'white' : 'var(--text-secondary)',
            transition: 'all 0.2s',
          }}>
            {t.key === 'all' && <IoCalendar size={13} style={{ marginRight: 4, verticalAlign: -2 }} />}
            {t.key === 'add' && <IoAdd size={13} style={{ marginRight: 4, verticalAlign: -2 }} />}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'all' && (
        <AllEventsList
          events={events}
          loading={loading}
          onRefresh={fetchEvents}
          onSelectEvent={onSelectEvent}
        />
      )}
      {tab === 'add' && (
        <AddEventForm
          folderId={folder._id}
          onCreated={() => { fetchEvents(); setTab('all'); }}
        />
      )}
    </div>
  );
}

// ─── Add Event Form ───

function AddEventForm({ folderId, onCreated }) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const [name, setName] = useState('');
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState(nowTime);
  const [reminder, setReminder] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Event name is required'); return; }
    setSaving(true);
    try {
      await createEvent({
        name: name.trim(),
        date: date || todayStr,
        time: time || nowTime,
        reminderEnabled: reminder,
        ...(folderId ? { folderId } : {}),
      });
      toast.success('Event created');
      setName(''); setDate(todayStr); setTime(nowTime); setReminder(false);
      onCreated();
    } catch (err) { toast.error(err.response?.data?.error || err.message); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Event Name *</label>
        <input type="text" placeholder="e.g., Wife's Birthday, Eid" value={name}
          onChange={(e) => setName(e.target.value)} required autoFocus />
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label>Time</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <label style={{ flex: 1, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          {reminder ? <IoNotifications size={18} color="var(--primary)" /> : <IoNotificationsOff size={18} color="var(--text-muted)" />}
          Yearly Reminder
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>(month & day only)</span>
        </label>
        <button type="button" onClick={() => setReminder(!reminder)}
          style={{
            width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
            background: reminder ? 'var(--primary)' : 'var(--border)',
            position: 'relative', transition: 'background 0.2s',
          }}>
          <span style={{
            position: 'absolute', top: 3, left: reminder ? 25 : 3,
            width: 20, height: 20, borderRadius: '50%', background: 'white',
            transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }} />
        </button>
      </div>
      {reminder && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, padding: '6px 10px', background: 'var(--primary)10', borderRadius: 6 }}>
          You'll be reminded every year on {date ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'the selected date'} via push notification and email (if enabled).
        </div>
      )}
      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? 'Creating...' : 'Create Event'}
      </button>
    </form>
  );
}

// ─── All Events List ───

function AllEventsList({ events, loading, onRefresh, onSelectEvent }) {
  const [confirmDel, setConfirmDel] = useState(null);

  const handleDelete = async () => {
    if (!confirmDel) return;
    try {
      await deleteEvent(confirmDel._id);
      toast.success('Event deleted');
      onRefresh();
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return <Spinner />;
  if (events.length === 0) return <EmptyState icon="calendar" title="No events yet" subtitle="Create your first event from the Add Event tab" />;

  return (
    <div className="desktop-grid-2" style={{ display: 'grid', gap: 8 }}>
      {events.map((evt) => (
        <div key={evt._id} className="card" style={{ padding: '12px 14px', cursor: 'pointer' }}
          onClick={() => onSelectEvent(evt)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{evt.name}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                <span><IoCalendar size={11} style={{ verticalAlign: -1, marginRight: 3 }} />{formatDate(evt.date)}</span>
                {evt.time && <span>{evt.time}</span>}
                {evt.reminderEnabled && (
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                    <IoNotifications size={11} style={{ verticalAlign: -1, marginRight: 2 }} />Reminder
                  </span>
                )}
              </div>
            </div>
            <button className="btn-ghost" style={{ padding: 4 }}
              onClick={(e) => { e.stopPropagation(); setConfirmDel(evt); }}>
              <IoTrash size={14} color="var(--danger)" />
            </button>
          </div>
        </div>
      ))}
      <ConfirmModal open={!!confirmDel} onClose={() => setConfirmDel(null)}
        onConfirm={handleDelete}
        title="Delete event?"
        message={`Delete "${confirmDel?.name}" and all its occasions/entries?`} />
    </div>
  );
}

// ─── Event Detail View (Occasions + Entries) ───

function EventDetailView({ event, onBack, onOpenNoteEditor, transactionTypes }) {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [askContainerName, setAskContainerName] = useState(false);
  const [containerName, setContainerName] = useState('');
  const [containerDate, setContainerDate] = useState('');
  const [containerTime, setContainerTime] = useState('');
  const [expandedContainer, setExpandedContainer] = useState(null);
  const [entries, setEntries] = useState({});
  const [editingEvent, setEditingEvent] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [eventNotes, setEventNotes] = useState(event.notes || '');
  const [showNotes, setShowNotes] = useState(false);

  // Helper to get current PKT date/time strings
  const getNowPKT = () => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
    return {
      date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    };
  };

  // Entry form state - default to first type (Given)
  const [entryForm, setEntryForm] = useState({ name: '', type: transactionTypes[0] || 'Given', amount: '' });
  const [entrySaving, setEntrySaving] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [confirmDelEntry, setConfirmDelEntry] = useState(null);

  useBackClose(!!askContainerName, () => setAskContainerName(false));
  useBackClose(!!editingEvent, () => setEditingEvent(false));

  const fetchContainers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEventContainers(event._id);
      setContainers(res.data);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [event._id]);

  useEffect(() => { fetchContainers(); }, []);

  const fetchEntries = useCallback(async (containerId) => {
    try {
      const res = await getEventEntries(containerId);
      setEntries(prev => ({ ...prev, [containerId]: res.data }));
    } catch (err) { toast.error(err.message); }
  }, []);

  const handleToggleContainer = (containerId) => {
    if (expandedContainer === containerId) {
      setExpandedContainer(null);
    } else {
      setExpandedContainer(containerId);
      if (!entries[containerId]) fetchEntries(containerId);
      setEntryForm({ name: '', type: transactionTypes[0] || 'Given', amount: '' });
      setEditingEntry(null);
    }
  };

  const handleCreateContainer = async (e) => {
    e.preventDefault();
    if (!containerName.trim()) return;
    try {
      await createEventContainer(event._id, { name: containerName.trim(), date: containerDate, time: containerTime });
      toast.success('Occasion created');
      setContainerName('');
      setContainerDate('');
      setContainerTime('');
      setAskContainerName(false);
      fetchContainers();
    } catch (err) { toast.error(err.response?.data?.error || err.message); }
  };

  const handleDeleteContainer = async () => {
    if (!confirmDel) return;
    try {
      await deleteEventContainer(confirmDel._id);
      toast.success('Occasion deleted');
      if (expandedContainer === confirmDel._id) setExpandedContainer(null);
      fetchContainers();
    } catch (err) { toast.error(err.message); }
  };

  const handleAddEntry = async (e) => {
    e.preventDefault();
    if (!entryForm.name.trim() || !entryForm.amount) { toast.error('Name and amount are required'); return; }
    setEntrySaving(true);
    try {
      if (editingEntry) {
        await updateEventEntry(editingEntry._id, { name: entryForm.name.trim(), type: entryForm.type, amount: Number(entryForm.amount) });
        toast.success('Entry updated');
        setEditingEntry(null);
      } else {
        await createEventEntry(expandedContainer, { name: entryForm.name.trim(), type: entryForm.type, amount: Number(entryForm.amount) });
        toast.success('Entry added');
      }
      setEntryForm({ name: '', type: transactionTypes[0] || 'Given', amount: '' });
      fetchEntries(expandedContainer);
      fetchContainers();
    } catch (err) { toast.error(err.response?.data?.error || err.message); }
    finally { setEntrySaving(false); }
  };

  const handleDeleteEntry = async () => {
    if (!confirmDelEntry) return;
    try {
      await deleteEventEntry(confirmDelEntry._id);
      toast.success('Entry deleted');
      fetchEntries(expandedContainer);
      fetchContainers();
    } catch (err) { toast.error(err.message); }
  };

  const startEditEntry = (entry) => {
    setEditingEntry(entry);
    setEntryForm({ name: entry.name, type: entry.type, amount: String(entry.amount) });
  };

  return (
    <div>
      {/* Header */}
      <div className="card" style={{ padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <button className="btn-ghost" style={{ padding: 4, marginTop: 2 }} onClick={onBack}>
            <IoArrowBack size={20} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px 0', wordBreak: 'break-word' }}>{event.name}</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <IoCalendar size={12} /> {formatDate(event.date)}
              </span>
              {event.time && <span>{event.time}</span>}
              {event.reminderEnabled && (
                <span style={{ color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <IoNotifications size={12} /> Yearly Reminder
                </span>
              )}
            </div>
          </div>
          <button className="btn-ghost" style={{ padding: 6 }}
            onClick={() => setEditingEvent(true)}>
            <IoCreate size={18} color="var(--text-muted)" />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            onClick={() => { const n = getNowPKT(); setContainerDate(n.date); setContainerTime(n.time); setAskContainerName(true); }}>
            <IoAdd size={16} /> New Occasion
          </button>
          <button className="btn-ghost" style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}
            onClick={() => setShowNotes(!showNotes)}>
            <IoDocumentText size={14} color="var(--primary)" /> Notes {eventNotes ? '(1)' : ''}
          </button>
        </div>
      </div>

      {/* Event Notes */}
      {showNotes && (
        <div className="card" style={{ padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Event Notes</span>
            <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}
              onClick={() => onOpenNoteEditor(eventNotes, async (html) => {
                setEventNotes(html);
                try {
                  await updateEvent(event._id, { notes: html });
                } catch (err) { toast.error(err.message); }
              })}>
              {eventNotes ? 'Edit' : 'Add Note'}
            </button>
          </div>
          {eventNotes ? (
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', wordBreak: 'break-word' }}
              dangerouslySetInnerHTML={{ __html: eventNotes }} />
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: 10 }}>
              No notes yet. Tap "Add Note" to write.
            </div>
          )}
        </div>
      )}

      {/* Occasion Name Prompt */}
      {askContainerName && (
        <div className="card" style={{ padding: '14px 16px', marginBottom: 12, background: 'rgba(118, 210, 219, 0.06)', border: '1px solid rgba(118, 210, 219, 0.2)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Enter occasion name</div>
          <form onSubmit={handleCreateContainer}>
            <input type="text" placeholder="e.g., Eid 2026, Birthday 2026" value={containerName}
              onChange={(e) => setContainerName(e.target.value)} autoFocus
              style={{ width: '100%', marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input type="date" value={containerDate} onChange={(e) => setContainerDate(e.target.value)}
                style={{ flex: 1 }} />
              <input type="time" value={containerTime} onChange={(e) => setContainerTime(e.target.value)}
                style={{ flex: 1 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>Create Occasion</button>
              <button type="button" className="btn-ghost" onClick={() => { setAskContainerName(false); setContainerName(''); setContainerDate(''); setContainerTime(''); }}
                style={{ padding: '10px 14px' }}><IoClose size={18} /></button>
            </div>
          </form>
        </div>
      )}

      {/* Occasions */}
      {loading ? <Spinner /> : containers.length === 0 ? (
        <EmptyState icon="folder" title="No occasions yet" subtitle="Create an occasion to start tracking entries" />
      ) : (
        <div className="desktop-grid-2" style={{ display: 'grid', gap: 8 }}>
          {containers.map((c) => {
            const isExpanded = expandedContainer === c._id;
            const cEntries = entries[c._id] || [];
            return (
              <div key={c._id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Occasion Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px',
                  cursor: 'pointer', borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
                }}
                  onClick={() => handleToggleContainer(c._id)}>
                  {isExpanded ? <IoChevronDown size={16} color="var(--primary)" /> : <IoChevronForward size={16} color="var(--text-muted)" />}
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                      {c.entryCount || 0} entries
                    </span>
                    {(c.date || c.time) && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        {c.date ? new Date(c.date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' }) : ''}
                        {c.date && c.time ? ' · ' : ''}{c.time || ''}
                      </div>
                    )}
                    {c.summary && Object.keys(c.summary).length > 0 && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                        {Object.entries(c.summary).map(([type, total]) => (
                          <span key={type} style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            {type}: {formatPKR(total)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatDate(c.createdAt)}</span>
                  <button className="btn-ghost" style={{ padding: 2 }}
                    onClick={(e) => { e.stopPropagation(); setConfirmDel(c); }}>
                    <IoTrash size={13} color="var(--danger)" />
                  </button>
                </div>

                {/* Expanded: Entry Form + Entries List */}
                {isExpanded && (
                  <div style={{ padding: '12px 14px' }}>
                    {/* Entry Form */}
                    <form onSubmit={handleAddEntry} style={{ marginBottom: 14 }}>
                      <div className="form-group" style={{ marginBottom: 8 }}>
                        <input type="text" placeholder="Name (e.g., Rehan)" value={entryForm.name}
                          onChange={(e) => setEntryForm(p => ({ ...p, name: e.target.value }))}
                          style={{ width: '100%' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <select value={entryForm.type}
                          onChange={(e) => setEntryForm(p => ({ ...p, type: e.target.value }))}
                          style={{ flex: 1 }}>
                          {transactionTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input type="number" placeholder="Amount (PKR)" value={entryForm.amount}
                          onChange={(e) => setEntryForm(p => ({ ...p, amount: e.target.value }))}
                          style={{ flex: 1 }} min="0" />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={entrySaving}>
                          {editingEntry ? 'Update Entry' : 'Add Entry'}
                        </button>
                        {editingEntry && (
                          <button type="button" className="btn-ghost" style={{ padding: '10px 14px' }}
                            onClick={() => { setEditingEntry(null); setEntryForm({ name: '', type: transactionTypes[0] || 'Given', amount: '' }); }}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>

                    {/* Entries List */}
                    {cEntries.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 10 }}>
                        No entries yet
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: 4 }}>
                        {cEntries.map((entry) => (
                          <div key={entry._id} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 10px', borderRadius: 6,
                            background: entry.type.toLowerCase() === 'received' ? 'rgba(34, 197, 94, 0.06)' : 'rgba(239, 68, 68, 0.06)',
                            border: '1px solid var(--border)',
                          }}>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: 13, fontWeight: 500 }}>{entry.name}</span>
                              <span style={{
                                marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '1px 6px',
                                borderRadius: 4,
                                background: entry.type.toLowerCase() === 'received' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: entry.type.toLowerCase() === 'received' ? '#22c55e' : '#ef4444',
                              }}>{entry.type}</span>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{formatPKR(entry.amount)}</span>
                            <button className="btn-ghost" style={{ padding: 2 }}
                              onClick={() => startEditEntry(entry)}>
                              <IoCreate size={12} color="var(--text-muted)" />
                            </button>
                            <button className="btn-ghost" style={{ padding: 2 }}
                              onClick={() => setConfirmDelEntry(entry)}>
                              <IoTrash size={12} color="var(--danger)" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Event Modal */}
      {editingEvent && (
        <EditEventModal event={event} onClose={() => setEditingEvent(false)} onDone={() => { setEditingEvent(false); onBack(); }} />
      )}

      <ConfirmModal open={!!confirmDel} onClose={() => setConfirmDel(null)}
        onConfirm={handleDeleteContainer}
        title="Delete occasion?"
        message={`Delete "${confirmDel?.name}" and all its entries?`} />
      <ConfirmModal open={!!confirmDelEntry} onClose={() => setConfirmDelEntry(null)}
        onConfirm={handleDeleteEntry}
        title="Delete entry?"
        message={`Delete entry "${confirmDelEntry?.name}" (${confirmDelEntry?.type} ${formatPKR(confirmDelEntry?.amount || 0)})?`} />
    </div>
  );
}

// ─── Edit Event Modal ───

function EditEventModal({ event, onClose, onDone }) {
  const [name, setName] = useState(event.name);
  const [date, setDate] = useState(event.date ? new Date(event.date).toISOString().split('T')[0] : '');
  const [time, setTime] = useState(event.time || '');
  const [reminder, setReminder] = useState(event.reminderEnabled || false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateEvent(event._id, { name, date, time, reminderEnabled: reminder });
      toast.success('Event updated');
      onDone();
    } catch (err) { toast.error(err.response?.data?.error || err.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={true} onClose={onClose} title="Edit Event">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Event Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>Time</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ flex: 1, margin: 0 }}>Yearly Reminder</label>
          <button type="button" onClick={() => setReminder(!reminder)}
            style={{
              width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
              background: reminder ? 'var(--primary)' : 'var(--border)',
              position: 'relative', transition: 'background 0.2s',
            }}>
            <span style={{
              position: 'absolute', top: 3, left: reminder ? 25 : 3,
              width: 20, height: 20, borderRadius: '50%', background: 'white',
              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
          </button>
        </div>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </Modal>
  );
}

// ─── Rich Note Editor (Full-Screen, reusable) ───

const COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#9B59B6', '#FF8C00', '#1A1A2E', '#F1F1F6'];
const FONT_SIZES = [
  { label: 'Small', value: '2' },
  { label: 'Normal', value: '3' },
  { label: 'Large', value: '5' },
  { label: 'Huge', value: '7' },
];
const HEADING_OPTIONS = [
  { label: 'Paragraph', tag: 'p' },
  { label: 'Heading 1', tag: 'h1' },
  { label: 'Heading 2', tag: 'h2' },
  { label: 'Heading 3', tag: 'h3' },
];

function RichNoteEditor({ initialContent, onSave, onClose }) {
  const editorRef = useRef(null);
  const savedSelection = useRef(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showFontSize, setShowFontSize] = useState(false);
  const [showHeading, setShowHeading] = useState(false);
  const [customColor, setCustomColor] = useState('#3AAFB9');

  useEffect(() => {
    if (editorRef.current && initialContent) editorRef.current.innerHTML = initialContent;
    setTimeout(() => editorRef.current?.focus(), 100);
  }, []);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) savedSelection.current = sel.getRangeAt(0);
  };

  const restoreSelection = () => {
    if (savedSelection.current) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedSelection.current);
    }
  };

  const execCmd = (cmd, value = null) => {
    restoreSelection();
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  };

  const closeAllPickers = () => {
    setShowColorPicker(false);
    setShowHighlightPicker(false);
    setShowFontSize(false);
    setShowHeading(false);
  };

  const toolBtn = (active) => ({
    padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
    background: active ? 'var(--primary)' + '25' : 'transparent',
    color: active ? 'var(--primary)' : 'var(--text-secondary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 32, height: 32, position: 'relative',
  });

  const dropdownStyle = {
    position: 'absolute', top: '100%', left: 0, zIndex: 20,
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 8, padding: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
    marginTop: 4,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'var(--bg)', display: 'flex', flexDirection: 'column',
    }}>
      {/* Top Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-card)', flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 4, display: 'flex', color: 'var(--text-secondary)',
        }}>
          <IoArrowBack size={22} />
        </button>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Edit Notes</span>
        <button onClick={() => onSave(editorRef.current?.innerHTML || '')}
          style={{
            padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 700,
          }}>
          Done
        </button>
      </div>

      {/* Formatting Toolbar */}
      <div style={{
        display: 'flex', gap: 2, padding: '6px 8px',
        borderBottom: '1px solid var(--border)', background: 'var(--bg-card)',
        overflowX: 'auto', flexShrink: 0, alignItems: 'center',
        WebkitOverflowScrolling: 'touch',
      }}
        onClick={() => closeAllPickers()}>
        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
          <button style={toolBtn(showHeading)}
            onClick={() => { saveSelection(); closeAllPickers(); setShowHeading(!showHeading); }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>H</span>
          </button>
          {showHeading && (
            <div style={{ ...dropdownStyle, minWidth: 130 }}>
              {HEADING_OPTIONS.map(h => (
                <button key={h.tag} onClick={() => { execCmd('formatBlock', h.tag); setShowHeading(false); }}
                  style={{
                    display: 'block', width: '100%', padding: '6px 10px', border: 'none',
                    background: 'transparent', cursor: 'pointer', textAlign: 'left',
                    fontSize: h.tag === 'p' ? 13 : h.tag === 'h3' ? 14 : h.tag === 'h2' ? 16 : 18,
                    fontWeight: h.tag === 'p' ? 400 : 700, color: 'var(--text)', borderRadius: 4,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {h.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
        <button style={toolBtn()} onClick={() => execCmd('bold')}><span style={{ fontWeight: 900, fontSize: 14 }}>B</span></button>
        <button style={toolBtn()} onClick={() => execCmd('italic')}><span style={{ fontStyle: 'italic', fontSize: 14, fontWeight: 500 }}>I</span></button>
        <button style={toolBtn()} onClick={() => execCmd('underline')}><span style={{ textDecoration: 'underline', fontSize: 14 }}>U</span></button>
        <button style={toolBtn()} onClick={() => execCmd('strikeThrough')}><span style={{ textDecoration: 'line-through', fontSize: 14 }}>S</span></button>
        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
          <button style={toolBtn(showFontSize)}
            onClick={() => { saveSelection(); closeAllPickers(); setShowFontSize(!showFontSize); }}>
            <span style={{ fontSize: 11, fontWeight: 600 }}>A<span style={{ fontSize: 8 }}>A</span></span>
          </button>
          {showFontSize && (
            <div style={{ ...dropdownStyle, minWidth: 100 }}>
              {FONT_SIZES.map(f => (
                <button key={f.value} onClick={() => { execCmd('fontSize', f.value); setShowFontSize(false); }}
                  style={{
                    display: 'block', width: '100%', padding: '6px 10px', border: 'none',
                    background: 'transparent', cursor: 'pointer', textAlign: 'left',
                    fontSize: 13, color: 'var(--text)', borderRadius: 4,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
          <button style={toolBtn(showColorPicker)}
            onClick={() => { saveSelection(); closeAllPickers(); setShowColorPicker(!showColorPicker); }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>A<span style={{
              display: 'block', height: 3, background: customColor, borderRadius: 1, marginTop: -2,
            }} /></span>
          </button>
          {showColorPicker && (
            <div style={{ ...dropdownStyle, display: 'flex', gap: 4, flexWrap: 'wrap', width: 164 }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => { execCmd('foreColor', c); setCustomColor(c); setShowColorPicker(false); }}
                  style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--border)', background: c, cursor: 'pointer' }} />
              ))}
              <input type="color" value={customColor}
                onChange={e => { execCmd('foreColor', e.target.value); setCustomColor(e.target.value); setShowColorPicker(false); }}
                style={{ width: 28, height: 28, padding: 0, border: 'none', cursor: 'pointer', borderRadius: '50%' }} />
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
          <button style={toolBtn(showHighlightPicker)}
            onClick={() => { saveSelection(); closeAllPickers(); setShowHighlightPicker(!showHighlightPicker); }}>
            <span style={{ fontSize: 13, fontWeight: 700, background: '#FFD93D50', padding: '0 3px', borderRadius: 2 }}>H</span>
          </button>
          {showHighlightPicker && (
            <div style={{ ...dropdownStyle, display: 'flex', gap: 4, flexWrap: 'wrap', width: 164 }}>
              {['#FFD93D', '#FF6B6B', '#6BCB77', '#4D96FF', '#9B59B6', '#FF8C00', 'transparent'].map(c => (
                <button key={c} onClick={() => { execCmd('hiliteColor', c); setShowHighlightPicker(false); }}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                    border: '2px solid var(--border)',
                    background: c === 'transparent' ? 'var(--bg-input)' : c + '80',
                  }}>
                  {c === 'transparent' && <IoClose size={14} style={{ color: 'var(--text-muted)' }} />}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
        <button style={toolBtn()} onClick={() => execCmd('insertUnorderedList')}><span style={{ fontSize: 14 }}>&#8226;</span></button>
        <button style={toolBtn()} onClick={() => execCmd('insertOrderedList')}><span style={{ fontSize: 12, fontWeight: 600 }}>1.</span></button>
        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
        <button style={toolBtn()} onClick={() => execCmd('indent')} title="Indent"><span style={{ fontSize: 13 }}>&rarr;</span></button>
        <button style={toolBtn()} onClick={() => execCmd('outdent')} title="Outdent"><span style={{ fontSize: 13 }}>&larr;</span></button>
        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
        <button style={toolBtn()} onClick={() => execCmd('justifyLeft')}><span style={{ fontSize: 11, lineHeight: 1 }}>&#9776;</span></button>
        <button style={toolBtn()} onClick={() => execCmd('justifyCenter')}><span style={{ fontSize: 11, lineHeight: 1, textAlign: 'center', display: 'block' }}>&#9776;</span></button>
        <button style={toolBtn()} onClick={() => execCmd('justifyRight')}><span style={{ fontSize: 11, lineHeight: 1 }}>&#9776;</span></button>
        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
        <button style={toolBtn()} onClick={() => execCmd('formatBlock', 'blockquote')}><span style={{ fontSize: 16, fontWeight: 700, fontStyle: 'italic', color: 'var(--text-muted)' }}>&ldquo;</span></button>
        <button style={toolBtn()} onClick={() => execCmd('insertHorizontalRule')}><span style={{ fontSize: 11, letterSpacing: 2 }}>&#8212;</span></button>
        <button style={toolBtn()} onClick={() => execCmd('removeFormat')}><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>T<span style={{ fontSize: 9 }}>x</span></span></button>
        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
        <button style={toolBtn()} onClick={() => execCmd('undo')} title="Undo"><span style={{ fontSize: 14 }}>&#8630;</span></button>
        <button style={toolBtn()} onClick={() => execCmd('redo')} title="Redo"><span style={{ fontSize: 14 }}>&#8631;</span></button>
      </div>

      {/* Editor Area */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}
        onClick={() => { closeAllPickers(); editorRef.current?.focus(); }}>
        <div ref={editorRef} contentEditable suppressContentEditableWarning
          onBlur={saveSelection}
          style={{
            minHeight: '100%', padding: '16px 14px', paddingBottom: 80,
            color: 'var(--text)', fontSize: 15, lineHeight: 1.75,
            outline: 'none', wordBreak: 'break-word',
            maxWidth: 'var(--max-width)', margin: '0 auto',
          }}
          data-placeholder="Start writing..."
        />
      </div>
    </div>
  );
}

// ─── Preset Colors ───

const PRESET_COLORS = [
  { name: 'Teal', hex: '#3AAFB9' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Pink', hex: '#ec4899' },
];

// ─── Create Topic Modal ───

function CreateTopicModal({ open, onClose, onDone }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3AAFB9');
  const [hexInput, setHexInput] = useState('#3AAFB9');
  const [loading, setLoading] = useState(false);
  const colorPickerRef = useRef(null);

  const handleColorChange = (c) => { setColor(c); setHexInput(c); };
  const handleHexInput = (val) => { setHexInput(val); if (/^#[0-9A-Fa-f]{6}$/.test(val)) setColor(val); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createTopic({ name, color });
      toast.success('Topic created');
      setName(''); setColor('#3AAFB9'); setHexInput('#3AAFB9');
      onClose(); onDone();
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Topic">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Topic Name</label>
          <input type="text" placeholder="e.g., Computer Science" value={name}
            onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Topic Color</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {PRESET_COLORS.map((p) => (
              <button key={p.hex} type="button" onClick={() => handleColorChange(p.hex)}
                title={p.name} style={{
                  width: 28, height: 28, borderRadius: '50%', border: color === p.hex ? '3px solid var(--text-primary)' : '2px solid var(--border)',
                  background: p.hex, cursor: 'pointer', padding: 0,
                }} />
            ))}
            <button type="button" onClick={() => colorPickerRef.current?.click()}
              title="Custom color" style={{
                width: 28, height: 28, borderRadius: '50%', border: '2px dashed var(--border)',
                background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', fontSize: 16, padding: 0,
              }}>+</button>
            <input ref={colorPickerRef} type="color" value={color} onChange={(e) => handleColorChange(e.target.value)}
              style={{ position: 'fixed', top: -100, left: -100, width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 20, height: 20, borderRadius: '50%', background: color, flexShrink: 0, border: '1px solid var(--border)' }} />
            <input type="text" value={hexInput} onChange={(e) => handleHexInput(e.target.value)}
              placeholder="#3AAFB9" style={{ flex: 1, fontSize: 13, fontFamily: 'monospace', padding: '4px 8px' }} />
          </div>
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Creating...' : 'Create Topic'}
        </button>
      </form>
    </Modal>
  );
}

// ─── Create SubTopic Modal ───

function CreateSubTopicModal({ open, topicId, onClose, onDone }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createSubTopic(topicId, { name });
      toast.success('SubTopic created');
      setName('');
      onClose(); onDone();
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create SubTopic">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>SubTopic Name</label>
          <input type="text" placeholder="e.g., Data Structures" value={name}
            onChange={(e) => setName(e.target.value)} required />
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Creating...' : 'Create SubTopic'}
        </button>
      </form>
    </Modal>
  );
}

// ─── Note Editor (Full-Screen Professional Editor) ───

function NoteEditorModal({ note, subTopicId, allTags, onClose, onDone, onTagsChanged }) {
  const [title, setTitle] = useState(note?.title || '');
  const [selectedTags, setSelectedTags] = useState(note?.tags?.map((t) => t._id) || []);
  const [loading, setLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(note?.locked || false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showFontSize, setShowFontSize] = useState(false);
  const [showHeading, setShowHeading] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [customColor, setCustomColor] = useState('#3AAFB9');
  const editorRef = useRef(null);
  const savedSelection = useRef(null);

  useEffect(() => {
    if (editorRef.current && note?.description) editorRef.current.innerHTML = note.description;
    setTimeout(() => editorRef.current?.focus(), 100);
  }, []);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) savedSelection.current = sel.getRangeAt(0);
  };

  const restoreSelection = () => {
    if (savedSelection.current) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedSelection.current);
    }
  };

  const execCmd = (cmd, value = null) => {
    restoreSelection();
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  };

  const closeAllPickers = () => {
    setShowColorPicker(false);
    setShowHighlightPicker(false);
    setShowFontSize(false);
    setShowHeading(false);
  };

  const toggleTag = (tagId) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSave = async () => {
    if (isLocked) { toast.error('This note is locked'); return; }
    if (!title.trim()) { toast.error('Title is required'); return; }
    setLoading(true);
    try {
      const data = { title, description: editorRef.current?.innerHTML || '', tags: selectedTags };
      if (note?._id) { await updateNote(note._id, data); toast.success('Note updated'); }
      else { await createNote(subTopicId, data); toast.success('Note created'); }
      onClose(); onDone();
    } catch (err) { toast.error(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  };

  const handleToggleLock = async () => {
    if (!note?._id) return;
    try {
      await updateNote(note._id, { locked: !isLocked });
      setIsLocked(!isLocked);
      toast.success(isLocked ? 'Note unlocked' : 'Note locked');
      onDone();
    } catch (err) { toast.error(err.message); }
  };

  const toolBtn = (active) => ({
    padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
    background: active ? 'var(--primary)' + '25' : 'transparent',
    color: active ? 'var(--primary)' : 'var(--text-secondary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 32, height: 32, position: 'relative',
  });

  const dropdownStyle = {
    position: 'absolute', top: '100%', left: 0, zIndex: 20,
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 8, padding: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
    marginTop: 4,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'var(--bg)', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-card)', flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 4, display: 'flex', color: 'var(--text-secondary)',
        }}>
          <IoArrowBack size={22} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input type="text" placeholder="Note title..." value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              width: '100%', border: 'none', background: 'transparent',
              fontSize: 16, fontWeight: 700, color: 'var(--text)',
              outline: 'none', padding: '4px 0',
            }} />
        </div>
        {note?._id && (
          <button onClick={handleToggleLock}
            style={{
              padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: isLocked ? 'var(--warning)' + '20' : 'transparent',
              color: isLocked ? 'var(--warning)' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
            }}>
            {isLocked ? <IoLockClosed size={16} /> : <IoLockOpen size={16} />}
          </button>
        )}
        {!isLocked && (
          <button onClick={handleSave} disabled={loading}
            style={{
              padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 700,
              opacity: loading ? 0.6 : 1,
            }}>
            {loading ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>

      {/* Formatting Toolbar */}
      <div style={{
        display: 'flex', gap: 2, padding: '6px 8px',
        borderBottom: '1px solid var(--border)', background: 'var(--bg-card)',
        overflowX: 'auto', flexShrink: 0, alignItems: 'center',
        WebkitOverflowScrolling: 'touch',
      }}
        onClick={() => closeAllPickers()}>
        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
          <button style={toolBtn(showHeading)}
            onClick={() => { saveSelection(); closeAllPickers(); setShowHeading(!showHeading); }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>H</span>
          </button>
          {showHeading && (
            <div style={{ ...dropdownStyle, minWidth: 130 }}>
              {HEADING_OPTIONS.map(h => (
                <button key={h.tag} onClick={() => { execCmd('formatBlock', h.tag); setShowHeading(false); }}
                  style={{
                    display: 'block', width: '100%', padding: '6px 10px', border: 'none',
                    background: 'transparent', cursor: 'pointer', textAlign: 'left',
                    fontSize: h.tag === 'p' ? 13 : h.tag === 'h3' ? 14 : h.tag === 'h2' ? 16 : 18,
                    fontWeight: h.tag === 'p' ? 400 : 700, color: 'var(--text)', borderRadius: 4,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {h.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
        <button style={toolBtn()} onClick={() => execCmd('bold')}><span style={{ fontWeight: 900, fontSize: 14 }}>B</span></button>
        <button style={toolBtn()} onClick={() => execCmd('italic')}><span style={{ fontStyle: 'italic', fontSize: 14, fontWeight: 500 }}>I</span></button>
        <button style={toolBtn()} onClick={() => execCmd('underline')}><span style={{ textDecoration: 'underline', fontSize: 14 }}>U</span></button>
        <button style={toolBtn()} onClick={() => execCmd('strikeThrough')}><span style={{ textDecoration: 'line-through', fontSize: 14 }}>S</span></button>
        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
          <button style={toolBtn(showFontSize)}
            onClick={() => { saveSelection(); closeAllPickers(); setShowFontSize(!showFontSize); }}>
            <span style={{ fontSize: 11, fontWeight: 600 }}>A<span style={{ fontSize: 8 }}>A</span></span>
          </button>
          {showFontSize && (
            <div style={{ ...dropdownStyle, minWidth: 100 }}>
              {FONT_SIZES.map(f => (
                <button key={f.value} onClick={() => { execCmd('fontSize', f.value); setShowFontSize(false); }}
                  style={{
                    display: 'block', width: '100%', padding: '6px 10px', border: 'none',
                    background: 'transparent', cursor: 'pointer', textAlign: 'left',
                    fontSize: 13, color: 'var(--text)', borderRadius: 4,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
          <button style={toolBtn(showColorPicker)}
            onClick={() => { saveSelection(); closeAllPickers(); setShowColorPicker(!showColorPicker); }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>A<span style={{
              display: 'block', height: 3, background: customColor, borderRadius: 1, marginTop: -2,
            }} /></span>
          </button>
          {showColorPicker && (
            <div style={{ ...dropdownStyle, display: 'flex', gap: 4, flexWrap: 'wrap', width: 164 }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => { execCmd('foreColor', c); setCustomColor(c); setShowColorPicker(false); }}
                  style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--border)', background: c, cursor: 'pointer' }} />
              ))}
              <input type="color" value={customColor}
                onChange={e => { execCmd('foreColor', e.target.value); setCustomColor(e.target.value); setShowColorPicker(false); }}
                style={{ width: 28, height: 28, padding: 0, border: 'none', cursor: 'pointer', borderRadius: '50%' }} />
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
          <button style={toolBtn(showHighlightPicker)}
            onClick={() => { saveSelection(); closeAllPickers(); setShowHighlightPicker(!showHighlightPicker); }}>
            <span style={{ fontSize: 13, fontWeight: 700, background: '#FFD93D50', padding: '0 3px', borderRadius: 2 }}>H</span>
          </button>
          {showHighlightPicker && (
            <div style={{ ...dropdownStyle, display: 'flex', gap: 4, flexWrap: 'wrap', width: 164 }}>
              {['#FFD93D', '#FF6B6B', '#6BCB77', '#4D96FF', '#9B59B6', '#FF8C00', 'transparent'].map(c => (
                <button key={c} onClick={() => { execCmd('hiliteColor', c); setShowHighlightPicker(false); }}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                    border: '2px solid var(--border)',
                    background: c === 'transparent' ? 'var(--bg-input)' : c + '80',
                  }}>
                  {c === 'transparent' && <IoClose size={14} style={{ color: 'var(--text-muted)' }} />}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
        <button style={toolBtn()} onClick={() => execCmd('insertUnorderedList')}><span style={{ fontSize: 14 }}>&#8226;</span></button>
        <button style={toolBtn()} onClick={() => execCmd('insertOrderedList')}><span style={{ fontSize: 12, fontWeight: 600 }}>1.</span></button>
        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
        <button style={toolBtn()} onClick={() => execCmd('indent')} title="Indent"><span style={{ fontSize: 13 }}>&rarr;</span></button>
        <button style={toolBtn()} onClick={() => execCmd('outdent')} title="Outdent"><span style={{ fontSize: 13 }}>&larr;</span></button>
        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
        <button style={toolBtn()} onClick={() => execCmd('justifyLeft')}><span style={{ fontSize: 11, lineHeight: 1 }}>&#9776;</span></button>
        <button style={toolBtn()} onClick={() => execCmd('justifyCenter')}><span style={{ fontSize: 11, lineHeight: 1, textAlign: 'center', display: 'block' }}>&#9776;</span></button>
        <button style={toolBtn()} onClick={() => execCmd('justifyRight')}><span style={{ fontSize: 11, lineHeight: 1 }}>&#9776;</span></button>
        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
        <button style={toolBtn()} onClick={() => execCmd('formatBlock', 'blockquote')}><span style={{ fontSize: 16, fontWeight: 700, fontStyle: 'italic', color: 'var(--text-muted)' }}>&ldquo;</span></button>
        <button style={toolBtn()} onClick={() => execCmd('insertHorizontalRule')}><span style={{ fontSize: 11, letterSpacing: 2 }}>&#8212;</span></button>
        <button style={toolBtn()} onClick={() => execCmd('removeFormat')}><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>T<span style={{ fontSize: 9 }}>x</span></span></button>
        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
        <button style={toolBtn()} onClick={() => execCmd('undo')} title="Undo"><span style={{ fontSize: 14 }}>&#8630;</span></button>
        <button style={toolBtn()} onClick={() => execCmd('redo')} title="Redo"><span style={{ fontSize: 14 }}>&#8631;</span></button>
      </div>

      {/* Editor Area */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}
        onClick={() => { closeAllPickers(); editorRef.current?.focus(); }}>
        <div ref={editorRef} contentEditable suppressContentEditableWarning
          onBlur={saveSelection}
          style={{
            minHeight: '100%', padding: '16px 14px', paddingBottom: 80,
            color: 'var(--text)', fontSize: 15, lineHeight: 1.75,
            outline: 'none', wordBreak: 'break-word',
            maxWidth: 'var(--max-width)', margin: '0 auto',
          }}
          data-placeholder="Start writing..."
        />
      </div>

      {/* Bottom Bar */}
      <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
        {showTags && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', maxHeight: 120, overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {allTags.map((tag) => (
                <button key={tag._id} type="button" onClick={() => toggleTag(tag._id)}
                  style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    border: selectedTags.includes(tag._id) ? `2px solid ${tag.color}` : '2px solid transparent',
                    background: selectedTags.includes(tag._id) ? tag.color + '30' : 'var(--bg-input)',
                    color: selectedTags.includes(tag._id) ? tag.color : 'var(--text-muted)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  {tag.name}
                </button>
              ))}
              {allTags.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No tags yet</span>}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', gap: 12 }}>
          <button onClick={() => setShowTags(!showTags)}
            style={{
              background: showTags ? 'var(--primary)' + '20' : 'transparent',
              border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 6,
              display: 'flex', alignItems: 'center', gap: 4,
              color: showTags ? 'var(--primary)' : 'var(--text-muted)', fontSize: 12, fontWeight: 600,
            }}>
            <IoPricetag size={14} /> Tags
            {selectedTags.length > 0 && (
              <span style={{
                background: 'var(--primary)', color: 'white', fontSize: 10, fontWeight: 700,
                padding: '1px 6px', borderRadius: 10, marginLeft: 2,
              }}>{selectedTags.length}</span>
            )}
          </button>
          <div style={{ flex: 1 }} />
          {note?.updatedAt && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              Edited: {formatDateTime(note.updatedAt)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tag Manager Modal ───

function TagManagerModal({ open, tags, onClose, onDone }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3AAFB9');
  const [loading, setLoading] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [confirmDeleteTag, setConfirmDeleteTag] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      if (editingTag) {
        await updateTag(editingTag._id, { name, color });
        toast.success('Tag updated');
        setEditingTag(null);
      } else {
        await createTag({ name, color });
        toast.success('Tag created');
      }
      setName(''); setColor('#3AAFB9');
      onDone();
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const handleDeleteTag = async () => {
    if (!confirmDeleteTag) return;
    try {
      await deleteTag(confirmDeleteTag._id);
      toast.success('Tag deleted');
      onDone();
    } catch (err) { toast.error(err.message); }
  };

  const startEdit = (tag) => { setEditingTag(tag); setName(tag.name); setColor(tag.color); };

  return (
    <Modal open={open} onClose={() => { setEditingTag(null); setName(''); onClose(); }} title="Manage Tags">
      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
          style={{ width: 40, height: 40, padding: 2, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }} />
        <input type="text" placeholder="Tag name" value={name}
          onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
        <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 16px' }} disabled={loading}>
          {editingTag ? 'Update' : 'Add'}
        </button>
        {editingTag && (
          <button type="button" className="btn-ghost" onClick={() => { setEditingTag(null); setName(''); setColor('#3AAFB9'); }}
            style={{ padding: '10px 12px' }}>
            <IoClose size={16} />
          </button>
        )}
      </form>
      <div style={{ display: 'grid', gap: 8 }}>
        {tags.map((tag) => (
          <div key={tag._id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 0', borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ width: 16, height: 16, borderRadius: '50%', background: tag.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{tag.name}</span>
            <button className="btn-ghost" style={{ padding: 4 }} onClick={() => startEdit(tag)}>
              <IoCreate size={14} color="var(--text-muted)" />
            </button>
            <button className="btn-ghost" style={{ padding: 4 }} onClick={() => setConfirmDeleteTag(tag)}>
              <IoTrash size={14} color="var(--danger)" />
            </button>
          </div>
        ))}
        {tags.length === 0 && <EmptyState title="No tags" subtitle="Create your first tag above" />}
      </div>
      <ConfirmModal open={!!confirmDeleteTag} onClose={() => setConfirmDeleteTag(null)}
        onConfirm={handleDeleteTag}
        title="Delete tag?"
        message={`Delete tag "${confirmDeleteTag?.name}"? It will be removed from all notes.`} />
    </Modal>
  );
}
