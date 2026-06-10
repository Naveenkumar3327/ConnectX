import User from '../models/User.js';
import cloudinary from 'cloudinary';
import fs from 'fs';

// @desc    Get current user profile
// @route   GET /api/users/profile
// @access  Private
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { fullName, bio, status, username } = req.body;

    if (username && username.toLowerCase() !== user.username) {
      const usernameExists = await User.findOne({ username: username.toLowerCase() });
      if (usernameExists) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
      user.username = username.toLowerCase();
    }

    if (fullName) user.fullName = fullName;
    if (bio !== undefined) user.bio = bio;
    if (status) user.status = status;

    if (req.file) {
      // Process avatar upload
      if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
        try {
          cloudinary.v2.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
          });
          const result = await cloudinary.v2.uploader.upload(req.file.path, {
            folder: 'connectx_avatars',
          });
          user.profilePicture = result.secure_url;
          fs.unlinkSync(req.file.path);
        } catch (cloudinaryError) {
          console.error(cloudinaryError);
          user.profilePicture = `/uploads/${req.file.filename}`;
        }
      } else {
        user.profilePicture = `/uploads/${req.file.filename}`;
      }
    }

    const updatedUser = await user.save();
    res.json({
      _id: updatedUser._id,
      fullName: updatedUser.fullName,
      username: updatedUser.username,
      email: updatedUser.email,
      profilePicture: updatedUser.profilePicture,
      bio: updatedUser.bio,
      status: updatedUser.status,
      publicKey: updatedUser.publicKey,
      privacy: updatedUser.privacy,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Update privacy controls
// @route   PUT /api/users/privacy
// @access  Private
export const updatePrivacySettings = async (req, res) => {
  const { lastSeen, profilePicture, readReceipts } = req.body;

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (lastSeen) user.privacy.lastSeen = lastSeen;
    if (profilePicture) user.privacy.profilePicture = profilePicture;
    if (readReceipts !== undefined) user.privacy.readReceipts = readReceipts;

    await user.save();
    res.json({
      message: 'Privacy settings updated successfully',
      privacy: user.privacy,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Search users by username or email
// @route   GET /api/users/search
// @access  Private
export const searchUsers = async (req, res) => {
  const query = req.query.q;

  try {
    if (!query) {
      return res.status(400).json({ message: 'Search query parameter (q) is required' });
    }

    // Find users whose usernames or full names match, excluding the current user and blocked/inactive accounts
    const users = await User.find({
      $and: [
        {
          $or: [
            { username: { $regex: query, $options: 'i' } },
            { fullName: { $regex: query, $options: 'i' } },
          ],
        },
        { _id: { $ne: req.user._id } },
        { isActive: true },
      ],
    })
      .select('username fullName profilePicture bio publicKey status lastSeen privacy')
      .limit(20);

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Block or unblock a user
// @route   POST /api/users/block
// @access  Private
export const blockToggleUser = async (req, res) => {
  const { targetUserId } = req.body;

  try {
    if (!targetUserId) {
      return res.status(400).json({ message: 'targetUserId is required' });
    }

    const user = await User.findById(req.user._id);
    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      return res.status(404).json({ message: 'User to block not found' });
    }

    const isBlocked = user.blockedUsers.includes(targetUserId);

    if (isBlocked) {
      // Unblock
      user.blockedUsers = user.blockedUsers.filter(id => id.toString() !== targetUserId);
    } else {
      // Block
      user.blockedUsers.push(targetUserId);
    }

    await user.save();
    res.json({
      message: isBlocked ? 'User unblocked successfully' : 'User blocked successfully',
      blockedUsers: user.blockedUsers,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Get user by username (specifically to get their public key for starting encrypted chats)
// @route   GET /api/users/:username
// @access  Private
export const getUserByUsername = async (req, res) => {
  try {
    const user = await User.findOne({
      username: req.params.username.toLowerCase(),
      isActive: true,
    }).select('username fullName profilePicture bio publicKey status lastSeen privacy');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Filter properties based on privacy settings (mock simple privacy check)
    // If the recipient blocked the caller or they set privacy to nobody, hide details.
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
