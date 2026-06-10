import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../context/AuthContext.jsx';
import api from '../utils/api.js';

export default function Login() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  // Login States
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot Password States
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!usernameOrEmail || !password) {
      return setError('Please fill in all fields');
    }
    setError('');
    setLoading(true);
    try {
      await login(usernameOrEmail, password);
      navigate('/');
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  // Forgot password OTP triggers
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    if (!forgotEmail) return setForgotError('Email is required');
    setForgotError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email: forgotEmail });
      setForgotMessage(data.message);
      setForgotStep(2);
    } catch (err) {
      setForgotError(err.response?.data?.message || 'Failed to send OTP code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otpCode) return setForgotError('OTP Code is required');
    setForgotError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { email: forgotEmail, otp: otpCode });
      setForgotMessage(data.message);
      setForgotStep(3);
    } catch (err) {
      setForgotError(err.response?.data?.message || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword) return setForgotError('New password is required');
    setForgotError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/reset-password', {
        email: forgotEmail,
        otp: otpCode,
        newPassword
      });
      alert(data.message);
      setIsForgotPassword(false);
      setForgotStep(1);
      setForgotEmail('');
      setOtpCode('');
      setNewPassword('');
      setForgotMessage('');
    } catch (err) {
      setForgotError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-tr from-slate-900 via-dark-sidebar to-whatsapp-dark px-4 py-12 transition-colors duration-200">
      {/* Visual background shapes */}
      <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-whatsapp-teal opacity-10 blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-whatsapp-blue opacity-10 blur-3xl"></div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-whatsapp-teal text-white shadow-lg shadow-whatsapp-teal/20 mb-3">
            <svg className="h-7 w-7 fill-current" viewBox="0 0 24 24">
              <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm5.72 14.12c-.24.69-1.42 1.26-1.97 1.3-1.63.14-3.61-.47-5.96-2.82-2.35-2.35-2.96-4.33-2.82-5.96.04-.55.61-1.73 1.3-1.97.24-.09.48-.12.64-.12.16 0 .32.01.46.07.29.13.56.68.61.79.06.13.09.28.01.44-.09.18-.18.3-.31.45-.13.15-.28.32-.42.49-.16.19-.34.39-.14.73.2.34.89 1.47 1.91 2.38 1.31 1.17 2.42 1.53 2.76 1.7.34.17.54.14.74-.09.2-.24.87-1.01 1.1-1.35.23-.34.46-.29.7-.2.24.09 1.53.72 1.79.85.26.13.43.2.49.31.06.11.06.66-.18 1.35z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">ConnectX</h2>
          <p className="text-sm text-slate-400">Enterprise Real-Time Communication</p>
        </div>

        <AnimatePresence mode="wait">
          {!isForgotPassword ? (
            // Login Mode
            <motion.form
              key="login-form"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              onSubmit={handleLoginSubmit}
              className="space-y-5"
            >
              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs font-medium text-red-400">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Username or Email</label>
                <input
                  type="text"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition duration-150 focus:border-whatsapp-teal focus:bg-white/10"
                  placeholder="Enter username or email"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setForgotStep(1);
                      setForgotError('');
                      setForgotMessage('');
                    }}
                    className="text-xs text-whatsapp-teal hover:underline outline-none"
                  >
                    Forgot Password?
                  </button>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition duration-150 focus:border-whatsapp-teal focus:bg-white/10"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-whatsapp-teal py-3 text-sm font-semibold text-white shadow-lg shadow-whatsapp-teal/20 transition duration-150 hover:bg-whatsapp-teal/90 active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>

              <div className="text-center text-xs text-slate-400 pt-2">
                Don't have an account?{' '}
                <Link to="/register" className="font-semibold text-whatsapp-teal hover:underline">
                  Sign Up
                </Link>
              </div>
            </motion.form>
          ) : (
            // Forgot Password Mode
            <motion.div
              key="forgot-form"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-semibold text-white">Reset Password</h3>
              
              {forgotError && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs font-medium text-red-400">
                  {forgotError}
                </div>
              )}
              {forgotMessage && (
                <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-xs font-medium text-green-400">
                  {forgotMessage}
                </div>
              )}

              {forgotStep === 1 && (
                <form onSubmit={handleRequestOTP} className="space-y-4">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Enter your email address. We'll send a 6-digit OTP code to verify your request.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Email Address</label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-whatsapp-teal"
                      placeholder="email@example.com"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-whatsapp-teal py-3 text-sm font-semibold text-white transition hover:bg-whatsapp-teal/90 disabled:opacity-50"
                  >
                    {loading ? 'Sending...' : 'Send OTP'}
                  </button>
                </form>
              )}

              {forgotStep === 2 && (
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <p className="text-xs text-slate-400 leading-relaxed font-medium">
                    Enter the 6-digit code printed in the server logs/console.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">OTP Verification Code</label>
                    <input
                      type="text"
                      maxLength="6"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-center text-white font-mono tracking-widest placeholder-slate-600 outline-none transition focus:border-whatsapp-teal"
                      placeholder="123456"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-whatsapp-teal py-3 text-sm font-semibold text-white transition hover:bg-whatsapp-teal/90 disabled:opacity-50"
                  >
                    {loading ? 'Verifying...' : 'Verify Code'}
                  </button>
                </form>
              )}

              {forgotStep === 3 && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Set a strong new password for your account.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-whatsapp-teal"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-whatsapp-teal py-3 text-sm font-semibold text-white transition hover:bg-whatsapp-teal/90 disabled:opacity-50"
                  >
                    {loading ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setForgotStep(1);
                }}
                className="w-full text-center text-xs text-slate-400 hover:text-white pt-2 outline-none"
              >
                Back to Sign In
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
