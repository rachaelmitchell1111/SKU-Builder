const express = require('express');
const router = express.Router();
const Item = require('../models/Item');

// POST endpoint to create a new item
router.post('/items', async (req, res) => {
    const {
        name,
        category,
        color,
        price,
        stockAmount,
        images: { top, bottom, left, right, brandSize, main }
    } = req.body;

    try {
        const newItem = new Item({
            name,
            category,
            color,
            price,
            stockAmount,
            images: { top, bottom, left, right, brandSize, main },
            sku: `${category}-${color}-${Date.now()}` // Auto-generate SKU
        });

        await newItem.save();
        res.status(201).json(newItem);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;