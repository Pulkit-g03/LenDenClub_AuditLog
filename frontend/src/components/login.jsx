import React, { useState } from 'react';
import api from '../services/api';
import { useNavigate, Link } from 'react-router-dom';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await api.post('/login', { email, password });
      const token = res.data.access_token;

      localStorage.setItem('token', token);
      onLogin(token);
      navigate('/account');
    } catch (err) {
      alert('Login failed: ' + (err.response?.data?.detail || 'Try again'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundImage: "url('/bg.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '400px',
          padding: '30px',
          background: 'rgba(255, 255, 255, 0.92)',
          borderRadius: '12px',
          boxShadow: '0 15px 40px rgba(0,0,0,0.25)',
        }}
      >
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
          Login / Register
        </h2>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '90%',
              padding: '12px',
              marginBottom: '15px',
              borderRadius: '6px',
              border: '1px solid #ccc',
            }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: '90%',
              padding: '12px',
              marginBottom: '20px',
              borderRadius: '6px',
              border: '1px solid #ccc',
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '96.5%',
              padding: '12px',
              backgroundColor: '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            {loading ? 'Loading...' : 'Login'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px' }}>
          Don’t have an account?{' '}
          <Link
            to="/signup"
            style={{ color: '#007bff', textDecoration: 'none' }}
          >
            Sign up here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
