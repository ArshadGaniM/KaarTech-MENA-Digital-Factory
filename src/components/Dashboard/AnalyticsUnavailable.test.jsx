import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnalyticsUnavailable from './AnalyticsUnavailable';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AnalyticsUnavailable', () => {
  it('tells the reader the charts could not be loaded and reloads the page on request', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    render(<AnalyticsUnavailable />);

    expect(screen.getByRole('alert')).toHaveTextContent('The charts could not be loaded');
    await userEvent.click(screen.getByRole('button', { name: 'Reload the page' }));

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
