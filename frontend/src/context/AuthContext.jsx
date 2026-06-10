import React, { createContext, useState, useEffect } from 'react';
import api, { setAccessToken, getAccessToken } from '../utils/api.js';
import { generateECDHKeyPair, encryptPrivateKeyWithPassword, decryptPrivateKeyWithPassword } from '../utils/crypto.js';
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
      let privKey = await getPrivateKey(loggedUser._id);
      if (privKey) {
        setPrivateKey(privKey);
      } else if (data.encryptedPrivateKey && data.ivPrivateKey && data.saltPrivateKey) {
        // Automatically restore from secure backup using user's login password
        try {
          console.log('Attempting E2EE key restoration from password...');
          const restoredKey = await decryptPrivateKeyWithPassword(
            data.encryptedPrivateKey,
            data.ivPrivateKey,
            data.saltPrivateKey,
            password
          );
          await savePrivateKey(loggedUser._id, restoredKey);
          setPrivateKey(restoredKey);
          console.log('E2EE key restored and synced successfully.');
        } catch (restoreErr) {
          console.error('Failed to auto-restore private key from cloud backup:', restoreErr);
          setPrivateKey(null);
        }
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

      // 2. Encrypt the private key using the user's password
      const backupDetails = await encryptPrivateKeyWithPassword(privateKey, password);

      // 3. Prepare FormData
      const formData = new FormData();
      formData.append('fullName', fullName);
      formData.append('username', username);
      formData.append('email', email);
      formData.append('password', password);
      formData.append('publicKey', publicKeyJwk);
      formData.append('encryptedPrivateKey', backupDetails.encryptedPrivateKey);
      formData.append('ivPrivateKey', backupDetails.ivPrivateKey);
      formData.append('saltPrivateKey', backupDetails.saltPrivateKey);
      if (profilePicFile) {
        formData.append('profilePicture', profilePicFile);
      }

      // 4. Request signup
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
        // We do not delete the private key on logout so that the user does not lose their secure chat history
        // on this browser/device when logging back in.
        // await deletePrivateKey(user._id);
      }
      setAccessToken('');
      setUser(null);
      setPrivateKey(null);
    }
  };

  // Helper to force generate a new keypair (e.g. if logging in from a new device and resetting keys)
  const regenerateKeyPair = async () => {
    if (!user) return;
    const pwd = prompt("Enter your account password to secure and back up your new private key in the cloud:");
    if (!pwd) return alert("Password is required to secure E2EE keys. Regeneration cancelled.");

    try {
      const { publicKeyJwk, privateKey } = await generateECDHKeyPair();
      
      // Encrypt the new private key using the password
      const backupDetails = await encryptPrivateKeyWithPassword(privateKey, pwd);
      
      // Update profile on server
      await api.put('/users/profile', { 
        publicKey: publicKeyJwk,
        encryptedPrivateKey: backupDetails.encryptedPrivateKey,
        ivPrivateKey: backupDetails.ivPrivateKey,
        saltPrivateKey: backupDetails.saltPrivateKey
      });
      
      // Save private key locally
      await savePrivateKey(user._id, privateKey);
      setPrivateKey(privateKey);
      
      // Update local user state
      setUser(prev => ({ ...prev, publicKey: publicKeyJwk }));
      alert("New cryptographic keys generated and secured successfully!");
    } catch (error) {
      console.error('Failed to regenerate ECDH keys:', error);
      alert("Key regeneration failed. Please ensure your password is correct.");
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
