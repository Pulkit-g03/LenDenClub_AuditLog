import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import Login from './components/login';      
import Signup from './components/signup';    
import Account from './components/Account';
import api from './services/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        console.log('Decoded token:', decoded);
        if (decoded.exp * 1000 > Date.now()) {
          setIsAuthenticated(true);
          setUser(decoded);
          // Optionally set Authorization header for future requests
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } else {
          console.log('Token expired');
          localStorage.removeItem('token');
        }
      } catch (e) {
        console.error('Invalid token decode:', e);
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (token) => {
    localStorage.setItem('token', token);
    try {
      const decoded = jwtDecode(token);
      if (decoded.exp * 1000 > Date.now()) {
        setIsAuthenticated(true);
        setUser(decoded);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
    } catch (e) {
      console.error('Invalid token:', e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setUser(null);
  };

  const PrivateRoute = ({ children }) => {
    if (loading) return <div>Loading...</div>;
    return isAuthenticated ? children : <Navigate to="/login" replace />;
  };

  // Show loading only once at startup
  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '100px' }}>Loading...</div>;
  }

  return (
    <div className="App">
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/account" replace />
            ) : (
              <Login onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/signup"
          element={
            isAuthenticated ? (
              <Navigate to="/account" replace />
            ) : (
              <Signup onLogin={handleLogin} />
            )
          }
        />

        {/* Protected route */}
        <Route
          path="/account"
          element={
            <PrivateRoute>
              <Account user={user} onLogout={handleLogout} />
            </PrivateRoute>
          }
        />

        {/* Root redirect */}
        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? "/account" : "/login"} replace />}
        />

        {/* Optional: Catch-all for unknown routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;