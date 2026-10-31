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
    vi.fn((url) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            String(url).includes('/v1/control-center') ? { data: { departments: [] } } : { data: [], total: 0, activeTotal: 0 }
          ),
      })
    )
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// NAV_ITEMS[0] is "Control Center", [1] is "Organization Structure" and [2] is
// "Dashboard" (no route/columns). NAV_ITEMS[3]/[4] are the first two real master-data
// tables, used to genuinely exercise the item-switching path without a mocked registry.
const [controlCenter, organizationStructure, dashboard, firstTable, secondTable] = NAV_ITEMS;

describe('AppShell', () => {
  it('resolves the initial view from a valid initialHash', async () => {
    render(<AppShell initialHash={firstTable.hash} />);

    expect(screen.getByRole('button', { name: firstTable.label })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByRole('columnheader', { name: firstTable.columns[0].label })).toBeInTheDocument();
  });

  it('falls back to the first NAV_ITEMS entry (Control Center) for an invalid or missing hash', () => {
    render(<AppShell initialHash="#does-not-exist" />);

    expect(screen.getByRole('button', { name: controlCenter.label })).toHaveAttribute('aria-current', 'page');
  });

  it('uses the first NAV_ITEMS entry (Control Center) when no initialHash is passed at all', async () => {
    render(<AppShell />);

    expect(screen.getByRole('button', { name: controlCenter.label })).toHaveAttribute('aria-current', 'page');
    // The Control Center drops the top bar's title; its own page heading names it.
    expect(screen.queryByRole('heading', { name: controlCenter.label })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'MENA Digital Factory', level: 1 })).toBeInTheDocument();
  });

  // FEAT-18: the heading previously stayed hardcoded to "Dashboard" no
  // matter which section was active — fixed to track the active section's
  // own label.
  it('shows a heading matching the active section, updating when the section changes', async () => {
    const user = userEvent.setup();
    render(<AppShell initialHash={firstTable.hash} />);

    expect(screen.getByRole('heading', { name: firstTable.label })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: secondTable.label }));

    expect(screen.getByRole('heading', { name: secondTable.label })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: firstTable.label })).not.toBeInTheDocument();
  });

  it('shows "Dashboard" as the heading when the Dashboard section is active', () => {
    render(<AppShell initialHash={dashboard.hash} />);

    expect(screen.getByRole('heading', { name: dashboard.label })).toBeInTheDocument();
  });

  it('switches sidebar selection and table content when a different section is clicked', async () => {
    const user = userEvent.setup();
    render(<AppShell initialHash={firstTable.hash} />);

    await user.click(screen.getByRole('button', { name: secondTable.label }));

    expect(screen.getByRole('button', { name: firstTable.label })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: secondTable.label })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByRole('columnheader', { name: secondTable.columns[0].label })).toBeInTheDocument();
  });

  it('shows the Organization Structure page under its own heading', async () => {
    render(<AppShell initialHash={organizationStructure.hash} />);

    expect(screen.getByRole('button', { name: organizationStructure.label })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { name: organizationStructure.label })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: organizationStructure.label })).toBeInTheDocument();
  });

  it('shows the Dashboard overview for the Dashboard section itself', async () => {
    render(<AppShell initialHash={dashboard.hash} />);

    expect(screen.getByRole('button', { name: dashboard.label })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
  });

  it('renders a skip link targeting the main content region', () => {
    render(<AppShell initialHash={firstTable.hash} />);

    const skipLink = screen.getByRole('link', { name: 'Skip to content' });
    expect(skipLink).toHaveAttribute('href', '#shell-main-content');
    expect(document.getElementById('shell-main-content')).not.toBeNull();
  });
});
