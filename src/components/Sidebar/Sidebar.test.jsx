import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from './Sidebar';

const ITEMS = [
  { id: 'master-data', label: 'Master Data' },
  { id: 'resources', label: 'Resources' },
];

describe('Sidebar', () => {
  it('renders every item as a nav link', () => {
    render(<Sidebar items={ITEMS} activeId="master-data" onSelect={() => {}} />);

    expect(screen.getByRole('navigation', { name: 'Workspace sections' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Master Data' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resources' })).toBeInTheDocument();
  });

  it('marks the active item with aria-current="page" and leaves inactive items unmarked', () => {
    render(<Sidebar items={ITEMS} activeId="master-data" onSelect={() => {}} />);

    expect(screen.getByRole('button', { name: 'Master Data' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Resources' })).not.toHaveAttribute('aria-current');
  });

  it('calls onSelect with the clicked item id', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Sidebar items={ITEMS} activeId="master-data" onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: 'Resources' }));

    expect(onSelect).toHaveBeenCalledWith('resources');
  });

  it('supports keyboard activation of a nav item', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Sidebar items={ITEMS} activeId="master-data" onSelect={onSelect} />);

    await user.tab();
    await user.tab();
    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith('resources');
  });
});
