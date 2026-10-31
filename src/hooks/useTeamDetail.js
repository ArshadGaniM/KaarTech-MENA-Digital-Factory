import { fetchTeamDetail } from '../lib/controlCenterApi';
import { useAsyncResource } from './useAsyncResource';

export function useTeamDetail(code, month) {
  return useAsyncResource(() => fetchTeamDetail(code, month), [code, month]);
}
