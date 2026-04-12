const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect, requireAdmin } = require('../middleware/auth');

const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
});

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
}

// GET /api/admin/users — list all users
router.get('/users', adminLimiter, protect, requireAdmin, async (req, res, next) => {
    try {
        const users = await User.find({}).select('_id email role createdAt').sort({ createdAt: -1 });
        res.status(200).json(users);
    } catch (err) {
        next(err);
    }
});

// PATCH /api/admin/users/:id/role — promote or demote a user
router.patch(
    '/users/:id/role',
    adminLimiter,
    protect,
    requireAdmin,
    [body('role').isIn(['user', 'admin']).withMessage('Role must be "user" or "admin".')],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { id } = req.params;
        if (!isValidObjectId(id)) return res.status(400).json({ message: 'Invalid user ID.' });

        if (String(req.user._id) === id) {
            return res.status(400).json({ message: 'You cannot change your own role.' });
        }

        try {
            const user = await User.findByIdAndUpdate(
                id,
                { role: req.body.role },
                { new: true, runValidators: true }
            ).select('_id email role createdAt');

            if (!user) return res.status(404).json({ message: 'User not found.' });
            res.status(200).json(user);
        } catch (err) {
            next(err);
        }
    }
);

module.exports = router;
