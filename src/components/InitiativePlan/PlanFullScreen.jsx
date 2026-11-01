import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import FitToScreen from './FitToScreen';
import styles from './PlanFullScreen.module.css';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// A full-screen dialog around the plan. Escape and the Close button close it,
// focus stays inside while it is open and returns to the button that opened it,
// and the page behind does not scroll.
function PlanFullScreen({ title, onClose, children }) {
  const frameRef = useRef(null);
  const closeRef = useRef(null);
  // The caller may pass a new function on every render. Keeping the latest one in a ref means the
  // setup below runs once, so a re-render never moves focus back to Close or forgets the opener.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onCloseRef.current();
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
  }, []);

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
