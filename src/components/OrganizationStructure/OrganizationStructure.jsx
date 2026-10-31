import { useState } from 'react';
import { useOrganizationStructure } from '../../hooks/useOrganizationStructure';
import styles from './OrganizationStructure.module.css';

function TeamCard({ team }) {
  return (
    <li className={styles.team}>
      <div className={styles.teamHeader}>
        <span className={styles.teamName}>{team.name}</span>
        <span className={styles.badge} aria-label={`${team.seats} seats`}>
          {team.seats}
        </span>
      </div>
      {team.competencies.length > 0 && <p className={styles.competencies}>{team.competencies.join(', ')}</p>}
      <dl className={styles.roles}>
        <div>
          <dt>Module Lead</dt>
          <dd>
            {team.moduleLeads} <span className={styles.unallocated}>unallocated</span>
          </dd>
        </div>
        <div>
          <dt>Lead Consultant</dt>
          <dd>{team.leadConsultants}</dd>
        </div>
        <div>
          <dt>Consultants</dt>
          <dd>{team.consultants}</dd>
        </div>
        {team.others > 0 && (
          <div>
            <dt>Other</dt>
            <dd>{team.others}</dd>
          </div>
        )}
      </dl>
    </li>
  );
}

function OrganizationStructure() {
  const { data, isLoading, error } = useOrganizationStructure();
  const [openCodes, setOpenCodes] = useState(() => new Set());

  if (isLoading) {
    return (
      <p className={styles.status} role="status" aria-live="polite">
        Loading…
      </p>
    );
  }
  if (error) {
    return (
      <p className={styles.statusError} role="alert">
        Could not load the organization structure: {error.message}
      </p>
    );
  }

  const setOpen = (code, isOpen) =>
    setOpenCodes((current) => {
      const next = new Set(current);
      if (isOpen) next.add(code);
      else next.delete(code);
      return next;
    });

  return (
    <section aria-label="Organization Structure">
      <div className={styles.toolbar}>
        <p className={styles.total}>
          Total seats <strong>{data.totalSeats}</strong>
        </p>
        <div className={styles.actions}>
          <button type="button" onClick={() => setOpenCodes(new Set(data.departments.map((d) => d.code)))}>
            Expand all
          </button>
          <button type="button" onClick={() => setOpenCodes(new Set())}>
            Collapse all
          </button>
        </div>
      </div>
      <div className={styles.departments}>
        {data.departments.map((department) => (
          <details
            key={department.code}
            className={styles.department}
            open={openCodes.has(department.code)}
            onToggle={(event) => setOpen(department.code, event.currentTarget.open)}
          >
            <summary className={styles.departmentHeader}>
              <span className={styles.departmentName}>{department.name}</span>
              <span className={styles.meta}>
                {department.code} · Floor {department.floorNumber ?? '–'} · {department.teams.length} teams
              </span>
              <span className={styles.badge} aria-label={`${department.seats} seats`}>
                {department.seats}
              </span>
            </summary>
            {department.teams.length === 0 ? (
              <p className={styles.empty}>No teams yet.</p>
            ) : (
              <ul className={styles.teams}>
                {department.teams.map((team) => (
                  <TeamCard key={team.code} team={team} />
                ))}
              </ul>
            )}
          </details>
        ))}
      </div>
    </section>
  );
}

export default OrganizationStructure;
