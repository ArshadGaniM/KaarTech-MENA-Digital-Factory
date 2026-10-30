import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import ControlCenter from './ControlCenter';

describe('ControlCenter', () => {
  it('renders an empty page until its layout is defined', () => {
    const { container } = render(<ControlCenter />);

    expect(container.firstChild).toBeEmptyDOMElement();
  });
});
