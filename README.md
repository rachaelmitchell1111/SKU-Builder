# SKU Builder — Inventory Management App

A Node.js/Express backend + Next.js frontend for managing inventory items with auto-generated SKUs.

---

## Backend

### Setup

```bash
npm install
cp .env.example .env   # fill in MONGODB_URI, JWT_SECRET
npm run dev            # starts on http://localhost:3000
```

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
