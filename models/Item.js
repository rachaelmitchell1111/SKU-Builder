const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true },
    color: { type: String, required: true },
    sku: { type: String, unique: true, required: true },
    price: { type: Number, required: true },
    stockAmount: { type: Number, required: true },
    images: {
        top: { type: String },
        bottom: { type: String },
        left: { type: String },
        right: { type: String },
        brandSize: { type: String },
        main: { type: String }
    },
    createdAt: { type: Date, default: Date.now }
});

const Item = mongoose.model('Item', itemSchema);

module.exports = Item;