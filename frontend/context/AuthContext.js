import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getMe } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      getMe()
        .then(setUser)
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Auto-logout when any protected API call returns 401 (expired / revoked token)
  useEffect(() => {
    function handleExpired() {
      localStorage.removeItem('token');
      setUser(null);
      router.replace('/login?expired=1');
    }
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, [router]);

  async function login(token) {
    localStorage.setItem('token', token);
    const me = await getMe();
    setUser(me);
  }

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
