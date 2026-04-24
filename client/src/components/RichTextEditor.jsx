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

  // Only save the selection if it's actually inside the editor. Without this
  // guard, clicking a toolbar button (which briefly gets focus) overwrites the
  // ref with a range pointing at the button — and subsequent formatting does
  // nothing useful when we "restore" it.
  const saveSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
      savedSelection.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    if (savedSelection.current && editorRef.current) {
      editorRef.current.focus();
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedSelection.current);
    } else {
      editorRef.current?.focus();
    }
  };

  // Continuously track selection inside the editor via selectionchange.
  // This is the most reliable way to always have a fresh saved range on mobile.
  useEffect(() => {
    if (!open) return;
    const handler = () => saveSelection();
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, [open]);

  const execCmd = (cmd, value = null) => {
    restoreSelection();
    document.execCommand(cmd, false, value);
    // Re-save the (now possibly updated) selection so subsequent toolbar taps
    // keep working without needing another tap into the editor.
    setTimeout(saveSelection, 0);
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
    touchAction: 'manipulation',
  });

  // Bind the action to mousedown (fires before focus loss) instead of click.
  // This is the only reliable pattern for contenteditable toolbars on Android:
  // `click` fires after the editor has already blurred, losing selection + keyboard.
  // On mobile the browser synthesizes mousedown from a tap, so this works for both.
  const toolAction = (fn) => ({
    tabIndex: -1,
    onMouseDown: (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    },
    // onClick reserved for accessibility/keyboard — no-op here so we don't double-fire
    onClick: (e) => e.preventDefault(),
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

      {/* Formatting Toolbar — all interactions go through toolAction() on each
          button, which prevents focus loss and fires the command synchronously. */}
      <div style={{
        display: 'flex', gap: 2, padding: '6px 8px',
        borderBottom: '1px solid var(--border)', background: 'var(--bg-card)',
        overflowX: 'auto', flexShrink: 0, alignItems: 'center',
        WebkitOverflowScrolling: 'touch',
      }}
        onMouseDown={(e) => { if (e.target.tagName !== 'INPUT') e.preventDefault(); }}>

        {/* Heading selector */}
        <div style={{ position: 'relative' }}>
          <button {...toolAction(() => { closeAllPickers(); setShowHeading(v => !v); })} style={toolBtn(showHeading)}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>H</span>
          </button>
          {showHeading && (
            <div style={{ ...dropdownStyle, minWidth: 130 }}>
              {HEADING_OPTIONS.map(h => (
                <button key={h.tag}
                  {...toolAction(() => { execCmd('formatBlock', h.tag); setShowHeading(false); })}
                  style={{
                    display: 'block', width: '100%', padding: '6px 10px', border: 'none',
                    background: 'transparent', cursor: 'pointer', textAlign: 'left',
                    fontSize: h.tag === 'p' ? 13 : h.tag === 'h3' ? 14 : h.tag === 'h2' ? 16 : 18,
                    fontWeight: h.tag === 'p' ? 400 : 700, color: 'var(--text)',
                    borderRadius: 4, touchAction: 'manipulation',
                  }}>
                  {h.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

        {/* Bold */}
        <button {...toolAction(() => execCmd('bold'))} style={toolBtn()}>
          <span style={{ fontWeight: 900, fontSize: 14 }}>B</span>
        </button>
        {/* Italic */}
        <button {...toolAction(() => execCmd('italic'))} style={toolBtn()}>
          <span style={{ fontStyle: 'italic', fontSize: 14, fontWeight: 500 }}>I</span>
        </button>
        {/* Underline */}
        <button {...toolAction(() => execCmd('underline'))} style={toolBtn()}>
          <span style={{ textDecoration: 'underline', fontSize: 14 }}>U</span>
        </button>
        {/* Strikethrough */}
        <button {...toolAction(() => execCmd('strikeThrough'))} style={toolBtn()}>
          <span style={{ textDecoration: 'line-through', fontSize: 14 }}>S</span>
        </button>

        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

        {/* Font Size */}
        <div style={{ position: 'relative' }}>
          <button {...toolAction(() => { closeAllPickers(); setShowFontSize(v => !v); })} style={toolBtn(showFontSize)}>
            <span style={{ fontSize: 11, fontWeight: 600 }}>A<span style={{ fontSize: 8 }}>A</span></span>
          </button>
          {showFontSize && (
            <div style={{ ...dropdownStyle, minWidth: 100 }}>
              {FONT_SIZES.map(f => (
                <button key={f.value}
                  {...toolAction(() => { execCmd('fontSize', f.value); setShowFontSize(false); })}
                  style={{
                    display: 'block', width: '100%', padding: '6px 10px', border: 'none',
                    background: 'transparent', cursor: 'pointer', textAlign: 'left',
                    fontSize: 13, color: 'var(--text)', borderRadius: 4, touchAction: 'manipulation',
                  }}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text Color */}
        <div style={{ position: 'relative' }}>
          <button {...toolAction(() => { closeAllPickers(); setShowColorPicker(v => !v); })} style={toolBtn(showColorPicker)}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>A<span style={{
              display: 'block', height: 3, background: customColor, borderRadius: 1, marginTop: -2,
            }} /></span>
          </button>
          {showColorPicker && (
            <div style={{ ...dropdownStyle, display: 'flex', gap: 4, flexWrap: 'wrap', width: 164 }}>
              {COLORS.map(c => (
                <button key={c}
                  {...toolAction(() => { execCmd('foreColor', c); setCustomColor(c); setShowColorPicker(false); })}
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    border: '2px solid var(--border)', background: c, cursor: 'pointer',
                    touchAction: 'manipulation',
                  }} />
              ))}
              <input type="color" value={customColor}
                onChange={e => { execCmd('foreColor', e.target.value); setCustomColor(e.target.value); setShowColorPicker(false); }}
                style={{ width: 28, height: 28, padding: 0, border: 'none', cursor: 'pointer', borderRadius: '50%' }} />
            </div>
          )}
        </div>

        {/* Highlight */}
        <div style={{ position: 'relative' }}>
          <button {...toolAction(() => { closeAllPickers(); setShowHighlightPicker(v => !v); })} style={toolBtn(showHighlightPicker)}>
            <span style={{
              fontSize: 13, fontWeight: 700, background: '#FFD93D50', padding: '0 3px', borderRadius: 2,
            }}>H</span>
          </button>
          {showHighlightPicker && (
            <div style={{ ...dropdownStyle, display: 'flex', gap: 4, flexWrap: 'wrap', width: 164 }}>
              {['#FFD93D', '#FF6B6B', '#6BCB77', '#4D96FF', '#9B59B6', '#FF8C00', 'transparent'].map(c => (
                <button key={c}
                  {...toolAction(() => { execCmd('hiliteColor', c); setShowHighlightPicker(false); })}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                    border: '2px solid var(--border)',
                    background: c === 'transparent' ? 'var(--bg-input)' : c + '80',
                    touchAction: 'manipulation',
                  }}>
                  {c === 'transparent' && <IoClose size={14} style={{ color: 'var(--text-muted)' }} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

        {/* Bullet List */}
        <button {...toolAction(() => execCmd('insertUnorderedList'))} style={toolBtn()}>
          <span style={{ fontSize: 14 }}>&#8226;</span>
        </button>
        {/* Numbered List */}
        <button {...toolAction(() => execCmd('insertOrderedList'))} style={toolBtn()}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>1.</span>
        </button>

        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

        {/* Indent / Outdent */}
        <button {...toolAction(() => execCmd('indent'))} style={toolBtn()} title="Indent">
          <span style={{ fontSize: 13 }}>&rarr;</span>
        </button>
        <button {...toolAction(() => execCmd('outdent'))} style={toolBtn()} title="Outdent">
          <span style={{ fontSize: 13 }}>&larr;</span>
        </button>

        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

        {/* Alignment */}
        <button {...toolAction(() => execCmd('justifyLeft'))} style={toolBtn()} title="Align left">
          <span style={{ fontSize: 11, lineHeight: 1 }}>&#9776;</span>
        </button>
        <button {...toolAction(() => execCmd('justifyCenter'))} style={toolBtn()} title="Align center">
          <span style={{ fontSize: 11, lineHeight: 1, textAlign: 'center', display: 'block' }}>&#9776;</span>
        </button>
        <button {...toolAction(() => execCmd('justifyRight'))} style={toolBtn()} title="Align right">
          <span style={{ fontSize: 11, lineHeight: 1 }}>&#9776;</span>
        </button>

        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

        {/* Quote */}
        <button {...toolAction(() => execCmd('formatBlock', 'blockquote'))} style={toolBtn()} title="Blockquote">
          <span style={{ fontSize: 16, fontWeight: 700, fontStyle: 'italic', color: 'var(--text-muted)' }}>&ldquo;</span>
        </button>
        {/* Horizontal Rule */}
        <button {...toolAction(() => execCmd('insertHorizontalRule'))} style={toolBtn()} title="Horizontal line">
          <span style={{ fontSize: 11, letterSpacing: 2 }}>&#8212;</span>
        </button>
        {/* Clear Formatting */}
        <button {...toolAction(() => execCmd('removeFormat'))} style={toolBtn()} title="Clear formatting">
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>T<span style={{ fontSize: 9 }}>x</span></span>
        </button>

        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

        {/* Undo / Redo */}
        <button {...toolAction(() => execCmd('undo'))} style={toolBtn()} title="Undo">
          <span style={{ fontSize: 14 }}>&#8630;</span>
        </button>
        <button {...toolAction(() => execCmd('redo'))} style={toolBtn()} title="Redo">
          <span style={{ fontSize: 14 }}>&#8631;</span>
        </button>
      </div>

      {/* Editor Area — tapping anywhere here focuses the editor. We intentionally
          do NOT close open dropdowns on editor tap, because the user may have
          just opened one and is positioning the caret first. Dropdowns close
          when another toolbar picker opens or after an action is chosen. */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}
        onClick={() => { editorRef.current?.focus(); }}>
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
