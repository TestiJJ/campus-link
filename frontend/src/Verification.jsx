import React, { useState, useEffect } from 'react';
import API from './api';

export default function Verification({ user, onComplete }) {
  const [institutions, setInstitutions] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [idCard, setIdCard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // Dynamic fetch of institutions via Hipolabs Open API
  useEffect(() => {
    fetch('http://universities.hipolabs.com/search?country=Nigeria')
      .then((res) => res.json())
      .then((data) => setInstitutions(data))
      .catch(() => setMsg({ type: 'error', text: 'Could not load institutions list' }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSchool || !idCard) {
      setMsg({ type: 'error', text: 'Select an institution and upload your ID.' });
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append('institution', selectedSchool);
    formData.append('id_card', idCard);

    try {
      await API.post('/users/verify-identity', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMsg({ type: 'success', text: 'Verification details submitted for review!' });
      if (onComplete) onComplete();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || 'Submission failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-lg mx-auto">
      <h3 className="text-xl font-bold text-slate-900 mb-2">Student Identity Verification</h3>
      <p className="text-sm text-slate-500 mb-6">Select your school and upload your valid ID card to gain full access.</p>
      
      {msg.text && (
        <div className={`p-3 rounded-lg text-xs font-semibold mb-4 ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Select University / Institution</label>
          <select 
            value={selectedSchool} 
            onChange={(e) => setSelectedSchool(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-emerald-500"
            required
          >
            <option value="">-- Search and Select Institution --</option>
            {institutions.map((inst, idx) => (
              <option key={idx} value={inst.name}>{inst.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Upload Student ID Card</label>
          <input 
            type="file" 
            accept="image/*,.pdf" 
            onChange={(e) => setIdCard(e.target.files[0])}
            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
            required
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg text-sm transition"
        >
          {loading ? 'Submitting...' : 'Submit Verification Request'}
        </button>
      </form>
    </div>
  );
}