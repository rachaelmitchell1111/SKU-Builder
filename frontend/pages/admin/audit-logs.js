import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { getAuditLogs } from '../../lib/api';

const ACTIONS = ['', 'create', 'update', 'delete', 'restore', 'bulk-delete', 'bulk-restore'];

const ACTION_STYLES = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
  restore: 'bg-yellow-100 text-yellow-800',
  'bulk-delete': 'bg-red-200 text-red-900',
  'bulk-restore': 'bg-yellow-200 text-yellow-900',
};

export default function AuditLogsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'admin') { router.replace('/items'); return; }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    setLoading(true);
    setError('');
    getAuditLogs({ page, limit: 25, action: actionFilter || undefined })
      .then((res) => {
        setLogs(res.data);
        setTotal(res.total);
        setPages(res.pages);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user, page, actionFilter]);

  function handleActionChange(e) {
    setActionFilter(e.target.value);
    setPage(1);
  }

  if (authLoading) return null;

  return (
    <Layout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} {total === 1 ? 'entry' : 'entries'} recorded
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600" htmlFor="action-filter">
            Filter by action:
          </label>
          <select
            id="action-filter"
            value={actionFilter}
            onChange={handleActionChange}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a || 'All actions'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-24 text-gray-400">Loading…</div>
      ) : (
        <>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Diff</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      No audit log entries found.
                    </td>
                  </tr>
                )}
                {logs.map((log) => {
                  const isExpanded = expandedId === log._id;
                  const hasDiff = log.diff && Object.keys(log.diff).length > 0;
                  return (
                    <tr key={log._id} className="border-b last:border-0 hover:bg-gray-50 align-top">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${
                            ACTION_STYLES[log.action] || 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {log.userId ? log.userId.email : <span className="text-gray-400">unknown</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {log.itemId ? (
                          <>
                            <span className="font-medium">{log.itemId.name}</span>
                            {log.itemId.sku && (
                              <span className="ml-1 text-xs text-gray-400">({log.itemId.sku})</span>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400">deleted item</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {hasDiff ? (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : log._id)}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            {isExpanded ? 'Hide' : 'Show'}
                          </button>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                        {isExpanded && hasDiff && (
                          <pre className="mt-2 bg-gray-50 border rounded p-2 text-xs text-gray-700 whitespace-pre-wrap max-w-xs overflow-auto">
                            {JSON.stringify(log.diff, null, 2)}
                          </pre>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
              <span>
                Page {page} of {pages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg border hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page >= pages}
                  className="px-3 py-1.5 rounded-lg border hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
