import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchServices, toServices } from './servicesApi';
import { fetchMasterDataTable } from './masterDataApi';

vi.mock('./masterDataApi');

const row = (overrides) => ({ code: 'DEPT-001', name: 'Design Services', floorNumber: 2, output: 'Designs things.', markedDeleted: 'No', ...overrides });

describe('toServices', () => {
  it('turns the department name into the title and the Output into the description', () => {
    expect(toServices([row()])).toEqual([{ code: 'DEPT-001', title: 'Design Services', description: 'Designs things.' }]);
  });

  it('orders by floor number, lowest first, and breaks ties by code', () => {
    const rows = [row({ code: 'DEPT-003', name: 'C', floorNumber: 3 }), row({ code: 'DEPT-002', name: 'B', floorNumber: 1 }), row({ code: 'DEPT-001', name: 'A', floorNumber: 1 })];
    expect(toServices(rows).map((service) => service.title)).toEqual(['A', 'B', 'C']);
  });

  it('leaves out deleted departments', () => {
    expect(toServices([row(), row({ code: 'DEPT-002', markedDeleted: 'Yes' })])).toHaveLength(1);
  });

  it('gives an empty description when the Output is empty or missing', () => {
    expect(toServices([row({ output: null })])[0].description).toBe('');
    expect(toServices([row({ output: '   ' })])[0].description).toBe('');
  });
});

describe('fetchServices', () => {
  beforeEach(() => vi.resetAllMocks());

  it('reads the departments at the largest page size', async () => {
    fetchMasterDataTable.mockResolvedValue({ rows: [row()], total: 1 });
    expect(await fetchServices()).toHaveLength(1);
    expect(fetchMasterDataTable).toHaveBeenCalledWith('departments', { limit: 100 });
  });

  it('lets a failed request reach the caller', async () => {
    fetchMasterDataTable.mockRejectedValue(new Error('down'));
    await expect(fetchServices()).rejects.toThrow('down');
  });
});
