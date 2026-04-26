/**
 * Tests for frontend/pages/login.js
 *
 * Note: login.js labels are not associated with inputs via htmlFor.
 * We therefore use getByRole('textbox') for the email input and
 * container.querySelector('[type="password"]') for the password input.
 * The submit button is found within the <form> to distinguish it from
 * the Login/Register tab buttons which are outside the form.
 */

import React from 'react';
import { render, screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
// query is mutable so individual tests can override it
const mockLoginRouter = { push: mockPush, query: {} };
jest.mock('next/router', () => ({
  useRouter: () => mockLoginRouter,
}));

const mockApiLogin = jest.fn();
const mockApiRegister = jest.fn();
const mockAuthLogin = jest.fn();

jest.mock('../../lib/api', () => ({
  login: (...a) => mockApiLogin(...a),
  register: (...a) => mockApiRegister(...a),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ login: mockAuthLogin }),
}));

import LoginPage from '../../pages/login';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Type into the email and password fields and click the submit button.
 * Uses the <form> element to disambiguate the submit button from the
 * Login/Register tab buttons.
 */
async function fillAndSubmit(user, email = 'test@example.com', password = 'secret123') {
  // email input has role="textbox" (type="email")
  await user.type(screen.getByRole('textbox'), email);
  // password input has no ARIA textbox role; find it by type attribute
  const pwInput = document.querySelector('input[type="password"]');
  await user.type(pwInput, password);
  // submit button is inside the <form>; tab buttons are outside it
  const form = document.querySelector('form');
  await user.click(within(form).getByRole('button'));
}

beforeEach(() => {
  jest.clearAllMocks();
  // reset query between tests
  mockLoginRouter.query = {};
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LoginPage — rendering', () => {
  it('renders the page title', () => {
    render(<LoginPage />);
    expect(screen.getByRole('heading', { name: /sku builder/i })).toBeInTheDocument();
  });

  it('shows Login and Register tab buttons', () => {
    render(<LoginPage />);
    const tabButtons = screen.getAllByRole('button', { name: /^(login|register)$/i });
    const tabNames = tabButtons.map((b) => b.textContent.trim().toLowerCase());
    expect(tabNames).toContain('login');
    expect(tabNames).toContain('register');
  });

  it('starts in login mode (the tab-Login button is highlighted)', () => {
    render(<LoginPage />);
    // In login mode the form submit button text is "Login"
    const form = document.querySelector('form');
    expect(within(form).getByRole('button')).toHaveTextContent(/login/i);
  });
});

describe('LoginPage — tab switching', () => {
  it('switches to Register mode when the Register tab is clicked', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    // Find the Register TAB button (type="button", outside the form)
    const registerTab = screen.getAllByRole('button', { name: /^register$/i })
      .find((b) => b.type === 'button' && b.closest('form') === null);
    await user.click(registerTab);
    const form = document.querySelector('form');
    expect(within(form).getByRole('button')).toHaveTextContent(/create account/i);
  });

  it('clears the error when switching tabs', async () => {
    mockApiLogin.mockRejectedValueOnce(new Error('Bad credentials'));
    const user = userEvent.setup();
    render(<LoginPage />);

    await fillAndSubmit(user);
    await waitFor(() => expect(screen.getByText('Bad credentials')).toBeInTheDocument());

    const registerTab = screen.getAllByRole('button', { name: /^register$/i })
      .find((b) => b.type === 'button' && b.closest('form') === null);
    await user.click(registerTab);
    expect(screen.queryByText('Bad credentials')).not.toBeInTheDocument();
  });
});

describe('LoginPage — login flow', () => {
  it('calls api.login and auth.login on success', async () => {
    mockApiLogin.mockResolvedValueOnce({ token: 'jwt-abc' });
    mockAuthLogin.mockResolvedValueOnce();
    const user = userEvent.setup();
    render(<LoginPage />);

    await fillAndSubmit(user);
    await waitFor(() => expect(mockApiLogin).toHaveBeenCalledWith('test@example.com', 'secret123'));
    expect(mockAuthLogin).toHaveBeenCalledWith('jwt-abc');
    expect(mockPush).toHaveBeenCalledWith('/items');
  });

  it('shows an error message on login failure', async () => {
    mockApiLogin.mockRejectedValueOnce(new Error('Invalid credentials'));
    const user = userEvent.setup();
    render(<LoginPage />);

    await fillAndSubmit(user);
    await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeInTheDocument());
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('disables the submit button while submitting', async () => {
    let resolve;
    mockApiLogin.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByRole('textbox'), 'a@b.com');
    await user.type(document.querySelector('input[type="password"]'), 'pass123');

    const form = document.querySelector('form');
    await user.click(within(form).getByRole('button'));

    expect(within(form).getByRole('button')).toBeDisabled();
    expect(within(form).getByRole('button')).toHaveTextContent(/please wait/i);
    // Resolve the promise inside act() to avoid "not wrapped in act" warnings
    await act(async () => { resolve({ token: 't' }); });
  });
});

describe('LoginPage — register flow', () => {
  it('calls api.register in register mode', async () => {
    mockApiRegister.mockResolvedValueOnce({ token: 'jwt-new' });
    mockAuthLogin.mockResolvedValueOnce();
    const user = userEvent.setup();
    render(<LoginPage />);

    // Switch to Register tab
    const registerTab = screen.getAllByRole('button', { name: /^register$/i })
      .find((b) => b.type === 'button' && b.closest('form') === null);
    await user.click(registerTab);

    await fillAndSubmit(user, 'new@user.com', 'mypassword');
    await waitFor(() => expect(mockApiRegister).toHaveBeenCalledWith('new@user.com', 'mypassword'));
    expect(mockPush).toHaveBeenCalledWith('/items');
  });
});

describe('LoginPage — session expired banner', () => {
  it('shows the banner when ?expired=1 is in the query', () => {
    mockLoginRouter.query = { expired: '1' };
    render(<LoginPage />);
    expect(
      screen.getByText('Your session has expired. Please log in again.'),
    ).toBeInTheDocument();
  });

  it('does NOT show the banner when expired is absent', () => {
    mockLoginRouter.query = {};
    render(<LoginPage />);
    expect(
      screen.queryByText('Your session has expired. Please log in again.'),
    ).not.toBeInTheDocument();
  });

  it('hides the banner once an error message is shown', async () => {
    mockLoginRouter.query = { expired: '1' };
    mockApiLogin.mockRejectedValueOnce(new Error('Invalid credentials'));
    const user = userEvent.setup();
    render(<LoginPage />);

    expect(screen.getByText('Your session has expired. Please log in again.')).toBeInTheDocument();
    await fillAndSubmit(user);
    await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeInTheDocument());
    expect(
      screen.queryByText('Your session has expired. Please log in again.'),
    ).not.toBeInTheDocument();
  });
});
