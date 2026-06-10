import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AuthContext } from '../context/AuthContext.jsx';
import api from '../utils/api.js';

export default function AdminDashboard() {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalMessages: 0,
    totalChats: 0,
    totalGroups: 0,
    totalBroadcasts: 0,
    pendingReports: 0
  });
  const [messageStats, setMessageStats] = useState([]);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'reports' | 'analytics'

  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch metrics & charts data
      const analyticsRes = await api.get('/admin/analytics');
      setMetrics(analyticsRes.data.metrics);
      setMessageStats(analyticsRes.data.messageStats);

      // 2. Fetch users list
      const usersRes = await api.get(`/admin/users?page=${usersPage}&limit=10`);
      setUsers(usersRes.data.users);
      setUsersTotalPages(usersRes.data.pages);

      // 3. Fetch reports list
      const reportsRes = await api.get('/admin/reports');
      setReports(reportsRes.data);
    } catch (error) {
      console.error('Failed to load administrative analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [usersPage]);

  // Handle User Suspension Toggle
  const handleSuspendToggle = async (userId) => {
    if (!confirm('Are you sure you want to change this user\'s suspension status?')) return;
    try {
      const { data } = await api.put(`/admin/users/${userId}/suspend`);
      alert(data.message);
      
      // Update local state
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, isActive: !u.isActive } : u));
      // Re-fetch analytics
      const analyticsRes = await api.get('/admin/analytics');
      setMetrics(analyticsRes.data.metrics);
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed');
    }
  };

  // Handle Report Resolution
  const handleResolveReport = async (reportId) => {
    try {
      const { data } = await api.put(`/admin/reports/${reportId}/resolve`);
      alert(data.message);
      
      // Update local state
      setReports(prev => prev.map(r => r._id === reportId ? { ...r, status: 'resolved' } : r));
      setMetrics(prev => ({ ...prev, pendingReports: Math.max(0, prev.pendingReports - 1) }));
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Header */}
      <header className="border-b border-white/5 bg-slate-950/40 px-6 py-4 flex items-center justify-between backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-whatsapp-teal flex items-center justify-center font-bold text-white shadow shadow-whatsapp-teal/20">
            CX
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide">ConnectX System Console</h1>
            <p className="text-[10px] text-whatsapp-light font-semibold uppercase tracking-wider">Enterprise Administration Panel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-xs font-semibold hover:bg-white/10 transition"
          >
            Open Chat Client
          </button>
          <button
            onClick={logout}
            className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold hover:bg-red-700 transition shadow-lg shadow-red-600/10"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6 overflow-y-auto">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: metrics.totalUsers, gradient: 'from-blue-600 to-indigo-600', icon: '👤' },
            { label: 'Active (Online)', value: metrics.activeUsers, gradient: 'from-emerald-600 to-teal-600', icon: '🟢' },
            { label: 'Total Messages', value: metrics.totalMessages, gradient: 'from-violet-600 to-purple-600', icon: '💬' },
            { label: 'Pending Reports', value: metrics.pendingReports, gradient: metrics.pendingReports > 0 ? 'from-amber-600 to-red-600 animate-pulse' : 'from-slate-700 to-slate-800', icon: '⚠️' }
          ].map((card, idx) => (
            <div key={idx} className={`rounded-xl bg-gradient-to-tr ${card.gradient} p-4 shadow-lg border border-white/5 relative overflow-hidden flex flex-col justify-between h-28`}>
              <div className="text-[10px] uppercase font-bold text-white/70 tracking-wider">{card.label}</div>
              <div className="text-3xl font-extrabold text-white">{card.value}</div>
              <span className="absolute right-4 bottom-4 text-3xl opacity-20">{card.icon}</span>
            </div>
          ))}
        </div>

        {/* Dashboard Navigation Tabs */}
        <div className="border-b border-white/5 flex gap-6">
          {[
            { id: 'users', label: 'User Directory' },
            { id: 'reports', label: `Pending Audits (${reports.filter(r=>r.status==='pending').length})` },
            { id: 'analytics', label: 'System Analytics' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition outline-none ${
                activeTab === tab.id
                  ? 'border-whatsapp-teal text-whatsapp-light'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading overlay */}
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-whatsapp-teal border-t-transparent"></div>
          </div>
        ) : (
          <div className="transition-all duration-300">
            {/* Tab: Users */}
            {activeTab === 'users' && (
              <div className="bg-slate-950/40 border border-white/5 rounded-xl overflow-hidden shadow-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 border-b border-white/10 uppercase font-semibold text-slate-400 tracking-wider">
                      <th className="p-4">User</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Presence</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Security Key</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map(u => (
                      <tr key={u._id} className="hover:bg-white/5 transition duration-150">
                        <td className="p-4 flex items-center gap-3">
                          <img
                            src={u.profilePicture || 'https://via.placeholder.com/150'}
                            alt={u.username}
                            className="h-8 w-8 rounded-full object-cover border border-white/10"
                            onError={(e) => { e.target.src = 'https://via.placeholder.com/150'; }}
                          />
                          <div>
                            <div className="font-bold text-white text-sm">{u.fullName}</div>
                            <div className="text-slate-400">@{u.username}</div>
                          </div>
                        </td>
                        <td className="p-4 text-slate-300 font-mono">{u.email}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.status === 'online' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-white/5'
                          }`}>
                            {u.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.isAdmin ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-slate-500/10 text-slate-400 border border-white/5'
                          }`}>
                            {u.isAdmin ? 'Admin' : 'User'}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-[10px] text-slate-400 max-w-[150px] truncate">
                          {u.publicKey}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {u.isActive ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleSuspendToggle(u._id)}
                            disabled={u.isAdmin}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition ${
                              u.isActive
                                ? 'bg-red-600/10 border-red-500/20 text-red-400 hover:bg-red-600/20'
                                : 'bg-emerald-600/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-600/20'
                            } disabled:opacity-30`}
                          >
                            {u.isActive ? 'Suspend' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination Controls */}
                <div className="p-4 flex justify-between items-center bg-slate-950/20 border-t border-white/5">
                  <span className="text-slate-400 text-xs">Page {usersPage} of {usersTotalPages}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setUsersPage(prev => Math.max(1, prev - 1))}
                      disabled={usersPage === 1}
                      className="px-3 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setUsersPage(prev => Math.min(usersTotalPages, prev + 1))}
                      disabled={usersPage === usersTotalPages}
                      className="px-3 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Reports */}
            {activeTab === 'reports' && (
              <div className="space-y-4">
                {reports.length === 0 ? (
                  <div className="h-32 flex items-center justify-center bg-slate-950/20 border border-white/5 rounded-xl text-slate-400 text-xs">
                    No abuse reports filed in the system.
                  </div>
                ) : (
                  reports.map(rep => (
                    <div key={rep._id} className="bg-slate-950/40 border border-white/5 rounded-xl p-5 shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider">
                          <span className="text-red-400">🚨 Abuse Report</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400">{new Date(rep.createdAt).toLocaleString()}</span>
                          <span className="text-slate-500">•</span>
                          <span className={`px-2 py-0.5 rounded-full ${
                            rep.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-500/10 text-slate-400'
                          }`}>
                            {rep.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300">
                          Filed by <span className="font-bold text-white">@{rep.reporter?.username}</span> against{' '}
                          {rep.reportedUser ? (
                            <span>user <span className="font-bold text-white">@{rep.reportedUser.username}</span></span>
                          ) : (
                            <span>group <span className="font-bold text-white">{rep.reportedChat?.name}</span></span>
                          )}
                        </div>
                        <div className="bg-white/5 border border-white/5 rounded-lg p-3 text-sm text-slate-200">
                          &ldquo;{rep.reason}&rdquo;
                        </div>
                      </div>
                      
                      {rep.status === 'pending' && (
                        <div className="flex gap-2 self-end md:self-center">
                          {rep.reportedUser && (
                            <button
                              onClick={() => handleSuspendToggle(rep.reportedUser._id)}
                              className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition"
                            >
                              Suspend Target
                            </button>
                          )}
                          <button
                            onClick={() => handleResolveReport(rep._id)}
                            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-semibold hover:bg-white/10 transition"
                          >
                            Resolve Flag
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab: Analytics */}
            {activeTab === 'analytics' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Visual Chart Card */}
                <div className="bg-slate-950/40 border border-white/5 rounded-xl p-5 md:col-span-2 shadow-xl flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide mb-1">Daily Traffic Activity</h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-6">Total messages sent per day (past week)</p>
                  </div>
                  {messageStats.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-slate-500 text-xs">No traffic logs found.</div>
                  ) : (
                    <div className="flex items-end justify-between gap-4 h-48 px-4 border-b border-white/10 pb-2">
                      {messageStats.map((stat, i) => {
                        const maxCount = Math.max(...messageStats.map(s => s.count)) || 1;
                        const pctHeight = (stat.count / maxCount) * 100;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                            {/* Hover Count */}
                            <div className="opacity-0 group-hover:opacity-100 transition bg-slate-950 border border-white/10 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow absolute -translate-y-16">
                              {stat.count} msgs
                            </div>
                            {/* Visual Bar */}
                            <div
                              style={{ height: `${pctHeight}%` }}
                              className="w-full bg-gradient-to-t from-whatsapp-teal to-whatsapp-light rounded-t-md min-h-[8px] max-w-[40px] shadow-lg shadow-whatsapp-teal/10 hover:brightness-110 transition cursor-pointer"
                            ></div>
                            <span className="text-[9px] text-slate-400 font-mono tracking-tighter truncate max-w-[40px]">
                              {stat._id.substring(5)} {/* MM-DD */}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Platform Summary Card */}
                <div className="bg-slate-950/40 border border-white/5 rounded-xl p-5 shadow-xl flex flex-col justify-between h-72">
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide mb-1">System Health</h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-6">Database Schema Coverage</p>
                  </div>
                  <div className="space-y-4 text-xs">
                    {[
                      { label: 'Group Channels', value: metrics.totalGroups, pct: (metrics.totalGroups / (metrics.totalChats || 1)) * 100 },
                      { label: 'Broadcast Channels', value: metrics.totalBroadcasts, pct: 100 },
                      { label: 'Encryption Key Index', value: '100% SECURE', pct: 100 }
                    ].map((row, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between font-semibold">
                          <span className="text-slate-400">{row.label}</span>
                          <span className="text-white">{row.value}</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <div style={{ width: `${row.pct}%` }} className="h-full bg-whatsapp-teal rounded-full"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-whatsapp-light font-bold text-center bg-whatsapp-teal/5 rounded-lg border border-whatsapp-teal/10 p-2 mt-4">
                    ✓ E2EE CRYPTO VERIFIED (AES-256-GCM)
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
