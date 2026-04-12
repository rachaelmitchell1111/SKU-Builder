import { useState } from 'react';
import { useRouter } from 'next/router';
import * as api from '../lib/api';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const IMAGE_FIELDS = ['main', 'top', 'bottom', 'left', 'right', 'brandSize'];

function existingImageUrl(initialData, field) {
  const src = initialData?.images?.[field];
  if (!src) return null;
  return src.startsWith('http') ? src : `${BASE}/${src.replace(/^\/+/, '')}`;
}

export default function ItemForm({ initialData }) {
  const isEdit = Boolean(initialData?._id);
  const router = useRouter();

  const [name, setName] = useState(initialData?.name || '');
  const [category, setCategory] = useState(initialData?.category || '');
  const [color, setColor] = useState(initialData?.color || '');
  const [price, setPrice] = useState(initialData?.price ?? '');
  const [stockAmount, setStockAmount] = useState(initialData?.stockAmount ?? '');
  const [imageFiles, setImageFiles] = useState({});
  const [imagePreviews, setImagePreviews] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function handleFileChange(field, file) {
    if (!file) return;
    setImageFiles((prev) => ({ ...prev, [field]: file }));
    setImagePreviews((prev) => ({ ...prev, [field]: URL.createObjectURL(file) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const payload = {
        name,
        category,
        color,
        price: parseFloat(price),
        stockAmount: parseInt(stockAmount, 10),
      };

      let item;
      if (isEdit) {
        item = await api.updateItem(initialData._id, payload);
      } else {
        item = await api.createItem(payload);
      }

      // Upload any selected images
      const fileEntries = Object.entries(imageFiles).filter(([, f]) => f);
      if (fileEntries.length > 0) {
        const formData = new FormData();
        for (const [field, file] of fileEntries) {
          formData.append(field, file);
        }
        await api.uploadImages(item._id, formData);
      }

      router.push('/items');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Color <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Price <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            min="0"
            step="0.01"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stock Amount <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={stockAmount}
            onChange={(e) => setStockAmount(e.target.value)}
            required
            min="0"
            step="1"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* SKU (read-only in edit mode) */}
      {isEdit && initialData?.sku && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">SKU (auto-generated)</label>
          <p className="font-mono text-sm bg-gray-50 border rounded-lg px-3 py-2 text-gray-600 select-all">
            {initialData.sku}
          </p>
        </div>
      )}

      {/* Image uploads */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Images (optional — click to upload)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {IMAGE_FIELDS.map((field) => {
            const preview = imagePreviews[field];
            const existing = existingImageUrl(initialData, field);
            const displaySrc = preview || existing;

            return (
              <label key={field} className="cursor-pointer block">
                <p className="text-xs text-gray-500 mb-1 capitalize text-center">{field}</p>
                <div className="border-2 border-dashed border-gray-200 rounded-lg h-28 flex items-center justify-center overflow-hidden hover:border-blue-400 transition-colors">
                  {displaySrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={displaySrc}
                      alt={field}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-gray-300 text-3xl select-none">+</span>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(field, e.target.files[0])}
                />
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Item'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/items')}
          className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
