/**
 * Tests for frontend/pages/admin/audit-logs.js
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockReplace = jest.fn();
const mockAuditRouter = { replace: mockReplace };

jest.mock('next/router', () => ({
  useRouter: () => mockAuditRouter,
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

const mockGetAuditLogs = jest.fn();

jest.mock('../../../lib/api', () => ({
  getAuditLogs: (...a) => mockGetAuditLogs(...a),
}));

let mockCurrentUser = null;
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockCurrentUser, loading: false }),
}));

jest.mock('../../../components/Layout', () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

import AuditLogsPage from '../../../pages/admin/audit-logs';

// ── Helpers ───────────────────────────────────────────────────────────────────

const adminUser = { _id: 'a1', email: 'admin@example.com', role: 'admin' };

function makeLogs(overrides = []) {
  return {
    data: overrides.length
      ? overrides
      : [
          {
            _id: 'log1',
            action: 'create',
            timestamp: '2026-01-01T10:00:00.000Z',
            userId: { _id: 'u1', email: 'alice@example.com' },
            itemId: { _id: 'i1', name: 'Blue Shirt', sku: 'SHI-BLU-0001' },
            diff: null,
          },
          {
            _id: 'log2',
            action: 'update',
            timestamp: '2026-01-02T12:00:00.000Z',
            userId: { _id: 'u1', email: 'alice@example.com' },
            itemId: { _id: 'i1', name: 'Blue Shirt', sku: 'SHI-BLU-0001' },
            diff: { price: 19.99 },
          },
        ],
    total: overrides.length || 2,
    page: 1,
    pages: 1,
    limit: 25,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentUser = adminUser;
  mockReplace.mockClear();
});

// ── Auth guards ───────────────────────────────────────────────────────────────

describe('AuditLogsPage — auth guards', () => {
  it('redirects to /login when unauthenticated', async () => {
    mockCurrentUser = null;
    render(<AuditLogsPage />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
  });

  it('redirects to /items when signed in as non-admin', async () => {
    mockCurrentUser = { _id: 'u2', email: 'user@example.com', role: 'user' };
    render(<AuditLogsPage />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/items'));
  });
});

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('AuditLogsPage — rendering', () => {
  it('shows the page heading', async () => {
    mockGetAuditLogs.mockResolvedValueOnce(makeLogs());
    render(<AuditLogsPage />);
    expect(screen.getByRole('heading', { name: /audit log/i })).toBeInTheDocument();
  });

  it('renders log rows with action, user, and item', async () => {
    mockGetAuditLogs.mockResolvedValueOnce(makeLogs());
    render(<AuditLogsPage />);
    await waitFor(() =>
      expect(screen.getAllByText('alice@example.com').length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText('create').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Blue Shirt').length).toBeGreaterThan(0);
  });

  it('shows "No audit log entries found." when data is empty', async () => {
    mockGetAuditLogs.mockResolvedValueOnce({
      data: [],
      total: 0,
      page: 1,
      pages: 1,
      limit: 25,
    });
    render(<AuditLogsPage />);
    await waitFor(() =>
      expect(screen.getByText(/no audit log entries found/i)).toBeInTheDocument(),
    );
  });

  it('shows an error message when the API call fails', async () => {
    mockGetAuditLogs.mockRejectedValueOnce(new Error('Network error'));
    render(<AuditLogsPage />);
    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
  });
});

// ── Diff toggle ───────────────────────────────────────────────────────────────

describe('AuditLogsPage — diff toggle', () => {
  it('shows a "Show" button for entries that have a diff', async () => {
    mockGetAuditLogs.mockResolvedValueOnce(makeLogs());
    render(<AuditLogsPage />);
    await waitFor(() => expect(screen.getByText('Show')).toBeInTheDocument());
  });

  it('expands and collapses the diff on button click', async () => {
    mockGetAuditLogs.mockResolvedValueOnce(makeLogs());
    const user = userEvent.setup();
    render(<AuditLogsPage />);
    await waitFor(() => expect(screen.getByText('Show')).toBeInTheDocument());

    // Expand
    await user.click(screen.getByText('Show'));
    expect(screen.getByText('Hide')).toBeInTheDocument();
    expect(screen.getByText(/"price"/)).toBeInTheDocument();

    // Collapse
    await user.click(screen.getByText('Hide'));
    expect(screen.getByText('Show')).toBeInTheDocument();
    expect(screen.queryByText(/"price"/)).not.toBeInTheDocument();
  });

  it('shows "—" for entries with no diff', async () => {
    mockGetAuditLogs.mockResolvedValueOnce(makeLogs());
    render(<AuditLogsPage />);
    await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThan(0));
  });
});

// ── Action filter ─────────────────────────────────────────────────────────────

describe('AuditLogsPage — action filter', () => {
  it('re-fetches with the selected action filter', async () => {
    mockGetAuditLogs.mockResolvedValue(makeLogs());
    const user = userEvent.setup();
    render(<AuditLogsPage />);
    await waitFor(() => expect(mockGetAuditLogs).toHaveBeenCalledTimes(1));

    const select = screen.getByRole('combobox', { name: /filter by action/i });
    await user.selectOptions(select, 'create');

    await waitFor(() => expect(mockGetAuditLogs).toHaveBeenCalledTimes(2));
    expect(mockGetAuditLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: 'create' }),
    );
  });
});

// ── Pagination ────────────────────────────────────────────────────────────────

describe('AuditLogsPage — pagination', () => {
  it('does not render pagination when there is only one page', async () => {
    mockGetAuditLogs.mockResolvedValueOnce(makeLogs());
    render(<AuditLogsPage />);
    await waitFor(() => expect(screen.queryByText(/previous/i)).not.toBeInTheDocument());
  });

  it('renders Next / Previous buttons when pages > 1', async () => {
    mockGetAuditLogs.mockResolvedValue({
      data: makeLogs().data,
      total: 50,
      page: 1,
      pages: 2,
      limit: 25,
    });
    render(<AuditLogsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
  });

  it('fetches the next page when Next is clicked', async () => {
    mockGetAuditLogs.mockResolvedValue({
      data: makeLogs().data,
      total: 50,
      page: 1,
      pages: 2,
      limit: 25,
    });
    const user = userEvent.setup();
    render(<AuditLogsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(mockGetAuditLogs).toHaveBeenCalledTimes(2));
    expect(mockGetAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });
});
