import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchServices, toServices } from './servicesApi';
import { fetchAllMasterDataTableRows } from './masterDataApi';

vi.mock('./masterDataApi');

const row = (overrides) => ({ code: 'DEPT-001', name: 'Design Services', floorNumber: 2, output: 'Designs things.', markedDeleted: 'No', ...overrides });

describe('toServices', () => {
  it('does not change the rows it is given', () => {
    const rows = [row({ code: 'B', floorNumber: 2 }), row({ code: 'A', floorNumber: 1 })];
    const snapshot = JSON.stringify(rows);
    toServices(rows);
    expect(JSON.stringify(rows)).toBe(snapshot);
  });

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

  it('reads every page of departments, so none is cut off past one page', async () => {
    fetchAllMasterDataTableRows.mockResolvedValue(Array.from({ length: 150 }, (_, i) => row({ code: `DEPT-${String(i).padStart(3, '0')}`, floorNumber: i })));
    expect(await fetchServices()).toHaveLength(150);
    expect(fetchAllMasterDataTableRows).toHaveBeenCalledWith('departments');
  });

  it('lets a failed request reach the caller', async () => {
    fetchAllMasterDataTableRows.mockRejectedValue(new Error('down'));
    await expect(fetchServices()).rejects.toThrow('down');
  });
});
