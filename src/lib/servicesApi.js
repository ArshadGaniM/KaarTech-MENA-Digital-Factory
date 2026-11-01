import { fetchMasterDataTable } from './masterDataApi';

// The services on the portal are the live departments in the application. A
// department's name is the service title and its Output is the description.
// Departments are listed by floor number, lowest first.
const MAX_DEPARTMENTS = 100;

export function toServices(rows) {
  return rows
    .filter((row) => row.markedDeleted !== 'Yes')
    .sort((a, b) => a.floorNumber - b.floorNumber || a.code.localeCompare(b.code))
    .map((row) => ({
      code: row.code,
      title: row.name,
      description: (row.output ?? '').trim(),
    }));
}

export async function fetchServices() {
  const { rows } = await fetchMasterDataTable('departments', { limit: MAX_DEPARTMENTS });
  return toServices(rows);
}
