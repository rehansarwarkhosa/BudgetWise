import { useState, useRef, useEffect } from 'react';
import { IoArrowBack, IoClose, IoPricetag } from 'react-icons/io5';

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

/**
 * Full-screen rich text editor component.
 *
 * Props:
 *  - open: boolean
 *  - initialContent: string (HTML)
 *  - onSave: (htmlContent: string) => void
 *  - onClose: () => void
 *  - title: string (optional, shown in top bar)
 *  - placeholder: string (optional)
 *  - saving: boolean (optional)
 */
export default function RichTextEditor({ open, initialContent, onSave, onClose, title, placeholder, saving }) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showFontSize, setShowFontSize] = useState(false);
  const [showHeading, setShowHeading] = useState(false);
  const [customColor, setCustomColor] = useState('#3AAFB9');
  const editorRef = useRef(null);
  const savedSelection = useRef(null);

  useEffect(() => {
    if (open && editorRef.current) {
      editorRef.current.innerHTML = initialContent || '';
      setTimeout(() => editorRef.current?.focus(), 100);
    }
  }, [open]);

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

  const handleSave = () => {
    onSave(editorRef.current?.innerHTML || '');
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

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
            {title || 'Edit Note'}
          </span>
        </div>
        <button onClick={handleSave} disabled={saving}
          style={{
            padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 700,
            opacity: saving ? 0.6 : 1,
          }}>
          {saving ? 'Saving...' : 'Save'}
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

        {/* Heading selector */}
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
                    fontWeight: h.tag === 'p' ? 400 : 700, color: 'var(--text)',
                    borderRadius: 4,
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

        {/* Bold */}
        <button style={toolBtn()} onClick={() => execCmd('bold')}>
          <span style={{ fontWeight: 900, fontSize: 14 }}>B</span>
        </button>
        {/* Italic */}
        <button style={toolBtn()} onClick={() => execCmd('italic')}>
          <span style={{ fontStyle: 'italic', fontSize: 14, fontWeight: 500 }}>I</span>
        </button>
        {/* Underline */}
        <button style={toolBtn()} onClick={() => execCmd('underline')}>
          <span style={{ textDecoration: 'underline', fontSize: 14 }}>U</span>
        </button>
        {/* Strikethrough */}
        <button style={toolBtn()} onClick={() => execCmd('strikeThrough')}>
          <span style={{ textDecoration: 'line-through', fontSize: 14 }}>S</span>
        </button>

        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

        {/* Font Size */}
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

        {/* Text Color */}
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
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    border: '2px solid var(--border)', background: c, cursor: 'pointer',
                  }} />
              ))}
              <input type="color" value={customColor}
                onChange={e => { execCmd('foreColor', e.target.value); setCustomColor(e.target.value); setShowColorPicker(false); }}
                style={{ width: 28, height: 28, padding: 0, border: 'none', cursor: 'pointer', borderRadius: '50%' }} />
            </div>
          )}
        </div>

        {/* Highlight */}
        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
          <button style={toolBtn(showHighlightPicker)}
            onClick={() => { saveSelection(); closeAllPickers(); setShowHighlightPicker(!showHighlightPicker); }}>
            <span style={{
              fontSize: 13, fontWeight: 700, background: '#FFD93D50', padding: '0 3px', borderRadius: 2,
            }}>H</span>
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

        {/* Bullet List */}
        <button style={toolBtn()} onClick={() => execCmd('insertUnorderedList')}>
          <span style={{ fontSize: 14 }}>&#8226;</span>
        </button>
        {/* Numbered List */}
        <button style={toolBtn()} onClick={() => execCmd('insertOrderedList')}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>1.</span>
        </button>

        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

        {/* Indent / Outdent */}
        <button style={toolBtn()} onClick={() => execCmd('indent')} title="Indent">
          <span style={{ fontSize: 13 }}>&rarr;</span>
        </button>
        <button style={toolBtn()} onClick={() => execCmd('outdent')} title="Outdent">
          <span style={{ fontSize: 13 }}>&larr;</span>
        </button>

        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

        {/* Alignment */}
        <button style={toolBtn()} onClick={() => execCmd('justifyLeft')} title="Align left">
          <span style={{ fontSize: 11, lineHeight: 1 }}>&#9776;</span>
        </button>
        <button style={toolBtn()} onClick={() => execCmd('justifyCenter')} title="Align center">
          <span style={{ fontSize: 11, lineHeight: 1, textAlign: 'center', display: 'block' }}>&#9776;</span>
        </button>
        <button style={toolBtn()} onClick={() => execCmd('justifyRight')} title="Align right">
          <span style={{ fontSize: 11, lineHeight: 1 }}>&#9776;</span>
        </button>

        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

        {/* Quote */}
        <button style={toolBtn()} onClick={() => execCmd('formatBlock', 'blockquote')} title="Blockquote">
          <span style={{ fontSize: 16, fontWeight: 700, fontStyle: 'italic', color: 'var(--text-muted)' }}>&ldquo;</span>
        </button>
        {/* Horizontal Rule */}
        <button style={toolBtn()} onClick={() => execCmd('insertHorizontalRule')} title="Horizontal line">
          <span style={{ fontSize: 11, letterSpacing: 2 }}>&#8212;</span>
        </button>
        {/* Clear Formatting */}
        <button style={toolBtn()} onClick={() => execCmd('removeFormat')} title="Clear formatting">
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>T<span style={{ fontSize: 9 }}>x</span></span>
        </button>

        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

        {/* Undo / Redo */}
        <button style={toolBtn()} onClick={() => execCmd('undo')} title="Undo">
          <span style={{ fontSize: 14 }}>&#8630;</span>
        </button>
        <button style={toolBtn()} onClick={() => execCmd('redo')} title="Redo">
          <span style={{ fontSize: 14 }}>&#8631;</span>
        </button>
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
          data-placeholder={placeholder || 'Start writing...'}
        />
      </div>
    </div>
  );
}
