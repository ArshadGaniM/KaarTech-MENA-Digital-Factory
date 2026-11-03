import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import TeamCard from './TeamCard';
import { pluralize } from './pluralize';
import { initialsOf } from './initialsOf';
import { practiceColor } from './practiceColor';
import styles from './OrganizationStructure.module.css';

// Mounted only while its department is selected (keyed by code), so mounting
// is "open": the section scrolls into view under the department cards.
function DepartmentDetail({ department }) {
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <section ref={ref} className={styles.detail} aria-label={`${department.name} detail`}>
      <div className={styles.detailHead}>
        <h3>{department.name}</h3>
        <p>
          {department.code} · Floor {department.floorNumber ?? '–'} · {pluralize(department.teamCount, 'team')} · {pluralize(department.seats, 'seat')}
        </p>
      </div>
      <div className={styles.detailBody}>
        {department.practices.map((practice) => (
          <details key={practice.key} className={styles.practice} open>
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
    </section>
  );
}

DepartmentDetail.propTypes = {
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
};

export default DepartmentDetail;
