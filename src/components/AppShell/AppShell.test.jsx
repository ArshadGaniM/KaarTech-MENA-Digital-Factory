import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppShell from './AppShell';
import { NAV_ITEMS } from '../../lib/navigation';

// AppShell's active view (MasterDataView -> MasterDataTable) makes a real
// network call via useMasterDataTable; stub fetch so these shell-level tests
// stay deterministic and offline, without reaching into the view's internals.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    })
  );
});

// The real NAV_ITEMS registry currently has one entry, so exercising
// AppShell's item-switching behaviour against it would be a no-op assertion
// that passes whether or not switching actually works. Mock a two-item
// registry locally so the switching path is genuinely exercised.
vi.mock('../../lib/navigation', async () => {
  const actual = await vi.importActual('../../lib/navigation');
  const SecondView = () => <p>Second view content</p>;
  const items = [
    actual.NAV_ITEMS[0],
    { id: 'second-view', label: 'Second View', hash: '#second-view', component: SecondView },
  ];
  return {
    ...actual,
    NAV_ITEMS: items,
    APP_SHELL_HASHES: items.map((item) => item.hash),
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AppShell', () => {
  it('resolves the initial view from a valid initialHash', () => {
    render(<AppShell initialHash="#master-data" />);

    expect(screen.getByRole('button', { name: 'Master Data' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { name: 'Master Data' })).toBeInTheDocument();
  });

  it('falls back to the first NAV_ITEMS entry for an invalid or missing hash', () => {
    render(<AppShell initialHash="#does-not-exist" />);

    const fallbackLabel = NAV_ITEMS[0].label;
    expect(screen.getByRole('button', { name: fallbackLabel })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { name: fallbackLabel })).toBeInTheDocument();
  });

  it('uses the first NAV_ITEMS entry when no initialHash is passed at all', () => {
    render(<AppShell />);

    const fallbackLabel = NAV_ITEMS[0].label;
    expect(screen.getByRole('heading', { name: fallbackLabel })).toBeInTheDocument();
  });

  it('switches TopBar title and content when a different Sidebar item is selected', async () => {
    const user = userEvent.setup();
    render(<AppShell initialHash="#master-data" />);

    const other = NAV_ITEMS[1];
    await user.click(screen.getByRole('button', { name: other.label }));

    expect(screen.getByRole('heading', { name: other.label })).toBeInTheDocument();
    expect(screen.getByText('Second view content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Master Data' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: other.label })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('heading', { name: 'Master Data' })).not.toBeInTheDocument();
  });

  it('renders a skip link targeting the main content region', () => {
    render(<AppShell initialHash="#master-data" />);

    const skipLink = screen.getByRole('link', { name: 'Skip to content' });
    expect(skipLink).toHaveAttribute('href', '#shell-main-content');
    expect(document.getElementById('shell-main-content')).not.toBeNull();
  });
});
