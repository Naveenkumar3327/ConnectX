import React, { createContext, useState, useEffect } from 'react';
import api, { setAccessToken, getAccessToken } from '../utils/api.js';
import { generateECDHKeyPair } from '../utils/crypto.js';
import { savePrivateKey, getPrivateKey, deletePrivateKey } from '../hooks/useIndexedDB.js';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [privateKey, setPrivateKey] = useState(null);
  const [loading, setLoading] = useState(true);

  // Silent refresh on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Fetch fresh access token via HTTP-only cookie refresh
        const { data } = await api.post('/auth/refresh-token');
        setAccessToken(data.token);

        // Fetch user profile info
        const profileRes = await api.get('/users/profile');
        const currentUser = profileRes.data;
        setUser(currentUser);

        // Retrieve private key from IndexedDB
        const privKey = await getPrivateKey(currentUser._id);
        setPrivateKey(privKey);
      } catch (error) {
        console.log('No active session found on initialize');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for global logout events dispatched by the axios interceptor
    const handleGlobalLogout = () => {
      logout();
    };
    window.addEventListener('auth-logout', handleGlobalLogout);

    return () => {
      window.removeEventListener('auth-logout', handleGlobalLogout);
    };
  }, []);

  const login = async (usernameOrEmail, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { usernameOrEmail, password });
      setAccessToken(data.token);
      
      const loggedUser = {
        _id: data._id,
        fullName: data.fullName,
        username: data.username,
        email: data.email,
        profilePicture: data.profilePicture,
        bio: data.bio,
        publicKey: data.publicKey,
        isAdmin: data.isAdmin,
      };

      setUser(loggedUser);

      // Check if private key exists in browser IndexedDB
      const privKey = await getPrivateKey(loggedUser._id);
      if (privKey) {
        setPrivateKey(privKey);
      } else {
        // Private key is missing (e.g. logging in from a new device/browser)
        console.warn('Private key not found on this device. E2EE messages will be unreadable unless a key is generated or imported.');
        setPrivateKey(null);
      }
      return loggedUser;
    } catch (error) {
      throw error.response?.data?.message || 'Login failed';
    } finally {
      setLoading(false);
    }
  };

  const signup = async (fullName, username, email, password, profilePicFile) => {
    setLoading(true);
    try {
      // 1. Generate new P-256 ECDH Keypair locally
      const { publicKeyJwk, privateKey } = await generateECDHKeyPair();

      // 2. Prepare FormData
      const formData = new FormData();
      formData.append('fullName', fullName);
      formData.append('username', username);
      formData.append('email', email);
      formData.append('password', password);
      formData.append('publicKey', publicKeyJwk);
      if (profilePicFile) {
        formData.append('profilePicture', profilePicFile);
      }

      // 3. Request signup
      const { data } = await api.post('/auth/signup', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // 4. Set session
      setAccessToken(data.token);
      
      const loggedUser = {
        _id: data._id,
        fullName: data.fullName,
        username: data.username,
        email: data.email,
        profilePicture: data.profilePicture,
        bio: data.bio,
        publicKey: data.publicKey,
        isAdmin: data.isAdmin,
      };

      setUser(loggedUser);

      // 5. Save private key to IndexedDB
      await savePrivateKey(loggedUser._id, privateKey);
      setPrivateKey(privateKey);

      return loggedUser;
    } catch (error) {
      throw error.response?.data?.message || 'Registration failed';
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout request failed on server', err);
    } finally {
      // Wipe local credentials and state
      if (user) {
        // We delete the private key from IndexedDB to ensure E2EE device privacy
        await deletePrivateKey(user._id);
      }
      setAccessToken('');
      setUser(null);
      setPrivateKey(null);
    }
  };

  // Helper to force generate a new keypair (e.g. if logging in from a new device and resetting keys)
  const regenerateKeyPair = async () => {
    if (!user) return;
    try {
      const { publicKeyJwk, privateKey } = await generateECDHKeyPair();
      
      // Update public key on server
      await api.put('/users/profile', { publicKey: publicKeyJwk });
      
      // Save private key locally
      await savePrivateKey(user._id, privateKey);
      setPrivateKey(privateKey);
      
      // Update local user state
      setUser(prev => ({ ...prev, publicKey: publicKeyJwk }));
    } catch (error) {
      console.error('Failed to regenerate ECDH keys:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        privateKey,
        loading,
        login,
        signup,
        logout,
        regenerateKeyPair,
        setPrivateKey
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
