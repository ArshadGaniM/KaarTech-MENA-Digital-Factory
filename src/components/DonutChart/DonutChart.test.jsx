import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DonutChart from './DonutChart';

const segments = [
  { key: 'Offshore', label: 'Offshore', count: 75 },
  { key: 'Onsite', label: 'Onsite', count: 25 },
];

describe('DonutChart', () => {
  it('lists every segment in the legend with its count and share', () => {
    render(<DonutChart segments={segments} onSelect={() => {}} centerLabel="resources" />);

    expect(screen.getByRole('button', { name: /Offshore 75 \(75%\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Onsite 25 \(25%\)/ })).toBeInTheDocument();
  });

  it('shows the total and its label in the middle', () => {
    const { container } = render(<DonutChart segments={segments} onSelect={() => {}} centerLabel="resources" />);

    expect(container.querySelector('svg')).toHaveTextContent('100');
    expect(container.querySelector('svg')).toHaveTextContent('resources');
  });

  it('gives each slice a hover tooltip with its exact numbers', () => {
    const { container } = render(<DonutChart segments={segments} onSelect={() => {}} centerLabel="resources" />);

    const titles = [...container.querySelectorAll('circle title')].map((title) => title.textContent);
    expect(titles).toEqual(['Offshore: 75 (75%)', 'Onsite: 25 (25%)']);
  });

  it('reports the segment key when its legend button is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<DonutChart segments={segments} onSelect={onSelect} centerLabel="resources" />);

    await user.click(screen.getByRole('button', { name: /Onsite/ }));

    expect(onSelect).toHaveBeenCalledWith('Onsite');
  });

  it('reports the segment key when the slice itself is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { container } = render(<DonutChart segments={segments} onSelect={onSelect} centerLabel="resources" />);

    await user.click(container.querySelectorAll('circle')[1]);

    expect(onSelect).toHaveBeenCalledWith('Offshore');
  });

  it('marks the selected segment as pressed and no other', () => {
    render(<DonutChart segments={segments} selectedKey="Onsite" onSelect={() => {}} centerLabel="resources" />);

    expect(screen.getByRole('button', { name: /Onsite/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Offshore/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('cannot select a segment marked not selectable (for example "Not set")', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <DonutChart
        segments={[...segments, { key: '__not-set', label: 'Not set', count: 5, selectable: false }]}
        onSelect={onSelect}
        centerLabel="resources"
      />
    );

    const button = screen.getByRole('button', { name: /Not set/ });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('says there is no data instead of drawing an empty ring', () => {
    render(<DonutChart segments={[{ key: 'a', label: 'A', count: 0 }]} onSelect={() => {}} centerLabel="resources" />);

    expect(screen.getByText('No data yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
