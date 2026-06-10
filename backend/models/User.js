import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    profilePicture: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      default: 'Hey there! I am using ConnectX.',
    },
    status: {
      type: String,
      default: 'online',
      enum: ['online', 'offline', 'away'],
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    publicKey: {
      type: String,
      required: true, // Stores the client's public key (ECDH P-256) for E2EE
    },
    encryptedPrivateKey: {
      type: String, // Client-encrypted private key (AES-GCM base64)
    },
    ivPrivateKey: {
      type: String, // Initialization vector for encrypted private key
    },
    saltPrivateKey: {
      type: String, // Salt used for PBKDF2 derivation
    },
    privacy: {
      lastSeen: {
        type: String,
        enum: ['everyone', 'contacts', 'nobody'],
        default: 'everyone',
      },
      profilePicture: {
        type: String,
        enum: ['everyone', 'contacts', 'nobody'],
        default: 'everyone',
      },
      readReceipts: {
        type: Boolean,
        default: true,
      },
    },
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isAdmin: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    otp: {
      code: String,
      expiresAt: Date,
    },
    refreshToken: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
