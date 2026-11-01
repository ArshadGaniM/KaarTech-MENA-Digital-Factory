import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { fitScale } from '../../lib/fitScale';
import styles from './FitToScreen.module.css';

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

export default FitToScreen;
