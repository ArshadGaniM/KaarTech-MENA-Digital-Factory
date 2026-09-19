import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import DeliveryCenters from './DeliveryCenters';
import { APP_SHELL_HASHES } from '../../lib/navigation';

describe('DeliveryCenters', () => {
  it('renders under "our-delivery-centers", not the dashboard\'s own "delivery-centers" route', () => {
    const { container } = render(<DeliveryCenters />);

    expect(container.querySelector('#our-delivery-centers')).not.toBeNull();
    expect(container.querySelector('#delivery-centers')).toBeNull();
  });

  it("doesn't collide with any dashboard app-shell hash", () => {
    expect(APP_SHELL_HASHES).not.toContain('#our-delivery-centers');
  });
});
