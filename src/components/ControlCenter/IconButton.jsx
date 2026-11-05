import { useState } from 'react';
import PropTypes from 'prop-types';
import styles from './ControlCenter.module.css';

const ICON_PATHS = {
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
};

// A small icon-only button. The full name is the aria-label; the tooltip shows it on
// hover and keyboard focus. The wrapper takes the events so a disabled button still shows it.
function IconButton({ icon, label, onClick, disabled, title }) {
  const [tipShown, setTipShown] = useState(false);
  return (
    <span
      className={styles.iconWrap}
      onMouseEnter={() => setTipShown(true)}
      onMouseLeave={() => setTipShown(false)}
      onFocus={() => setTipShown(true)}
      onBlur={() => setTipShown(false)}
    >
      <button type="button" className={styles.iconButton} aria-label={label} onClick={onClick} disabled={disabled} title={title}>
        <svg className={styles.iconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d={ICON_PATHS[icon]} />
        </svg>
      </button>
      {tipShown && (
        <span className={styles.iconTip} role="tooltip">
          {label}
        </span>
      )}
    </span>
  );
}

IconButton.propTypes = {
  icon: PropTypes.oneOf(Object.keys(ICON_PATHS)).isRequired,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  title: PropTypes.string,
};

export default IconButton;
