'use strict';

const request = require('supertest');
const mongoose = require('mongoose');

// Mock mongoose models before app is required
jest.mock('../models/Item');
jest.mock('../models/User');
jest.mock('../models/AuditLog');

const Item = require('../models/Item');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const app = require('../app');

// ── helpers ──────────────────────────────────────────────────────────────────

function makeObjectId() {
    return new mongoose.Types.ObjectId().toString();
}

function makeToken(userId) {
    const jwt = require('jsonwebtoken');
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// ── Auth routes ───────────────────────────────────────────────────────────────

describe('Auth routes', () => {
    const userId = makeObjectId();
    const credentials = { email: 'test@example.com', password: 'password123' };

    beforeEach(() => jest.clearAllMocks());

    it('POST /api/auth/register — creates a new user and returns a token', async () => {
        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue({ _id: userId, email: credentials.email });

        const res = await request(app).post('/api/auth/register').send(credentials);
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('token');
    });

    it('POST /api/auth/register — rejects duplicate email', async () => {
        User.findOne.mockResolvedValue({ _id: userId, email: credentials.email });

        const res = await request(app).post('/api/auth/register').send(credentials);
        expect(res.status).toBe(409);
    });

    it('POST /api/auth/login — returns a token for valid credentials', async () => {
        const mockUser = {
            _id: userId,
            email: credentials.email,
            comparePassword: jest.fn().mockResolvedValue(true),
        };
        User.findOne.mockResolvedValue(mockUser);

        const res = await request(app).post('/api/auth/login').send(credentials);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
    });

    it('POST /api/auth/login — rejects invalid password', async () => {
        const mockUser = {
            _id: userId,
            email: credentials.email,
            comparePassword: jest.fn().mockResolvedValue(false),
        };
        User.findOne.mockResolvedValue(mockUser);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: credentials.email, password: 'wrongpassword' });
        expect(res.status).toBe(401);
    });

    it('POST /api/auth/register — rejects invalid email', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ email: 'not-an-email', password: 'password123' });
        expect(res.status).toBe(400);
    });

    it('GET /api/auth/me — returns user profile when authenticated', async () => {
        const token = makeToken(userId);
        const mockUser = { _id: userId, email: credentials.email, role: 'user', createdAt: new Date().toISOString() };
        User.findById = jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue(mockUser),
        });

        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('email', credentials.email);
        expect(res.body).toHaveProperty('_id');
        expect(res.body).toHaveProperty('role', 'user');
    });

    it('GET /api/auth/me — rejects unauthenticated request', async () => {
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
    });
});

// ── Items routes ──────────────────────────────────────────────────────────────

describe('Items routes', () => {
    const userId = makeObjectId();
    const itemId = makeObjectId();
    let token;

    const validItem = {
        name: 'Test Shirt',
        category: 'Shirts',
        color: 'Blue',
        price: 29.99,
        stockAmount: 100,
    };

    const mockItem = {
        _id: itemId,
        ...validItem,
        sku: 'SHI-BLU-1234',
        isDeleted: false,
        deletedAt: null,
    };

    beforeAll(() => {
        token = makeToken(userId);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // auth middleware: User.findById().select() — admin user by default for write tests
        User.findById = jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({ _id: userId, role: 'admin' }),
        });
        AuditLog.create = jest.fn().mockResolvedValue({});
        AuditLog.insertMany = jest.fn().mockResolvedValue([]);
    });

    it('GET /api/items — returns paginated list of items', async () => {
        Item.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([mockItem]) }) }) });
        Item.countDocuments.mockResolvedValue(1);

        const res = await request(app).get('/api/items');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('data');
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body).toHaveProperty('total', 1);
        expect(res.body).toHaveProperty('page', 1);
        expect(res.body).toHaveProperty('limit', 20);
        expect(res.body).toHaveProperty('pages', 1);
    });

    it('GET /api/items — excludes soft-deleted items by default', async () => {
        Item.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([mockItem]) }) }) });
        Item.countDocuments.mockResolvedValue(1);

        const res = await request(app).get('/api/items');
        expect(res.status).toBe(200);
        expect(Item.find).toHaveBeenCalledWith(expect.objectContaining({ isDeleted: false }));
    });

    it('GET /api/items — includes soft-deleted items when includeDeleted=true (admin)', async () => {
        Item.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([mockItem]) }) }) });
        Item.countDocuments.mockResolvedValue(1);

        const res = await request(app)
            .get('/api/items?includeDeleted=true')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        const callArg = Item.find.mock.calls[0][0];
        expect(callArg).not.toHaveProperty('isDeleted');
    });

    it('GET /api/items — respects page and limit query params', async () => {
        Item.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([mockItem]) }) }) });
        Item.countDocuments.mockResolvedValue(50);

        const res = await request(app).get('/api/items?page=2&limit=10');
        expect(res.status).toBe(200);
        expect(res.body.page).toBe(2);
        expect(res.body.limit).toBe(10);
        expect(res.body.pages).toBe(5);
    });

    it('GET /api/items — filters by category and color', async () => {
        Item.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([mockItem]) }) }) });
        Item.countDocuments.mockResolvedValue(1);

        const res = await request(app).get('/api/items?category=Shirts&color=Blue');
        expect(res.status).toBe(200);
        expect(Item.find).toHaveBeenCalledWith(expect.objectContaining({ category: 'Shirts', color: 'Blue' }));
    });

    it('GET /api/items — filters by price range', async () => {
        Item.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([mockItem]) }) }) });
        Item.countDocuments.mockResolvedValue(1);

        const res = await request(app).get('/api/items?minPrice=10&maxPrice=50');
        expect(res.status).toBe(200);
        expect(Item.find).toHaveBeenCalledWith(expect.objectContaining({ price: { $gte: 10, $lte: 50 } }));
    });

    it('GET /api/items — sorts by price ascending', async () => {
        const sortMock = jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([mockItem]) }) });
        Item.find.mockReturnValue({ sort: sortMock });
        Item.countDocuments.mockResolvedValue(1);

        const res = await request(app).get('/api/items?sortBy=price&order=asc');
        expect(res.status).toBe(200);
        expect(sortMock).toHaveBeenCalledWith({ price: 1 });
    });

    it('GET /api/items — sorts by name descending by default', async () => {
        const sortMock = jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([mockItem]) }) });
        Item.find.mockReturnValue({ sort: sortMock });
        Item.countDocuments.mockResolvedValue(1);

        const res = await request(app).get('/api/items?sortBy=name');
        expect(res.status).toBe(200);
        expect(sortMock).toHaveBeenCalledWith({ name: -1 });
    });

    it('GET /api/items — rejects invalid minPrice', async () => {
        const res = await request(app).get('/api/items?minPrice=abc');
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('message');
    });

    it('GET /api/items — filters by search query q', async () => {
        Item.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([mockItem]) }) }) });
        Item.countDocuments.mockResolvedValue(1);

        const res = await request(app).get('/api/items?q=shirt');
        expect(res.status).toBe(200);
        expect(Item.find).toHaveBeenCalledWith(expect.objectContaining({
            $or: [
                { name: { $regex: 'shirt', $options: 'i' } },
                { category: { $regex: 'shirt', $options: 'i' } },
            ],
        }));
    });

    it('GET /api/items/:id — returns item by id', async () => {
        Item.findOne.mockResolvedValue(mockItem);

        const res = await request(app).get(`/api/items/${itemId}`);
        expect(res.status).toBe(200);
        expect(res.body._id).toBe(itemId);
    });

    it('GET /api/items/:id — returns 404 for unknown id', async () => {
        Item.findOne.mockResolvedValue(null);

        const fakeId = makeObjectId();
        const res = await request(app).get(`/api/items/${fakeId}`);
        expect(res.status).toBe(404);
    });

    it('GET /api/items/:id — excludes soft-deleted items by default', async () => {
        Item.findOne.mockResolvedValue(null);

        const res = await request(app).get(`/api/items/${itemId}`);
        expect(Item.findOne).toHaveBeenCalledWith(expect.objectContaining({ isDeleted: false }));
    });

    it('POST /api/items — rejects unauthenticated request', async () => {
        const res = await request(app).post('/api/items').send(validItem);
        expect(res.status).toBe(401);
    });

    it('POST /api/items — rejects missing required fields', async () => {
        const res = await request(app)
            .post('/api/items')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Incomplete' });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('errors');
    });

    it('POST /api/items — rejects negative price', async () => {
        const res = await request(app)
            .post('/api/items')
            .set('Authorization', `Bearer ${token}`)
            .send({ ...validItem, price: -5 });
        expect(res.status).toBe(400);
    });

    it('POST /api/items — creates item with auto-generated SKU', async () => {
        const saveMock = jest.fn().mockResolvedValue(mockItem);
        Item.mockImplementation(() => ({ ...mockItem, save: saveMock }));

        const res = await request(app)
            .post('/api/items')
            .set('Authorization', `Bearer ${token}`)
            .send(validItem);
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('sku');
        expect(saveMock).toHaveBeenCalled();
    });

    it('POST /api/items — retries on duplicate SKU and succeeds', async () => {
        const dupError = Object.assign(new Error('duplicate key'), { code: 11000 });
        const saveMock = jest.fn()
            .mockRejectedValueOnce(dupError)
            .mockResolvedValueOnce(mockItem);
        Item.mockImplementation(() => ({ ...mockItem, save: saveMock }));

        const res = await request(app)
            .post('/api/items')
            .set('Authorization', `Bearer ${token}`)
            .send(validItem);
        expect(res.status).toBe(201);
        expect(saveMock).toHaveBeenCalledTimes(2);
    });

    it('POST /api/items — returns 409 after exhausting SKU retries', async () => {
        const dupError = Object.assign(new Error('duplicate key'), { code: 11000 });
        const saveMock = jest.fn().mockRejectedValue(dupError);
        Item.mockImplementation(() => ({ ...mockItem, save: saveMock }));

        const res = await request(app)
            .post('/api/items')
            .set('Authorization', `Bearer ${token}`)
            .send(validItem);
        expect(res.status).toBe(409);
        expect(saveMock).toHaveBeenCalledTimes(3);
    });

    it('PUT /api/items/:id — updates item', async () => {
        Item.findByIdAndUpdate.mockResolvedValue({ ...mockItem, price: 39.99 });

        const res = await request(app)
            .put(`/api/items/${itemId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ price: 39.99 });
        expect(res.status).toBe(200);
        expect(res.body.price).toBe(39.99);
    });

    it('PUT /api/items/:id — rejects unauthenticated request', async () => {
        const res = await request(app)
            .put(`/api/items/${itemId}`)
            .send({ price: 1 });
        expect(res.status).toBe(401);
    });

    it('DELETE /api/items/:id — soft-deletes the item', async () => {
        Item.findOneAndUpdate.mockResolvedValue({ ...mockItem, isDeleted: true, deletedAt: new Date() });

        const res = await request(app)
            .delete(`/api/items/${itemId}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(204);
        expect(Item.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: itemId, isDeleted: false },
            { $set: expect.objectContaining({ isDeleted: true }) },
            { new: true }
        );
    });

    it('DELETE /api/items/:id — rejects unauthenticated request', async () => {
        const res = await request(app).delete(`/api/items/${itemId}`);
        expect(res.status).toBe(401);
    });

    it('DELETE /api/items/:id — returns 404 for unknown or already-deleted id', async () => {
        Item.findOneAndUpdate.mockResolvedValue(null);

        const fakeId = makeObjectId();
        const res = await request(app)
            .delete(`/api/items/${fakeId}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    it('PATCH /api/items/:id/restore — restores a soft-deleted item', async () => {
        Item.findOneAndUpdate.mockResolvedValue({ ...mockItem, isDeleted: false, deletedAt: null });

        const res = await request(app)
            .patch(`/api/items/${itemId}/restore`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Item.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: itemId, isDeleted: true },
            { $set: { isDeleted: false, deletedAt: null } },
            { new: true }
        );
    });

    it('PATCH /api/items/:id/restore — returns 404 if item is not deleted', async () => {
        Item.findOneAndUpdate.mockResolvedValue(null);

        const res = await request(app)
            .patch(`/api/items/${itemId}/restore`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    it('PATCH /api/items/:id/restore — rejects unauthenticated request', async () => {
        const res = await request(app).patch(`/api/items/${itemId}/restore`);
        expect(res.status).toBe(401);
    });

    it('DELETE /api/items/:id — rejects non-admin user', async () => {
        User.findById = jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({ _id: userId, role: 'user' }),
        });
        const res = await request(app)
            .delete(`/api/items/${itemId}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    it('PATCH /api/items/:id/restore — rejects non-admin user', async () => {
        User.findById = jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({ _id: userId, role: 'user' }),
        });
        const res = await request(app)
            .patch(`/api/items/${itemId}/restore`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    it('GET /api/items — rejects includeDeleted=true for non-admin', async () => {
        User.findById = jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({ _id: userId, role: 'user' }),
        });
        const res = await request(app)
            .get('/api/items?includeDeleted=true')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    it('GET /api/items — rejects includeDeleted=true for unauthenticated request', async () => {
        const res = await request(app).get('/api/items?includeDeleted=true');
        expect(res.status).toBe(403);
    });

    it('POST /api/items/bulk-delete — soft-deletes multiple items', async () => {
        const id1 = makeObjectId();
        const id2 = makeObjectId();
        Item.updateMany.mockResolvedValue({ modifiedCount: 2 });

        const res = await request(app)
            .post('/api/items/bulk-delete')
            .set('Authorization', `Bearer ${token}`)
            .send({ ids: [id1, id2] });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('deleted', 2);
        expect(Item.updateMany).toHaveBeenCalledWith(
            { _id: { $in: [id1, id2] }, isDeleted: false },
            { $set: expect.objectContaining({ isDeleted: true }) }
        );
    });

    it('POST /api/items/bulk-delete — rejects unauthenticated request', async () => {
        const res = await request(app)
            .post('/api/items/bulk-delete')
            .send({ ids: [makeObjectId()] });
        expect(res.status).toBe(401);
    });

    it('POST /api/items/bulk-delete — rejects non-admin user', async () => {
        User.findById = jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({ _id: userId, role: 'user' }),
        });
        const res = await request(app)
            .post('/api/items/bulk-delete')
            .set('Authorization', `Bearer ${token}`)
            .send({ ids: [makeObjectId()] });
        expect(res.status).toBe(403);
    });

    it('POST /api/items/bulk-delete — returns 400 for empty ids', async () => {
        const res = await request(app)
            .post('/api/items/bulk-delete')
            .set('Authorization', `Bearer ${token}`)
            .send({ ids: [] });
        expect(res.status).toBe(400);
    });

    it('POST /api/items/bulk-restore — restores multiple items', async () => {
        const id1 = makeObjectId();
        const id2 = makeObjectId();
        Item.updateMany.mockResolvedValue({ modifiedCount: 2 });

        const res = await request(app)
            .post('/api/items/bulk-restore')
            .set('Authorization', `Bearer ${token}`)
            .send({ ids: [id1, id2] });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('restored', 2);
        expect(Item.updateMany).toHaveBeenCalledWith(
            { _id: { $in: [id1, id2] }, isDeleted: true },
            { $set: { isDeleted: false, deletedAt: null } }
        );
    });

    it('POST /api/items/bulk-restore — rejects unauthenticated request', async () => {
        const res = await request(app)
            .post('/api/items/bulk-restore')
            .send({ ids: [makeObjectId()] });
        expect(res.status).toBe(401);
    });

    it('POST /api/items/bulk-restore — rejects non-admin user', async () => {
        User.findById = jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({ _id: userId, role: 'user' }),
        });
        const res = await request(app)
            .post('/api/items/bulk-restore')
            .set('Authorization', `Bearer ${token}`)
            .send({ ids: [makeObjectId()] });
        expect(res.status).toBe(403);
    });
});

// ── Admin: audit log route ────────────────────────────────────────────────────

describe('GET /api/admin/audit-logs', () => {
    const adminId = makeObjectId();
    let adminToken;

    const fakeLogs = [
        {
            _id: makeObjectId(),
            action: 'create',
            timestamp: new Date().toISOString(),
            userId: { _id: adminId, email: 'admin@example.com' },
            itemId: { _id: makeObjectId(), name: 'Test Shirt', sku: 'SHI-BLU-1234' },
            diff: null,
        },
        {
            _id: makeObjectId(),
            action: 'update',
            timestamp: new Date().toISOString(),
            userId: { _id: adminId, email: 'admin@example.com' },
            itemId: { _id: makeObjectId(), name: 'Test Shirt', sku: 'SHI-BLU-1234' },
            diff: { price: 19.99 },
        },
    ];

    beforeAll(() => {
        adminToken = makeToken(adminId);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        User.findById = jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({ _id: adminId, role: 'admin' }),
        });

        // Mock AuditLog.find(...).sort().skip().limit().populate().populate()
        const populateItem = jest.fn().mockResolvedValue(fakeLogs);
        const populateUser = jest.fn().mockReturnValue({ populate: populateItem });
        const limitMock = jest.fn().mockReturnValue({ populate: populateUser });
        const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
        const sortMock = jest.fn().mockReturnValue({ skip: skipMock });
        AuditLog.find = jest.fn().mockReturnValue({ sort: sortMock });
        AuditLog.countDocuments = jest.fn().mockResolvedValue(fakeLogs.length);
    });

    it('returns 401 when unauthenticated', async () => {
        const res = await request(app).get('/api/admin/audit-logs');
        expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin users', async () => {
        User.findById = jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({ _id: adminId, role: 'user' }),
        });
        const res = await request(app)
            .get('/api/admin/audit-logs')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(403);
    });

    it('returns paginated audit logs for admins', async () => {
        const res = await request(app)
            .get('/api/admin/audit-logs')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('total');
        expect(res.body).toHaveProperty('page');
        expect(res.body).toHaveProperty('pages');
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('passes action filter to AuditLog.find', async () => {
        const res = await request(app)
            .get('/api/admin/audit-logs?action=create')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(AuditLog.find).toHaveBeenCalledWith(expect.objectContaining({ action: 'create' }));
    });

    it('ignores invalid action filter values', async () => {
        const res = await request(app)
            .get('/api/admin/audit-logs?action=invalid-action')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        // 'action' key must not appear in the filter when invalid
        expect(AuditLog.find).toHaveBeenCalledWith(
            expect.not.objectContaining({ action: 'invalid-action' }),
        );
    });

    it('passes itemId filter when a valid ObjectId is provided', async () => {
        const id = makeObjectId();
        const res = await request(app)
            .get(`/api/admin/audit-logs?itemId=${id}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(AuditLog.find).toHaveBeenCalledWith(expect.objectContaining({ itemId: id }));
    });

    it('ignores itemId filter when an invalid ObjectId is provided', async () => {
        const res = await request(app)
            .get('/api/admin/audit-logs?itemId=not-an-id')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(AuditLog.find).toHaveBeenCalledWith(
            expect.not.objectContaining({ itemId: 'not-an-id' }),
        );
    });
});

