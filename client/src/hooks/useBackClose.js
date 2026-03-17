import { useEffect, useRef } from 'react';

const closeStack = [];
let skipCount = 0;

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (skipCount > 0) { skipCount--; return; }
    if (closeStack.length > 0) {
      closeStack.pop()();
    }
  });
}

export default function useBackClose(isOpen, onClose) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const entry = () => onCloseRef.current();
    closeStack.push(entry);
    window.history.pushState({ backClose: true }, '');

    return () => {
      const idx = closeStack.indexOf(entry);
      if (idx !== -1) {
        closeStack.splice(idx, 1);
        skipCount++;
        window.history.back();
      }
    };
  }, [isOpen]);
}
