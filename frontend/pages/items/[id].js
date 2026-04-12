import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import ItemForm from '../../components/ItemForm';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../lib/api';

export default function EditItemPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { id } = router.query;

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!id || !user) return;
    setLoading(true);
    api.getItem(id)
      .then(setItem)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, user]);

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="text-center py-24 text-gray-400">Loading…</div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4">{error}</div>
        </div>
      </Layout>
    );
  }

  if (!item) return null;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-gray-700 text-lg transition-colors"
            aria-label="Go back"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Edit Item</h1>
          {item.isDeleted && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">deleted</span>
          )}
        </div>

        <div className="bg-white rounded-xl border p-6">
          <ItemForm initialData={item} />
        </div>
      </div>
    </Layout>
  );
}
