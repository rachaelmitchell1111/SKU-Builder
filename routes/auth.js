const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
});

function signToken(id) {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
}

// POST /api/auth/register
router.post(
    '/register',
    authLimiter,
    [
        body('email').isEmail().withMessage('Please provide a valid email.'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
    ],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        try {
            const email = String(req.body.email).toLowerCase().trim();
            const { password } = req.body;
            const existing = await User.findOne({ email });
            if (existing) return res.status(409).json({ message: 'Email already in use.' });

            const user = await User.create({ email, password });
            const token = signToken(user._id);
            res.status(201).json({ token });
        } catch (error) {
            next(error);
        }
    }
);

// POST /api/auth/login
router.post(
    '/login',
    authLimiter,
    [
        body('email').isEmail().withMessage('Please provide a valid email.'),
        body('password').notEmpty().withMessage('Password is required.'),
    ],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        try {
            const email = String(req.body.email).toLowerCase().trim();
            const { password } = req.body;
            const user = await User.findOne({ email });
            if (!user || !(await user.comparePassword(password))) {
                return res.status(401).json({ message: 'Invalid email or password.' });
            }

            const token = signToken(user._id);
            res.status(200).json({ token });
        } catch (error) {
            next(error);
        }
    }
);

// GET /api/auth/me — return current user's profile
router.get('/me', authLimiter, protect, async (req, res, next) => {
    try {
        res.status(200).json({
            _id: req.user._id,
            email: req.user.email,
            createdAt: req.user.createdAt,
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
