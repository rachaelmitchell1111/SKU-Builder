'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();

const itemsRouter = require('./routes/items');
const authRouter = require('./routes/auth');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

app.use(express.json());
app.use('/uploads', express.static(uploadsDir));
app.use('/api/auth', authRouter);
app.use('/api/items', itemsRouter);

app.get('/', (req, res) => {
    res.send('Hello, world!');
});

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error(err);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ message: err.message || 'Internal server error.' });
});

module.exports = app;
