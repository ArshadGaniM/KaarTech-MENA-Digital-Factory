import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { buildHierarchy, keysWithChildren } from '../../lib/orgHierarchy';
import styles from './OrganizationStructure.module.css';

// A node's box. A box with something under it opens and closes that branch. A team
// box opens the team popup, the same one the Control Center opens.
function Box({ node, isOpen, onToggle, onOpenTeam }) {
  const hasChildren = node.children.length > 0;
  const content = (
    <>
      <span className={styles.hierLabel}>{node.label}</span>{' '}
      <span className={styles.hierTitle}>{node.title}</span>{' '}
      <span className={styles.hierMeta}>{node.meta}</span>
    </>
  );
  if (node.kind === 'team') {
    return (
      <button type="button" className={`${styles.hierBox} ${styles.hierTeam}`} onClick={() => onOpenTeam(node.teamCode)} aria-label={`${node.title}, ${node.teamCode}. Open details`}>
        {content}
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`${styles.hierBox} ${styles[`hier_${node.kind}`] ?? ''}`}
      aria-expanded={hasChildren ? isOpen : undefined}
      disabled={!hasChildren}
      onClick={() => onToggle(node.key)}
    >
      {content}
      {hasChildren && (
        <span className={styles.hierCount} aria-hidden="true">
          {isOpen ? '▾' : '▸'} {node.children.length}
        </span>
      )}
    </button>
  );
}

Box.propTypes = {
  node: PropTypes.shape({
    key: PropTypes.string.isRequired,
    kind: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    meta: PropTypes.string.isRequired,
    teamCode: PropTypes.string,
    children: PropTypes.array.isRequired,
  }).isRequired,
  isOpen: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  onOpenTeam: PropTypes.func.isRequired,
};

function Branch({ node, open, onToggle, onOpenTeam }) {
  const isOpen = open.has(node.key);
  return (
    <li>
      <Box node={node} isOpen={isOpen} onToggle={onToggle} onOpenTeam={onOpenTeam} />
      {isOpen && node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <Branch key={child.key} node={child} open={open} onToggle={onToggle} onOpenTeam={onOpenTeam} />
          ))}
        </ul>
      )}
    </li>
  );
}

Branch.propTypes = {
  node: PropTypes.object.isRequired,
  open: PropTypes.instanceOf(Set).isRequired,
  onToggle: PropTypes.func.isRequired,
  onOpenTeam: PropTypes.func.isRequired,
};

// The Delivery Manager at the top, the Project Managers under it, then departments,
// practices, Module Leads and teams. It starts with the first two levels showing.
function OrgHierarchy({ structure, onOpenTeam }) {
  const root = useMemo(() => buildHierarchy(structure), [structure]);
  const [open, setOpen] = useState(() => new Set(['leader']));
  const toggle = (key) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  return (
    <div className={styles.hier}>
      <div className={styles.hierTools}>
        <button type="button" onClick={() => setOpen(new Set(keysWithChildren(root)))}>
          Expand all
        </button>
        <button type="button" onClick={() => setOpen(new Set(['leader']))}>
          Collapse all
        </button>
      </div>
      <div className={styles.hierScroll}>
        <ul className={styles.hierTree} aria-label="Organization tree">
          <Branch node={root} open={open} onToggle={toggle} onOpenTeam={onOpenTeam} />
        </ul>
      </div>
    </div>
  );
}

OrgHierarchy.propTypes = {
  structure: PropTypes.shape({ deliveryManager: PropTypes.object.isRequired, projectManagers: PropTypes.array.isRequired }).isRequired,
  onOpenTeam: PropTypes.func.isRequired,
};

export default OrgHierarchy;
