import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from './api';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'settings'
  const [showModal, setShowModal] = useState(false);

  // Settings State
  const [profileForm, setProfileForm] = useState({ full_name: '', phone_number: '' });
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '' });
  const [settingsMsg, setSettingsMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setProfileForm({
        full_name: parsedUser.full_name || '',
        phone_number: parsedUser.phone_number || '',
      });
      fetchListings();
    } else {
      navigate('/auth');
    }
  }, [navigate]);

  const fetchListings = async () => {
    try {
      const res = await API.get('/listings');
      setListings(res.data);
    } catch (err) {
      console.error('Error fetching listings:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/auth');
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSettingsMsg({ type: '', text: '' });
    try {
      const res = await API.put('/users/profile', profileForm);
      const updatedUser = { ...user, ...profileForm };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setSettingsMsg({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      setSettingsMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to update profile.' });
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setSettingsMsg({ type: '', text: '' });
    try {
      await API.put('/users/change-password', passwordForm);
      setSettingsMsg({ type: 'success', text: 'Password updated successfully!' });
      setPasswordForm({ current_password: '', new_password: '' });
    } catch (err) {
      setSettingsMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to change password.' });
    }
  };

  if (!user) return null;

  const filteredListings = listings.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800">
      {/* Responsive Navbar */}
      <nav className="bg-slate-900 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <span className="text-xl font-bold text-sky-400">CampusLink</span>
            <span className="hidden sm:inline-block bg-sky-900/60 text-sky-200 text-xs px-2.5 py-1 rounded-full border border-sky-700/50">
              Student Portal
            </span>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button
              onClick={() => setActiveTab('feed')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'feed' ? 'bg-sky-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              Feed
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'settings' ? 'bg-sky-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              Settings
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Welcome & Badge Banner */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Welcome, {user.full_name}! 👋</h1>
            <p className="text-sm text-slate-500 mt-1">{user.email} • Lead City University</p>
          </div>
          <div>
            {user.is_verified ? (
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-bold inline-flex items-center">
                ✓ LCU Verified Student
              </span>
            ) : (
              <span className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full text-xs font-bold inline-flex items-center">
                Unverified Student
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Tab Switching */}
        {activeTab === 'feed' ? (
          <div>
            {/* Search, Filter & Offer Skill Bar */}
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 mb-6">
              <div className="flex flex-1 flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Search campus products, skills, tutors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="all">All Categories</option>
                  <option value="electronics">Electronics</option>
                  <option value="books">Textbooks & Notes</option>
                  <option value="fashion">Fashion</option>
                  <option value="services">Services & Skills</option>
                </select>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition"
              >
                + Offer Skill/Service
              </button>
            </div>

            {/* Marketplace Grid */}
            {filteredListings.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500">
                No active listings or services matched your search.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredListings.map((item) => (
                  <div key={item.listing_id} className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between shadow-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider bg-sky-100 text-sky-800 px-2 py-0.5 rounded">
                        {item.category}
                      </span>
                      <h3 className="font-bold text-slate-900 mt-2 text-base line-clamp-1">{item.title}</h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-3">{item.description}</p>
                    </div>
                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100">
                      <span className="text-base font-bold text-emerald-600">₦{item.price}</span>
                      <button className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3 py-1.5 rounded-md transition">
                        Contact
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Student Settings Component */
          <div className="max-w-3xl mx-auto space-y-6">
            {settingsMsg.text && (
              <div className={`p-4 rounded-lg text-sm font-medium ${
                settingsMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {settingsMsg.text}
              </div>
            )}

            {/* Profile Info Settings */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Account Profile</h2>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Full Name</label>
                  <input
                    type="text"
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={profileForm.phone_number}
                    onChange={(e) => setProfileForm({ ...profileForm, phone_number: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                    required
                  />
                </div>
                <button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition">
                  Save Changes
                </button>
              </form>
            </div>

            {/* Password Security Settings */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Security & Credentials</h2>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Current Password</label>
                  <input
                    type="password"
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">New Password</label>
                  <input
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                    required
                  />
                </div>
                <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-lg text-sm transition">
                  Update Password
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Offer Skill Modal */}
      {showModal && <CreateListingModal closeModal={() => setShowModal(false)} refreshListings={fetchListings} />}
    </div>
  );
}

// Modal Component for Posting
function CreateListingModal({ closeModal, refreshListings }) {
  const [form, setForm] = useState({ title: '', description: '', price: '', category: 'services' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post('/listings', { ...form, price: parseFloat(form.price) });
      refreshListings();
      closeModal();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit post');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Post Skill / Item</h3>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Title (e.g. Graphics Design, Used Textbook)"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500"
          />
          <textarea
            placeholder="Description of service or item"
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500 min-h-[90px]"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Price (₦)"
            required
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500"
          />
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500 bg-white"
          >
            <option value="services">Skills & Freelance</option>
            <option value="electronics">Electronics</option>
            <option value="books">Textbooks</option>
            <option value="fashion">Fashion</option>
          </select>
          <div className="flex justify-end space-x-2 pt-2">
            <button type="button" onClick={closeModal} className="px-4 py-2 bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-300 transition">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-sky-600 text-white text-sm font-bold rounded-lg hover:bg-sky-700 transition">
              Publish
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}