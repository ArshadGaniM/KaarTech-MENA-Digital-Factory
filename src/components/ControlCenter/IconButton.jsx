import { useState } from 'react';
import PropTypes from 'prop-types';
import styles from './ControlCenter.module.css';

const ICON_PATHS = {
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
};

const isKeyboardFocus = (element) => {
  try {
    return element.matches(':focus-visible');
  } catch {
    return true;
  }
};

// A small icon-only button. The full name is the aria-label; the tooltip shows it on
// hover and keyboard focus. The wrapper takes the events so a disabled button still shows it.
// A disabledReason keeps the button focusable and tappable (aria-disabled) so the reason
// reaches keyboard and touch users, which a disabled attribute would block.
function IconButton({ icon, label, onClick, disabled, disabledReason }) {
  const [tipShown, setTipShown] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const tipText = disabledReason ? `${label}: ${disabledReason}` : label;

  const hide = () => {
    setTipShown(false);
    setDismissed(false);
  };
  const handleClick = (event) => {
    if (disabledReason) {
      setTipShown(true);
      return;
    }
    setTipShown(false);
    setDismissed(true);
    onClick(event);
  };

  return (
    <span
      className={styles.iconWrap}
      onMouseEnter={() => !dismissed && setTipShown(true)}
      onMouseLeave={hide}
      onFocus={(event) => !dismissed && isKeyboardFocus(event.target) && setTipShown(true)}
      onBlur={hide}
    >
      <button
        type="button"
        className={styles.iconButton}
        aria-label={tipText}
        aria-disabled={disabledReason ? 'true' : undefined}
        onClick={handleClick}
        disabled={disabled}
      >
        <svg className={styles.iconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d={ICON_PATHS[icon]} />
        </svg>
      </button>
      {tipShown && (
        <span className={styles.iconTip} role="tooltip" aria-hidden="true">
          {tipText}
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
  disabledReason: PropTypes.string,
};

export default IconButton;
