const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    action: { type: String, enum: ['create', 'update', 'delete', 'restore', 'bulk-delete', 'bulk-restore'], required: true },
    diff: { type: mongoose.Schema.Types.Mixed, default: null },
    timestamp: { type: Date, default: Date.now },
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
