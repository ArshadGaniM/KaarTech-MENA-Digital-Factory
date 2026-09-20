import { useEntityRelationships } from '../../hooks/useEntityRelationships';
import { MASTER_DATA_TABLES } from '../../lib/masterDataApi';
import styles from './EntityRelationship.module.css';

// Reuses the same route -> display label mapping the sidebar already uses
// (masterDataApi.js), so this page's headings match the table names the
// user sees everywhere else, instead of maintaining a second copy.
const LABELS_BY_ROUTE = Object.fromEntries(MASTER_DATA_TABLES.map((table) => [table.route, table.label]));

function labelFor(route) {
  return LABELS_BY_ROUTE[route] ?? route;
}

function describeIdentity(identity) {
  if (identity.type === 'auto-generated') return `Auto-generated code (${identity.field})`;
  if (identity.type === 'caller-supplied-unique') return `Caller-supplied, unique (${identity.field})`;
  return 'No single identity field';
}

function EntityRelationship() {
  const { data, isLoading, error } = useEntityRelationships();

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
        Could not load entity relationships: {error.message}
      </p>
    );
  }

  return (
    <div className={styles.grid}>
      {data.map((entity) => (
        <section key={entity.route} className={styles.card} aria-labelledby={`entity-${entity.route}`}>
          <h3 id={`entity-${entity.route}`}>{labelFor(entity.route)}</h3>
          <p className={styles.identity}>{describeIdentity(entity.identity)}</p>

          {entity.relationships.length > 0 && (
            <>
              <h4>References</h4>
              <ul>
                {entity.relationships.map((rel) => (
                  <li key={rel.field}>
                    <code>{rel.field}</code> → {labelFor(rel.referencesTable)} (<code>{rel.referencesColumn}</code>)
                  </li>
                ))}
              </ul>
            </>
          )}

          {entity.lookups.length > 0 && (
            <>
              <h4>Live lookups</h4>
              <ul>
                {entity.lookups.map((lookup) => (
                  <li key={lookup.key}>
                    <code>{lookup.key}</code> from {labelFor(lookup.sourceTable)}
                    {lookup.via ? ` (via ${labelFor(lookup.via)})` : ''}
                  </li>
                ))}
              </ul>
            </>
          )}

          {entity.relationships.length === 0 && entity.lookups.length === 0 && (
            <p className={styles.noRelations}>No relationships to other tables.</p>
          )}
        </section>
      ))}
    </div>
  );
}

export default EntityRelationship;
