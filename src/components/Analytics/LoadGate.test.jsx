import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoadGate from './LoadGate';

const loaded = { data: { rows: [] }, error: null };

describe('LoadGate', () => {
  it('says Loading until every dataset has arrived', () => {
    render(<LoadGate results={[loaded, { data: null, error: null }]} what="the projects" onRetry={() => {}}>content</LoadGate>);

    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });

  it('shows the error and retries when a dataset failed and nothing is loaded', async () => {
    const onRetry = vi.fn();
    render(<LoadGate results={[loaded, { data: null, error: new Error('down') }]} what="the projects" onRetry={onRetry}>content</LoadGate>);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load the projects: down');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('keeps the content and says the numbers are earlier ones when a refresh failed', () => {
    render(<LoadGate results={[{ data: { rows: [] }, error: new Error('timeout') }, loaded]} what="the projects" onRetry={() => {}}>content</LoadGate>);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not refresh the projects, showing the earlier numbers: timeout');
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('shows only the content when everything loaded', () => {
    render(<LoadGate results={[loaded]} what="the projects" onRetry={() => {}}>content</LoadGate>);

    expect(screen.getByText('content')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
