# SKU Builder — Inventory App

A Node.js + Express REST API for managing inventory items with automatic SKU generation.

## Features

- Automatic SKU generation from category and color
- Full CRUD operations for inventory items
- MongoDB storage via Mongoose
- Image URL support (top, bottom, left, right, brandSize, main)

## Requirements

- [Node.js](https://nodejs.org/) v14+
- [MongoDB](https://www.mongodb.com/) (local or Atlas cluster)

## Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/rachaelmitchell1111/SKU-Builder.git
   cd SKU-Builder
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy the example file and fill in your values:

   ```bash
   cp .env.example .env
   ```

   Edit `.env`:

   ```
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>
   PORT=3000
   NODE_ENV=development
   ```

4. **Start the server**

   ```bash
   # Production
   npm start

   # Development (with auto-reload via nodemon)
   npm run dev
   ```

## API Endpoints

| Method | Path             | Description          |
|--------|------------------|----------------------|
| POST   | `/api/items`     | Create a new item    |
| GET    | `/api/items`     | List all items       |
| GET    | `/api/items/:id` | Get one item by ID   |
| PUT    | `/api/items/:id` | Update an item by ID |
| DELETE | `/api/items/:id` | Delete an item by ID |

### Example — Create an item

```bash
curl -X POST http://localhost:3000/api/items \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Classic Tee",
    "category": "Shirt",
    "color": "Blue",
    "price": 29.99,
    "stockAmount": 100
  }'
```

Response:

```json
{
  "_id": "...",
  "name": "Classic Tee",
  "category": "Shirt",
  "color": "Blue",
  "sku": "SHI-BLU-4821",
  "price": 29.99,
  "stockAmount": 100,
  "images": {},
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to commit and submit changes.

## License

MIT
