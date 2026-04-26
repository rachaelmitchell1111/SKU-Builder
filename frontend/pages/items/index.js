import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../lib/api';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const IMAGE_FIELDS = ['main', 'top', 'bottom', 'left', 'right', 'brandSize'];

function itemImageUrl(item) {
  for (const f of IMAGE_FIELDS) {
    const src = item.images?.[f];
    if (src) return src.startsWith('http') ? src : `${BASE}/${src.replace(/^\/+/, '')}`;
  }
  return null;
}

export default function ItemsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'admin';

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Incrementing this triggers a re-fetch without changing any filter state
  const [fetchSeq, setFetchSeq] = useState(0);

  // Filter state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [color, setColor] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [includeDeleted, setIncludeDeleted] = useState(false);

  // Bulk selection
  const [selected, setSelected] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const searchTimer = useRef(null);

  // Debounce search input
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  // Reset page when filters change (not when page itself changes)
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, category, color, sortBy, order, includeDeleted]);

  // Fetch items whenever relevant state changes
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }

    let cancelled = false;
    setLoading(true);
    setError('');

    const params = { page, limit: 12, sortBy, order };
    if (debouncedSearch) params.q = debouncedSearch;
    if (category) params.category = category;
    if (color) params.color = color;
    if (includeDeleted && isAdmin) params.includeDeleted = 'true';

    api.getItems(params)
      .then((res) => {
        if (!cancelled) {
          setItems(res.data);
          setTotal(res.total);
          setPages(res.pages);
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [authLoading, user, page, debouncedSearch, category, color, sortBy, order, includeDeleted, isAdmin, fetchSeq, router]);

  function refetch() { setFetchSeq((s) => s + 1); }

  async function handleDelete(id) {
    if (!confirm('Soft-delete this item?')) return;
    try {
      await api.deleteItem(id);
      refetch();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleRestore(id) {
    try {
      await api.restoreItem(id);
      refetch();
    } catch (err) {
      alert(err.message);
    }
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Soft-delete ${selected.size} item(s)?`)) return;
    setBulkLoading(true);
    try {
      await api.bulkDelete([...selected]);
      setSelected(new Set());
      refetch();
    } catch (err) {
      alert(err.message);
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkRestore() {
    if (selected.size === 0) return;
    if (!confirm(`Restore ${selected.size} item(s)?`)) return;
    setBulkLoading(true);
    try {
      await api.bulkRestore([...selected]);
      setSelected(new Set());
      refetch();
    } catch (err) {
      alert(err.message);
    } finally {
      setBulkLoading(false);
    }
  }

  if (authLoading) return null;

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Inventory{total > 0 && <span className="ml-2 text-base font-normal text-gray-400">({total})</span>}
        </h1>
        <Link
          href="/items/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + New Item
        </Link>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border p-4 mb-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search name or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[180px] focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Category"
          value={category}
          onChange={(e) => { setCategory(e.target.value); }}
          className="border rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Color"
          value={color}
          onChange={(e) => { setColor(e.target.value); }}
          className="border rounded-lg px-3 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="createdAt">Sort: Date</option>
          <option value="name">Sort: Name</option>
          <option value="price">Sort: Price</option>
          <option value="stockAmount">Sort: Stock</option>
        </select>
        <select
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
        {isAdmin && (
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
              className="rounded"
            />
            Show deleted
          </label>
        )}
      </div>

      {/* Bulk action bar */}
      {isAdmin && selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-blue-800">{selected.size} selected</span>
          <button
            onClick={handleBulkDelete}
            disabled={bulkLoading}
            className="text-sm bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            Bulk Delete
          </button>
          {includeDeleted && (
            <button
              onClick={handleBulkRestore}
              disabled={bulkLoading}
              className="text-sm bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              Bulk Restore
            </button>
          )}
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-gray-500 hover:text-gray-800 ml-auto"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Select-all link */}
      {isAdmin && items.length > 0 && (
        <div className="mb-3 flex gap-3">
          <button
            onClick={() => setSelected(new Set(items.map((i) => i._id)))}
            className="text-xs text-blue-600 hover:underline"
          >
            Select all on page
          </button>
          {selected.size > 0 && (
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-gray-500 hover:underline"
            >
              Clear ({selected.size})
            </button>
          )}
        </div>
      )}

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {/* Grid */}
      {loading ? (
        <div className="text-center py-24 text-gray-400">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-24 text-gray-400">No items found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => {
            const imgUrl = itemImageUrl(item);
            const isSelected = selected.has(item._id);

            return (
              <div
                key={item._id}
                className={`bg-white rounded-xl border overflow-hidden ${
                  item.isDeleted ? 'opacity-60' : ''
                } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
              >
                {/* Image area */}
                <div className="relative h-40 bg-gray-100 flex items-center justify-center overflow-hidden">
                  {isAdmin && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(item._id)}
                      className="absolute top-2 left-2 z-10 h-4 w-4 cursor-pointer"
                    />
                  )}
                  {imgUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imgUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-300 text-5xl select-none">📦</span>
                  )}
                  {item.isDeleted && (
                    <span className="absolute top-2 right-2 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded">
                      deleted
                    </span>
                  )}
                </div>

                {/* Card body */}
                <div className="p-3">
                  <h3 className="font-semibold text-sm leading-snug truncate" title={item.name}>
                    {item.name}
                  </h3>
                  <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">{item.sku}</p>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{item.category}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{item.color}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-semibold text-sm">${Number(item.price).toFixed(2)}</span>
                    <span className="text-xs text-gray-500">Stock: {item.stockAmount}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    <Link
                      href={`/items/${item._id}`}
                      className="flex-1 text-center text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1.5 rounded-lg transition-colors"
                    >
                      Edit
                    </Link>
                    {isAdmin && !item.isDeleted && (
                      <button
                        onClick={() => handleDelete(item._id)}
                        className="text-xs bg-red-50 hover:bg-red-100 text-red-700 px-2 py-1.5 rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    )}
                    {isAdmin && item.isDeleted && (
                      <button
                        onClick={() => handleRestore(item._id)}
                        className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-2 py-1.5 rounded-lg transition-colors"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            ← Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </Layout>
  );
}
