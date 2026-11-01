import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Gantt from './Gantt';

const percent = (element, property) => parseFloat(element.style[property]);

describe('Gantt', () => {
  it('starts and sizes each bar from its dates on one shared axis', () => {
    render(
      <Gantt
        rows={[
          { key: 'a', label: 'Team A', sub: 'One', start: '2026-01-01', end: '2026-01-10' },
          { key: 'b', label: 'Team B', sub: 'Two', start: '2026-01-06', end: '2026-01-10' },
        ]}
      />
    );

    const a = screen.getByTitle('2026-01-01 to 2026-01-10');
    const b = screen.getByTitle('2026-01-06 to 2026-01-10');
    expect(percent(a, 'left')).toBeCloseTo(0);
    expect(percent(a, 'width')).toBeCloseTo(100);
    expect(percent(b, 'left')).toBeCloseTo(50);
    expect(percent(b, 'width')).toBeCloseTo(50);
  });

  it('ends the latest bar exactly at the right edge', () => {
    render(
      <Gantt
        rows={[
          { key: 'a', label: 'A', sub: '', start: '2026-01-01', end: '2026-12-31' },
          { key: 'b', label: 'B', sub: '', start: '2026-03-01', end: '2027-02-28' },
        ]}
      />
    );

    const b = screen.getByTitle('2026-03-01 to 2027-02-28');
    expect(percent(b, 'left') + percent(b, 'width')).toBeCloseTo(100);
  });

  it('draws a one day assignment as the whole axis', () => {
    render(<Gantt rows={[{ key: 'a', label: 'A', sub: '', start: '2026-05-05', end: '2026-05-05' }]} />);

    const bar = screen.getByTitle('2026-05-05 to 2026-05-05');
    expect(percent(bar, 'left')).toBe(0);
    expect(percent(bar, 'width')).toBe(100);
  });

  it('labels the rows with the team and the project', () => {
    render(<Gantt rows={[{ key: 'a', label: 'Team A', sub: 'Roll out', start: '2026-01-01', end: '2026-02-01' }]} />);

    expect(screen.getByText('Team A')).toBeInTheDocument();
    expect(screen.getByText('Roll out')).toBeInTheDocument();
  });

  it('labels about twelve months at most, however long the span', () => {
    const { container } = render(<Gantt rows={[{ key: 'a', label: 'A', sub: '', start: '2020-01-01', end: '2030-12-31' }]} />);

    expect(container.querySelectorAll('ol li').length).toBeLessThanOrEqual(12);
    expect(container.querySelectorAll('ol li').length).toBeGreaterThan(1);
  });
});
