import { useState } from 'react';
import DepartmentDetail from './DepartmentDetail';
import DepartmentTile from './DepartmentTile';
import LeaderBand from './LeaderBand';
import ManagerCard from './ManagerCard';
import OrgTree from './OrgTree';
import SeatShareBar from './SeatShareBar';
import TeamDialog from '../ControlCenter/TeamDialog';
import { useOrganizationStructure } from '../../hooks/useOrganizationStructure';
import { currentMonth } from '../../lib/months';
import styles from './OrganizationStructure.module.css';

function OrganizationStructure() {
  const { data, isLoading, error, updatedAt } = useOrganizationStructure();
  // undefined: nothing picked yet, so the first manager shows. null: the picked manager was toggled off.
  const [selectedId, setSelectedId] = useState(undefined);
  const [query, setQuery] = useState('');
  const [openCode, setOpenCode] = useState(null);
  const [view, setView] = useState('cards');
  // The team popup: the same one the Control Center opens. It opens on the current month.
  const [openTeam, setOpenTeam] = useState(null);

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
  const selected = selectedId === null ? null : (managers.find((manager) => manager.id === selectedId) ?? managers[0]);
  const allDepartments = managers.flatMap((manager) => manager.departments);
  const term = query.trim().toLowerCase();
  const shown = term
    ? allDepartments.filter((department) => department.name.toLowerCase().includes(term))
    : (selected?.departments ?? []);
  // Looked up by code among the departments on show, so a live refresh updates
  // the open detail and a department that disappears or is filtered out closes it.
  const openDepartment = shown.find((department) => department.code === openCode);
  const pickManager = (id) => {
    setSelectedId(id === selected?.id ? null : id);
    setOpenCode(null);
    setQuery('');
  };
  const toggleDepartment = (code) => setOpenCode(code === openCode ? null : code);
  const maxSeats = Math.max(...managers.map((manager) => manager.seats), 1);

  return (
    <section className={styles.page} aria-label="Organization Structure">
      {error && (
        <p className={styles.statusError} role="alert">
          Could not refresh: {error.message}. Showing the last loaded data.
        </p>
      )}
      <div className={styles.toolbar}>
        <div className={styles.viewSwitch} role="group" aria-label="View">
          {['cards', 'tree'].map((name) => (
            <button key={name} type="button" aria-pressed={view === name} onClick={() => setView(name)}>
              {name === 'cards' ? 'Cards' : 'Tree'}
            </button>
          ))}
        </div>
        <span className={styles.live}>
          <i aria-hidden="true" />
          Live: updates as teams change
        </span>
      </div>
      {view === 'cards' && (
      <LeaderBand
        leader={data.deliveryManager}
        totalSeats={data.totalSeats}
        filledSeats={data.filledSeats}
        totalDepartments={data.totalDepartments}
        totalTeams={data.totalTeams}
      />
      )}
      {managers.length === 0 ? (
        <p className={styles.empty}>No teams yet.</p>
      ) : view === 'tree' ? (
        <OrgTree
          leader={data.deliveryManager}
          managers={managers}
          selected={selected ?? managers[0]}
          onSelect={setSelectedId}
        />
      ) : (
        <>
          <SeatShareBar managers={managers} totalSeats={data.totalSeats} selectedId={selected?.id ?? null} onSelect={pickManager} />
          <div className={styles.managers}>
            {managers.map((manager) => (
              <ManagerCard
                key={manager.id}
                manager={manager}
                maxSeats={maxSeats}
                isSelected={manager.id === selected?.id}
                onSelect={pickManager}
              />
            ))}
          </div>
          <div className={styles.panelHead}>
            <h2>{term ? `Departments matching "${query.trim()}"` : selected ? `${selected.title}: departments` : 'Departments'}</h2>
            <label className={styles.searchLabel}>
              <span className={styles.visuallyHidden}>Find a department</span>
              <input
                type="search"
                className={styles.search}
                placeholder="Find a department"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setOpenCode(null);
                }}
              />
            </label>
          </div>
          {!term && !selected ? (
            <p className={styles.empty}>Select a project manager to see its departments.</p>
          ) : shown.length === 0 ? (
            <p className={styles.empty}>No department matches. Try another word.</p>
          ) : (
            <div className={styles.depts}>
              {shown.map((department) => (
                <DepartmentTile
                  key={department.code}
                  department={department}
                  isOpen={department.code === openCode}
                  onToggle={toggleDepartment}
                />
              ))}
            </div>
          )}
          {openDepartment && (
            <DepartmentDetail
              key={openDepartment.code}
              department={openDepartment}
              onOpenTeam={(code) => setOpenTeam({ code, month: currentMonth() })}
            />
          )}
        </>
      )}
      {openTeam && (
        <TeamDialog code={openTeam.code} month={openTeam.month} updatedAt={updatedAt} pageError={error} onClose={() => setOpenTeam(null)} />
      )}
    </section>
  );
}

export default OrganizationStructure;
