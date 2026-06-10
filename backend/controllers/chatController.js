import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';

// @desc    Get all chats for current user
// @route   GET /api/chats
// @access  Private
export const getChats = async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.user._id,
    })
      .populate('participants', 'username fullName profilePicture status lastSeen publicKey privacy')
      .populate('admins', 'username fullName')
      .sort({ updatedAt: -1 });

    const chatList = [];
    for (let chat of chats) {
      // Find last message
      const lastMessage = await Message.findOne({ chat: chat._id })
        .sort({ createdAt: -1 })
        .populate('sender', 'username fullName');

      // Count unread messages (messages sent by others that have not been read by current user)
      const unreadCount = await Message.countDocuments({
        chat: chat._id,
        sender: { $ne: req.user._id },
        isDeleted: false,
        'readBy.user': { $ne: req.user._id },
      });

      chatList.push({
        ...chat.toObject(),
        lastMessage,
        unreadCount,
      });
    }

    res.json(chatList);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Create or access a 1-on-1 chat
// @route   POST /api/chats
// @access  Private
export const accessChat = async (req, res) => {
  const { recipientId } = req.body;

  if (!recipientId) {
    return res.status(400).json({ message: 'recipientId is required' });
  }

  try {
    // Check if user is trying to chat with self
    if (req.user._id.toString() === recipientId.toString()) {
      return res.status(400).json({ message: 'Cannot create a chat with yourself' });
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    // Check if chat already exists
    let chat = await Chat.findOne({
      isGroup: false,
      $and: [
        { participants: { $elemMatch: { $eq: req.user._id } } },
        { participants: { $elemMatch: { $eq: recipientId } } },
      ],
    })
      .populate('participants', 'username fullName profilePicture status lastSeen publicKey privacy')
      .populate('admins', 'username fullName');

    if (chat) {
      return res.json(chat);
    } else {
      // Create new chat
      const chatData = {
        name: 'sender-recipient',
        isGroup: false,
        participants: [req.user._id, recipientId],
      };

      const createdChat = await Chat.create(chatData);
      const fullChat = await Chat.findById(createdChat._id).populate(
        'participants',
        'username fullName profilePicture status lastSeen publicKey privacy'
      );
      return res.status(201).json(fullChat);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Pin/unpin chat
// @route   POST /api/chats/pin/:id
// @access  Private
export const togglePinChat = async (req, res) => {
  const chatId = req.params.id;

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not participant of this chat' });
    }

    const isPinned = chat.pinnedBy.includes(req.user._id);

    if (isPinned) {
      chat.pinnedBy = chat.pinnedBy.filter(id => id.toString() !== req.user._id.toString());
    } else {
      chat.pinnedBy.push(req.user._id);
    }

    await chat.save();
    res.json({
      message: isPinned ? 'Chat unpinned successfully' : 'Chat pinned successfully',
      pinnedBy: chat.pinnedBy,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Archive/unarchive chat
// @route   POST /api/chats/archive/:id
// @access  Private
export const toggleArchiveChat = async (req, res) => {
  const chatId = req.params.id;

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not participant of this chat' });
    }

    const isArchived = chat.archivedBy.includes(req.user._id);

    if (isArchived) {
      chat.archivedBy = chat.archivedBy.filter(id => id.toString() !== req.user._id.toString());
    } else {
      chat.archivedBy.push(req.user._id);
    }

    await chat.save();
    res.json({
      message: isArchived ? 'Chat unarchived successfully' : 'Chat archived successfully',
      archivedBy: chat.archivedBy,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Mute/unmute chat
// @route   POST /api/chats/mute/:id
// @access  Private
export const muteChat = async (req, res) => {
  const chatId = req.params.id;
  const { duration } = req.body; // duration in hours (e.g. 8, 24, 730 for 1 month)

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not participant of this chat' });
    }

    // Filter out existing mute configuration for user
    chat.mutedBy = chat.mutedBy.filter(m => m.user.toString() !== req.user._id.toString());

    if (duration && duration > 0) {
      const untilDate = new Date(Date.now() + duration * 60 * 60 * 1000);
      chat.mutedBy.push({
        user: req.user._id,
        until: untilDate,
      });
      await chat.save();
      res.json({ message: 'Chat muted successfully', mutedBy: chat.mutedBy });
    } else {
      // Unmute
      await chat.save();
      res.json({ message: 'Chat unmuted successfully', mutedBy: chat.mutedBy });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
