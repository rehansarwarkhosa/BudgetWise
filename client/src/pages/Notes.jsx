import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  IoAdd, IoTrash, IoChevronForward, IoChevronDown, IoSearch, IoArrowBack,
  IoClose, IoPricetag, IoCreate, IoColorPalette, IoTime,
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
} from '../api';
import { formatDateTime } from '../utils/format';

// ─── Main Page ───

export default function Notes() {
  // Tab: 'tree' | 'recent' | 'search'
  const [tab, setTab] = useState('tree');

  // Tree data
  const [tree, setTree] = useState([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [expandedTopics, setExpandedTopics] = useState({});
  const [expandedSubs, setExpandedSubs] = useState({});

  // Recent
  const [recentNotes, setRecentNotes] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);

  // Modals
  const [createTopicModal, setCreateTopicModal] = useState(false);
  const [createSubTopicModal, setCreateSubTopicModal] = useState(null); // topicId
  const [noteEditorModal, setNoteEditorModal] = useState(null); // null | { note, subTopicId }
  const [tagManagerModal, setTagManagerModal] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTag, setSearchTag] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [allTags, setAllTags] = useState([]);

  // Edit state
  const [editItem, setEditItem] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Topic color editing
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
    if (tab === 'recent') fetchRecent();
  }, [tab]);

  const toggleTopic = (topicId) => {
    setExpandedTopics(prev => ({ ...prev, [topicId]: !prev[topicId] }));
  };

  const toggleSub = (subId) => {
    setExpandedSubs(prev => ({ ...prev, [subId]: !prev[subId] }));
  };

  // Search
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

  useEffect(() => {
    if (tab === 'search') {
      const timer = setTimeout(doSearch, 400);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, searchTag, tab]);

  // Edit inline
  const handleRename = async () => {
    if (!editItem) return;
    try {
      if (editItem.type === 'topic') {
        await updateTopic(editItem.id, { name: editItem.name });
      } else if (editItem.type === 'subtopic') {
        await updateSubTopic(editItem.id, { name: editItem.name });
      }
      toast.success('Renamed');
      fetchTree();
    } catch (err) { toast.error(err.message); }
    setEditItem(null);
  };

  // Delete handlers
  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.type === 'topic') {
        await deleteTopic(confirmDelete.id);
        toast.success('Topic deleted');
      } else if (confirmDelete.type === 'subtopic') {
        await deleteSubTopic(confirmDelete.id);
        toast.success('SubTopic deleted');
      } else if (confirmDelete.type === 'note') {
        await deleteNote(confirmDelete.id);
        toast.success('Note deleted');
      }
      fetchTree();
    } catch (err) { toast.error(err.message); }
  };

  const refreshAll = () => { fetchTree(); fetchTags(); if (tab === 'recent') fetchRecent(); };

  if (treeLoading && tree.length === 0) return (
    <div className="page"><h1 className="page-title">Notes</h1><Spinner /></div>
  );

  return (
    <div className="page">
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
          <input type="text" placeholder="Search notes..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ marginBottom: 8 }} autoFocus />
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
          {searchLoading ? <Spinner /> : searchResults.length > 0 ? (
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
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
          ) : null}
        </div>
      )}

      {/* Recent Notes */}
      {tab === 'recent' && (
        <>
          {recentLoading ? <Spinner /> : recentNotes.length === 0 ? (
            <EmptyState icon="🕐" title="No recent notes" subtitle="Notes you edit will appear here" />
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
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
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{note.title}</h3>
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
        </>
      )}

      {/* Tree View */}
      {tab === 'tree' && (
        <>
          {tree.length === 0 ? (
            <EmptyState icon="📝" title="No topics yet" subtitle="Create a topic to organize your notes" />
          ) : (
            <div style={{ display: 'grid', gap: 0 }}>
              {tree.map((topic) => (
                <div key={topic._id}>
                  {/* Topic row */}
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
                            width: 14, height: 14, borderRadius: '50%', background: topic.color || '#6C63FF',
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

                  {/* SubTopics (expanded) */}
                  {expandedTopics[topic._id] && (
                    <div style={{ paddingLeft: 20 }}>
                      {topic.subTopics.length === 0 ? (
                        <div style={{ padding: '8px 0', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          No subtopics
                        </div>
                      ) : topic.subTopics.map((sub) => (
                        <div key={sub._id}>
                          {/* SubTopic row */}
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

                          {/* Notes (expanded) */}
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
                                  <button className="btn-ghost" style={{ padding: 2 }}
                                    onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'note', id: note._id, name: note.title }); }}>
                                    <IoTrash size={12} color="var(--danger)" />
                                  </button>
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

          {/* FAB */}
          <button className="fab" onClick={() => setCreateTopicModal(true)}>
            <IoAdd />
          </button>
        </>
      )}

      {/* Hidden color picker for topic color editing */}
      <input ref={topicColorRef} type="color"
        value={tree.find(t => t._id === editingTopicColor)?.color || '#6C63FF'}
        onChange={handleTopicColorChange}
        style={{ position: 'fixed', top: -100, left: -100, width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} />

      {/* Modals */}
      <CreateTopicModal open={createTopicModal} onClose={() => setCreateTopicModal(false)}
        onDone={refreshAll} />
      <CreateSubTopicModal open={!!createSubTopicModal} topicId={createSubTopicModal}
        onClose={() => setCreateSubTopicModal(null)} onDone={refreshAll} />
      {noteEditorModal && (
        <NoteEditorModal
          note={noteEditorModal.note}
          subTopicId={noteEditorModal.subTopicId}
          allTags={allTags}
          onClose={() => setNoteEditorModal(null)}
          onDone={refreshAll}
          onTagsChanged={fetchTags}
        />
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

// ─── Preset Colors ───

const PRESET_COLORS = [
  { name: 'Purple', hex: '#6C63FF' },
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
  const [color, setColor] = useState('#6C63FF');
  const [hexInput, setHexInput] = useState('#6C63FF');
  const [loading, setLoading] = useState(false);
  const colorPickerRef = useRef(null);

  const handleColorChange = (c) => {
    setColor(c);
    setHexInput(c);
  };

  const handleHexInput = (val) => {
    setHexInput(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) setColor(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createTopic({ name, color });
      toast.success('Topic created');
      setName(''); setColor('#6C63FF'); setHexInput('#6C63FF');
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
              placeholder="#6C63FF" style={{ flex: 1, fontSize: 13, fontFamily: 'monospace', padding: '4px 8px' }} />
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

// ─── Note Editor Modal ───

const COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#9B59B6', '#FF8C00', '#1A1A2E', '#F1F1F6'];

function NoteEditorModal({ note, subTopicId, allTags, onClose, onDone, onTagsChanged }) {
  const [title, setTitle] = useState(note?.title || '');
  const [selectedTags, setSelectedTags] = useState(note?.tags?.map((t) => t._id) || []);
  const [loading, setLoading] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && note?.description) {
      editorRef.current.innerHTML = note.description;
    }
  }, []);

  const execCmd = (cmd, value = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  };

  const toggleTag = (tagId) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    setLoading(true);
    try {
      const data = {
        title,
        description: editorRef.current?.innerHTML || '',
        tags: selectedTags,
      };
      if (note?._id) {
        await updateNote(note._id, data);
        toast.success('Note updated');
      } else {
        await createNote(subTopicId, data);
        toast.success('Note created');
      }
      onClose(); onDone();
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={true} onClose={onClose} title={note ? 'Edit Note' : 'New Note'}>
      <div className="form-group">
        <label>Title</label>
        <input type="text" placeholder="Note title" value={title}
          onChange={(e) => setTitle(e.target.value)} />
      </div>

      {/* Rich Text Toolbar */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap',
        padding: '6px 8px', background: 'var(--bg-input)', borderRadius: 8,
      }}>
        <button type="button" className="btn-ghost"
          style={{ padding: '4px 8px', fontWeight: 700, fontSize: 14 }}
          onClick={() => execCmd('bold')}>B</button>
        <button type="button" className="btn-ghost"
          style={{ padding: '4px 8px', fontStyle: 'italic', fontSize: 14 }}
          onClick={() => execCmd('italic')}>I</button>
        <button type="button" className="btn-ghost"
          style={{ padding: '4px 8px', textDecoration: 'underline', fontSize: 14 }}
          onClick={() => execCmd('underline')}>U</button>
        <div style={{ position: 'relative' }}>
          <button type="button" className="btn-ghost"
            style={{ padding: '4px 8px' }}
            onClick={() => setShowColorPicker(!showColorPicker)}>
            <IoColorPalette size={16} />
          </button>
          {showColorPicker && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 10,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 8, display: 'flex', gap: 4, flexWrap: 'wrap', width: 140,
            }}>
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => { execCmd('foreColor', c); setShowColorPicker(false); }}
                  style={{
                    width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--border)',
                    background: c, cursor: 'pointer',
                  }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content Editable */}
      <div ref={editorRef} contentEditable suppressContentEditableWarning
        style={{
          minHeight: 150, padding: 12, background: 'var(--bg-input)', borderRadius: 8,
          color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.6,
          outline: 'none', marginBottom: 12, overflowY: 'auto', maxHeight: 300,
        }}
        data-placeholder="Write your note..."
      />

      {/* Tags */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 6, display: 'block' }}>Tags</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {allTags.map((tag) => (
            <button key={tag._id} type="button" onClick={() => toggleTag(tag._id)}
              style={{
                padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                border: selectedTags.includes(tag._id) ? `2px solid ${tag.color}` : '2px solid transparent',
                background: selectedTags.includes(tag._id) ? tag.color + '33' : 'var(--bg-input)',
                color: selectedTags.includes(tag._id) ? tag.color : 'var(--text-muted)',
                cursor: 'pointer',
              }}>
              {tag.name}
            </button>
          ))}
          {allTags.length === 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No tags yet — create from tag manager</span>
          )}
        </div>
      </div>

      <button type="button" className="btn-primary" disabled={loading} onClick={handleSave}>
        {loading ? 'Saving...' : note ? 'Update Note' : 'Create Note'}
      </button>
    </Modal>
  );
}

// ─── Tag Manager Modal ───

function TagManagerModal({ open, tags, onClose, onDone }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6C63FF');
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
      setName(''); setColor('#6C63FF');
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

  const startEdit = (tag) => {
    setEditingTag(tag);
    setName(tag.name);
    setColor(tag.color);
  };

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
          <button type="button" className="btn-ghost" onClick={() => { setEditingTag(null); setName(''); setColor('#6C63FF'); }}
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
            <span style={{
              width: 16, height: 16, borderRadius: '50%', background: tag.color, flexShrink: 0,
            }} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{tag.name}</span>
            <button className="btn-ghost" style={{ padding: 4 }} onClick={() => startEdit(tag)}>
              <IoCreate size={14} color="var(--text-muted)" />
            </button>
            <button className="btn-ghost" style={{ padding: 4 }} onClick={() => setConfirmDeleteTag(tag)}>
              <IoTrash size={14} color="var(--danger)" />
            </button>
          </div>
        ))}
        {tags.length === 0 && (
          <EmptyState title="No tags" subtitle="Create your first tag above" />
        )}
      </div>

      <ConfirmModal open={!!confirmDeleteTag} onClose={() => setConfirmDeleteTag(null)}
        onConfirm={handleDeleteTag}
        title="Delete tag?"
        message={`Delete tag "${confirmDeleteTag?.name}"? It will be removed from all notes.`} />
    </Modal>
  );
}
