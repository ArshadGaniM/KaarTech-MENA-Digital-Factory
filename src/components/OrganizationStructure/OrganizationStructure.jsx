import { useState } from 'react';
import TreeNode from './TreeNode';
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

function allNodeKeys(data) {
  return data.projectManagers.flatMap((manager) => [
    manager.id,
    ...manager.departments.flatMap((department) => {
      const departmentKey = `${manager.id}/${department.code}`;
      return [
        departmentKey,
        ...department.practices.flatMap((practice) => {
          const practiceKey = `${departmentKey}/${practice.code}`;
          return [practiceKey, ...practice.moduleLeads.map((lead) => `${practiceKey}/${lead.key}`)];
        }),
      ];
    }),
  ]);
}

function OrganizationStructure() {
  const { data, isLoading, error } = useOrganizationStructure();
  const [openKeys, setOpenKeys] = useState(() => new Set());

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

  const toggle = (key, isOpen) =>
    setOpenKeys((current) => {
      const next = new Set(current);
      if (isOpen) next.add(key);
      else next.delete(key);
      return next;
    });

  return (
    <section aria-label="Organization Structure">
      {error && (
        <p className={styles.statusError} role="alert">
          Could not refresh: {error.message}. Showing the last loaded data.
        </p>
      )}
      <div className={styles.toolbar}>
        <p className={styles.leader}>
          <span className={styles.leaderTitle}>{data.deliveryManager.title}</span>
          <span className={styles.meta}>{data.deliveryManager.name}</span>
        </p>
        <p className={styles.total}>
          Total seats <strong>{data.totalSeats}</strong>
        </p>
        <div className={styles.actions}>
          <button type="button" onClick={() => setOpenKeys(new Set(allNodeKeys(data)))}>
            Expand all
          </button>
          <button type="button" onClick={() => setOpenKeys(new Set())}>
            Collapse all
          </button>
        </div>
      </div>
      <div className={styles.tree}>
        {data.projectManagers.map((manager) => (
          <TreeNode
            key={manager.id}
            id={manager.id}
            isOpen={openKeys.has(manager.id)}
            onToggle={toggle}
            title={manager.title}
            meta={manager.name ?? undefined}
            seats={manager.seats}
          >
            {manager.departments.map((department) => {
              const departmentKey = `${manager.id}/${department.code}`;
              return (
                <TreeNode
                  key={departmentKey}
                  id={departmentKey}
                  isOpen={openKeys.has(departmentKey)}
                  onToggle={toggle}
                  title={department.name}
                  meta={`${department.code} · Floor ${department.floorNumber ?? '–'} · ${department.teamCount} teams`}
                  seats={department.seats}
                >
                  {department.practices.length === 0 && <p className={styles.empty}>No teams yet.</p>}
                  {department.practices.map((practice) => {
                    const practiceKey = `${departmentKey}/${practice.code}`;
                    return (
                      <TreeNode
                        key={practiceKey}
                        id={practiceKey}
                        isOpen={openKeys.has(practiceKey)}
                        onToggle={toggle}
                        title={practice.name}
                        meta="Practice"
                        seats={practice.seats}
                      >
                        {practice.moduleLeads.map((lead) => {
                          const leadKey = `${practiceKey}/${lead.key}`;
                          return (
                            <TreeNode
                              key={leadKey}
                              id={leadKey}
                              isOpen={openKeys.has(leadKey)}
                              onToggle={toggle}
                              title={lead.name}
                              meta={lead.key === 'unallocated' ? 'Module Lead seat empty' : 'Module Lead'}
                            >
                              <ul className={styles.teams}>
                                {lead.teams.map((team) => (
                                  <TeamCard key={team.code} team={team} />
                                ))}
                              </ul>
                            </TreeNode>
                          );
                        })}
                      </TreeNode>
                    );
                  })}
                </TreeNode>
              );
            })}
          </TreeNode>
        ))}
      </div>
    </section>
  );
}

export default OrganizationStructure;
