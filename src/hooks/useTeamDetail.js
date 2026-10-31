import { fetchTeamDetail } from '../lib/controlCenterApi';
import { useAsyncResource } from './useAsyncResource';

// One team's detail. `refreshKey` changes whenever the page's own data was
// refreshed, which refetches the team so an open popup stays current. The
// previous detail stays in `data` while the refetch runs.
export function useTeamDetail(code, month, refreshKey) {
  return useAsyncResource(() => fetchTeamDetail(code, month), [code, month, refreshKey]);
}
