import { useEffect, useState } from 'react';

const DB_NAME = 'ConnectX_Crypto';
const STORE_NAME = 'user_keys';
const DB_VERSION = 1;

// Helper to open the database connection
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Saves a CryptoKey to IndexedDB under a specific user identifier
 * @param {string} userId 
 * @param {CryptoKey} privateKey 
 * @returns {Promise<void>}
 */
export async function savePrivateKey(userId, privateKey) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(privateKey, `private_key_${userId}`);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieves a CryptoKey from IndexedDB
 * @param {string} userId 
 * @returns {Promise<CryptoKey|null>}
 */
export async function getPrivateKey(userId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(`private_key_${userId}`);

    request.onsuccess = (event) => {
      resolve(event.target.result || null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Deletes a user's private key from IndexedDB (e.g. on clean logout or device wipe)
 * @param {string} userId 
 * @returns {Promise<void>}
 */
export async function deletePrivateKey(userId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(`private_key_${userId}`);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
