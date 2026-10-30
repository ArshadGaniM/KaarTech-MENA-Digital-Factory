import { fetchAllMasterDataTableRows } from '../lib/masterDataApi';
import { useAsyncResource } from './useAsyncResource';

// Department code -> name. The list route also returns soft-deleted rows
// (markedDeleted: "Yes"), which must not name a floor.
async function fetchDepartmentNames() {
  const rows = await fetchAllMasterDataTableRows('departments');
  return new Map(rows.filter((row) => row.markedDeleted !== 'Yes').map((row) => [row.code, row.name]));
}

export function useDepartmentNames() {
  return useAsyncResource(fetchDepartmentNames, []);
}
