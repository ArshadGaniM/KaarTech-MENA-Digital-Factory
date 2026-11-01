import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import TeamCard from './TeamCard';
import { pluralize } from './pluralize';
import { practiceColor } from './practiceColor';
import styles from './OrganizationStructure.module.css';

const initialsOf = (name) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

// Mounted only while open, so mounting is "open" and unmounting is "close":
// focus moves in on mount and goes back to the tile that opened it.
const FOCUSABLE = 'button, summary, [href], input, [tabindex]:not([tabindex="-1"])';

function DepartmentDrawer({ department, onClose }) {
  const closeRef = useRef(null);
  const drawerRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus();
    // aria-modal alone does not stop Tab from leaving the dialog, so Tab wraps
    // between the first and last control inside it.
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const controls = [...drawerRef.current.querySelectorAll(FOCUSABLE)];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <>
      <button type="button" className={styles.scrim} tabIndex={-1} aria-label="Close department detail" onClick={onClose} />
      <aside ref={drawerRef} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="org-drawer-title">
        <div className={styles.drawerHead}>
          <div>
            <h2 id="org-drawer-title">{department.name}</h2>
            <p>
              {department.code} · Floor {department.floorNumber ?? '–'} · {pluralize(department.teamCount, 'team')} · {pluralize(department.seats, 'seat')}
            </p>
          </div>
          <button ref={closeRef} type="button" className={styles.close} aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className={styles.drawerBody}>
          {department.practices.map((practice, index) => (
            <details key={practice.key} className={styles.practice} open={index === 0}>
              <summary>
                <span className={styles.dot} style={{ background: practiceColor(practice.code) }} />
                <span className={styles.practiceName}>{practice.name}</span>
                <span className={styles.count}>
                  {pluralize(practice.teamCount, 'team')} · {pluralize(practice.seats, 'seat')}
                </span>
              </summary>
              <div className={styles.practiceBody}>
                {practice.moduleLeads.map((lead) => (
                  <div key={lead.key}>
                    <div className={styles.lead}>
                      <span className={styles.avatar} aria-hidden="true">
                        {lead.isUnallocated ? 'TBD' : initialsOf(lead.name)}
                      </span>
                      <div>
                        <b>{lead.name}</b>
                        <small>
                          Module Lead, {lead.teams.length === 1 ? '1 team' : `shared across ${pluralize(lead.teams.length, 'team')}`}
                        </small>
                      </div>
                      {lead.isUnallocated && <span className={styles.emptySeat}>Seat empty</span>}
                    </div>
                    <ul className={styles.teams}>
                      {lead.teams.map((team) => (
                        <TeamCard key={team.code} team={team} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </aside>
    </>
  );
}

DepartmentDrawer.propTypes = {
  department: PropTypes.shape({
    code: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    floorNumber: PropTypes.number,
    seats: PropTypes.number.isRequired,
    teamCount: PropTypes.number.isRequired,
    practices: PropTypes.arrayOf(
      PropTypes.shape({
        key: PropTypes.string.isRequired,
        code: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        teamCount: PropTypes.number.isRequired,
        seats: PropTypes.number.isRequired,
        moduleLeads: PropTypes.arrayOf(
          PropTypes.shape({
            key: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired,
            isUnallocated: PropTypes.bool.isRequired,
            teams: PropTypes.arrayOf(PropTypes.object).isRequired,
          })
        ).isRequired,
      })
    ).isRequired,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
};

export default DepartmentDrawer;
