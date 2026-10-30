import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import OrganizationStructure from './OrganizationStructure';

describe('OrganizationStructure', () => {
  it('renders an empty labelled section', () => {
    render(<OrganizationStructure />);

    const region = screen.getByRole('region', { name: 'Organization Structure' });
    expect(region).toBeEmptyDOMElement();
  });
});
