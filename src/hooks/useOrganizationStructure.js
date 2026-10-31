import { fetchAllMasterDataTableRows } from '../lib/masterDataApi';
import { buildOrgStructure } from '../lib/orgStructure';
import { useAsyncResource } from './useAsyncResource';

export function useOrganizationStructure() {
  return useAsyncResource(async () => {
    const [departments, teams, positions] = await Promise.all([
      fetchAllMasterDataTableRows('departments'),
      fetchAllMasterDataTableRows('teams'),
      fetchAllMasterDataTableRows('positions'),
    ]);
    return buildOrgStructure({ departments, teams, positions });
  }, []);
}
