# SKU Builder — Inventory Management App

A Node.js/Express backend + Next.js frontend for managing inventory items with auto-generated SKUs.

---

## Backend

### Setup

```bash
npm install
cp .env.example .env   # fill in MONGODB_URI, JWT_SECRET, and Cloudinary credentials
npm run dev            # starts on http://localhost:3000
```

### Image Storage

Uploaded images are stored in [Cloudinary](https://cloudinary.com) (free tier available) under the `sku-builder` folder.

Set the following variables in `.env`:

| Variable | Description |
|---|---|
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | API key from the Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | API secret from the Cloudinary dashboard |

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/auth/me` | User | Current user profile |
| GET | `/api/items` | Optional | List items (search, filter, sort, paginate) |
| GET | `/api/items/:id` | Optional | Get single item |
| POST | `/api/items` | User | Create item (SKU auto-generated) |
| PUT | `/api/items/:id` | User | Update item |
| POST | `/api/items/:id/images` | User | Upload item images (multipart) |
| DELETE | `/api/items/:id` | Admin | Soft-delete item |
| PATCH | `/api/items/:id/restore` | Admin | Restore soft-deleted item |
| POST | `/api/items/bulk-delete` | Admin | Bulk soft-delete |
| POST | `/api/items/bulk-restore` | Admin | Bulk restore |
| GET | `/api/admin/users` | Admin | List all users |
| PATCH | `/api/admin/users/:id/role` | Admin | Set a user's role (`user`/`admin`) |

Interactive Swagger UI: **`GET /api/docs`**

### Tests

```bash
npm test
```

---

## Frontend

A Next.js (Pages Router) + Tailwind CSS app.

### Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL=http://localhost:3000
npm run dev                         # starts on http://localhost:3001
```

### Pages

| Route | Description |
|-------|-------------|
| `/login` | Login / Register tabs |
| `/items` | Item grid with search, filter, sort, pagination |
| `/items/new` | Create a new item with image upload |
| `/items/:id` | Edit an item with image upload |

### Features

- **Auth** — JWT stored in `localStorage`; redirects unauthenticated users to `/login`
- **Item list** — debounced search, category/color filters, sort, 12-per-page pagination
- **Image upload** — click any image slot (main/top/bottom/left/right/brandSize) to upload
- **Admin controls** — soft-delete and restore buttons per card; bulk select + bulk delete/restore; "Show deleted" toggle
- **Role badge** — admins see an `admin` chip next to their email in the nav bar

---

## Deployment

### Docker Compose (recommended)

The easiest way to run the full stack (backend + frontend + MongoDB) locally or on a server.

**1. Create a `.env` file at the repository root** (copy from `.env.example` and fill in your values):

```bash
cp .env.example .env
```

At minimum set:

| Variable | Description |
|---|---|
| `JWT_SECRET` | Long random string used to sign JWTs |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `NEXT_PUBLIC_API_URL` | Public URL of the backend (e.g. `http://localhost:3000`) |

**2. Start all services:**

```bash
docker compose up --build
```

- Backend → `http://localhost:3000`
- Frontend → `http://localhost:3001`
- MongoDB data persisted in a named Docker volume (`mongo_data`)

**3. Stop:**

```bash
docker compose down          # keep data
docker compose down -v       # also remove the MongoDB volume
```

### Container Registry (GitHub Actions CD)

On every push to `main` the `Docker` workflow builds both images and pushes them to the **GitHub Container Registry** (GHCR):

```
ghcr.io/<owner>/sku-builder/backend:latest
ghcr.io/<owner>/sku-builder/frontend:latest
```

Tagged with both `latest` and the commit SHA.

To provide the backend public URL at build time, set a repository variable `NEXT_PUBLIC_API_URL` in **Settings → Variables → Actions**.

### Deploying to a cloud VM

1. Install Docker + Docker Compose on the server.
2. Clone the repository (or copy the `docker-compose.yml` and `.env` files).
3. Fill in `.env` with production values.
4. Run `docker compose up -d --build`.

To pull pre-built images from GHCR instead of building on the server, replace the `build:` sections in `docker-compose.yml` with `image:` references:

```yaml
backend:
  image: ghcr.io/<owner>/sku-builder/backend:latest

frontend:
  image: ghcr.io/<owner>/sku-builder/frontend:latest
```
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
