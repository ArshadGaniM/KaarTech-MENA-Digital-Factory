import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from './Sidebar';
import { APP_SHELL_HASHES } from '../../lib/navigation';

const ITEMS = [
  { id: 'master-data', label: 'Master Data' },
  { id: 'resources', label: 'Resources' },
];

describe('Sidebar', () => {
  it('has a Back to the portal link at the top that leaves the application hashes', () => {
    render(<Sidebar items={ITEMS} activeId="master-data" onSelect={() => {}} />);

    const link = screen.getByRole('link', { name: /Back to the portal/ });
    expect(link).toHaveAttribute('href', '#top');
    expect(APP_SHELL_HASHES).not.toContain('#top');
    // It comes before the section buttons.
    expect(link.compareDocumentPosition(screen.getByRole('button', { name: 'Master Data' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

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

    // The Back to the portal link is first, then the two items.
    await user.tab();
    await user.tab();
    await user.tab();
    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith('resources');
  });
});
