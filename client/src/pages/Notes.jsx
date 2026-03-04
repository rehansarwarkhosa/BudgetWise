import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  IoAdd, IoTrash, IoChevronForward, IoSearch, IoArrowBack,
  IoClose, IoPricetag, IoCreate, IoColorPalette,
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
  searchNotes,
} from '../api';

// ─── Main Page ───

export default function Notes() {
  // Navigation state: 'topics' | 'subtopics' | 'notes'
  const [view, setView] = useState('topics');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedSubTopic, setSelectedSubTopic] = useState(null);

  // Data
  const [topics, setTopics] = useState([]);
  const [subTopics, setSubTopics] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [createTopicModal, setCreateTopicModal] = useState(false);
  const [createSubTopicModal, setCreateSubTopicModal] = useState(false);
  const [noteEditorModal, setNoteEditorModal] = useState(null); // null | 'new' | noteObj
  const [tagManagerModal, setTagManagerModal] = useState(false);

  // Search
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTag, setSearchTag] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [allTags, setAllTags] = useState([]);

  // Edit state
  const [editItem, setEditItem] = useState(null); // { type, id, name }
  const [confirmDelete, setConfirmDelete] = useState(null); // { type, id, name }

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTopics();
      setTopics(res.data);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, []);

  const fetchSubTopics = useCallback(async () => {
    if (!selectedTopic) return;
    setLoading(true);
    try {
      const res = await getSubTopics(selectedTopic._id);
      setSubTopics(res.data);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [selectedTopic]);

  const fetchNotes = useCallback(async () => {
    if (!selectedSubTopic) return;
    setLoading(true);
    try {
      const res = await getNotes(selectedSubTopic._id);
      setNotes(res.data);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [selectedSubTopic]);

  const fetchTags = useCallback(async () => {
    try {
      const res = await getTags();
      setAllTags(res.data);
    } catch (err) { /* silent */ }
  }, []);

  useEffect(() => { fetchTopics(); fetchTags(); }, []);

  useEffect(() => {
    if (view === 'subtopics' && selectedTopic) fetchSubTopics();
  }, [view, selectedTopic]);

  useEffect(() => {
    if (view === 'notes' && selectedSubTopic) fetchNotes();
  }, [view, selectedSubTopic]);

  const navigateToSubTopics = (topic) => {
    setSelectedTopic(topic);
    setView('subtopics');
  };

  const navigateToNotes = (sub) => {
    setSelectedSubTopic(sub);
    setView('notes');
  };

  const goBack = () => {
    if (view === 'notes') { setView('subtopics'); setNotes([]); }
    else if (view === 'subtopics') { setView('topics'); setSubTopics([]); fetchTopics(); }
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
    if (searchMode) {
      const timer = setTimeout(doSearch, 400);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, searchTag, searchMode]);

  // Edit inline
  const handleRename = async () => {
    if (!editItem) return;
    try {
      if (editItem.type === 'topic') {
        await updateTopic(editItem.id, { name: editItem.name });
        fetchTopics();
      } else if (editItem.type === 'subtopic') {
        await updateSubTopic(editItem.id, { name: editItem.name });
        fetchSubTopics();
      }
      toast.success('Renamed');
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
        fetchTopics();
      } else if (confirmDelete.type === 'subtopic') {
        await deleteSubTopic(confirmDelete.id);
        toast.success('SubTopic deleted');
        fetchSubTopics();
      } else if (confirmDelete.type === 'note') {
        await deleteNote(confirmDelete.id);
        toast.success('Note deleted');
        fetchNotes();
      }
    } catch (err) { toast.error(err.message); }
  };

  if (loading && !searchMode && topics.length === 0) return (
    <div className="page"><h1 className="page-title">Notes</h1><Spinner /></div>
  );

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {(view !== 'topics' || searchMode) && (
          <button className="btn-ghost" style={{ padding: 4 }}
            onClick={() => { if (searchMode) { setSearchMode(false); setSearchResults([]); setSearchQuery(''); setSearchTag(''); } else goBack(); }}>
            <IoArrowBack size={20} />
          </button>
        )}
        <h1 className="page-title" style={{ margin: 0, flex: 1 }}>
          {searchMode ? 'Search Notes' : 'Notes'}
        </h1>
        <button className="btn-ghost" style={{ padding: 4 }} onClick={() => setTagManagerModal(true)}>
          <IoPricetag size={18} />
        </button>
        <button className="btn-ghost" style={{ padding: 4 }}
          onClick={() => { setSearchMode(!searchMode); if (searchMode) { setSearchResults([]); setSearchQuery(''); setSearchTag(''); } }}>
          <IoSearch size={18} />
        </button>
      </div>

      {/* Breadcrumb */}
      {!searchMode && view !== 'topics' && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <span style={{ cursor: 'pointer', color: 'var(--primary)' }}
            onClick={() => { setView('topics'); setSubTopics([]); fetchTopics(); }}>Topics</span>
          {selectedTopic && (
            <>
              <span>/</span>
              <span style={{ cursor: view === 'notes' ? 'pointer' : 'default', color: view === 'notes' ? 'var(--primary)' : 'var(--text-secondary)' }}
                onClick={() => { if (view === 'notes') { setView('subtopics'); setNotes([]); } }}>
                {selectedTopic.name}
              </span>
            </>
          )}
          {selectedSubTopic && view === 'notes' && (
            <>
              <span>/</span>
              <span style={{ color: 'var(--text-secondary)' }}>{selectedSubTopic.name}</span>
            </>
          )}
        </div>
      )}

      {/* Search UI */}
      {searchMode && (
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
              {searchResults.map((note) => (
                <div key={note._id} className="card" style={{ cursor: 'pointer' }}
                  onClick={() => { setNoteEditorModal(note); }}>
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
              ))}
            </div>
          ) : (searchQuery || searchTag) ? (
            <EmptyState title="No results" subtitle="Try different search terms" />
          ) : null}
        </div>
      )}

      {/* Topic List */}
      {!searchMode && view === 'topics' && (
        <>
          {topics.length === 0 ? (
            <EmptyState icon="📝" title="No topics yet" subtitle="Create a topic to organize your notes" />
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {topics.map((t) => (
                <div key={t._id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {editItem?.type === 'topic' && editItem.id === t._id ? (
                    <form onSubmit={(e) => { e.preventDefault(); handleRename(); }} style={{ flex: 1, display: 'flex', gap: 6 }}>
                      <input type="text" value={editItem.name} autoFocus
                        onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                        style={{ flex: 1, fontSize: 14 }} />
                      <button type="submit" className="btn-ghost" style={{ color: 'var(--primary)', fontSize: 12 }}>Save</button>
                      <button type="button" className="btn-ghost" onClick={() => setEditItem(null)} style={{ fontSize: 12 }}>Cancel</button>
                    </form>
                  ) : (
                    <>
                      <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => navigateToSubTopics(t)}>
                        <h3 style={{ fontSize: 15, fontWeight: 600 }}>{t.name}</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {t.subCount} subtopic{t.subCount !== 1 ? 's' : ''} &middot; {t.noteCount} note{t.noteCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <button className="btn-ghost" style={{ padding: 4 }}
                        onClick={() => setEditItem({ type: 'topic', id: t._id, name: t.name })}>
                        <IoCreate size={16} color="var(--text-muted)" />
                      </button>
                      <button className="btn-ghost" style={{ padding: 4 }} onClick={() => setConfirmDelete({ type: 'topic', id: t._id, name: t.name })}>
                        <IoTrash size={16} color="var(--danger)" />
                      </button>
                      <IoChevronForward size={16} color="var(--text-muted)" style={{ cursor: 'pointer' }}
                        onClick={() => navigateToSubTopics(t)} />
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* SubTopic List */}
      {!searchMode && view === 'subtopics' && (
        <>
          {loading ? <Spinner /> : subTopics.length === 0 ? (
            <EmptyState icon="📂" title="No subtopics yet" subtitle="Create a subtopic to start adding notes" />
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {subTopics.map((s) => (
                <div key={s._id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {editItem?.type === 'subtopic' && editItem.id === s._id ? (
                    <form onSubmit={(e) => { e.preventDefault(); handleRename(); }} style={{ flex: 1, display: 'flex', gap: 6 }}>
                      <input type="text" value={editItem.name} autoFocus
                        onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                        style={{ flex: 1, fontSize: 14 }} />
                      <button type="submit" className="btn-ghost" style={{ color: 'var(--primary)', fontSize: 12 }}>Save</button>
                      <button type="button" className="btn-ghost" onClick={() => setEditItem(null)} style={{ fontSize: 12 }}>Cancel</button>
                    </form>
                  ) : (
                    <>
                      <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => navigateToNotes(s)}>
                        <h3 style={{ fontSize: 15, fontWeight: 600 }}>{s.name}</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {s.noteCount} note{s.noteCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <button className="btn-ghost" style={{ padding: 4 }}
                        onClick={() => setEditItem({ type: 'subtopic', id: s._id, name: s.name })}>
                        <IoCreate size={16} color="var(--text-muted)" />
                      </button>
                      <button className="btn-ghost" style={{ padding: 4 }} onClick={() => setConfirmDelete({ type: 'subtopic', id: s._id, name: s.name })}>
                        <IoTrash size={16} color="var(--danger)" />
                      </button>
                      <IoChevronForward size={16} color="var(--text-muted)" style={{ cursor: 'pointer' }}
                        onClick={() => navigateToNotes(s)} />
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Note List */}
      {!searchMode && view === 'notes' && (
        <>
          {loading ? <Spinner /> : notes.length === 0 ? (
            <EmptyState icon="📄" title="No notes yet" subtitle="Create your first note" />
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {notes.map((n) => (
                <div key={n._id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setNoteEditorModal(n)}>
                    <h3 style={{ fontSize: 15, fontWeight: 600 }}>{n.title}</h3>
                    {n.tags?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        {n.tags.map((tag) => (
                          <span key={tag._id} style={{
                            padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                            background: tag.color + '33', color: tag.color,
                          }}>{tag.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button className="btn-ghost" style={{ padding: 4 }} onClick={() => setConfirmDelete({ type: 'note', id: n._id, name: n.title })}>
                    <IoTrash size={16} color="var(--danger)" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* FAB */}
      {!searchMode && (
        <button className="fab" onClick={() => {
          if (view === 'topics') setCreateTopicModal(true);
          else if (view === 'subtopics') setCreateSubTopicModal(true);
          else if (view === 'notes') setNoteEditorModal('new');
        }}>
          <IoAdd />
        </button>
      )}

      {/* Modals */}
      <CreateTopicModal open={createTopicModal} onClose={() => setCreateTopicModal(false)}
        onDone={fetchTopics} />
      <CreateSubTopicModal open={createSubTopicModal} topicId={selectedTopic?._id}
        onClose={() => setCreateSubTopicModal(false)} onDone={fetchSubTopics} />
      {noteEditorModal && (
        <NoteEditorModal
          note={noteEditorModal === 'new' ? null : noteEditorModal}
          subTopicId={selectedSubTopic?._id}
          allTags={allTags}
          onClose={() => setNoteEditorModal(null)}
          onDone={() => { fetchNotes(); fetchTags(); }}
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

// ─── Create Topic Modal ───

function CreateTopicModal({ open, onClose, onDone }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createTopic({ name });
      toast.success('Topic created');
      setName('');
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

  const handleDelete = async (id) => {
    try {
      await deleteTag(id);
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
            <button className="btn-ghost" style={{ padding: 4 }} onClick={() => handleDelete(tag._id)}>
              <IoTrash size={14} color="var(--danger)" />
            </button>
          </div>
        ))}
        {tags.length === 0 && (
          <EmptyState title="No tags" subtitle="Create your first tag above" />
        )}
      </div>
    </Modal>
  );
}
