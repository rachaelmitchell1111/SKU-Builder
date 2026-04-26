'use strict';

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');

const app = require('./app');

const PORT = process.env.PORT || 3000;
// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Route registration
app.use('/api/items', itemsRouter);

// 404 error handler
app.use((req, res, next) => {
  res.status(404).json({ message: 'Resource not found' });
});

// MongoDB connection
const dbURI = process.env.MONGODB_URI;
if (!dbURI) {
    throw new Error('MONGODB_URI environment variable is not defined');
}
mongoose.connect(dbURI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error(err));

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});