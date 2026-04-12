const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const Item = require('../models/Item');
const { generateSKU } = require('../index');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const readLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
});

const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
});

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
}

const itemValidation = [
    body('name').notEmpty().withMessage('Name is required.'),
    body('category').notEmpty().withMessage('Category is required.'),
    body('color').notEmpty().withMessage('Color is required.'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number.'),
    body('stockAmount').isInt({ min: 0 }).withMessage('Stock amount must be a non-negative integer.'),
];

function validate(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
}

// GET all items (with optional pagination, filtering, and sorting)
// Query params: page, limit, category, color, minPrice, maxPrice, sortBy, order
router.get('/', readLimiter, async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.category) filter.category = String(req.query.category);
        if (req.query.color) filter.color = String(req.query.color);
        if (req.query.minPrice !== undefined || req.query.maxPrice !== undefined) {
            const minPrice = parseFloat(req.query.minPrice);
            const maxPrice = parseFloat(req.query.maxPrice);
            if (req.query.minPrice !== undefined && isNaN(minPrice)) {
                return res.status(400).json({ message: 'minPrice must be a valid number.' });
            }
            if (req.query.maxPrice !== undefined && isNaN(maxPrice)) {
                return res.status(400).json({ message: 'maxPrice must be a valid number.' });
            }
            filter.price = {};
            if (!isNaN(minPrice)) filter.price.$gte = minPrice;
            if (!isNaN(maxPrice)) filter.price.$lte = maxPrice;
        }

        const allowedSortFields = ['name', 'price', 'createdAt', 'stockAmount'];
        const sortBy = allowedSortFields.includes(req.query.sortBy) ? req.query.sortBy : 'createdAt';
        const order = req.query.order === 'asc' ? 1 : -1;
        const sort = { [sortBy]: order };

        const [items, total] = await Promise.all([
            Item.find(filter).sort(sort).skip(skip).limit(limit),
            Item.countDocuments(filter),
        ]);

        res.status(200).json({
            data: items,
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        });
    } catch (error) {
        next(error);
    }
});

// GET item by ID
router.get('/:id', readLimiter, async (req, res, next) => {
    try {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid item ID.' });
        const item = await Item.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found.' });
        res.status(200).json(item);
    } catch (error) {
        next(error);
    }
});

// POST create new item with auto-generated SKU
router.post('/', writeLimiter, protect, itemValidation, validate, async (req, res, next) => {
    try {
        const { name, price, category, color, stockAmount, images } = req.body;
        const newItem = new Item({
            name,
            price,
            category,
            color,
            stockAmount,
            images,
            sku: generateSKU(category, color),
        });
        await newItem.save();
        res.status(201).json(newItem);
    } catch (error) {
        next(error);
    }
});

// POST upload images for an item
router.post(
    '/:id/images',
    writeLimiter,
    protect,
    upload.fields([
        { name: 'top', maxCount: 1 },
        { name: 'bottom', maxCount: 1 },
        { name: 'left', maxCount: 1 },
        { name: 'right', maxCount: 1 },
        { name: 'brandSize', maxCount: 1 },
        { name: 'main', maxCount: 1 },
    ]),
    async (req, res, next) => {
        try {
            if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid item ID.' });
            const item = await Item.findById(req.params.id);
            if (!item) return res.status(404).json({ message: 'Item not found.' });

            const files = req.files || {};
            const imageUpdates = {};
            for (const field of ['top', 'bottom', 'left', 'right', 'brandSize', 'main']) {
                if (files[field]) {
                    imageUpdates[`images.${field}`] = files[field][0].path;
                }
            }

            const updatedItem = await Item.findByIdAndUpdate(
                req.params.id,
                { $set: imageUpdates },
                { new: true }
            );
            res.status(200).json(updatedItem);
        } catch (error) {
            next(error);
        }
    }
);

// PUT update item
router.put('/:id', writeLimiter, protect, async (req, res, next) => {
    try {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid item ID.' });
        const stringFields = ['name', 'category', 'color'];
        const updates = {};
        for (const field of stringFields) {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                updates[field] = String(req.body[field]);
            }
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'price')) {
            const price = parseFloat(req.body.price);
            if (isNaN(price) || price < 0) {
                return res.status(400).json({ message: 'price must be a non-negative number.' });
            }
            updates.price = price;
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'stockAmount')) {
            const stockAmount = parseInt(req.body.stockAmount, 10);
            if (isNaN(stockAmount) || stockAmount < 0) {
                return res.status(400).json({ message: 'stockAmount must be a non-negative integer.' });
            }
            updates.stockAmount = stockAmount;
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'images') && typeof req.body.images === 'object' && req.body.images !== null) {
            updates.images = req.body.images;
        }
        const updatedItem = await Item.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
        if (!updatedItem) return res.status(404).json({ message: 'Item not found.' });
        res.status(200).json(updatedItem);
    } catch (error) {
        next(error);
    }
});

// DELETE item
router.delete('/:id', writeLimiter, protect, async (req, res, next) => {
    try {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid item ID.' });
        const deletedItem = await Item.findByIdAndDelete(req.params.id);
        if (!deletedItem) return res.status(404).json({ message: 'Item not found.' });
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

module.exports = router;