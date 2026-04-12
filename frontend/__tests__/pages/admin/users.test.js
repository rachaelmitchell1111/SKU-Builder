/**
 * Tests for frontend/pages/admin/users.js
 *
 * Key: useRouter() must return a stable object so the `router` dep in the
 * page's useEffect doesn't appear to change on every render.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Stable router object
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

// Direct jest.fn() references so clearAllMocks doesn't break them
const mockGetUsers = jest.fn();
const mockSetUserRole = jest.fn();

jest.mock('../../../lib/api', () => ({
  getUsers: (...a) => mockGetUsers(...a),
  setUserRole: (...a) => mockSetUserRole(...a),
}));

let mockCurrentUser = null;
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockCurrentUser, loading: false }),
}));

jest.mock('../../../components/Layout', () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

import AdminUsersPage from '../../../pages/admin/users';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const adminUser = { _id: 'admin1', email: 'admin@test.com', role: 'admin' };
const regularUser = { _id: 'user1', email: 'user@test.com', role: 'user', createdAt: '2024-01-01' };
const otherAdmin = { _id: 'admin2', email: 'other@test.com', role: 'admin', createdAt: '2024-01-02' };

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentUser = null;
  window.alert = jest.fn();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AdminUsersPage — redirects', () => {
  it('redirects to /login when not logged in', async () => {
    mockCurrentUser = null;
    render(<AdminUsersPage />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
  });

  it('redirects to /items when logged in as a regular user', async () => {
    mockCurrentUser = { ...regularUser };
    render(<AdminUsersPage />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/items'));
  });
});

describe('AdminUsersPage — rendering', () => {
  beforeEach(() => {
    mockCurrentUser = adminUser;
  });

  it('shows the page heading', async () => {
    mockGetUsers.mockResolvedValueOnce([]);
    render(<AdminUsersPage />);
    await waitFor(() => screen.getByRole('heading', { name: /user management/i }));
  });

  it('shows "No users found." when the list is empty', async () => {
    mockGetUsers.mockResolvedValueOnce([]);
    render(<AdminUsersPage />);
    await waitFor(() => expect(screen.getByText('No users found.')).toBeInTheDocument());
  });

  it('renders a row for each user', async () => {
    mockGetUsers.mockResolvedValueOnce([regularUser, otherAdmin]);
    render(<AdminUsersPage />);
    await waitFor(() => screen.getByText('user@test.com'));
    expect(screen.getByText('other@test.com')).toBeInTheDocument();
  });

  it('shows role badges', async () => {
    mockGetUsers.mockResolvedValueOnce([regularUser, otherAdmin]);
    render(<AdminUsersPage />);
    await waitFor(() => screen.getByText('user@test.com'));
    expect(screen.getByText('user')).toBeInTheDocument();
    expect(screen.getAllByText('admin').length).toBeGreaterThanOrEqual(1);
  });

  it('shows an error message when getUsers fails', async () => {
    mockGetUsers.mockRejectedValueOnce(new Error('Forbidden'));
    render(<AdminUsersPage />);
    await waitFor(() => expect(screen.getByText('Forbidden')).toBeInTheDocument());
  });
});

describe('AdminUsersPage — role toggle', () => {
  beforeEach(() => {
    mockCurrentUser = adminUser;
  });

  it('shows "Make admin" for regular users', async () => {
    mockGetUsers.mockResolvedValueOnce([regularUser]);
    render(<AdminUsersPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /make admin/i })).toBeInTheDocument());
  });

  it('shows "Remove admin" for admin users (other than self)', async () => {
    mockGetUsers.mockResolvedValueOnce([otherAdmin]);
    render(<AdminUsersPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /remove admin/i })).toBeInTheDocument());
  });

  it('promotes a user to admin on click', async () => {
    mockGetUsers.mockResolvedValueOnce([regularUser]);
    mockSetUserRole.mockResolvedValueOnce({ ...regularUser, role: 'admin' });

    const user = userEvent.setup();
    render(<AdminUsersPage />);
    await waitFor(() => screen.getByRole('button', { name: /make admin/i }));
    await user.click(screen.getByRole('button', { name: /make admin/i }));

    await waitFor(() => expect(mockSetUserRole).toHaveBeenCalledWith(regularUser._id, 'admin'));
    await waitFor(() => expect(screen.getByRole('button', { name: /remove admin/i })).toBeInTheDocument());
  });

  it('demotes an admin to user on click', async () => {
    mockGetUsers.mockResolvedValueOnce([otherAdmin]);
    mockSetUserRole.mockResolvedValueOnce({ ...otherAdmin, role: 'user' });

    const user = userEvent.setup();
    render(<AdminUsersPage />);
    await waitFor(() => screen.getByRole('button', { name: /remove admin/i }));
    await user.click(screen.getByRole('button', { name: /remove admin/i }));

    await waitFor(() => expect(mockSetUserRole).toHaveBeenCalledWith(otherAdmin._id, 'user'));
    await waitFor(() => expect(screen.getByRole('button', { name: /make admin/i })).toBeInTheDocument());
  });
});

describe('AdminUsersPage — self-demotion protection', () => {
  it("disables the action button for the current user's own row", async () => {
    const selfRow = { ...adminUser, createdAt: '2024-01-01' };
    mockGetUsers.mockResolvedValueOnce([selfRow]);
    mockCurrentUser = adminUser;

    render(<AdminUsersPage />);
    await waitFor(() => screen.getByText('admin@test.com'));

    expect(screen.getByText('(you)')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /remove admin/i });
    expect(btn).toBeDisabled();
  });
});
