import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from './api';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    password: '',
    role: 'student',
  });
  const [message, setMessage] = useState('');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const navigate = useNavigate();

  // Helper function to handle role-based navigation
  const navigateToRoleDashboard = (user) => {
    const role = user?.role?.toLowerCase() || 'student';
    if (role === 'vendor' || role === 'seller') {
      navigate('/vendor-dashboard');
    } else {
      navigate('/student-dashboard');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      if (isLogin) {
        const res = await API.post('/login', {
          email: formData.email,
          password: formData.password,
        });

        // Save token and user details to localStorage
        localStorage.setItem('token', res.data.access_token);
        if (res.data.user) {
          localStorage.setItem('user', JSON.stringify(res.data.user));
        }

        setToken(res.data.access_token);
        setMessage('Login successful!');

        // Redirect dynamically based on user role
        navigateToRoleDashboard(res.data.user);
      } else {
        await API.post('/register', formData);
        setMessage('Registration successful! Please log in.');
        setIsLogin(true);
      }
    } catch (err) {
      setMessage(err.response?.data?.detail || 'An error occurred.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setMessage('Logged out successfully.');
  };

  const handleGoToDashboard = () => {
    const storedUser = localStorage.getItem('user');
    const user = storedUser ? JSON.parse(storedUser) : null;
    navigateToRoleDashboard(user);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
          {token ? 'Welcome to CampusLink' : isLogin ? 'Login' : 'Register Account'}
        </h2>

        {message && (
          <div className="mb-4 p-3 bg-blue-50 text-blue-700 text-sm rounded-lg text-center font-medium">
            {message}
          </div>
        )}

        {token ? (
          <div className="text-center space-y-3">
            <p className="text-gray-600">You are currently authenticated.</p>
            <button
              onClick={handleGoToDashboard}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition mb-2"
            >
              Go to Portal
            </button>
            <button
              onClick={handleLogout}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold transition"
            >
              Log Out
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Full Name</label>
                  <input
                    type="text"
                    name="full_name"
                    required
                    value={formData.full_name}
                    onChange={handleChange}
                    className="w-full mt-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                  <input
                    type="text"
                    name="phone_number"
                    required
                    value={formData.phone_number}
                    onChange={handleChange}
                    className="w-full mt-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Account Type (Role)</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full mt-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="student">Student</option>
                    <option value="vendor">Vendor / Seller</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">Email Address</label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full mt-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full mt-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition"
            >
              {isLogin ? 'Sign In' : 'Create Account'}
            </button>

            <div className="text-center mt-4 text-sm text-gray-600">
              {isLogin ? "Don't have an account?" : 'Already registered?'}{' '}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-blue-600 font-semibold hover:underline"
              >
                {isLogin ? 'Register' : 'Login'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
