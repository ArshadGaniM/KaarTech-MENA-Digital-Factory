import { useCallback, useState } from 'react';
import DepartmentDrawer from './DepartmentDrawer';
import DepartmentTile from './DepartmentTile';
import LeaderBand from './LeaderBand';
import ManagerCard from './ManagerCard';
import SeatShareBar from './SeatShareBar';
import { useOrganizationStructure } from '../../hooks/useOrganizationStructure';
import styles from './OrganizationStructure.module.css';

function OrganizationStructure() {
  const { data, isLoading, error } = useOrganizationStructure();
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [openCode, setOpenCode] = useState(null);
  const closeDrawer = useCallback(() => setOpenCode(null), []);

  if (isLoading) {
    return (
      <p className={styles.status} role="status" aria-live="polite">
        Loading…
      </p>
    );
  }
  if (!data) {
    return (
      <p className={styles.statusError} role="alert">
        Could not load the organization structure: {error.message}
      </p>
    );
  }

  const managers = data.projectManagers;
  const selected = managers.find((manager) => manager.id === selectedId) ?? managers[0];
  const allDepartments = managers.flatMap((manager) => manager.departments);
  const term = query.trim().toLowerCase();
  const shown = term
    ? allDepartments.filter((department) => department.name.toLowerCase().includes(term))
    : (selected?.departments ?? []);
  // Looked up by code on every render, so a live refresh updates an open drawer
  // and a department that disappears closes it.
  const openDepartment = allDepartments.find((department) => department.code === openCode);
  const maxSeats = Math.max(...managers.map((manager) => manager.seats), 1);

  return (
    <section className={styles.page} aria-label="Organization Structure">
      {error && (
        <p className={styles.statusError} role="alert">
          Could not refresh: {error.message}. Showing the last loaded data.
        </p>
      )}
      <div className={styles.toolbar}>
        <span className={styles.live}>
          <i aria-hidden="true" />
          Live: updates as teams change
        </span>
      </div>
      <LeaderBand
        leader={data.deliveryManager}
        totalSeats={data.totalSeats}
        filledSeats={data.filledSeats}
        totalDepartments={data.totalDepartments}
        totalTeams={data.totalTeams}
      />
      {managers.length === 0 ? (
        <p className={styles.empty}>No teams yet.</p>
      ) : (
        <>
          <SeatShareBar managers={managers} totalSeats={data.totalSeats} selectedId={selected.id} onSelect={setSelectedId} />
          <div className={styles.managers}>
            {managers.map((manager) => (
              <ManagerCard
                key={manager.id}
                manager={manager}
                maxSeats={maxSeats}
                isSelected={manager.id === selected.id}
                onSelect={(id) => {
                  setSelectedId(id);
                  setQuery('');
                }}
              />
            ))}
          </div>
          <div className={styles.panelHead}>
            <h2>{term ? `Departments matching "${query.trim()}"` : `${selected.title}: departments`}</h2>
            <label className={styles.searchLabel}>
              <span className={styles.visuallyHidden}>Find a department</span>
              <input
                type="search"
                className={styles.search}
                placeholder="Find a department"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
          {shown.length === 0 ? (
            <p className={styles.empty}>No department matches. Try another word.</p>
          ) : (
            <div className={styles.depts}>
              {shown.map((department) => (
                <DepartmentTile key={department.code} department={department} onOpen={setOpenCode} />
              ))}
            </div>
          )}
        </>
      )}
      {openDepartment && <DepartmentDrawer department={openDepartment} onClose={closeDrawer} />}
    </section>
  );
}

export default OrganizationStructure;
