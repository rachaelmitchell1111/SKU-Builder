'use strict';

const request = require('supertest');
const mongoose = require('mongoose');

// Mock mongoose models before app is required
jest.mock('../models/Item');
jest.mock('../models/User');

const Item = require('../models/Item');
const User = require('../models/User');
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
    };

    beforeAll(() => {
        token = makeToken(userId);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // auth middleware: User.findById().select()
        User.findById = jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({ _id: userId }),
        });
    });

    it('GET /api/items — returns paginated list of items', async () => {
        Item.find.mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([mockItem]) }) });
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

    it('GET /api/items — respects page and limit query params', async () => {
        Item.find.mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([mockItem]) }) });
        Item.countDocuments.mockResolvedValue(50);

        const res = await request(app).get('/api/items?page=2&limit=10');
        expect(res.status).toBe(200);
        expect(res.body.page).toBe(2);
        expect(res.body.limit).toBe(10);
        expect(res.body.pages).toBe(5);
    });

    it('GET /api/items — filters by category and color', async () => {
        Item.find.mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([mockItem]) }) });
        Item.countDocuments.mockResolvedValue(1);

        const res = await request(app).get('/api/items?category=Shirts&color=Blue');
        expect(res.status).toBe(200);
        expect(Item.find).toHaveBeenCalledWith(expect.objectContaining({ category: 'Shirts', color: 'Blue' }));
    });

    it('GET /api/items — filters by price range', async () => {
        Item.find.mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([mockItem]) }) });
        Item.countDocuments.mockResolvedValue(1);

        const res = await request(app).get('/api/items?minPrice=10&maxPrice=50');
        expect(res.status).toBe(200);
        expect(Item.find).toHaveBeenCalledWith(expect.objectContaining({ price: { $gte: 10, $lte: 50 } }));
    });

    it('GET /api/items/:id — returns item by id', async () => {
        Item.findById.mockResolvedValue(mockItem);

        const res = await request(app).get(`/api/items/${itemId}`);
        expect(res.status).toBe(200);
        expect(res.body._id).toBe(itemId);
    });

    it('GET /api/items/:id — returns 404 for unknown id', async () => {
        Item.findById.mockResolvedValue(null);

        const fakeId = makeObjectId();
        const res = await request(app).get(`/api/items/${fakeId}`);
        expect(res.status).toBe(404);
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

    it('DELETE /api/items/:id — deletes the item', async () => {
        Item.findByIdAndDelete.mockResolvedValue(mockItem);

        const res = await request(app)
            .delete(`/api/items/${itemId}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(204);
    });

    it('DELETE /api/items/:id — rejects unauthenticated request', async () => {
        const res = await request(app).delete(`/api/items/${itemId}`);
        expect(res.status).toBe(401);
    });

    it('DELETE /api/items/:id — returns 404 for unknown id', async () => {
        Item.findByIdAndDelete.mockResolvedValue(null);

        const fakeId = makeObjectId();
        const res = await request(app)
            .delete(`/api/items/${fakeId}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
});

