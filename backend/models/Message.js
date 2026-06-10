import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ciphertext: {
      type: String,
      required: true, // Encrypted content using client-derived AES-GCM-256 key
    },
    iv: {
      type: String,
      required: true, // Initialization vector used in AES-GCM-256
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'video', 'document', 'audio', 'location', 'contact', 'gif', 'sticker', 'poll'],
      default: 'text',
    },
    fileMetadata: {
      url: String, // URL to media (Cloudinary)
      fileName: String,
      fileSize: Number,
      mimeType: String,
      duration: Number, // In seconds (for audio/video)
      key: String, // Encrypted media symmetric key
    },
    location: {
      latitude: Number,
      longitude: Number,
      address: String,
    },
    contact: {
      name: String,
      phoneNumber: String,
    },
    poll: {
      question: String,
      options: [
        {
          text: String,
          votes: [
            {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'User',
            },
          ],
        },
      ],
    },
    deliveredTo: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        time: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        time: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        emoji: String,
      },
    ],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
    forwarded: {
      type: Boolean,
      default: false,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false, // For "unsend" features, ciphertext will be modified
    },
    scheduledFor: {
      type: Date,
      index: true, // For finding and scheduling messages
    },
    isSent: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date,
      index: true, // MongoDB TTL index to clean up disappearing messages
    },
  },
  {
    timestamps: true,
  }
);

// Create TTL index for disappearing messages
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Message = mongoose.model('Message', messageSchema);
export default Message;
