'use strict';

const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
const dbURI = 'your_mongodb_connection_string_here';
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error(err));

app.get('/', (req, res) => {
    res.send('Hello, world!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});