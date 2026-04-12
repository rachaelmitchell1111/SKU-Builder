/**
 * Tests for frontend/lib/api.js
 *
 * We mock globalThis.fetch so we never hit the network.
 */

import {
  login,
  register,
  getMe,
  getItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  restoreItem,
  uploadImages,
  bulkDelete,
  bulkRestore,
  getUsers,
  setUserRole,
} from '../../lib/api';

const BASE = 'http://localhost:3000';

function mockFetch(status, body) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── Auth ─────────────────────────────────────────────────────────────────────

describe('login()', () => {
  it('posts credentials and returns the response', async () => {
    mockFetch(200, { token: 'tok123' });
    const result = await login('a@b.com', 'pass');
    expect(result).toEqual({ token: 'tok123' });
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/api/auth/login`,
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('register()', () => {
  it('posts registration data', async () => {
    mockFetch(200, { token: 'tok456' });
    await register('c@d.com', 'newpass');
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/api/auth/register`,
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('getMe()', () => {
  it('sends the stored JWT as Bearer token', async () => {
    localStorage.setItem('token', 'my-jwt');
    mockFetch(200, { _id: '1', email: 'a@b.com', role: 'user' });
    await getMe();
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers['Authorization']).toBe('Bearer my-jwt');
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('request error handling', () => {
  it('throws with the server message on a 4xx', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    });
    await expect(getMe()).rejects.toThrow('Unauthorized');
  });

  it('falls back to HTTP status when body has no message', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    await expect(getMe()).rejects.toThrow('HTTP 500');
  });

  it('returns null for 204 No Content', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 204 });
    const result = await deleteItem('abc');
    expect(result).toBeNull();
  });
});

// ── Items ─────────────────────────────────────────────────────────────────────

describe('getItems()', () => {
  it('builds a query string from provided params', async () => {
    mockFetch(200, { data: [], total: 0, pages: 1 });
    await getItems({ page: 2, q: 'boot', category: 'Footwear' });
    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('page=2');
    expect(url).toContain('q=boot');
    expect(url).toContain('category=Footwear');
  });

  it('omits empty params', async () => {
    mockFetch(200, { data: [], total: 0, pages: 1 });
    await getItems({ page: 1, q: '', category: null });
    const url = global.fetch.mock.calls[0][0];
    expect(url).not.toContain('q=');
    expect(url).not.toContain('category=');
  });
});

describe('getItem()', () => {
  it('fetches a single item by id', async () => {
    mockFetch(200, { _id: 'id1' });
    await getItem('id1');
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/api/items/id1`,
      expect.any(Object),
    );
  });
});

describe('createItem()', () => {
  it('POSTs JSON data', async () => {
    mockFetch(201, { _id: 'new' });
    await createItem({ name: 'Shoe', category: 'Footwear', color: 'Red', price: 10, stockAmount: 5 });
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body).name).toBe('Shoe');
  });
});

describe('updateItem()', () => {
  it('PUTs JSON data', async () => {
    mockFetch(200, { _id: 'id1' });
    await updateItem('id1', { name: 'Boot' });
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.method).toBe('PUT');
  });
});

describe('restoreItem()', () => {
  it('sends PATCH to /restore', async () => {
    mockFetch(200, { _id: 'id1' });
    await restoreItem('id1');
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('/restore');
    expect(opts.method).toBe('PATCH');
  });
});

describe('uploadImages()', () => {
  it('does not set Content-Type for FormData', async () => {
    mockFetch(200, { _id: 'id1' });
    const fd = new FormData();
    await uploadImages('id1', fd);
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers['Content-Type']).toBeUndefined();
  });
});

describe('bulkDelete() / bulkRestore()', () => {
  it('posts an array of ids for bulk delete', async () => {
    mockFetch(200, { deleted: 2 });
    await bulkDelete(['a', 'b']);
    const [, opts] = global.fetch.mock.calls[0];
    expect(JSON.parse(opts.body).ids).toEqual(['a', 'b']);
  });

  it('posts an array of ids for bulk restore', async () => {
    mockFetch(200, { restored: 2 });
    await bulkRestore(['c', 'd']);
    const [, opts] = global.fetch.mock.calls[0];
    expect(JSON.parse(opts.body).ids).toEqual(['c', 'd']);
  });
});

// ── Admin ─────────────────────────────────────────────────────────────────────

describe('getUsers()', () => {
  it('calls /api/admin/users', async () => {
    mockFetch(200, []);
    await getUsers();
    expect(global.fetch.mock.calls[0][0]).toBe(`${BASE}/api/admin/users`);
  });
});

describe('setUserRole()', () => {
  it('PATCHes role for the given user', async () => {
    mockFetch(200, { _id: 'u1', role: 'admin' });
    await setUserRole('u1', 'admin');
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('/api/admin/users/u1/role');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body).role).toBe('admin');
  });
});
