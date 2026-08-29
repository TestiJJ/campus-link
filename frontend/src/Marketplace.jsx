import React, { useEffect, useState } from 'react';
import API from './api';

export default function Marketplace() {
  const [listings, setListings] = useState([]);
  const [formData, setFormData] = useState({ title: '', description: '', price: '', category: 'Textbooks' });

  const fetchListings = async () => {
    try {
      const res = await API.get('/listings');
      setListings(res.data);
    } catch (err) {
      console.error('Error loading listings', err);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post('/listings', {
        ...formData,
        price: parseFloat(formData.price)
      });
      setFormData({ title: '', description: '', price: '', category: 'Textbooks' });
      fetchListings();
    } catch (err) {
      console.error('Error creating listing', err);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '30px auto', fontFamily: 'sans-serif' }}>
      <h2>Campus Marketplace</h2>

      {/* Post Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#f1f5f9', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
        <h3>Create New Listing</h3>
        <input 
          placeholder="Title" 
          value={formData.title} 
          onChange={(e) => setFormData({...formData, title: e.target.value})} 
          required 
          style={{ padding: '8px' }}
        />
        <textarea 
          placeholder="Description" 
          value={formData.description} 
          onChange={(e) => setFormData({...formData, description: e.target.value})} 
          required 
          style={{ padding: '8px' }}
        />
        <input 
          type="number" 
          placeholder="Price ($)" 
          value={formData.price} 
          onChange={(e) => setFormData({...formData, price: e.target.value})} 
          required 
          style={{ padding: '8px' }}
        />
        <select 
          value={formData.category} 
          onChange={(e) => setFormData({...formData, category: e.target.value})}
          style={{ padding: '8px' }}
        >
          <option value="Textbooks">Textbooks</option>
          <option value="Electronics">Electronics</option>
          <option value="Housing">Housing</option>
          <option value="Services">Services</option>
        </select>
        <button type="submit" style={{ padding: '10px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>
          Post Item
        </button>
      </form>

      {/* Feed */}
      <h3>Available Listings</h3>
      <div style={{ display: 'grid', gap: '16px' }}>
        {listings.map((item) => (
          <div key={item.listing_id} style={{ border: '1px solid #cbd5e1', padding: '16px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0 }}>{item.title}</h4>
              <span style={{ fontWeight: 'bold', color: '#16a34a' }}>${item.price}</span>
            </div>
            <p style={{ color: '#475569', margin: '8px 0' }}>{item.description}</p>
            <span style={{ fontSize: '0.8rem', background: '#e2e8f0', padding: '4px 8px', borderRadius: '4px' }}>{item.category}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
