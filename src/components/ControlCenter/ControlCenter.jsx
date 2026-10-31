import { useState } from 'react';
import FactoryFloor from './FactoryFloor';
import MonthPicker from './MonthPicker';
import TeamDialog from './TeamDialog';
import { FLOORS } from './factoryLayout';
import { useControlCenter } from '../../hooks/useControlCenter';
import { currentMonth } from '../../lib/months';
import styles from './ControlCenter.module.css';

// What the status line says: not live when the latest try failed, busy while
// loading, otherwise live with the time of the last update.
function liveStatus({ data, error, isLoading, updatedAt }) {
  const time = updatedAt?.toLocaleTimeString('en-GB');
  if (error) return { dotClass: styles.liveDotError, text: data ? `Not live, last updated ${time}` : 'Not live' };
  if (isLoading) return { dotClass: styles.liveDotBusy, text: data ? 'Updating…' : 'Loading…' };
  return { dotClass: styles.liveDot, text: `Live, updated ${time}` };
}

function ControlCenter() {
  const [month, setMonth] = useState(() => currentMonth());
  const [openTeam, setOpenTeam] = useState(null);
  const { data, isLoading, error, updatedAt } = useControlCenter(month);
  const live = liveStatus({ data, error, isLoading, updatedAt });
  const departments = new Map((data?.departments ?? []).map((department) => [department.code, department]));

  return (
    <div className={styles.controlCenter}>
      <div className={styles.toolbar}>
        <MonthPicker month={month} onChange={setMonth} />
        <p className={styles.live} role="status" aria-live="polite">
          <span className={live.dotClass} aria-hidden="true" />
          {live.text}
        </p>
      </div>
      {error && (
        <p className={styles.statusError} role="alert">
          {data ? `Could not refresh, showing the last data: ${error.message}` : `Could not load the factory: ${error.message}`}
        </p>
      )}
      {data && data.departments.length === 0 && (
        <p className={styles.statusError} role="alert">
          The backend returned no departments, so no floor can be filled in.
        </p>
      )}

      {data && (
      <section className={`${styles.building} ${isLoading ? styles.buildingBusy : ''}`} aria-labelledby="factory-title">
        <h1 id="factory-title" className={styles.roof}>
          MENA Digital Factory
        </h1>
        <ol className={styles.floors}>
          {FLOORS.map((floor, i) => {
            const department = departments.get(floor.departmentCode);
            return (
              <FactoryFloor
                key={floor.id}
                level={FLOORS.length - i}
                name={department?.name ?? `${floor.departmentCode} (department not found)`}
                teams={department?.teams ?? []}
                onOpenTeam={setOpenTeam}
              />
            );
          })}
        </ol>
      </section>
      )}

      {openTeam && <TeamDialog code={openTeam} month={month} onClose={() => setOpenTeam(null)} />}
    </div>
  );
}

export default ControlCenter;
