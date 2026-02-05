import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

const ADMIN_STORAGE_KEY = 'spinloot_admin';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing admin session in localStorage
    const storedAdmin = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (storedAdmin) {
      try {
        setUser(JSON.parse(storedAdmin));
      } catch (e) {
        localStorage.removeItem(ADMIN_STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (username, password) => {
    try {
      const { data, error } = await supabase.rpc('verify_admin_password', {
        p_username: username,
        p_password: password,
      });

      if (error) {
        return { data: null, error };
      }

      if (!data || data.length === 0) {
        return { data: null, error: { message: 'Invalid username or password' } };
      }

      const admin = data[0];
      
      if (!admin.is_valid) {
        return { data: null, error: { message: 'Invalid username or password' } };
      }

      const userData = { id: admin.id, username: admin.username };
      setUser(userData);
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(userData));
      
      return { data: { user: userData }, error: null };
    } catch (err) {
      return { data: null, error: { message: 'Authentication failed' } };
    }
  };

  const signOut = async () => {
    setUser(null);
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    return { error: null };
  };

  const value = {
    user,
    loading,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
