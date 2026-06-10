import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import cloudinary from 'cloudinary';
import fs from 'fs';

const generateAccessToken = (id, username) => {
  return jwt.sign(
    { id, username },
    process.env.JWT_SECRET || 'your_jwt_access_secret_key_here',
    { expiresIn: '15m' }
  );
};

const generateRefreshToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_REFRESH_SECRET || 'your_jwt_refresh_secret_key_here',
    { expiresIn: '7d' }
  );
};

const sendRefreshToken = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
export const registerUser = async (req, res) => {
  const { fullName, username, email, password, publicKey } = req.body;

  try {
    if (!fullName || !username || !email || !password || !publicKey) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const userExists = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
    });

    if (userExists) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    // Process profile picture upload
    let profilePictureUrl = '';
    if (req.file) {
      // If Cloudinary setup, upload to Cloudinary, else keep local link
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
          profilePictureUrl = result.secure_url;
          fs.unlinkSync(req.file.path); // Remove temp file
        } catch (cloudinaryError) {
          console.error('Cloudinary upload failure, using local fallback', cloudinaryError);
          profilePictureUrl = `/uploads/${req.file.filename}`;
        }
      } else {
        profilePictureUrl = `/uploads/${req.file.filename}`;
      }
    }

    const user = await User.create({
      fullName,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
      publicKey,
      profilePicture: profilePictureUrl,
    });

    const accessToken = generateAccessToken(user._id, user.username);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    sendRefreshToken(res, refreshToken);

    res.status(201).json({
      _id: user._id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      profilePicture: user.profilePicture,
      bio: user.bio,
      publicKey: user.publicKey,
      isAdmin: user.isAdmin,
      token: accessToken,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
export const authUser = async (req, res) => {
  const { usernameOrEmail, password } = req.body;

  try {
    if (!usernameOrEmail || !password) {
      return res.status(400).json({ message: 'Please provide credentials' });
    }

    const user = await User.findOne({
      $or: [
        { email: usernameOrEmail.toLowerCase() },
        { username: usernameOrEmail.toLowerCase() },
      ],
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'This user account is suspended' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const accessToken = generateAccessToken(user._id, user.username);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    user.status = 'online';
    await user.save();

    sendRefreshToken(res, refreshToken);

    res.json({
      _id: user._id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      profilePicture: user.profilePicture,
      bio: user.bio,
      publicKey: user.publicKey,
      isAdmin: user.isAdmin,
      token: accessToken,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Log user out
// @route   POST /api/auth/logout
// @access  Private
export const logoutUser = async (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.refreshToken) return res.sendStatus(204); // No content

  try {
    const refreshToken = cookies.refreshToken;
    const user = await User.findOne({ refreshToken });

    if (user) {
      user.refreshToken = '';
      user.status = 'offline';
      user.lastSeen = new Date();
      await user.save();
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    res.status(200).json({ message: 'Successfully logged out' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Logout failed' });
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh-token
// @access  Public
export const refreshAccessToken = async (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.refreshToken) {
    return res.status(401).json({ message: 'No refresh token provided' });
  }

  const refreshToken = cookies.refreshToken;

  try {
    const user = await User.findOne({ refreshToken });
    if (!user) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'your_jwt_refresh_secret_key_here',
      (err, decoded) => {
        if (err || user._id.toString() !== decoded.id) {
          return res.status(403).json({ message: 'Token verification failed' });
        }

        const accessToken = generateAccessToken(user._id, user.username);
        res.json({ token: accessToken });
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Token refresh failed' });
  }
};

// @desc    Forgot password (OTP trigger)
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'No user registered with this email' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    user.otp = { code: otpCode, expiresAt };
    await user.save();

    // Mock send OTP (Print to server console)
    console.log(`\n======================================================`);
    console.log(`OTP REQUEST FOR USER: ${user.username} (${user.email})`);
    console.log(`OTP CODE: ${otpCode}`);
    console.log(`EXPIRES IN: 10 Minutes`);
    console.log(`======================================================\n`);

    res.json({ message: 'OTP verification code sent to your email (dev check logs)' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.otp || !user.otp.code) {
      return res.status(400).json({ message: 'OTP not requested or user not found' });
    }

    if (user.otp.code !== otp) {
      return res.status(400).json({ message: 'Incorrect verification code' });
    }

    if (new Date() > user.otp.expiresAt) {
      return res.status(400).json({ message: 'Verification code has expired' });
    }

    res.json({ message: 'OTP verified successfully. You may now reset your password.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.otp || !user.otp.code) {
      return res.status(400).json({ message: 'Invalid request' });
    }

    if (user.otp.code !== otp || new Date() > user.otp.expiresAt) {
      return res.status(400).json({ message: 'Verification code is invalid or expired' });
    }

    user.password = newPassword; // Handled by pre-save hashing
    user.otp = undefined; // Clear OTP data
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
