import Message from '../models/Message.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import { getIO } from '../services/socketService.js';
import cloudinary from 'cloudinary';
import fs from 'fs';

// @desc    Get paginated messages for a specific chat
// @route   GET /api/messages/:chatId
// @access  Private
export const getMessages = async (req, res) => {
  const { chatId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 40;
  const skip = (page - 1) * limit;

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to view these messages' });
    }

    // Retrieve messages (excluding unsent scheduled messages)
    const messages = await Message.find({
      chat: chatId,
      $or: [
        { scheduledFor: { $exists: false } },
        { scheduledFor: null },
        { scheduledFor: { $lte: new Date() }, isSent: true }
      ]
    })
      .populate('sender', 'username fullName profilePicture status lastSeen publicKey')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // If user opens the chat, mark all unread messages from other senders as read
    const unreadMessages = await Message.find({
      chat: chatId,
      sender: { $ne: req.user._id },
      'readBy.user': { $ne: req.user._id }
    });

    if (unreadMessages.length > 0) {
      const io = getIO();
      const readTime = new Date();

      for (let msg of unreadMessages) {
        msg.readBy.push({ user: req.user._id, time: readTime });
        await msg.save();
      }

      // Notify sender and other participants that messages were read
      if (io) {
        io.to(chatId).emit('messages_read', {
          chatId,
          readByUserId: req.user._id,
          messageIds: unreadMessages.map(m => m._id),
          time: readTime
        });
      }
    }

    res.json(messages.reverse());
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
export const sendMessage = async (req, res) => {
  const { chatId, ciphertext, iv, messageType, location, contact, poll, scheduledFor } = req.body;

  if (!chatId || !ciphertext || !iv) {
    return res.status(400).json({ message: 'chatId, ciphertext, and iv are required' });
  }

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to send messages to this chat' });
    }

    // Process file metadata if file is uploaded
    let fileMetadata = null;
    if (req.file) {
      let fileUrl = '';
      if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
        try {
          cloudinary.v2.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
          });
          const uploadResult = await cloudinary.v2.uploader.upload(req.file.path, {
            resource_type: 'auto',
            folder: 'connectx_attachments',
          });
          fileUrl = uploadResult.secure_url;
          fs.unlinkSync(req.file.path);
        } catch (cloudinaryError) {
          console.error(cloudinaryError);
          fileUrl = `/uploads/${req.file.filename}`;
        }
      } else {
        fileUrl = `/uploads/${req.file.filename}`;
      }

      fileMetadata = {
        url: fileUrl,
        fileName: req.body.fileName || req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        duration: req.body.duration || 0,
        key: req.body.fileKey || '', // symmetric key encrypted with shared secret
      };
    }

    // Check disappearing messages setting
    let expiresAt = null;
    if (chat.disappearingDuration && chat.disappearingDuration > 0) {
      expiresAt = new Date(Date.now() + chat.disappearingDuration * 1000);
    }

    // Handle Poll parsing
    let parsedPoll = null;
    if (poll) {
      const pollObj = typeof poll === 'string' ? JSON.parse(poll) : poll;
      parsedPoll = {
        question: pollObj.question,
        options: pollObj.options.map(opt => ({ text: opt, votes: [] }))
      };
    }

    // Handle Contact parsing
    let parsedContact = null;
    if (contact) {
      parsedContact = typeof contact === 'string' ? JSON.parse(contact) : contact;
    }

    // Handle Location parsing
    let parsedLocation = null;
    if (location) {
      parsedLocation = typeof location === 'string' ? JSON.parse(location) : location;
    }

    const isScheduled = scheduledFor && new Date(scheduledFor) > new Date();

    const messageData = {
      chat: chatId,
      sender: req.user._id,
      ciphertext,
      iv,
      messageType: messageType || 'text',
      fileMetadata,
      location: parsedLocation,
      contact: parsedContact,
      poll: parsedPoll,
      isSent: !isScheduled,
      scheduledFor: isScheduled ? new Date(scheduledFor) : null,
      expiresAt,
    };

    const message = await Message.create(messageData);

    const populatedMsg = await Message.findById(message._id)
      .populate('sender', 'username fullName profilePicture status lastSeen publicKey')
      .populate('chat');

    // Update Chat's updatedAt field
    chat.updatedAt = new Date();
    await chat.save();

    // Emit live via socket if not scheduled
    if (!isScheduled) {
      const io = getIO();
      if (io) {
        io.to(chatId).emit('receive_message', populatedMsg);
      }
    }

    res.status(201).json(populatedMsg);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Edit a sent message
// @route   PUT /api/messages/:id
// @access  Private
export const editMessage = async (req, res) => {
  const { id } = req.params;
  const { ciphertext, iv } = req.body;

  try {
    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Can only edit your own messages' });
    }

    // Optional: Restrict editing window to 15 minutes
    const timeLimit = 15 * 60 * 1000;
    if (Date.now() - message.createdAt.getTime() > timeLimit) {
      return res.status(400).json({ message: 'Editing window has expired (15m limit)' });
    }

    message.ciphertext = ciphertext;
    message.iv = iv;
    message.isEdited = true;
    await message.save();

    const populatedMsg = await Message.findById(id)
      .populate('sender', 'username fullName profilePicture status lastSeen publicKey');

    const io = getIO();
    if (io) {
      io.to(message.chat.toString()).emit('edit_message', populatedMsg);
    }

    res.json(populatedMsg);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Unsend/delete a message
// @route   DELETE /api/messages/:id
// @access  Private
export const deleteMessage = async (req, res) => {
  const { id } = req.params;

  try {
    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Allow deletion if sender is current user
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Can only unsend your own messages' });
    }

    // Set as deleted
    message.isDeleted = true;
    message.ciphertext = 'This message was deleted';
    message.iv = '000000000000000000000000'; // Mock/Sentinel IV
    message.fileMetadata = undefined;
    message.location = undefined;
    message.contact = undefined;
    message.poll = undefined;
    await message.save();

    const io = getIO();
    if (io) {
      io.to(message.chat.toString()).emit('delete_message', {
        _id: message._id,
        chat: message.chat,
        ciphertext: message.ciphertext,
        iv: message.iv,
        isDeleted: true
      });
    }

    res.json({ message: 'Message unsent successfully', messageId: message._id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Add/toggle a reaction to a message
// @route   POST /api/messages/react/:id
// @access  Private
export const reactToMessage = async (req, res) => {
  const { id } = req.params;
  const { emoji } = req.body; // e.g. "👍", "❤️", "😂"

  try {
    const message = await Message.findById(id).populate('chat');
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (!message.chat.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Check if user already reacted with this exact emoji
    const existingIndex = message.reactions.findIndex(
      r => r.user.toString() === req.user._id.toString()
    );

    if (existingIndex > -1) {
      if (message.reactions[existingIndex].emoji === emoji) {
        // Toggle off if same emoji clicked
        message.reactions.splice(existingIndex, 1);
      } else {
        // Update to new emoji
        message.reactions[existingIndex].emoji = emoji;
      }
    } else {
      // Add new reaction
      message.reactions.push({ user: req.user._id, emoji });
    }

    await message.save();

    const io = getIO();
    if (io) {
      io.to(message.chat._id.toString()).emit('message_reaction', {
        messageId: message._id,
        reactions: message.reactions
      });
    }

    res.json(message.reactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Vote on a poll message
// @route   POST /api/messages/vote/:id
// @access  Private
export const votePoll = async (req, res) => {
  const { id } = req.params;
  const { optionText } = req.body;

  try {
    const message = await Message.findById(id).populate('chat');
    if (!message || message.messageType !== 'poll') {
      return res.status(404).json({ message: 'Poll message not found' });
    }

    if (!message.chat.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Toggle user vote: Remove vote from other options, and toggle in current option
    message.poll.options.forEach(opt => {
      opt.votes = opt.votes.filter(userId => userId.toString() !== req.user._id.toString());
      if (opt.text === optionText) {
        opt.votes.push(req.user._id);
      }
    });

    await message.save();

    const io = getIO();
    if (io) {
      io.to(message.chat._id.toString()).emit('poll_update', {
        messageId: message._id,
        poll: message.poll
      });
    }

    res.json(message.poll);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
