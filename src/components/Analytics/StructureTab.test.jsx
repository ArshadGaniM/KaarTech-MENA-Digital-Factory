import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StructureTab from './StructureTab';
import { fetchCatalog, fetchStructure } from '../../lib/analyticsApi';

vi.mock('../../lib/analyticsApi');

const position = (teamCode, over = {}) => ({
  departmentName: 'Design',
  floorNumber: 10,
  teamCode,
  teamName: teamCode,
  positionName: 'Consultant',
  competencies: ['FICO'],
  filled: false,
  practiceName: 'Finance',
  ...over,
});
const POSITIONS = [
  position('T1'),
  position('T1'),
  position('T1', { positionName: 'Module Lead', filled: true }),
  position('T2', { competencies: ['FICO', 'MM'] }),
  position('T3', { departmentName: 'Audit', floorNumber: 12, practiceName: null, competencies: [] }),
];
const CATALOG = [
  { kind: 'competency', name: 'FICO', practiceName: 'Finance' },
  { kind: 'competency', name: 'MM', practiceName: 'Logistics' },
  { kind: 'module', name: 'M1', practiceName: 'Finance' },
  { kind: 'department', name: 'Design', floorNumber: 10, input: 'SDD', output: 'FRS' },
  { kind: 'department', name: 'Audit', floorNumber: 12, input: null, output: null },
  { kind: 'practice', name: 'Finance' },
  { kind: 'practice', name: 'Logistics' },
];

const card = (name) => screen.getByRole('region', { name });
const cellsOf = (table) => within(table).getAllByRole('row').map((row) => Array.from(row.children, (cell) => cell.textContent));
const tableOf = async (user, name) => {
  await user.click(within(card(name)).getByRole('button', { name: 'Show table' }));
  return cellsOf(within(card(name)).getByRole('table'));
};
const renderTab = async () => {
  const user = userEvent.setup();
  render(<StructureTab refreshKey={0} />);
  await screen.findByText('5 of 5 positions');
  return user;
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchStructure.mockResolvedValue(POSITIONS);
  fetchCatalog.mockResolvedValue(CATALOG);
});

describe('StructureTab loading', () => {
  it('says Loading, then shows the number of positions', async () => {
    render(<StructureTab refreshKey={0} />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    expect(await screen.findByText('5 of 5 positions')).toBeInTheDocument();
  });

  it('shows the error and recovers on Try again', async () => {
    const user = userEvent.setup();
    fetchStructure.mockRejectedValueOnce(new Error('down'));
    render(<StructureTab refreshKey={0} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the structure: down');
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('5 of 5 positions')).toBeInTheDocument();
  });
});

describe('StructureTab charts', () => {
  it('ranks teams by size and can count only the Consultant and Lead Consultant seats', async () => {
    const user = await renderTab();

    expect(await tableOf(user, 'Team size')).toEqual([['Team', 'Positions'], ['T1', '3'], ['T2', '1'], ['T3', '1']]);

    await user.selectOptions(within(card('Team size')).getByLabelText('Count'), 'Consultant and Lead Consultant seats');
    expect(cellsOf(within(card('Team size')).getByRole('table'))[1]).toEqual(['T1', '2']);
  });

  it('counts teams, positions or seats per department', async () => {
    const user = await renderTab();

    expect(await tableOf(user, 'Department structure')).toEqual([['Department', 'Teams'], ['Design', '2'], ['Audit', '1']]);

    await user.selectOptions(within(card('Department structure')).getByLabelText('Size by'), 'Positions');
    expect(cellsOf(within(card('Department structure')).getByRole('table'))[1]).toEqual(['Design', '4']);
  });

  it('counts the positions that list each competency, or each competency practice', async () => {
    const user = await renderTab();

    expect(await tableOf(user, 'Competency demand')).toEqual([['Competency', 'Positions'], ['FICO', '4'], ['MM', '1']]);

    await user.selectOptions(within(card('Competency demand')).getByLabelText('Group by'), 'Practice');
    expect(cellsOf(within(card('Competency demand')).getByRole('table'))).toEqual([['Practice', 'Positions'], ['Finance', '4'], ['Logistics', '1']]);
  });

  it('counts competencies, modules and teams per practice', async () => {
    const user = await renderTab();

    expect(await tableOf(user, 'Practice portfolio')).toEqual([
      ['Practice', 'Competencies', 'Modules', 'Teams'],
      ['Finance', '1', '1', '2'],
      ['Logistics', '1', '0', '0'],
    ]);

    await user.selectOptions(within(card('Practice portfolio')).getByLabelText('Show'), 'Modules');
    expect(cellsOf(within(card('Practice portfolio')).getByRole('table'))[0]).toEqual(['Practice', 'Modules']);
  });

  it('shows how many teams sit on each floor, top floor first', async () => {
    const user = await renderTab();

    expect(await tableOf(user, 'Departments by floor')).toEqual([['Floor', 'Teams'], ['Floor 12', '1'], ['Floor 10', '2']]);
  });

  it('lists each department with its input and output, and filters by which it has', async () => {
    const user = await renderTab();
    const list = within(card('Department input and output'));

    expect(cellsOf(list.getByRole('table'))).toEqual([['Department', 'Floor', 'Input', 'Output'], ['Design', '10', 'SDD', 'FRS'], ['Audit', '12', '–', '–']]);

    await user.selectOptions(list.getByLabelText('Show'), 'With an output');
    expect(cellsOf(list.getByRole('table')).slice(1)).toEqual([['Design', '10', 'SDD', 'FRS']]);
  });

  it('counts which competencies each team covers in a grid', async () => {
    const user = await renderTab();

    expect(await tableOf(user, 'Competency coverage by team')).toEqual([['Team', 'FICO', 'MM'], ['T1', '3', '0'], ['T2', '1', '1'], ['T3', '0', '0']]);
  });
});

describe('StructureTab slicers', () => {
  it('narrows every chart to one department and clears with Reset slicers', async () => {
    const user = await renderTab();

    await user.selectOptions(screen.getByLabelText('Department'), 'Audit');

    expect(screen.getByText('1 of 5 positions')).toBeInTheDocument();
    expect(await tableOf(user, 'Team size')).toEqual([['Team', 'Positions'], ['T3', '1']]);

    await user.click(screen.getByRole('button', { name: 'Reset slicers' }));
    expect(screen.getByText('5 of 5 positions')).toBeInTheDocument();
  });

  it('keeps all of a chart’s own slices when its own slicer is set', async () => {
    const user = await renderTab();

    await user.selectOptions(screen.getByLabelText('Team'), 'T3');

    expect(await tableOf(user, 'Team size')).toEqual([['Team', 'Positions'], ['T1', '3'], ['T2', '1'], ['T3', '1']]);
  });

  it('lists a team with no practice under Not set', async () => {
    await renderTab();

    expect(within(screen.getByLabelText('Practice')).getByRole('option', { name: 'Not set' })).toBeInTheDocument();
  });
});
