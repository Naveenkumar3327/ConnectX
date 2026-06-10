import React, { useState, useContext, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AuthContext } from '../context/AuthContext.jsx';

export default function Register() {
  const { signup } = useContext(AuthContext);
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profilePic, setProfilePic] = useState(null);
  const [profilePicPreview, setProfilePicPreview] = useState(null);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        return setError('Image file is too large (max 5MB)');
      }
      setProfilePic(file);
      setProfilePicPreview(URL.createObjectURL(file));
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!fullName || !username || !email || !password || !confirmPassword) {
      return setError('Please fill in all fields');
    }
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }
    if (username.includes(' ')) {
      return setError('Username cannot contain spaces');
    }

    setError('');
    setLoading(true);
    try {
      await signup(fullName, username, email, password, profilePic);
      navigate('/');
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-tr from-slate-900 via-dark-sidebar to-whatsapp-dark px-4 py-8 transition-colors duration-200">
      {/* Visual background shapes */}
      <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-whatsapp-teal opacity-10 blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-whatsapp-blue opacity-10 blur-3xl"></div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex flex-col items-center mb-5">
          <h2 className="text-2xl font-bold tracking-tight text-white">Create Account</h2>
          <p className="text-sm text-slate-400">Join ConnectX and start secure messaging</p>
        </div>

        <form onSubmit={handleRegisterSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs font-medium text-red-400">
              {error}
            </div>
          )}

          {/* Profile Picture Drag/Drop Upload Area */}
          <div className="flex flex-col items-center gap-2 py-1">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-slate-600 bg-white/5 transition hover:border-whatsapp-teal hover:bg-white/10"
            >
              {profilePicPreview ? (
                <img src={profilePicPreview} alt="Avatar preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex flex-col items-center text-slate-400">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-[10px] font-semibold">Avatar</span>
                </div>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <span className="text-[10px] text-slate-400">Click to upload avatar (optional)</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-whatsapp-teal focus:bg-white/10"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-whatsapp-teal focus:bg-white/10"
                placeholder="johndoe"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-whatsapp-teal focus:bg-white/10"
              placeholder="john@example.com"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-whatsapp-teal focus:bg-white/10"
                placeholder="••••••••"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-whatsapp-teal focus:bg-white/10"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <p className="text-[10px] text-slate-400 leading-normal text-center bg-white/5 rounded-lg p-2.5 border border-white/5">
            🔒 <strong>E2EE Secured:</strong> We generate 256-bit cryptographic keys directly in your browser. Your private key will never leave this device.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-whatsapp-teal py-3 text-sm font-semibold text-white shadow-lg shadow-whatsapp-teal/20 transition duration-150 hover:bg-whatsapp-teal/90 active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Creating secure profile...' : 'Register'}
          </button>

          <div className="text-center text-xs text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-whatsapp-teal hover:underline">
              Sign In
            </Link>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
