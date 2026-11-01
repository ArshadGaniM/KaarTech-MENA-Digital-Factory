import { useState } from 'react';
import TeamCard from './TeamCard';
import TreeNode from './TreeNode';
import { useOrganizationStructure } from '../../hooks/useOrganizationStructure';
import { allNodeKeys } from '../../lib/orgStructure';
import styles from './OrganizationStructure.module.css';

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
            {manager.departments.map((department) => (
              <TreeNode
                key={department.key}
                id={department.key}
                isOpen={openKeys.has(department.key)}
                onToggle={toggle}
                title={department.name}
                meta={`${department.code} · Floor ${department.floorNumber ?? '–'} · ${department.teamCount} teams`}
                seats={department.seats}
              >
                {department.practices.length === 0 && <p className={styles.empty}>No teams yet.</p>}
                {department.practices.map((practice) => (
                  <TreeNode
                    key={practice.key}
                    id={practice.key}
                    isOpen={openKeys.has(practice.key)}
                    onToggle={toggle}
                    title={practice.name}
                    meta="Practice"
                    seats={practice.seats}
                  >
                    {practice.moduleLeads.map((lead) => (
                      <TreeNode
                        key={lead.key}
                        id={lead.key}
                        isOpen={openKeys.has(lead.key)}
                        onToggle={toggle}
                        title={lead.name}
                        meta={lead.isUnallocated ? 'Module Lead seat empty' : 'Module Lead'}
                      >
                        <ul className={styles.teams}>
                          {lead.teams.map((team) => (
                            <TeamCard key={team.code} team={team} />
                          ))}
                        </ul>
                      </TreeNode>
                    ))}
                  </TreeNode>
                ))}
              </TreeNode>
            ))}
          </TreeNode>
        ))}
      </div>
    </section>
  );
}

export default OrganizationStructure;
