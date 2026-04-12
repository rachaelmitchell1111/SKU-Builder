/**
 * Tests for frontend/components/ItemForm.js
 *
 * Note: labels in ItemForm are NOT associated with inputs via htmlFor/id.
 * We therefore find fields by role + index:
 *   getAllByRole('textbox')  → [0]=Name, [1]=Category, [2]=Color
 *   getAllByRole('spinbutton') → [0]=Price, [1]=StockAmount
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Stable router to avoid infinite effect loops
const mockPush = jest.fn();
const mockItemFormRouter = { push: mockPush };
jest.mock('next/router', () => ({
  useRouter: () => mockItemFormRouter,
}));

// jsdom doesn't implement URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:test');

const mockCreateItem = jest.fn();
const mockUpdateItem = jest.fn();
const mockUploadImages = jest.fn();

jest.mock('../../lib/api', () => ({
  createItem: (...a) => mockCreateItem(...a),
  updateItem: (...a) => mockUpdateItem(...a),
  uploadImages: (...a) => mockUploadImages(...a),
}));

import ItemForm from '../../components/ItemForm';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fill every field and click submit. */
async function fillAndSubmit(user, opts = {}) {
  const textboxes = screen.getAllByRole('textbox');
  const spinners = screen.getAllByRole('spinbutton');

  await user.clear(textboxes[0]);
  await user.type(textboxes[0], opts.name ?? 'Blue Sneaker');

  await user.clear(textboxes[1]);
  await user.type(textboxes[1], opts.category ?? 'Footwear');

  await user.clear(textboxes[2]);
  await user.type(textboxes[2], opts.color ?? 'Blue');

  await user.clear(spinners[0]);
  await user.type(spinners[0], opts.price ?? '49.99');

  await user.clear(spinners[1]);
  await user.type(spinners[1], opts.stock ?? '10');

  const submitBtn =
    screen.queryByRole('button', { name: /create item/i }) ||
    screen.queryByRole('button', { name: /save changes/i });
  await user.click(submitBtn);
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ItemForm — create mode', () => {
  it('renders three text inputs and two number inputs', () => {
    render(<ItemForm />);
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
  });

  it('shows "Create Item" submit button', () => {
    render(<ItemForm />);
    expect(screen.getByRole('button', { name: /create item/i })).toBeInTheDocument();
  });

  it('does NOT show the SKU field in create mode', () => {
    render(<ItemForm />);
    expect(screen.queryByText(/sku \(auto-generated\)/i)).not.toBeInTheDocument();
  });

  it('renders image slot labels for all six views', () => {
    render(<ItemForm />);
    ['main', 'top', 'bottom', 'left', 'right', 'brandsize'].forEach((field) => {
      expect(screen.getByText(new RegExp(field, 'i'))).toBeInTheDocument();
    });
  });

  it('calls createItem with correct values on submit', async () => {
    mockCreateItem.mockResolvedValueOnce({ _id: 'new-id' });
    const user = userEvent.setup();
    render(<ItemForm />);
    await fillAndSubmit(user);
    expect(mockCreateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Blue Sneaker',
        category: 'Footwear',
        color: 'Blue',
        price: 49.99,
        stockAmount: 10,
      }),
    );
  });

  it('redirects to /items after successful create', async () => {
    mockCreateItem.mockResolvedValueOnce({ _id: 'new-id' });
    const user = userEvent.setup();
    render(<ItemForm />);
    await fillAndSubmit(user);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/items'));
  });

  it('shows an error message on API failure', async () => {
    mockCreateItem.mockRejectedValueOnce(new Error('Server error'));
    const user = userEvent.setup();
    render(<ItemForm />);
    await fillAndSubmit(user);
    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('navigates to /items when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<ItemForm />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockPush).toHaveBeenCalledWith('/items');
  });
});

describe('ItemForm — edit mode', () => {
  const initialData = {
    _id: 'item-123',
    sku: 'SKU-001',
    name: 'Red Boot',
    category: 'Footwear',
    color: 'Red',
    price: 79.99,
    stockAmount: 5,
  };

  it('pre-fills fields with initialData values', () => {
    render(<ItemForm initialData={initialData} />);
    expect(screen.getByDisplayValue('Red Boot')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Footwear')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Red')).toBeInTheDocument();
  });

  it('shows the SKU in read-only display', () => {
    render(<ItemForm initialData={initialData} />);
    expect(screen.getByText('SKU-001')).toBeInTheDocument();
  });

  it('shows "Save Changes" submit button in edit mode', () => {
    render(<ItemForm initialData={initialData} />);
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('calls updateItem (not createItem) on submit', async () => {
    mockUpdateItem.mockResolvedValueOnce({ _id: 'item-123' });
    const user = userEvent.setup();
    render(<ItemForm initialData={initialData} />);
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() =>
      expect(mockUpdateItem).toHaveBeenCalledWith(
        'item-123',
        expect.objectContaining({ name: 'Red Boot' }),
      ),
    );
    expect(mockCreateItem).not.toHaveBeenCalled();
  });
});

describe('ItemForm — image upload', () => {
  it('calls uploadImages when a file is chosen and form is submitted', async () => {
    mockCreateItem.mockResolvedValueOnce({ _id: 'new-id' });
    mockUploadImages.mockResolvedValueOnce({});
    const user = userEvent.setup();
    render(<ItemForm />);

    const file = new File(['data'], 'shoe.png', { type: 'image/png' });
    const fileInputs = document.querySelectorAll('input[type="file"]');
    await user.upload(fileInputs[0], file);

    await fillAndSubmit(user);
    await waitFor(() =>
      expect(mockUploadImages).toHaveBeenCalledWith('new-id', expect.any(FormData)),
    );
  });
});
