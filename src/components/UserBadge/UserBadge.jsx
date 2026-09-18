import { useCurrentUser } from '../../hooks/useCurrentUser';
import styles from './UserBadge.module.css';

function UserBadge() {
  const user = useCurrentUser();

  return (
    <div className={styles.badge}>
      <span className={styles.avatar} aria-hidden="true">
        {user.initials}
      </span>
      <span className={styles.identity}>
        <span className={styles.name}>{user.name}</span>
        <span className={styles.role}>{user.role}</span>
      </span>
    </div>
  );
}

export default UserBadge;
