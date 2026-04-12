const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function protect(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Not authenticated. Please log in.' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');
        if (!req.user) {
            return res.status(401).json({ message: 'User no longer exists.' });
        }
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
}

// Attaches req.user if a valid Bearer token is present; never blocks the request.
async function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');
    } catch (_) {
        // Ignore invalid/expired tokens for optional auth
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required.' });
    }
    next();
}

module.exports = { protect, optionalAuth, requireAdmin };
