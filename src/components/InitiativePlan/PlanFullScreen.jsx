import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { fitScale } from '../../lib/fitScale';
import styles from './PlanFullScreen.module.css';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Shrinks its content to fit the space it has, so all of it shows in one view.
// On a narrow screen it keeps the full size and scrolls instead.
function FitToScreen({ children }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [fit, setFit] = useState({ scale: 1, offsetX: 0 });

  const measure = useCallback(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const scale = fitScale({
      contentWidth: inner.offsetWidth,
      contentHeight: inner.offsetHeight,
      availableWidth: outer.clientWidth,
      availableHeight: outer.clientHeight,
      viewportWidth: window.innerWidth,
    });
    // Centre the shrunken content sideways.
    const offsetX = scale < 1 ? Math.max(0, (outer.clientWidth - inner.offsetWidth * scale) / 2) : 0;
    setFit((previous) => (previous.scale === scale && previous.offsetX === offsetX ? previous : { scale, offsetX }));
  }, []);

  useLayoutEffect(() => {
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(outerRef.current);
    observer?.observe(innerRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const shrunk = fit.scale < 1;
  return (
    <div ref={outerRef} className={`${styles.fitOuter} ${shrunk ? styles.fitShrunk : ''}`} data-shrunk={shrunk}>
      <div
        ref={innerRef}
        className={styles.fitInner}
        style={shrunk ? { transform: `scale(${fit.scale})`, marginLeft: fit.offsetX } : undefined}
        data-scale={fit.scale}
      >
        {children}
      </div>
    </div>
  );
}

FitToScreen.propTypes = { children: PropTypes.node.isRequired };

// A full-screen dialog around the plan. Escape and the Close button close it,
// focus stays inside while it is open and returns to the button that opened it,
// and the page behind does not scroll.
function PlanFullScreen({ title, onClose, children }) {
  const frameRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(frameRef.current?.querySelectorAll(FOCUSABLE) ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!frameRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div ref={frameRef} className={styles.frame} role="dialog" aria-modal="true" aria-labelledby="plan-full-title">
      <div className={styles.frameHead}>
        <h2 id="plan-full-title" className={styles.frameTitle}>{title}</h2>
        <button ref={closeRef} type="button" className={styles.close} onClick={onClose}>
          Close
        </button>
      </div>
      <div className={styles.frameBody}>
        <FitToScreen>{children}</FitToScreen>
      </div>
    </div>
  );
}

PlanFullScreen.propTypes = {
  title: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};

export default PlanFullScreen;
