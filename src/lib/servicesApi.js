import { byDepartmentOrder } from './departmentOrder';
import { fetchAllMasterDataTableRows } from './masterDataApi';

// The services on the portal are the live departments in the application. A
// department's name is the service title and its Output is the description.
// Departments are listed in the owner's order (departmentOrder.js). Every page is read, so no service is cut off.
export function toServices(rows) {
  return rows
    .filter((row) => row.markedDeleted !== 'Yes')
    .sort(byDepartmentOrder)
    .map((row) => ({
      code: row.code,
      title: row.name,
      description: (row.output ?? '').trim(),
    }));
}

export async function fetchServices() {
  return toServices(await fetchAllMasterDataTableRows('departments'));
}
