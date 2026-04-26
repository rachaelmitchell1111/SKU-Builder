/**
 * Tests for frontend/components/Layout.js
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({ push: mockPush, pathname: '/items' }),
}));

// next/link just renders a plain <a> in test env
jest.mock('next/link', () => {
  const Link = ({ children, href, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  Link.displayName = 'Link';
  return Link;
});

const mockLogout = jest.fn();
let mockUser = null;

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, logout: mockLogout }),
}));

import Layout from '../../components/Layout';

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderLayout(user = null) {
  mockUser = user;
  return render(<Layout><div>content</div></Layout>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = null;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Layout — unauthenticated', () => {
  it('renders the brand link', () => {
    renderLayout();
    expect(screen.getByText('SKU Builder')).toBeInTheDocument();
  });

  it('does not render user info when logged out', () => {
    renderLayout();
    expect(screen.queryByText(/logout/i)).not.toBeInTheDocument();
  });
});

describe('Layout — regular user', () => {
  const regularUser = { email: 'user@test.com', role: 'user' };

  it('shows the user email', () => {
    renderLayout(regularUser);
    expect(screen.getByText(/user@test\.com/)).toBeInTheDocument();
  });

  it('shows Logout button', () => {
    renderLayout(regularUser);
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('does NOT show the Admin link', () => {
    renderLayout(regularUser);
    expect(screen.queryByRole('link', { name: /^users$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /audit log/i })).not.toBeInTheDocument();
  });

  it('does NOT show the admin badge', () => {
    renderLayout(regularUser);
    expect(screen.queryByText('admin')).not.toBeInTheDocument();
  });

  it('calls logout and pushes to /login when Logout is clicked', async () => {
    const user = userEvent.setup();
    renderLayout(regularUser);
    await user.click(screen.getByRole('button', { name: /logout/i }));
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/login');
  });
});

describe('Layout — admin user', () => {
  const adminUser = { email: 'admin@test.com', role: 'admin' };

  it('shows the admin badge next to the email', () => {
    renderLayout(adminUser);
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('shows the Users nav link', () => {
    renderLayout(adminUser);
    expect(screen.getByRole('link', { name: /^users$/i })).toHaveAttribute(
      'href',
      '/admin/users',
    );
  });

  it('shows the Audit Log nav link', () => {
    renderLayout(adminUser);
    expect(screen.getByRole('link', { name: /audit log/i })).toHaveAttribute(
      'href',
      '/admin/audit-logs',
    );
  });
});

describe('Layout — children', () => {
  it('renders its children', () => {
    renderLayout();
    expect(screen.getByText('content')).toBeInTheDocument();
  });
});
