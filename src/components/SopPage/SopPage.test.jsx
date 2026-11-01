import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import SopPage from './SopPage';
import { fetchServices } from '../../lib/servicesApi';
import { SOP_SECTIONS } from '../../data/sop';

vi.mock('../../lib/servicesApi');

const services = [
  { code: 'DEPT-001', title: 'Design Services', description: 'Designs things.' },
  { code: 'DEPT-002', title: 'Audit Services', description: '' },
];

describe('SopPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.scrollTo = vi.fn();
  });

  it('shows the service name and all ten headings, each with "Content to be added"', async () => {
    fetchServices.mockResolvedValue(services);
    render(<SopPage code="DEPT-001" />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Design Services' })).toBeInTheDocument();
    expect(screen.getByText('Designs things.')).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual(SOP_SECTIONS.map((section) => section.title));
    for (const heading of headings) {
      expect(within(heading.closest('section')).getByText('Content to be added')).toBeInTheDocument();
    }
  });

  it('shows the same headings for every service, and no summary when there is no description', async () => {
    fetchServices.mockResolvedValue(services);
    render(<SopPage code="DEPT-002" />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Audit Services' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(10);
    expect(screen.queryByText('Designs things.')).not.toBeInTheDocument();
  });

  it('links back to the services and opens at the top of the page', async () => {
    fetchServices.mockResolvedValue(services);
    render(<SopPage code="DEPT-001" />);

    expect(screen.getByRole('link', { name: /Back to services/ })).toHaveAttribute('href', '#services');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    await screen.findByRole('heading', { level: 1 });
  });

  it('says so when no live service has that code, for example a deleted one', async () => {
    fetchServices.mockResolvedValue(services);
    render(<SopPage code="DEPT-999" />);

    expect(await screen.findByRole('heading', { name: 'Service not found' })).toBeInTheDocument();
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
    expect(screen.getByRole('link', { name: /Back to services/ })).toBeInTheDocument();
  });

  it('says so when the services cannot be loaded', async () => {
    fetchServices.mockRejectedValue(new Error('down'));
    render(<SopPage code="DEPT-001" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('The SOP could not be loaded.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
