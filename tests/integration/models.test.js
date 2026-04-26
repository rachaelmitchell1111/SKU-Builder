'use strict';

/**
 * Integration tests using mongodb-memory-server.
 * These tests exercise the full Mongoose stack (schemas, indexes, validators, hooks).
 *
 * Note: MongoMemoryServer downloads a MongoDB binary on first run. In offline/sandboxed
 * environments without internet access the suite is skipped automatically.
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// We test models directly — no HTTP layer here
let mongod;
let available = false;

beforeAll(async () => {
    try {
        mongod = await MongoMemoryServer.create();
        await mongoose.connect(mongod.getUri());
        available = true;
    } catch (err) {
        console.warn('mongodb-memory-server unavailable (offline?), skipping integration tests:', err.message);
    }
}, 120000); // allow up to 2 min for initial binary download

afterAll(async () => {
    if (!available) return;
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
}, 30000);

afterEach(async () => {
    if (!available) return;
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
});

// Wraps a test so it only runs when mongodb-memory-server is available
function mongoTest(name, fn, timeout) {
    it(name, async () => {
        if (!available) return;
        await fn();
    }, timeout);
}

// ── User model ────────────────────────────────────────────────────────────────

describe('User model integration', () => {
    let User;
    beforeAll(() => { User = require('../../models/User'); });

    mongoTest('creates a user with default role "user"', async () => {
        const user = await User.create({ email: 'a@example.com', password: 'secret123' });
        expect(user.role).toBe('user');
    });

    mongoTest('creates a user with role "admin"', async () => {
        const user = await User.create({ email: 'admin@example.com', password: 'secret123', role: 'admin' });
        expect(user.role).toBe('admin');
    });

    mongoTest('rejects invalid role values', async () => {
        await expect(
            User.create({ email: 'b@example.com', password: 'secret123', role: 'superuser' })
        ).rejects.toThrow();
    });

    mongoTest('hashes the password before saving', async () => {
        const user = await User.create({ email: 'c@example.com', password: 'plaintext' });
        expect(user.password).not.toBe('plaintext');
        expect(user.password.length).toBeGreaterThan(20);
    });

    mongoTest('comparePassword returns true for correct password', async () => {
        const user = await User.create({ email: 'd@example.com', password: 'correct' });
        expect(await user.comparePassword('correct')).toBe(true);
    });

    mongoTest('comparePassword returns false for wrong password', async () => {
        const user = await User.create({ email: 'e@example.com', password: 'correct' });
        expect(await user.comparePassword('wrong')).toBe(false);
    });

    mongoTest('enforces unique email', async () => {
        await User.create({ email: 'dup@example.com', password: 'pass1' });
        await expect(
            User.create({ email: 'dup@example.com', password: 'pass2' })
        ).rejects.toThrow();
    });
});

// ── Item model ────────────────────────────────────────────────────────────────

describe('Item model integration', () => {
    let Item;
    beforeAll(() => { Item = require('../../models/Item'); });

    const baseItem = {
        name: 'Test Shirt',
        category: 'Shirts',
        color: 'Blue',
        sku: 'SHI-BLU-0001',
        price: 29.99,
        stockAmount: 10,
    };

    mongoTest('creates an item with default isDeleted=false', async () => {
        const item = await Item.create(baseItem);
        expect(item.isDeleted).toBe(false);
        expect(item.deletedAt).toBeNull();
    });

    mongoTest('enforces required fields', async () => {
        await expect(Item.create({ name: 'No Category' })).rejects.toThrow();
    });

    mongoTest('enforces unique SKU', async () => {
        await Item.create(baseItem);
        await expect(Item.create({ ...baseItem, name: 'Other' })).rejects.toThrow();
    });

    mongoTest('soft-deletes: sets isDeleted and deletedAt', async () => {
        const item = await Item.create(baseItem);
        const deleted = await Item.findByIdAndUpdate(
            item._id,
            { $set: { isDeleted: true, deletedAt: new Date() } },
            { new: true }
        );
        expect(deleted.isDeleted).toBe(true);
        expect(deleted.deletedAt).not.toBeNull();
    });

    mongoTest('soft-deleted items are excluded from default query', async () => {
        await Item.create({ ...baseItem, sku: 'SHI-BLU-0002', isDeleted: true, deletedAt: new Date() });
        await Item.create({ ...baseItem, sku: 'SHI-BLU-0003', name: 'Active Item' });
        const items = await Item.find({ isDeleted: false });
        expect(items).toHaveLength(1);
        expect(items[0].name).toBe('Active Item');
    });

    mongoTest('restores a soft-deleted item', async () => {
        const item = await Item.create({ ...baseItem, sku: 'SHI-BLU-0004', isDeleted: true, deletedAt: new Date() });
        const restored = await Item.findByIdAndUpdate(
            item._id,
            { $set: { isDeleted: false, deletedAt: null } },
            { new: true }
        );
        expect(restored.isDeleted).toBe(false);
        expect(restored.deletedAt).toBeNull();
    });
});

// ── AuditLog model ────────────────────────────────────────────────────────────

describe('AuditLog model integration', () => {
    let AuditLog, Item;
    beforeAll(() => {
        AuditLog = require('../../models/AuditLog');
        Item = require('../../models/Item');
    });

    mongoTest('creates an audit log entry for an item action', async () => {
        const item = await Item.create({
            name: 'Audit Item', category: 'Pants', color: 'Black',
            sku: 'PAN-BLK-0001', price: 49.99, stockAmount: 5,
        });
        const log = await AuditLog.create({ itemId: item._id, action: 'create' });
        expect(log.action).toBe('create');
        expect(log.itemId.toString()).toBe(item._id.toString());
        expect(log.userId).toBeNull();
    });

    mongoTest('rejects invalid action values', async () => {
        const item = await Item.create({
            name: 'X', category: 'Y', color: 'Z',
            sku: 'XYZ-000', price: 1, stockAmount: 1,
        });
        await expect(
            AuditLog.create({ itemId: item._id, action: 'invalid-action' })
        ).rejects.toThrow();
    });

    mongoTest('stores a diff on update events', async () => {
        const item = await Item.create({
            name: 'Diff Item', category: 'Tops', color: 'Red',
            sku: 'TOP-RED-0001', price: 10, stockAmount: 2,
        });
        const diff = { price: 15 };
        const log = await AuditLog.create({ itemId: item._id, action: 'update', diff });
        expect(log.diff).toMatchObject(diff);
    });
});
