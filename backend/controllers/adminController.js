import User from '../models/User.js';
import Message from '../models/Message.js';
import Chat from '../models/Chat.js';
import Broadcast from '../models/Broadcast.js';
import Report from '../models/Report.js';

// @desc    Get dashboard metrics & analytics
// @route   GET /api/admin/analytics
// @access  Private/Admin
export const getAnalytics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'online' });
    const totalMessages = await Message.countDocuments();
    const totalChats = await Chat.countDocuments();
    const totalGroups = await Chat.countDocuments({ isGroup: true });
    const totalBroadcasts = await Broadcast.countDocuments();
    const pendingReports = await Report.countDocuments({ status: 'pending' });

    // Messages per day (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const messageStats = await Message.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json({
      metrics: {
        totalUsers,
        activeUsers,
        totalMessages,
        totalChats,
        totalGroups,
        totalBroadcasts,
        pendingReports
      },
      messageStats
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Get paginated users list
// @route   GET /api/admin/users
// @access  Private/Admin
export const getUsersList = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    const total = await User.countDocuments();
    const users = await User.find()
      .select('-password -refreshToken')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.json({
      users,
      page,
      pages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Toggle user suspension status
// @route   PUT /api/admin/users/:id/suspend
// @access  Private/Admin
export const suspendUserToggle = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isAdmin) {
      return res.status(400).json({ message: 'Cannot suspend an administrative account' });
    }

    user.isActive = !user.isActive;
    if (!user.isActive) {
      user.status = 'offline';
      user.refreshToken = ''; // Invalidate refresh session
    }
    await user.save();

    res.json({
      message: user.isActive ? 'User account activated successfully' : 'User account suspended successfully',
      user: {
        _id: user._id,
        username: user.username,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Get user abuse reports
// @route   GET /api/admin/reports
// @access  Private/Admin
export const getReportsList = async (req, res) => {
  try {
    const reports = await Report.find()
      .populate('reporter', 'username fullName email')
      .populate('reportedUser', 'username fullName email profilePicture isActive')
      .populate('reportedChat', 'name isGroup groupAvatar')
      .sort({ createdAt: -1 });

    res.json(reports);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Resolve reported issues
// @route   PUT /api/admin/reports/:id/resolve
// @access  Private/Admin
export const resolveReport = async (req, res) => {
  const { id } = req.params;

  try {
    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ message: 'Report audit not found' });
    }

    report.status = 'resolved';
    await report.save();

    res.json({ message: 'Report marked as resolved', report });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
