import { useEffect, useRef, useState } from 'react';

export const DEFAULT_COLUMN_WIDTH = 180;
export const MIN_COLUMN_WIDTH = 72;

// Drag-to-resize for every table's columns (FEAT-18). Each column's width
// lives in state keyed by its column key; a caller renders a drag handle
// on each column's trailing edge and wires it to `startResize`.
// `MasterDataTable` remounts per table (AppShell renders it with
// `key={activeItem.id}`), so switching sections naturally resets widths
// back to the default — no explicit reset effect needed here.
export function useColumnWidths(columns) {
  const [widths, setWidths] = useState(() =>
    Object.fromEntries(columns.map((column) => [column.key, DEFAULT_COLUMN_WIDTH]))
  );
  // Holds the active drag's cleanup function, if any — so an unmount
  // mid-drag (switching tables while still holding the mouse down) can
  // remove the listeners too, not just a normal mouseup (gate finding,
  // security-auditor: otherwise the listeners leak and keep firing
  // against a stale closure after the component is gone).
  const cleanupRef = useRef(null);

  useEffect(() => {
    return () => cleanupRef.current?.();
  }, []);

  function startResize(event, key) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = widths[key] ?? DEFAULT_COLUMN_WIDTH;

    function onMove(moveEvent) {
      const next = Math.max(MIN_COLUMN_WIDTH, startWidth + (moveEvent.clientX - startX));
      setWidths((prev) => ({ ...prev, [key]: next }));
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      cleanupRef.current = null;
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    cleanupRef.current = onUp;
  }

  return { widths, startResize };
}
