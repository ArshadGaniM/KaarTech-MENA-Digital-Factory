import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppShell from './AppShell';
import { NAV_ITEMS } from '../../lib/navigation';

// AppShell's active view (MasterDataTable) makes a real network call via
// useMasterDataTable; stub fetch so these shell-level tests stay
// deterministic and offline.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// NAV_ITEMS[0] is "Dashboard" (no route/columns — empty placeholder).
// NAV_ITEMS[1]/[2] are the first two real master-data tables, used to
// genuinely exercise the item-switching path without a mocked registry.
const [dashboard, firstTable, secondTable] = NAV_ITEMS;

describe('AppShell', () => {
  it('resolves the initial view from a valid initialHash', async () => {
    render(<AppShell initialHash={firstTable.hash} />);

    expect(screen.getByRole('button', { name: firstTable.label })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByRole('columnheader', { name: firstTable.columns[0].label })).toBeInTheDocument();
  });

  it('falls back to the first NAV_ITEMS entry (Dashboard) for an invalid or missing hash', () => {
    render(<AppShell initialHash="#does-not-exist" />);

    expect(screen.getByRole('button', { name: dashboard.label })).toHaveAttribute('aria-current', 'page');
  });

  it('uses the first NAV_ITEMS entry (Dashboard) when no initialHash is passed at all', () => {
    render(<AppShell />);

    expect(screen.getByRole('button', { name: dashboard.label })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument();
  });

  it('shows a static "Dashboard" heading regardless of the active section', async () => {
    const user = userEvent.setup();
    render(<AppShell initialHash={firstTable.hash} />);

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: secondTable.label }));

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('switches sidebar selection and table content when a different section is clicked', async () => {
    const user = userEvent.setup();
    render(<AppShell initialHash={firstTable.hash} />);

    await user.click(screen.getByRole('button', { name: secondTable.label }));

    expect(screen.getByRole('button', { name: firstTable.label })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: secondTable.label })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByRole('columnheader', { name: secondTable.columns[0].label })).toBeInTheDocument();
  });

  it('shows an empty placeholder for the Dashboard section itself', () => {
    render(<AppShell initialHash={dashboard.hash} />);

    expect(screen.getByRole('button', { name: dashboard.label })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument();
  });

  it('renders a skip link targeting the main content region', () => {
    render(<AppShell initialHash={firstTable.hash} />);

    const skipLink = screen.getByRole('link', { name: 'Skip to content' });
    expect(skipLink).toHaveAttribute('href', '#shell-main-content');
    expect(document.getElementById('shell-main-content')).not.toBeNull();
  });
});
