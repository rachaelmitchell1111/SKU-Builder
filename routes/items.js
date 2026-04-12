const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Item = require('../models/Item');
const { generateSKU } = require('../index');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

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

// GET all items
router.get('/', async (req, res, next) => {
    try {
        const items = await Item.find();
        res.status(200).json(items);
    } catch (error) {
        next(error);
    }
});

// GET item by ID
router.get('/:id', async (req, res, next) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found.' });
        res.status(200).json(item);
    } catch (error) {
        next(error);
    }
});

// POST create new item with auto-generated SKU
router.post('/', protect, itemValidation, validate, async (req, res, next) => {
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
router.put('/:id', protect, async (req, res, next) => {
    try {
        const allowedFields = ['name', 'category', 'color', 'price', 'stockAmount', 'images'];
        const updates = {};
        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                updates[field] = req.body[field];
            }
        }
        const updatedItem = await Item.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
        if (!updatedItem) return res.status(404).json({ message: 'Item not found.' });
        res.status(200).json(updatedItem);
    } catch (error) {
        next(error);
    }
});

// DELETE item
router.delete('/:id', protect, async (req, res, next) => {
    try {
        const deletedItem = await Item.findByIdAndDelete(req.params.id);
        if (!deletedItem) return res.status(404).json({ message: 'Item not found.' });
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

module.exports = router;