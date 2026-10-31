import PropTypes from 'prop-types';
import UserBadge from '../UserBadge';
import styles from './TopBar.module.css';

function TopBar({ title }) {
  return (
    <header className={styles.topBar}>
      {title ? <h1 className={styles.title}>{title}</h1> : <span />}
      <UserBadge />
    </header>
  );
}

TopBar.propTypes = {
  title: PropTypes.string,
};

export default TopBar;
