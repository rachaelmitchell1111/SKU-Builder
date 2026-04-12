'use strict';

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');

const app = require('./app');

const PORT = process.env.PORT || 3000;

// MongoDB connection
const dbURI = process.env.MONGODB_URI;
if (!dbURI) {
    throw new Error('MONGODB_URI environment variable is not defined');
}
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error(err));

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});