import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterSummary, InsightCard, InsightNote, InsightPanel } from '.';

describe('InsightPanel', () => {
  it('names the section by its heading, shows the summary and the cards, and links to the table', async () => {
    const user = userEvent.setup();
    const onLink = vi.fn();
    render(
      <InsightPanel id="x" title="Allocation" linkLabel="Open table" onLink={onLink} summary={<p>summary text</p>}>
        <p>card one</p>
      </InsightPanel>
    );

    expect(screen.getByRole('region', { name: 'Allocation' })).toBeInTheDocument();
    expect(screen.getByText('summary text')).toBeInTheDocument();
    expect(screen.getByText('card one')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open table' }));
    expect(onLink).toHaveBeenCalledTimes(1);
  });
});

describe('FilterSummary', () => {
  it('shows the match text in a polite status region and no buttons when nothing is filtered', () => {
    render(<FilterSummary matchingText="12 resources match" chips={[]} onClearAll={() => {}} />);

    expect(screen.getByRole('status')).toHaveTextContent('12 resources match');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows a chip per filter and removes just that one', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <FilterSummary
        matchingText="1 resources match"
        chips={[
          { key: 'a', label: 'Offshore', onRemove },
          { key: 'b', label: 'Analyst', onRemove: () => {} },
        ]}
        onClearAll={() => {}}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Remove filter Offshore' }));

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Remove filter Analyst' })).toBeInTheDocument();
  });

  it('clears everything from Clear filters', async () => {
    const user = userEvent.setup();
    const onClearAll = vi.fn();
    render(<FilterSummary matchingText="x" chips={[{ key: 'a', label: 'A', onRemove: () => {} }]} onClearAll={onClearAll} />);

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(onClearAll).toHaveBeenCalledTimes(1);
  });
});

describe('InsightCard', () => {
  const base = { title: 'Card', errorLabel: 'Could not load it', onRetry: () => {} };

  it('shows its content once there is data', () => {
    render(
      <InsightCard {...base} error={null} hasData>
        <p>the chart</p>
      </InsightCard>
    );

    expect(screen.getByRole('heading', { name: 'Card' })).toBeInTheDocument();
    expect(screen.getByText('the chart')).toBeInTheDocument();
  });

  it('shows Loading until the first result or error', () => {
    render(<InsightCard {...base} error={null} hasData={false} />);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows only the error and a retry when it failed with no data', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<InsightCard {...base} error={new Error('Backend unreachable')} hasData={false} onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load it: Backend unreachable');
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('marks itself busy while new numbers load, and not otherwise', () => {
    const { rerender, container } = render(
      <InsightCard {...base} error={null} hasData isLoading>
        <p>the chart</p>
      </InsightCard>
    );
    expect(container.firstChild).toHaveAttribute('aria-busy', 'true');

    rerender(
      <InsightCard {...base} error={null} hasData isLoading={false}>
        <p>the chart</p>
      </InsightCard>
    );
    expect(container.firstChild).toHaveAttribute('aria-busy', 'false');
  });

  it('keeps the chart when a refresh failed, with the error above it', () => {
    render(
      <InsightCard {...base} error={new Error('boom')} hasData>
        <p>the old chart</p>
      </InsightCard>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('boom');
    expect(screen.getByText('the old chart')).toBeInTheDocument();
  });
});

describe('InsightNote', () => {
  it('shows its message as plain text', () => {
    render(<InsightNote>No resources match.</InsightNote>);

    expect(screen.getByText('No resources match.')).toBeInTheDocument();
  });
});
