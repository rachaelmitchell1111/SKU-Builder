'use strict';

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'SKU Builder Inventory API',
            version: '1.0.0',
            description:
                'REST API for managing inventory items with auto-generated SKUs, ' +
                'soft-delete, RBAC, audit logging, and bulk operations.',
        },
        servers: [{ url: '/api', description: 'API base path' }],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                Item: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        name: { type: 'string' },
                        category: { type: 'string' },
                        color: { type: 'string' },
                        sku: { type: 'string' },
                        price: { type: 'number' },
                        stockAmount: { type: 'integer' },
                        images: {
                            type: 'object',
                            properties: {
                                top: { type: 'string' },
                                bottom: { type: 'string' },
                                left: { type: 'string' },
                                right: { type: 'string' },
                                brandSize: { type: 'string' },
                                main: { type: 'string' },
                            },
                        },
                        isDeleted: { type: 'boolean' },
                        deletedAt: { type: 'string', format: 'date-time', nullable: true },
                        createdAt: { type: 'string', format: 'date-time' },
                    },
                },
                PaginatedItems: {
                    type: 'object',
                    properties: {
                        data: { type: 'array', items: { $ref: '#/components/schemas/Item' } },
                        total: { type: 'integer' },
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        pages: { type: 'integer' },
                    },
                },
                ErrorMessage: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' },
                    },
                },
            },
        },
        security: [{ bearerAuth: [] }],
        tags: [
            { name: 'Auth', description: 'Authentication & user profile' },
            { name: 'Items', description: 'Inventory item management' },
        ],
        paths: {
            '/auth/register': {
                post: {
                    tags: ['Auth'],
                    summary: 'Register a new user',
                    security: [],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['email', 'password'],
                                    properties: {
                                        email: { type: 'string', format: 'email' },
                                        password: { type: 'string', minLength: 6 },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        201: { description: 'User created', content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' } } } } } },
                        400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorMessage' } } } },
                        409: { description: 'Email already in use', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorMessage' } } } },
                    },
                },
            },
            '/auth/login': {
                post: {
                    tags: ['Auth'],
                    summary: 'Log in and receive a JWT',
                    security: [],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['email', 'password'],
                                    properties: {
                                        email: { type: 'string', format: 'email' },
                                        password: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        200: { description: 'JWT token', content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' } } } } } },
                        400: { description: 'Validation error' },
                        401: { description: 'Invalid credentials' },
                    },
                },
            },
            '/auth/me': {
                get: {
                    tags: ['Auth'],
                    summary: 'Get current user profile',
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: {
                            description: 'User profile',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            _id: { type: 'string' },
                                            email: { type: 'string' },
                                            role: { type: 'string', enum: ['user', 'admin'] },
                                            createdAt: { type: 'string', format: 'date-time' },
                                        },
                                    },
                                },
                            },
                        },
                        401: { description: 'Not authenticated' },
                    },
                },
            },
            '/items': {
                get: {
                    tags: ['Items'],
                    summary: 'List items with pagination, filtering, sorting, and search',
                    security: [],
                    parameters: [
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                        { name: 'category', in: 'query', schema: { type: 'string' } },
                        { name: 'color', in: 'query', schema: { type: 'string' } },
                        { name: 'minPrice', in: 'query', schema: { type: 'number' } },
                        { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
                        { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['name', 'price', 'createdAt', 'stockAmount'] } },
                        { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
                        { name: 'q', in: 'query', description: 'Search term matched against name and category', schema: { type: 'string' } },
                        { name: 'includeDeleted', in: 'query', description: 'Admin only — include soft-deleted items', schema: { type: 'boolean' } },
                    ],
                    responses: {
                        200: { description: 'Paginated item list', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedItems' } } } },
                        403: { description: 'Admin access required (includeDeleted)' },
                    },
                },
                post: {
                    tags: ['Items'],
                    summary: 'Create a new inventory item (auto-generates SKU)',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['name', 'category', 'color', 'price', 'stockAmount'],
                                    properties: {
                                        name: { type: 'string' },
                                        category: { type: 'string' },
                                        color: { type: 'string' },
                                        price: { type: 'number', minimum: 0 },
                                        stockAmount: { type: 'integer', minimum: 0 },
                                        images: { $ref: '#/components/schemas/Item/properties/images' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        201: { description: 'Item created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Item' } } } },
                        400: { description: 'Validation error' },
                        401: { description: 'Not authenticated' },
                        409: { description: 'SKU collision after retries' },
                    },
                },
            },
            '/items/bulk-delete': {
                post: {
                    tags: ['Items'],
                    summary: 'Bulk soft-delete items (admin only)',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { type: 'object', required: ['ids'], properties: { ids: { type: 'array', items: { type: 'string' } } } },
                            },
                        },
                    },
                    responses: {
                        200: { description: 'Count of deleted items', content: { 'application/json': { schema: { type: 'object', properties: { deleted: { type: 'integer' } } } } } },
                        400: { description: 'No valid IDs provided' },
                        401: { description: 'Not authenticated' },
                        403: { description: 'Admin access required' },
                    },
                },
            },
            '/items/bulk-restore': {
                post: {
                    tags: ['Items'],
                    summary: 'Bulk restore soft-deleted items (admin only)',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { type: 'object', required: ['ids'], properties: { ids: { type: 'array', items: { type: 'string' } } } },
                            },
                        },
                    },
                    responses: {
                        200: { description: 'Count of restored items', content: { 'application/json': { schema: { type: 'object', properties: { restored: { type: 'integer' } } } } } },
                        400: { description: 'No valid IDs provided' },
                        401: { description: 'Not authenticated' },
                        403: { description: 'Admin access required' },
                    },
                },
            },
            '/items/{id}': {
                get: {
                    tags: ['Items'],
                    summary: 'Get a single item by ID',
                    security: [],
                    parameters: [
                        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                        { name: 'includeDeleted', in: 'query', description: 'Admin only', schema: { type: 'boolean' } },
                    ],
                    responses: {
                        200: { description: 'Item', content: { 'application/json': { schema: { $ref: '#/components/schemas/Item' } } } },
                        400: { description: 'Invalid ID' },
                        403: { description: 'Admin access required' },
                        404: { description: 'Not found' },
                    },
                },
                put: {
                    tags: ['Items'],
                    summary: 'Update an item',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    requestBody: {
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string' },
                                        category: { type: 'string' },
                                        color: { type: 'string' },
                                        price: { type: 'number', minimum: 0 },
                                        stockAmount: { type: 'integer', minimum: 0 },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        200: { description: 'Updated item', content: { 'application/json': { schema: { $ref: '#/components/schemas/Item' } } } },
                        400: { description: 'Validation error' },
                        401: { description: 'Not authenticated' },
                        404: { description: 'Not found' },
                    },
                },
                delete: {
                    tags: ['Items'],
                    summary: 'Soft-delete an item (admin only)',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: {
                        204: { description: 'Deleted' },
                        401: { description: 'Not authenticated' },
                        403: { description: 'Admin access required' },
                        404: { description: 'Not found' },
                    },
                },
            },
            '/items/{id}/restore': {
                patch: {
                    tags: ['Items'],
                    summary: 'Restore a soft-deleted item (admin only)',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: {
                        200: { description: 'Restored item', content: { 'application/json': { schema: { $ref: '#/components/schemas/Item' } } } },
                        401: { description: 'Not authenticated' },
                        403: { description: 'Admin access required' },
                        404: { description: 'Not found or not deleted' },
                    },
                },
            },
            '/items/{id}/images': {
                post: {
                    tags: ['Items'],
                    summary: 'Upload images for an item',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    requestBody: {
                        content: {
                            'multipart/form-data': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        top: { type: 'string', format: 'binary' },
                                        bottom: { type: 'string', format: 'binary' },
                                        left: { type: 'string', format: 'binary' },
                                        right: { type: 'string', format: 'binary' },
                                        brandSize: { type: 'string', format: 'binary' },
                                        main: { type: 'string', format: 'binary' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        200: { description: 'Updated item with image paths', content: { 'application/json': { schema: { $ref: '#/components/schemas/Item' } } } },
                        401: { description: 'Not authenticated' },
                        404: { description: 'Not found' },
                    },
                },
            },
        },
    },
    apis: [],
};

module.exports = swaggerJsdoc(options);
