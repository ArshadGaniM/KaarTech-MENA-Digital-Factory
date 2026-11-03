import { useState } from 'react';
import PropTypes from 'prop-types';
import { initialsOf } from './initialsOf';
import { nameTag } from './leaderName';
import { pluralize, pluralNoun } from './pluralize';
import { practiceColor } from './practiceColor';
import TreeToggle from './TreeToggle';
import styles from './OrganizationStructure.module.css';

// What is open by default: the first department of the manager, with its
// practices, so the whole path from manager to team shows at once.
function defaultOpen(manager) {
  const first = manager.departments[0];
  return new Set(first ? [first.code, ...first.practices.map((practice) => practice.key)] : []);
}

const allKeys = (manager) => new Set(manager.departments.flatMap((department) => [department.code, ...department.practices.map((practice) => practice.key)]));

// The same data as the cards, as a tree: Delivery Manager, Project Managers,
// then for the picked manager its departments, practices, Module Leads and
// teams. A team under No practice or a seat with no Module Lead shows as the
// builder grouped it.
function OrgTree({ leader, managers, selected, onSelect }) {
  // Open state belongs to the picked manager. Picking any manager starts from the default.
  const [expansion, setExpansion] = useState({ managerId: null, keys: new Set() });
  const keys = expansion.managerId === selected.id ? expansion.keys : defaultOpen(selected);
  const setKeys = (next) => setExpansion({ managerId: selected.id, keys: next });
  const pick = (id) => {
    // Picking the manager already shown keeps what the reader opened.
    if (id === selected.id) return;
    setExpansion({ managerId: null, keys: new Set() });
    onSelect(id);
  };
  const flip = (key) => {
    const next = new Set(keys);
    if (!next.delete(key)) next.add(key);
    setKeys(next);
  };

  return (
    <div className={styles.tree}>
      <div className={styles.treeRoot}>
        <span className={styles.role}>Layer 1 · {leader.title}</span>
        <strong>MENA Digital Factory</strong>
        {leader.name && <span className={styles.chipTbd}>{nameTag(leader.name)}</span>}
      </div>
      <div className={styles.treeStem} aria-hidden="true" />
      <div className={styles.treeManagers} role="group" aria-label="ODC Project Managers">
        {managers.map((manager) => (
          <button
            key={manager.id}
            type="button"
            className={styles.treeManager}
            aria-pressed={manager.id === selected.id}
            onClick={() => pick(manager.id)}
          >
            <span className={styles.role}>Layer 2</span>{' '}
            <span className={styles.treeManagerTitle}>{manager.title}</span>{' '}
            {manager.name && <span className={styles.chipTbd}>{nameTag(manager.name)}</span>}{' '}
            <span className={styles.seats}>
              {manager.seats}
              <small> {pluralNoun(manager.seats, 'seat')}</small>
            </span>
          </button>
        ))}
      </div>

      <div className={styles.treePanel}>
        <div className={styles.treeHead}>
          <h2>
            {selected.title} · {pluralize(selected.departments.length, 'department')}
          </h2>
          <span className={styles.treeTools}>
            <button type="button" className={styles.linkButton} onClick={() => setKeys(allKeys(selected))}>
              Expand all
            </button>
            <button type="button" className={styles.linkButton} onClick={() => setKeys(new Set())}>
              Collapse all
            </button>
          </span>
        </div>
        <ul className={styles.treeList}>
          {selected.departments.map((department) => {
            const departmentOpen = keys.has(department.code);
            return (
              <li key={department.code}>
                <div className={styles.treeRow}>
                  <TreeToggle id={`tree-${department.code}`} isOpen={departmentOpen} onToggle={() => flip(department.code)}>
                    <span className={styles.treeTag}>Department</span>{' '}
                    <span className={styles.treeName}>{department.name}</span>{' '}
                    <span className={styles.treeCount}>
                      Floor {department.floorNumber} · {department.filled}/{department.seats} seats · {pluralize(department.teamCount, 'team')}
                    </span>
                  </TreeToggle>
                </div>
                {departmentOpen && (
                  <ul className={styles.treeList} id={`tree-${department.code}`}>
                    {department.practices.map((practice) => {
                      const practiceOpen = keys.has(practice.key);
                      return (
                        <li key={practice.key}>
                          <div className={styles.treeRow}>
                            <TreeToggle id={`tree-${practice.key}`} isOpen={practiceOpen} onToggle={() => flip(practice.key)}>
                              <span className={styles.treeTag}>Practice</span>{' '}
                              <i className={styles.treeDot} style={{ background: practiceColor(practice.code) }} aria-hidden="true" />
                              <span className={styles.treeName}>{practice.name}</span>{' '}
                              <span className={styles.treeCount}>
                                {practice.filled}/{practice.seats} seats · {pluralize(practice.teamCount, 'team')}
                              </span>
                            </TreeToggle>
                          </div>
                          {practiceOpen && (
                            <ul className={styles.treeList} id={`tree-${practice.key}`}>
                              {practice.moduleLeads.map((lead) => (
                                <li key={lead.key}>
                                  <div className={styles.treeLead}>
                                    <span className={styles.treeWho}>
                                      <span className={styles.avatar} aria-hidden="true">
                                        {lead.isUnallocated ? 'TBD' : initialsOf(lead.name)}
                                      </span>
                                      <span>
                                        <span className={styles.role}>Module Lead</span>
                                        <br />
                                        <strong>{lead.isUnallocated ? 'TBD' : lead.name}</strong>
                                      </span>
                                    </span>
                                    <ul className={styles.treeTeams} aria-label={`Teams of ${lead.isUnallocated ? 'the unfilled Module Lead seat' : lead.name}`}>
                                      {lead.teams.map((team) => (
                                        <li key={team.code} className={team.filled > 0 ? styles.treeTeamFilled : undefined}>
                                          {team.name}
                                          <i>
                                            {team.filled}/{team.seats}
                                          </i>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

OrgTree.propTypes = {
  leader: PropTypes.shape({ title: PropTypes.string, name: PropTypes.string }).isRequired,
  managers: PropTypes.arrayOf(PropTypes.object).isRequired,
  selected: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    departments: PropTypes.arrayOf(PropTypes.object).isRequired,
  }).isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default OrgTree;
