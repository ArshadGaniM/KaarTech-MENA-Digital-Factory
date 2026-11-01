import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { NAV_ITEMS, DASHBOARD_HASH } from './lib/navigation';

// App's app-shell branch mounts MasterDataTable, which fetches over the
// network via useMasterDataTable; stub fetch so this routing-boundary test
// stays deterministic and offline.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [], total: 0, activeTotal: 0 }),
    })
  );
});

afterEach(() => {
  window.location.hash = '';
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('renders AppShell alone (no marketing Header/Footer) for an app-shell hash — locks in AC-1', () => {
    window.sessionStorage.setItem('application-unlocked', 'yes');
    window.location.hash = NAV_ITEMS[0].hash;
    render(<App />);

    expect(screen.getByRole('navigation', { name: 'Workspace sections' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Talk to Us' })).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it('landing on the Dashboard hash — the same value Header\'s "Dashboard" link uses — resolves to the Dashboard section', async () => {
    window.sessionStorage.setItem('application-unlocked', 'yes');
    window.location.hash = DASHBOARD_HASH;
    render(<App />);

    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
  });

  it('renders the marketing tree (Header + Footer) with AppShell absent for a non-app-shell hash', () => {
    window.location.hash = '';
    render(<App />);

    expect(screen.getByRole('link', { name: 'Talk to Us' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Workspace sections' })).not.toBeInTheDocument();
  });

  it('renders the marketing tree for an unrecognized hash', () => {
    window.location.hash = '#not-a-real-section';
    render(<App />);

    expect(screen.getByRole('link', { name: 'Talk to Us' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Workspace sections' })).not.toBeInTheDocument();
  });

  describe('password screen in front of the application', () => {
    it('keeps the whole portal public, with no password asked', () => {
      window.location.hash = '';
      render(<App />);

      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Charter' })).toBeInTheDocument();
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
      expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    });

    it('asks for the password instead of opening the application, and links back to the portal', () => {
      window.location.hash = NAV_ITEMS[0].hash;
      render(<App />);

      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Workspace sections' })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Back to the portal' })).toHaveAttribute('href', '#top');
    });

    it('opens the application on the section asked for after the right password, and stays open for the tab', async () => {
      const user = userEvent.setup();
      window.location.hash = DASHBOARD_HASH;
      const { unmount } = render(<App />);

      await user.type(screen.getByLabelText('Password'), 'Meena UOCC');
      await user.click(screen.getByRole('button', { name: 'Open the application' }));

      expect(await screen.findByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
      expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();

      unmount();
      render(<App />);
      await waitFor(() => expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument());
    });

    it('stays locked on a wrong password', async () => {
      const user = userEvent.setup();
      window.location.hash = NAV_ITEMS[0].hash;
      render(<App />);

      await user.type(screen.getByLabelText('Password'), 'nope');
      await user.click(screen.getByRole('button', { name: 'Open the application' }));

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Workspace sections' })).not.toBeInTheDocument();
    });
  });
});
