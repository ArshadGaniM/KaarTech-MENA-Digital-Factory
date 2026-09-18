import PropTypes from 'prop-types';
import styles from './Sidebar.module.css';

function Sidebar({ items, activeId, onSelect }) {
  return (
    <nav className={styles.sidebar} aria-label="Workspace sections">
      <div className={styles.brand}>
        <span className={styles.brandKaartech}>KaarTech</span>
        <span className={styles.brandFactory}>MENA Digital Factory</span>
      </div>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={item.id === activeId ? styles.itemActive : styles.item}
              aria-current={item.id === activeId ? 'page' : undefined}
              onClick={() => onSelect(item.id)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

Sidebar.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ).isRequired,
  activeId: PropTypes.string.isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default Sidebar;
