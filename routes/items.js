const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const { generateSKU } = require('../index');

// POST — create a new item
router.post('/', async (req, res) => {
    const { name, category, color, price, stockAmount, images } = req.body;

    if (!name || !category || !color || price == null || stockAmount == null) {
        return res.status(400).json({ message: 'name, category, color, price, and stockAmount are required' });
    }

    try {
        const newItem = new Item({
            name,
            category,
            color,
            price,
            stockAmount,
            images: images || {},
            sku: generateSKU(category, color)
        });

        await newItem.save();
        res.status(201).json(newItem);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET — list all items
router.get('/', async (req, res) => {
    try {
        const items = await Item.find();
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET — get one item by id
router.get('/:id', async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });
        res.json(item);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// PUT — update an item by id
router.put('/:id', async (req, res) => {
    try {
        const item = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!item) return res.status(404).json({ message: 'Item not found' });
        res.json(item);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// DELETE — delete an item by id
router.delete('/:id', async (req, res) => {
    try {
        const item = await Item.findByIdAndDelete(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });
        res.json({ message: 'Item deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;