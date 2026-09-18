import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

// App's app-shell branch mounts MasterDataView, which fetches over the
// network via useMasterDataTable; stub fetch so this routing-boundary test
// stays deterministic and offline.
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
  window.location.hash = '';
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('renders AppShell alone (no marketing Header/Footer) for an app-shell hash — locks in AC-1', () => {
    window.location.hash = '#master-data';
    render(<App />);

    expect(screen.getByRole('navigation', { name: 'Workspace sections' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Talk to Us' })).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
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
});
