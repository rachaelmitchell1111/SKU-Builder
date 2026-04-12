const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const { generateSKU } = require('../index');

// GET all items
router.get('/', async (req, res) => {
    try {
        const items = await Item.find();
        res.status(200).json(items);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving items.' });
    }
});

// GET item by ID
router.get('/:id', async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found.' });
        res.status(200).json(item);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving item.' });
    }
});

// POST create new item with auto-generated SKU
router.post('/', async (req, res) => {
    try {
        const { name, price, category, color } = req.body;
        const newItem = new Item({ name, price, sku: generateSKU(category, color) });
        await newItem.save();
        res.status(201).json(newItem);
    } catch (error) {
        res.status(500).json({ message: 'Error creating item.' });
    }
});

// PUT update item
router.put('/:id', async (req, res) => {
    try {
        const updatedItem = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedItem) return res.status(404).json({ message: 'Item not found.' });
        res.status(200).json(updatedItem);
    } catch (error) {
        res.status(500).json({ message: 'Error updating item.' });
    }
});

// DELETE item
router.delete('/:id', async (req, res) => {
    try {
        const deletedItem = await Item.findByIdAndDelete(req.params.id);
        if (!deletedItem) return res.status(404).json({ message: 'Item not found.' });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Error deleting item.' });
    }
});

module.exports = router;