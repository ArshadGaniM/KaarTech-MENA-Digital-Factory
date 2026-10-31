import { useState } from 'react';
import FactoryFloor from './FactoryFloor';
import MonthPicker from './MonthPicker';
import TeamDialog from './TeamDialog';
import { FLOORS } from './factoryLayout';
import { useControlCenter } from '../../hooks/useControlCenter';
import { currentMonth } from '../../lib/months';
import styles from './ControlCenter.module.css';

function ControlCenter() {
  const [month, setMonth] = useState(() => currentMonth());
  const [openTeam, setOpenTeam] = useState(null);
  const { data, isLoading, error, updatedAt } = useControlCenter(month);

  if (!data) {
    return error ? (
      <p className={styles.statusError} role="alert">
        Could not load the factory: {error.message}
      </p>
    ) : (
      <p className={styles.status} role="status" aria-live="polite">
        Loading…
      </p>
    );
  }

  const departments = new Map(data.departments.map((department) => [department.code, department]));

  return (
    <div className={styles.controlCenter}>
      <div className={styles.toolbar}>
        <MonthPicker month={month} onChange={setMonth} />
        <p className={styles.live} role="status" aria-live="polite">
          <span className={isLoading ? styles.liveDotBusy : styles.liveDot} aria-hidden="true" />
          {isLoading ? 'Updating…' : `Live, updated ${updatedAt.toLocaleTimeString('en-GB')}`}
        </p>
      </div>
      {error && (
        <p className={styles.statusError} role="alert">
          Could not refresh, showing the last data: {error.message}
        </p>
      )}

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

      {openTeam && <TeamDialog code={openTeam} month={month} onClose={() => setOpenTeam(null)} />}
    </div>
  );
}

export default ControlCenter;
