import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { CallProvider } from './context/CallContext.jsx';

import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';

// Route guard for authenticated users
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100 dark:bg-dark-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-whatsapp-teal border-t-transparent"></div>
          <span className="text-sm font-medium text-slate-500 dark:text-dark-muted">Securing communication lines...</span>
        </div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
};

// Route guard for admin-only pages
const AdminRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100 dark:bg-dark-bg">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-whatsapp-teal border-t-transparent"></div>
      </div>
    );
  }

  return user && user.isAdmin ? children : <Navigate to="/" replace />;
};

// Route guard to prevent authenticated users from viewing auth pages
const AuthRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) return null;

  return !user ? children : <Navigate to="/" replace />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <CallProvider>
            <Routes>
              <Route
                path="/login"
                element={
                  <AuthRoute>
                    <Login />
                  </AuthRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <AuthRoute>
                    <Register />
                  </AuthRoute>
                }
              />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                }
              />
              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </CallProvider>
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
