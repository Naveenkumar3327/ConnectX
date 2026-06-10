import Broadcast from '../models/Broadcast.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import { getIO } from '../services/socketService.js';

// @desc    Get all broadcast lists created by current user
// @route   GET /api/broadcasts
// @access  Private
export const getBroadcasts = async (req, res) => {
  try {
    const lists = await Broadcast.find({ creator: req.user._id })
      .populate('recipients', 'username fullName profilePicture status lastSeen publicKey privacy')
      .sort({ createdAt: -1 });

    res.json(lists);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Create a new broadcast list
// @route   POST /api/broadcasts
// @access  Private
export const createBroadcast = async (req, res) => {
  const { name, recipients } = req.body; // recipients: array of user IDs

  if (!name || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ message: 'List name and recipients are required' });
  }

  try {
    const list = await Broadcast.create({
      name,
      creator: req.user._id,
      recipients,
    });

    const fullList = await Broadcast.findById(list._id).populate(
      'recipients',
      'username fullName profilePicture status lastSeen publicKey privacy'
    );

    res.status(201).json(fullList);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Update a broadcast list (name, recipients)
// @route   PUT /api/broadcasts/:id
// @access  Private
export const updateBroadcast = async (req, res) => {
  const listId = req.params.id;
  const { name, recipients } = req.body;

  try {
    const list = await Broadcast.findById(listId);
    if (!list) {
      return res.status(404).json({ message: 'Broadcast list not found' });
    }

    if (list.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only creator can modify this list' });
    }

    if (name) list.name = name;
    if (recipients && Array.isArray(recipients)) list.recipients = recipients;

    await list.save();

    const updatedList = await Broadcast.findById(listId).populate(
      'recipients',
      'username fullName profilePicture status lastSeen publicKey privacy'
    );

    res.json(updatedList);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Delete a broadcast list
// @route   DELETE /api/broadcasts/:id
// @access  Private
export const deleteBroadcast = async (req, res) => {
  const listId = req.params.id;

  try {
    const list = await Broadcast.findById(listId);
    if (!list) {
      return res.status(404).json({ message: 'Broadcast list not found' });
    }

    if (list.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only creator can delete this list' });
    }

    await Broadcast.findByIdAndDelete(listId);
    res.json({ message: 'Broadcast list deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Send E2EE message to broadcast list
// @route   POST /api/broadcasts/:id/send
// @access  Private
export const sendBroadcastMessage = async (req, res) => {
  const listId = req.params.id;
  // payloads: object mapping recipientId -> { ciphertext, iv, fileMetadata, etc. }
  const { payloads } = req.body; 

  if (!payloads || typeof payloads !== 'object') {
    return res.status(400).json({ message: 'Payloads mapping (userId -> message details) is required' });
  }

  try {
    const list = await Broadcast.findById(listId);
    if (!list) {
      return res.status(404).json({ message: 'Broadcast list not found' });
    }

    if (list.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only creator can send to this list' });
    }

    const messagesSent = [];
    const io = getIO();

    for (let recipientId of list.recipients) {
      const payload = payloads[recipientId.toString()];
      if (!payload) continue; // Skip if client didn't supply ciphertext for this user

      // 1. Access or create 1-to-1 chat with recipient
      let chat = await Chat.findOne({
        isGroup: false,
        $and: [
          { participants: { $elemMatch: { $eq: req.user._id } } },
          { participants: { $elemMatch: { $eq: recipientId } } },
        ],
      });

      if (!chat) {
        chat = await Chat.create({
          isGroup: false,
          participants: [req.user._id, recipientId],
        });
      }

      // 2. Create Message record
      const message = await Message.create({
        chat: chat._id,
        sender: req.user._id,
        ciphertext: payload.ciphertext,
        iv: payload.iv,
        messageType: payload.messageType || 'text',
        fileMetadata: payload.fileMetadata,
        location: payload.location,
        contact: payload.contact,
        forwarded: true, // Marked as forwarded from broadcast
      });

      const populatedMsg = await Message.findById(message._id)
        .populate('sender', 'username fullName profilePicture')
        .populate('chat');

      // Update chat's updatedAt field
      chat.updatedAt = new Date();
      await chat.save();

      messagesSent.push(populatedMsg);

      // 3. Emit via socket
      if (io) {
        // Send to sender's own devices in this chat room
        io.to(chat._id.toString()).emit('receive_message', populatedMsg);
        
        // Emitting notification event to recipient in their personal room
        io.to(recipientId.toString()).emit('new_broadcast_message', {
          listName: list.name,
          message: populatedMsg,
        });
      }
    }

    res.json({ message: 'Broadcast sent successfully', messages: messagesSent });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
