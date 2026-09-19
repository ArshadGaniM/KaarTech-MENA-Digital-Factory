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

// The real NAV_ITEMS registry now has one entry per master-data table, so
// switching between the first two real entries genuinely exercises the
// item-switching path without needing a mocked registry.
const [first, second] = NAV_ITEMS;

describe('AppShell', () => {
  it('resolves the initial view from a valid initialHash', async () => {
    render(<AppShell initialHash={first.hash} />);

    expect(screen.getByRole('button', { name: first.label })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByRole('columnheader', { name: first.columns[0].label })).toBeInTheDocument();
  });

  it('falls back to the first NAV_ITEMS entry for an invalid or missing hash', () => {
    render(<AppShell initialHash="#does-not-exist" />);

    expect(screen.getByRole('button', { name: first.label })).toHaveAttribute('aria-current', 'page');
  });

  it('uses the first NAV_ITEMS entry when no initialHash is passed at all', () => {
    render(<AppShell />);

    expect(screen.getByRole('button', { name: first.label })).toHaveAttribute('aria-current', 'page');
  });

  it('shows a static "Dashboard" heading regardless of the active section', async () => {
    const user = userEvent.setup();
    render(<AppShell initialHash={first.hash} />);

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: second.label }));

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('switches sidebar selection and table content when a different section is clicked', async () => {
    const user = userEvent.setup();
    render(<AppShell initialHash={first.hash} />);

    await user.click(screen.getByRole('button', { name: second.label }));

    expect(screen.getByRole('button', { name: first.label })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: second.label })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByRole('columnheader', { name: second.columns[0].label })).toBeInTheDocument();
  });

  it('renders a skip link targeting the main content region', () => {
    render(<AppShell initialHash={first.hash} />);

    const skipLink = screen.getByRole('link', { name: 'Skip to content' });
    expect(skipLink).toHaveAttribute('href', '#shell-main-content');
    expect(document.getElementById('shell-main-content')).not.toBeNull();
  });
});
