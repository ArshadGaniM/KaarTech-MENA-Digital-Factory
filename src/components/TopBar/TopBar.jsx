import PropTypes from 'prop-types';
import UserBadge from '../UserBadge';
import styles from './TopBar.module.css';

function TopBar({ title }) {
  return (
    <header className={styles.topBar}>
      <h1 className={styles.title}>{title}</h1>
      <UserBadge />
    </header>
  );
}

TopBar.propTypes = {
  title: PropTypes.string.isRequired,
};

export default TopBar;
