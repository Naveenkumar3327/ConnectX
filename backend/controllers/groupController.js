import Chat from '../models/Chat.js';
import User from '../models/User.js';
import cloudinary from 'cloudinary';
import fs from 'fs';

// @desc    Create a new group chat
// @route   POST /api/chats/group
// @access  Private
export const createGroup = async (req, res) => {
  const { name, participants, groupDescription, groupKeys, disappearingDuration } = req.body;

  if (!name || !participants || !Array.parse || participants.length === 0) {
    return res.status(400).json({ message: 'Group name and participants are required' });
  }

  try {
    // Parse participants if they are passed as a JSON string (due to form-data uploading)
    let parsedParticipants = typeof participants === 'string' ? JSON.parse(participants) : participants;
    let parsedGroupKeys = typeof groupKeys === 'string' ? JSON.parse(groupKeys) : groupKeys || [];

    // Ensure all participants exist in database
    const users = await User.find({ _id: { $in: parsedParticipants } });
    if (users.length !== parsedParticipants.length) {
      return res.status(400).json({ message: 'One or more participants not found' });
    }

    // Add current user to participants
    if (!parsedParticipants.includes(req.user._id.toString())) {
      parsedParticipants.push(req.user._id.toString());
    }

    // Process group avatar upload
    let avatarUrl = '';
    if (req.file) {
      if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
        try {
          cloudinary.v2.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
          });
          const result = await cloudinary.v2.uploader.upload(req.file.path, {
            folder: 'connectx_groups',
          });
          avatarUrl = result.secure_url;
          fs.unlinkSync(req.file.path);
        } catch (cloudinaryError) {
          console.error(cloudinaryError);
          avatarUrl = `/uploads/${req.file.filename}`;
        }
      } else {
        avatarUrl = `/uploads/${req.file.filename}`;
      }
    }

    // Generate unique invite code
    const inviteLink = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);

    const groupChat = await Chat.create({
      name,
      isGroup: true,
      groupDescription: groupDescription || '',
      groupAvatar: avatarUrl,
      participants: parsedParticipants,
      admins: [req.user._id],
      inviteLink,
      groupKeys: parsedGroupKeys, // Encrypted group keys for each participant
      disappearingDuration: disappearingDuration || 0,
    });

    const fullGroupChat = await Chat.findById(groupChat._id)
      .populate('participants', 'username fullName profilePicture status lastSeen publicKey privacy')
      .populate('admins', 'username fullName profilePicture');

    res.status(201).json(fullGroupChat);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Add members to group
// @route   PUT /api/chats/group/:id/add
// @access  Private
export const addGroupMembers = async (req, res) => {
  const chatId = req.params.id;
  const { newMemberIds, newGroupKeys } = req.body; // newGroupKeys: array of { user: id, encryptedKey: key }

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if requester is admin
    if (!chat.admins.includes(req.user._id)) {
      return res.status(403).json({ message: 'Only admins can add members' });
    }

    // Check if new members exist
    const users = await User.find({ _id: { $in: newMemberIds } });
    if (users.length !== newMemberIds.length) {
      return res.status(400).json({ message: 'One or more users not found' });
    }

    // Filter out users already in the chat
    const membersToAdd = newMemberIds.filter(id => !chat.participants.includes(id));
    if (membersToAdd.length === 0) {
      return res.status(400).json({ message: 'All users are already members of this group' });
    }

    chat.participants.push(...membersToAdd);

    // Append new group keys
    if (newGroupKeys && Array.isArray(newGroupKeys)) {
      chat.groupKeys.push(...newGroupKeys);
    }

    await chat.save();

    const updatedChat = await Chat.findById(chatId)
      .populate('participants', 'username fullName profilePicture status lastSeen publicKey privacy')
      .populate('admins', 'username fullName profilePicture');

    res.json(updatedChat);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Remove member from group
// @route   PUT /api/chats/group/:id/remove
// @access  Private
export const removeGroupMember = async (req, res) => {
  const chatId = req.params.id;
  const { memberId } = req.body;

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if requester is admin or if the user is exiting the group
    const isAdmin = chat.admins.includes(req.user._id);
    const isSelfExit = req.user._id.toString() === memberId.toString();

    if (!isAdmin && !isSelfExit) {
      return res.status(403).json({ message: 'Only admins can remove members' });
    }

    // Cannot remove admin if they are the only admin and exiting
    if (isSelfExit && chat.admins.includes(memberId) && chat.admins.length === 1 && chat.participants.length > 1) {
      return res.status(400).json({ message: 'Please promote another admin before exiting' });
    }

    // Remove user
    chat.participants = chat.participants.filter(id => id.toString() !== memberId.toString());
    chat.admins = chat.admins.filter(id => id.toString() !== memberId.toString());
    chat.groupKeys = chat.groupKeys.filter(k => k.user.toString() !== memberId.toString());

    // If no participants left, delete group completely
    if (chat.participants.length === 0) {
      await Chat.findByIdAndDelete(chatId);
      return res.json({ message: 'Group deleted successfully (no members left)' });
    }

    await chat.save();

    const updatedChat = await Chat.findById(chatId)
      .populate('participants', 'username fullName profilePicture status lastSeen publicKey privacy')
      .populate('admins', 'username fullName profilePicture');

    res.json(updatedChat);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Promote member to admin
// @route   PUT /api/chats/group/:id/promote
// @access  Private
export const promoteToAdmin = async (req, res) => {
  const chatId = req.params.id;
  const { memberId } = req.body;

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if requester is admin
    if (!chat.admins.includes(req.user._id)) {
      return res.status(403).json({ message: 'Only admins can promote members' });
    }

    if (!chat.participants.includes(memberId)) {
      return res.status(400).json({ message: 'User is not a member of this group' });
    }

    if (chat.admins.includes(memberId)) {
      return res.status(400).json({ message: 'User is already an admin' });
    }

    chat.admins.push(memberId);
    await chat.save();

    const updatedChat = await Chat.findById(chatId)
      .populate('participants', 'username fullName profilePicture status lastSeen publicKey privacy')
      .populate('admins', 'username fullName profilePicture');

    res.json(updatedChat);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Join group via invite link
// @route   GET /api/chats/group/invite/:code
// @access  Private
export const joinGroupViaInvite = async (req, res) => {
  const { code } = req.params;

  try {
    const chat = await Chat.findOne({ inviteLink: code });
    if (!chat) {
      return res.status(404).json({ message: 'Invalid invite link' });
    }

    // Check if user is already a member
    if (chat.participants.includes(req.user._id)) {
      return res.status(400).json({ message: 'You are already a member of this group' });
    }

    // Join group
    chat.participants.push(req.user._id);
    await chat.save();

    const fullGroupChat = await Chat.findById(chat._id)
      .populate('participants', 'username fullName profilePicture status lastSeen publicKey privacy')
      .populate('admins', 'username fullName profilePicture');

    res.json(fullGroupChat);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Update group settings (name, description, avatar, disappearingDuration)
// @route   PUT /api/chats/group/:id/settings
// @access  Private
export const updateGroupSettings = async (req, res) => {
  const chatId = req.params.id;
  const { name, groupDescription, disappearingDuration } = req.body;

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if requester is admin
    if (!chat.admins.includes(req.user._id)) {
      return res.status(403).json({ message: 'Only admins can modify settings' });
    }

    if (name) chat.name = name;
    if (groupDescription !== undefined) chat.groupDescription = groupDescription;
    if (disappearingDuration !== undefined) chat.disappearingDuration = disappearingDuration;

    if (req.file) {
      if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
        try {
          cloudinary.v2.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
          });
          const result = await cloudinary.v2.uploader.upload(req.file.path, {
            folder: 'connectx_groups',
          });
          chat.groupAvatar = result.secure_url;
          fs.unlinkSync(req.file.path);
        } catch (cloudinaryError) {
          console.error(cloudinaryError);
          chat.groupAvatar = `/uploads/${req.file.filename}`;
        }
      } else {
        chat.groupAvatar = `/uploads/${req.file.filename}`;
      }
    }

    await chat.save();

    const updatedChat = await Chat.findById(chatId)
      .populate('participants', 'username fullName profilePicture status lastSeen publicKey privacy')
      .populate('admins', 'username fullName profilePicture');

    res.json(updatedChat);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
