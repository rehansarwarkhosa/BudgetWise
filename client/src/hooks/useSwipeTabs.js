import { useRef, useCallback } from 'react';

export default function useSwipeTabs(tabKeys, activeTab, setActiveTab) {
  const touchStartRef = useRef(null);
  const touchStartYRef = useRef(null);

  const onTouchStart = useCallback((e) => {
    touchStartRef.current = e.changedTouches[0].clientX;
    touchStartYRef.current = e.changedTouches[0].clientY;
  }, []);

  const onTouchEnd = useCallback((e) => {
    if (touchStartRef.current === null) return;
    const diffX = touchStartRef.current - e.changedTouches[0].clientX;
    const diffY = touchStartYRef.current - e.changedTouches[0].clientY;
    touchStartRef.current = null;
    touchStartYRef.current = null;

    // Only trigger if horizontal swipe is dominant and exceeds threshold
    if (Math.abs(diffX) < 50 || Math.abs(diffY) > Math.abs(diffX)) return;

    const currentIdx = tabKeys.indexOf(activeTab);
    if (currentIdx === -1) return;

    if (diffX > 0 && currentIdx < tabKeys.length - 1) {
      setActiveTab(tabKeys[currentIdx + 1]);
    } else if (diffX < 0 && currentIdx > 0) {
      setActiveTab(tabKeys[currentIdx - 1]);
    }
  }, [tabKeys, activeTab, setActiveTab]);

  return { onTouchStart, onTouchEnd };
}
