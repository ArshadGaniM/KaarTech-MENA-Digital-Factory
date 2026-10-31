import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import AnimatedNumber from './AnimatedNumber';

describe('AnimatedNumber', () => {
  it('shows a thousands-separated number', () => {
    const { container } = render(<AnimatedNumber value={2756} />);

    expect(container).toHaveTextContent('2,756');
  });

  it('shows a dash for a count that could not be loaded, never zero', () => {
    const { container } = render(<AnimatedNumber value={null} />);

    expect(container).toHaveTextContent('—');
  });

  it('shows zero as zero', () => {
    const { container } = render(<AnimatedNumber value={0} />);

    expect(container).toHaveTextContent('0');
  });
});
