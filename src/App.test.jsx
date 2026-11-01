import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { NAV_ITEMS, DASHBOARD_HASH } from './lib/navigation';
import { fetchServices } from './lib/servicesApi';

vi.mock('./lib/servicesApi');

// App's app-shell branch mounts MasterDataTable, which fetches over the
// network via useMasterDataTable; stub fetch so this routing-boundary test
// stays deterministic and offline.
beforeEach(() => {
  fetchServices.mockResolvedValue([{ code: 'DEPT-001', title: 'Design Services', description: 'Designs things.' }]);
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
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
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

async function unlock() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Password'), 'MENAUOCC');
  await user.click(screen.getByRole('button', { name: 'Open the application' }));
  await screen.findByRole('navigation', { name: 'Workspace sections' });
  return user;
}

describe('App', () => {
  it('renders AppShell alone (no marketing Header/Footer) for an app-shell hash — locks in AC-1', async () => {
    window.location.hash = NAV_ITEMS[0].hash;
    render(<App />);
    await unlock();

    expect(screen.getByRole('navigation', { name: 'Workspace sections' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Talk to Us' })).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it('landing on the Dashboard hash — the same value Header\'s "Dashboard" link uses — resolves to the Dashboard section', async () => {
    window.location.hash = DASHBOARD_HASH;
    render(<App />);
    await unlock();

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

    it('opens the application on the section asked for after the right password, and stays open while you move between sections', async () => {
      const user = userEvent.setup();
      window.location.hash = DASHBOARD_HASH;
      render(<App />);

      await user.type(screen.getByLabelText('Password'), 'MENAUOCC');
      await user.click(screen.getByRole('button', { name: 'Open the application' }));

      expect(await screen.findByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
      expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
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

  it('asks for the password again every time you enter the application from the portal', async () => {
    window.location.hash = NAV_ITEMS[0].hash;
    render(<App />);
    const user = await unlock();

    await user.click(screen.getByRole('link', { name: /Back to the portal/ }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Charter' })).toBeInTheDocument());
    expect(screen.queryByRole('navigation', { name: 'Workspace sections' })).not.toBeInTheDocument();

    window.location.hash = NAV_ITEMS[0].hash;
    expect(await screen.findByLabelText('Password')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Workspace sections' })).not.toBeInTheDocument();

    window.location.hash = DASHBOARD_HASH;
    await waitFor(() => expect(screen.getByLabelText('Password')).toBeInTheDocument());
  });

  it('does not ask again when you move from one application section to another', async () => {
    window.location.hash = NAV_ITEMS[0].hash;
    render(<App />);
    await unlock();

    window.location.hash = DASHBOARD_HASH;
    await waitFor(() => expect(window.location.hash).toBe(DASHBOARD_HASH));
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Workspace sections' })).toBeInTheDocument();
  });

  describe('SOP screen', () => {
    it('opens a service\'s SOP screen, with the portal header and footer and no password', async () => {
      window.location.hash = '#sop/DEPT-001';
      render(<App />);

      expect(await screen.findByRole('heading', { level: 1, name: 'Design Services' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Talk to Us' })).toBeInTheDocument();
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
      expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Charter' })).not.toBeInTheDocument();
    });

    it('goes from a Read SOP link to the SOP screen and back to the services', async () => {
      const user = userEvent.setup();
      window.location.hash = '';
      render(<App />);

      await user.click(await screen.findByRole('link', { name: 'Read SOP, Design Services' }));
      expect(await screen.findByRole('heading', { level: 1, name: 'Design Services' })).toBeInTheDocument();

      await user.click(screen.getByRole('link', { name: /Back to services/ }));
      expect(await screen.findByRole('link', { name: 'Read SOP, Design Services' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { level: 1, name: 'Design Services' })).not.toBeInTheDocument();
    });
  });
});
