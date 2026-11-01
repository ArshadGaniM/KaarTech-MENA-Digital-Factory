import { useEffect, useState } from 'react';
import { CONTROL_CENTER_STREAM_URL } from '../lib/controlCenterApi';
import { fetchAllMasterDataTableRows } from '../lib/masterDataApi';
import { buildOrgStructure } from '../lib/orgStructure';

// Same safety net and spread-out refetch as the Control Center: the page
// refreshes when the backend says data changed, and every 30 seconds even if
// the stream drops.
const POLL_MS = 30_000;
const MAX_JITTER_MS = 500;

async function loadOrgStructure() {
  const [departments, teams, positions, competencies, practices, deployments] = await Promise.all([
    fetchAllMasterDataTableRows('departments'),
    fetchAllMasterDataTableRows('teams'),
    fetchAllMasterDataTableRows('positions'),
    fetchAllMasterDataTableRows('competencies'),
    fetchAllMasterDataTableRows('practices'),
    fetchAllMasterDataTableRows('resource-deployment'),
  ]);
  return buildOrgStructure({ departments, teams, positions, competencies, practices, deployments });
}

// Returns { data, isLoading, error }. If a refresh fails the last data stays
// on screen and `error` says the latest try failed.
export function useOrganizationStructure() {
  const [state, setState] = useState({ data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    let latest = 0;
    let jitterTimer = null;

    // Only the newest request may update the page, so a slow older response
    // cannot overwrite newer data.
    const load = () => {
      const request = ++latest;
      return loadOrgStructure()
        .then((data) => {
          if (!cancelled && request === latest) setState({ data, error: null });
        })
        .catch((error) => {
          if (!cancelled && request === latest) setState((prev) => ({ ...prev, error }));
        });
    };
    const loadSoon = () => {
      clearTimeout(jitterTimer);
      jitterTimer = setTimeout(load, Math.random() * MAX_JITTER_MS);
    };

    load();
    const stream = typeof EventSource === 'undefined' ? null : new EventSource(CONTROL_CENTER_STREAM_URL);
    stream?.addEventListener('changed', loadSoon);
    const poll = setInterval(load, POLL_MS);

    return () => {
      cancelled = true;
      clearTimeout(jitterTimer);
      stream?.close();
      clearInterval(poll);
    };
  }, []);

  return { data: state.data, error: state.error, isLoading: state.data === null && state.error === null };
}
