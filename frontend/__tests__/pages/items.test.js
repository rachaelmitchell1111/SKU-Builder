/**
 * Tests for frontend/pages/items/index.js
 *
 * Key: useRouter() must return a stable object reference. If a new object is
 * returned on each render the `router` dependency in the fetch useEffect will
 * change every cycle and trigger an infinite re-fetch loop where loading never
 * clears.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Stable router object — MUST not be recreated on each call
const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };

jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('next/link', () => {
  const Link = ({ children, href, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  Link.displayName = 'Link';
  return Link;
});

const mockGetItems = jest.fn();
const mockDeleteItem = jest.fn();
const mockRestoreItem = jest.fn();
const mockBulkDelete = jest.fn();
const mockBulkRestore = jest.fn();

jest.mock('../../lib/api', () => ({
  getItems: (...a) => mockGetItems(...a),
  deleteItem: (...a) => mockDeleteItem(...a),
  restoreItem: (...a) => mockRestoreItem(...a),
  bulkDelete: (...a) => mockBulkDelete(...a),
  bulkRestore: (...a) => mockBulkRestore(...a),
}));

let mockUser = null;
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));

jest.mock('../../components/Layout', () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

import ItemsPage from '../../pages/items/index';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeItem = (overrides = {}) => ({
  _id: 'item1',
  name: 'Blue Sneaker',
  sku: 'SKU-001',
  category: 'Footwear',
  color: 'Blue',
  price: 49.99,
  stockAmount: 10,
  isDeleted: false,
  images: {},
  ...overrides,
});

function mockItems(items, extras = {}) {
  mockGetItems.mockResolvedValue({ data: items, total: items.length, pages: 1, ...extras });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = null;
  window.confirm = jest.fn(() => true);
  window.alert = jest.fn();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ItemsPage — unauthenticated', () => {
  it('redirects to /login when there is no user', async () => {
    mockUser = null;
    render(<ItemsPage />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
  });
});

describe('ItemsPage — regular user', () => {
  beforeEach(() => {
    mockUser = { _id: 'u1', email: 'u@test.com', role: 'user' };
  });

  it('renders items returned from the API', async () => {
    mockItems([makeItem()]);
    render(<ItemsPage />);
    expect(await screen.findByText('Blue Sneaker')).toBeInTheDocument();
  });

  it('shows "No items found." when the list is empty', async () => {
    mockItems([]);
    render(<ItemsPage />);
    expect(await screen.findByText('No items found.')).toBeInTheDocument();
  });

  it('does NOT show Delete or Restore buttons for regular users', async () => {
    mockItems([makeItem()]);
    render(<ItemsPage />);
    await screen.findByText('Blue Sneaker');
    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^restore$/i })).not.toBeInTheDocument();
  });

  it('does NOT show "Show deleted" checkbox for regular users', async () => {
    mockItems([]);
    render(<ItemsPage />);
    await screen.findByText('No items found.');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('shows an error message when getItems fails', async () => {
    mockGetItems.mockRejectedValue(new Error('Network error'));
    render(<ItemsPage />);
    expect(await screen.findByText('Network error')).toBeInTheDocument();
  });
});

describe('ItemsPage — admin user', () => {
  beforeEach(() => {
    mockUser = { _id: 'admin1', email: 'admin@test.com', role: 'admin' };
  });

  it('shows Delete button for live items', async () => {
    mockItems([makeItem({ isDeleted: false })]);
    render(<ItemsPage />);
    await screen.findByText('Blue Sneaker');
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
  });

  it('shows Restore button for deleted items', async () => {
    mockItems([makeItem({ isDeleted: true })]);
    render(<ItemsPage />);
    await screen.findByText('Blue Sneaker');
    expect(screen.getByRole('button', { name: /^restore$/i })).toBeInTheDocument();
  });

  it('calls deleteItem after confirming delete', async () => {
    const item = makeItem({ _id: 'item-abc' });
    // First call returns item; after delete refetch returns empty
    mockGetItems
      .mockResolvedValueOnce({ data: [item], total: 1, pages: 1 })
      .mockResolvedValue({ data: [], total: 0, pages: 1 });
    mockDeleteItem.mockResolvedValueOnce(null);

    const user = userEvent.setup();
    render(<ItemsPage />);
    await screen.findByText('Blue Sneaker');
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(mockDeleteItem).toHaveBeenCalledWith('item-abc'));
  });

  it('shows the "Show deleted" checkbox', async () => {
    mockItems([]);
    render(<ItemsPage />);
    await screen.findByText('No items found.');
    expect(screen.getByRole('checkbox', { name: /show deleted/i })).toBeInTheDocument();
  });

  it('shows bulk action bar when items are selected', async () => {
    mockItems([makeItem()]);
    const user = userEvent.setup();
    render(<ItemsPage />);
    await screen.findByText('Blue Sneaker');

    // Admin view has two checkboxes: [0]="Show deleted" filter, [1]=item card
    const checkboxes = screen.getAllByRole('checkbox');
    const itemCheckbox = checkboxes[checkboxes.length - 1]; // last = item card
    await user.click(itemCheckbox);
    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bulk delete/i })).toBeInTheDocument();
  });

  it('"Select all on page" selects every item', async () => {
    mockItems([makeItem({ _id: 'a' }), makeItem({ _id: 'b', name: 'Red Boot' })]);
    const user = userEvent.setup();
    render(<ItemsPage />);
    await screen.findByText('Blue Sneaker');

    await user.click(screen.getByRole('button', { name: /select all on page/i }));
    expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
  });
});

describe('ItemsPage — pagination', () => {
  beforeEach(() => {
    mockUser = { _id: 'u1', email: 'u@test.com', role: 'user' };
  });

  it('renders Previous/Next buttons when there are multiple pages', async () => {
    mockGetItems.mockResolvedValue({ data: [makeItem()], total: 13, pages: 2 });
    render(<ItemsPage />);
    await screen.findByText('Blue Sneaker');
    expect(screen.getByRole('button', { name: /← previous/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next →/i })).toBeInTheDocument();
  });

  it('disables the Previous button on the first page', async () => {
    mockGetItems.mockResolvedValue({ data: [makeItem()], total: 13, pages: 2 });
    render(<ItemsPage />);
    await screen.findByText('Blue Sneaker');
    expect(screen.getByRole('button', { name: /← previous/i })).toBeDisabled();
  });

  it('does not show pagination when there is only one page', async () => {
    mockItems([makeItem()]);
    render(<ItemsPage />);
    await screen.findByText('Blue Sneaker');
    expect(screen.queryByRole('button', { name: /← previous/i })).not.toBeInTheDocument();
  });
});
