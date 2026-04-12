import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import ItemForm from '../../components/ItemForm';
import { useAuth } from '../../context/AuthContext';

export default function NewItemPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) return null;

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
          <h1 className="text-2xl font-bold text-gray-900">New Item</h1>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <ItemForm />
        </div>
      </div>
    </Layout>
  );
}
