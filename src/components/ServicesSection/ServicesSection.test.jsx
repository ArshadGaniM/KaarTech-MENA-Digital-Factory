import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ServicesSection from './ServicesSection';
import { fetchServices } from '../../lib/servicesApi';

vi.mock('../../lib/servicesApi');

const service = (code, title, description) => ({ code, title, description });

describe('ServicesSection', () => {
  beforeEach(() => vi.resetAllMocks());

  it('shows one card per service, with its description and a Read SOP link to that service', async () => {
    fetchServices.mockResolvedValue([service('DEPT-001', 'Design Services', 'Designs things.'), service('DEPT-002', 'Audit Services', '')]);
    render(<ServicesSection />);

    expect(await screen.findByRole('heading', { name: 'Two services, one delivery operation' })).toBeInTheDocument();
    const design = screen.getByRole('heading', { name: 'Design Services' }).closest('article');
    expect(within(design).getByText('Designs things.')).toBeInTheDocument();
    expect(within(design).getByRole('link', { name: 'Read SOP, Design Services' })).toHaveAttribute('href', '#sop/DEPT-001');
    const audit = screen.getByRole('heading', { name: 'Audit Services' }).closest('article');
    expect(audit.querySelector('p')).toBeNull();
    expect(within(audit).getByRole('link', { name: 'Read SOP, Audit Services' })).toHaveAttribute('href', '#sop/DEPT-002');
  });

  it('counts the services in the heading, so a new department changes it', async () => {
    fetchServices.mockResolvedValue(Array.from({ length: 8 }, (_, i) => service(`DEPT-00${i}`, `Service ${i}`, '')));
    render(<ServicesSection />);

    expect(await screen.findByRole('heading', { name: 'Eight services, one delivery operation' })).toBeInTheDocument();
  });

  it('says "One service" for a single service', async () => {
    fetchServices.mockResolvedValue([service('DEPT-001', 'Design Services', '')]);
    render(<ServicesSection />);

    expect(await screen.findByRole('heading', { name: 'One service, one delivery operation' })).toBeInTheDocument();
  });

  it('says it is loading, then says nothing is listed when there are no departments', async () => {
    fetchServices.mockResolvedValue([]);
    render(<ServicesSection />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading the services.');
    expect(await screen.findByText('No services are listed yet.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Our services, one delivery operation' })).toBeInTheDocument();
  });

  it('says so when the services cannot be loaded and loads them again on Try again', async () => {
    const user = userEvent.setup();
    fetchServices.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce([service('DEPT-001', 'Design Services', '')]);
    render(<ServicesSection />);

    expect(await screen.findByRole('alert')).toHaveTextContent('The services could not be loaded.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'Design Services' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(fetchServices).toHaveBeenCalledTimes(2);
  });
});
