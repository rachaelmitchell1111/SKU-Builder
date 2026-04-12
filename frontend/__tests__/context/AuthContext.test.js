/**
 * Tests for frontend/context/AuthContext.js
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../context/AuthContext';

jest.mock('../../lib/api', () => ({
  getMe: jest.fn(),
}));

// AuthContext now uses useRouter for the auth:expired redirect
const mockReplace = jest.fn();
const mockAuthCtxRouter = { replace: mockReplace };
jest.mock('next/router', () => ({
  useRouter: () => mockAuthCtxRouter,
}));

import { getMe } from '../../lib/api';

// Helper: a component that reads AuthContext and exposes values via text
function AuthConsumer() {
  const { user, loading } = useAuth();
  if (loading) return <p>loading</p>;
  if (!user) return <p>no user</p>;
  return <p>user:{user.email}</p>;
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  mockReplace.mockClear();
});

describe('AuthProvider — initial state', () => {
  it('shows no user when there is no token', async () => {
    renderWithProvider();
    await waitFor(() => expect(screen.queryByText('loading')).not.toBeInTheDocument());
    expect(screen.getByText('no user')).toBeInTheDocument();
    expect(getMe).not.toHaveBeenCalled();
  });

  it('calls getMe when a token exists in localStorage', async () => {
    localStorage.setItem('token', 'jwt-token');
    getMe.mockResolvedValueOnce({ _id: '1', email: 'a@b.com', role: 'user' });

    renderWithProvider();
    await waitFor(() => expect(screen.queryByText('loading')).not.toBeInTheDocument());

    expect(getMe).toHaveBeenCalledTimes(1);
    expect(screen.getByText('user:a@b.com')).toBeInTheDocument();
  });

  it('clears the token when getMe fails', async () => {
    localStorage.setItem('token', 'bad-token');
    getMe.mockRejectedValueOnce(new Error('Unauthorized'));

    renderWithProvider();
    await waitFor(() => expect(screen.queryByText('loading')).not.toBeInTheDocument());

    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.getByText('no user')).toBeInTheDocument();
  });
});

// Helper: a component that exercises login/logout
function LoginLogoutConsumer() {
  const { user, loading, login, logout } = useAuth();
  if (loading) return <p>loading</p>;
  return (
    <>
      {user ? <p>user:{user.email}</p> : <p>no user</p>}
      <button onClick={() => login('new-token')}>login</button>
      <button onClick={logout}>logout</button>
    </>
  );
}

describe('login()', () => {
  it('stores the token and sets the user', async () => {
    // No token → getMe is NOT called on mount; only called after login()
    getMe.mockResolvedValueOnce({ _id: '2', email: 'c@d.com', role: 'user' });

    render(
      <AuthProvider>
        <LoginLogoutConsumer />
      </AuthProvider>,
    );

    // Wait for the initial loading to finish (no token, so loading → false quickly)
    await waitFor(() => expect(screen.queryByText('loading')).not.toBeInTheDocument());
    expect(screen.getByText('no user')).toBeInTheDocument();

    await act(async () => {
      screen.getByText('login').click();
    });

    await waitFor(() => expect(screen.getByText('user:c@d.com')).toBeInTheDocument());
    expect(localStorage.getItem('token')).toBe('new-token');
  });
});

describe('logout()', () => {
  it('removes the token and clears the user', async () => {
    localStorage.setItem('token', 'existing');
    getMe.mockResolvedValueOnce({ _id: '3', email: 'e@f.com', role: 'user' });

    render(
      <AuthProvider>
        <LoginLogoutConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText('user:e@f.com')).toBeInTheDocument());

    act(() => {
      screen.getByText('logout').click();
    });

    expect(screen.getByText('no user')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
  });
});

describe('auth:expired event', () => {
  it('clears user and redirects to /login?expired=1 when auth:expired fires', async () => {
    localStorage.setItem('token', 'existing');
    getMe.mockResolvedValueOnce({ _id: '4', email: 'x@y.com', role: 'user' });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText('user:x@y.com')).toBeInTheDocument());

    await act(async () => {
      window.dispatchEvent(new CustomEvent('auth:expired'));
    });

    expect(screen.getByText('no user')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/login?expired=1');
  });
});
