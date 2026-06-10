// Utility helper to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Utility helper to convert Base64 to ArrayBuffer
function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Helper to convert string to ArrayBuffer (UTF-8)
function stringToBuffer(str) {
  return new TextEncoder().encode(str);
}

// Helper to convert ArrayBuffer to string
function bufferToString(buffer) {
  return new TextDecoder().decode(buffer);
}

/**
 * Generates an ECDH key pair for the user
 * @returns {Promise<{publicKeyJwk: string, privateKey: CryptoKey}>}
 */
export async function generateECDHKeyPair() {
  try {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true, // extractable
      ['deriveKey', 'deriveBits']
    );

    // Export public key as JWK string for server upload
    const publicKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
    
    return {
      publicKeyJwk: JSON.stringify(publicKeyJwk),
      privateKey: keyPair.privateKey,
    };
  } catch (error) {
    console.error('Error generating ECDH keys:', error);
    throw error;
  }
}

/**
 * Derives a shared AES-GCM key from current user's private key and recipient's public key (JWK)
 * @param {CryptoKey} privateKey
 * @param {string} recipientPublicKeyJwkStr
 * @returns {Promise<CryptoKey>}
 */
export async function deriveSharedSecret(privateKey, recipientPublicKeyJwkStr) {
  try {
    const recipientPublicKeyJwk = JSON.parse(recipientPublicKeyJwkStr);
    const recipientPublicKey = await window.crypto.subtle.importKey(
      'jwk',
      recipientPublicKeyJwk,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      []
    );

    return await window.crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: recipientPublicKey,
      },
      privateKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  } catch (error) {
    console.error('Error deriving shared secret:', error);
    throw error;
  }
}

/**
 * Encrypts a plaintext string using a derived shared key
 * @param {CryptoKey} sharedKey
 * @param {string} plaintext
 * @returns {Promise<{ciphertext: string, iv: string}>}
 */
export async function encryptMessage(sharedKey, plaintext) {
  try {
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV is standard for GCM
    const encodedPlaintext = stringToBuffer(plaintext);

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      sharedKey,
      encodedPlaintext
    );

    return {
      ciphertext: arrayBufferToBase64(ciphertextBuffer),
      iv: arrayBufferToBase64(iv),
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
}

/**
 * Decrypts a ciphertext string using a derived shared key
 * @param {CryptoKey} sharedKey
 * @param {string} ciphertextBase64
 * @param {string} ivBase64
 * @returns {Promise<string>}
 */
export async function decryptMessage(sharedKey, ciphertextBase64, ivBase64) {
  try {
    const ciphertext = base64ToArrayBuffer(ciphertextBase64);
    const iv = base64ToArrayBuffer(ivBase64);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      sharedKey,
      ciphertext
    );

    return bufferToString(decryptedBuffer);
  } catch (error) {
    console.error('Decryption error:', error);
    return '[Decryption failed: Key mismatch or integrity compromised]';
  }
}

/**
 * Generates an ephemeral symmetric key and encrypts binary file data
 * @param {File|Blob} file
 * @returns {Promise<{encryptedData: Blob, keyJwk: string}>}
 */
export async function encryptFile(file) {
  try {
    const fileKey = await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const arrayBuffer = await file.arrayBuffer();

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      fileKey,
      arrayBuffer
    );

    // Concat IV and Ciphertext so we only have one payload to upload
    const payload = new Uint8Array(iv.length + ciphertextBuffer.byteLength);
    payload.set(iv, 0);
    payload.set(new Uint8Array(ciphertextBuffer), iv.length);

    const encryptedBlob = new Blob([payload], { type: 'application/octet-stream' });
    const keyJwk = await window.crypto.subtle.exportKey('jwk', fileKey);

    return {
      encryptedData: encryptedBlob,
      keyJwk: JSON.stringify(keyJwk),
    };
  } catch (error) {
    console.error('File encryption error:', error);
    throw error;
  }
}

/**
 * Decrypts binary file data using an exported key JWK string
 * @param {Blob} encryptedBlob
 * @param {string} keyJwkStr
 * @returns {Promise<Blob>}
 */
export async function decryptFile(encryptedBlob, keyJwkStr) {
  try {
    const fileKeyJwk = JSON.parse(keyJwkStr);
    const fileKey = await window.crypto.subtle.importKey(
      'jwk',
      fileKeyJwk,
      {
        name: 'AES-GCM',
      },
      true,
      ['decrypt']
    );

    const arrayBuffer = await encryptedBlob.arrayBuffer();
    const dataView = new Uint8Array(arrayBuffer);

    // Extract standard 12-byte IV from start of buffer
    const iv = dataView.slice(0, 12);
    const ciphertext = dataView.slice(12);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      fileKey,
      ciphertext
    );

    return new Blob([decryptedBuffer]);
  } catch (error) {
    console.error('File decryption error:', error);
    throw error;
  }
}

/**
 * Derives a key from a password and salt using PBKDF2
 * @param {string} password
 * @param {Uint8Array} salt
 * @returns {Promise<CryptoKey>}
 */
async function deriveKeyFromPassword(password, salt) {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // Import the password string as a CryptoKey
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey', 'deriveBits']
  );
  
  // Derive an AES-GCM 256-bit key from the base key
  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a private key JWK string using a password
 * @param {CryptoKey} privateKey
 * @param {string} password
 * @returns {Promise<{encryptedPrivateKey: string, ivPrivateKey: string, saltPrivateKey: string}>}
 */
export async function encryptPrivateKeyWithPassword(privateKey, password) {
  try {
    const jwk = await window.crypto.subtle.exportKey('jwk', privateKey);
    const plaintext = JSON.stringify(jwk);
    
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const aesKey = await deriveKeyFromPassword(password, salt);
    
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      aesKey,
      new TextEncoder().encode(plaintext)
    );
    
    return {
      encryptedPrivateKey: arrayBufferToBase64(encryptedBuffer),
      ivPrivateKey: arrayBufferToBase64(iv),
      saltPrivateKey: arrayBufferToBase64(salt)
    };
  } catch (error) {
    console.error('Error encrypting private key:', error);
    throw error;
  }
}

/**
 * Decrypts an encrypted private key JWK string using a password
 * @param {string} encryptedPrivateKeyBase64
 * @param {string} ivBase64
 * @param {string} saltBase64
 * @param {string} password
 * @returns {Promise<CryptoKey>}
 */
export async function decryptPrivateKeyWithPassword(encryptedPrivateKeyBase64, ivBase64, saltBase64, password) {
  try {
    const ciphertext = base64ToArrayBuffer(encryptedPrivateKeyBase64);
    const iv = base64ToArrayBuffer(ivBase64);
    const salt = base64ToArrayBuffer(saltBase64);
    
    const aesKey = await deriveKeyFromPassword(password, salt);
    
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      aesKey,
      ciphertext
    );
    
    const jwk = JSON.parse(new TextDecoder().decode(decryptedBuffer));
    
    return await window.crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      ['deriveKey', 'deriveBits']
    );
  } catch (error) {
    console.error('Error decrypting private key with password:', error);
    throw error;
  }
}
