import React, { useState, useEffect } from 'react';
import API from './api';

export default function ServicesMarketplace({ user }) {
  const [activeRole, setActiveRole] = useState(user?.role || 'buyer'); // 'buyer' | 'seller'
  const [services, setServices] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const res = await API.get('/services');
      setServices(res.data);
    } catch (err) {
      console.error('Failed to fetch services', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Header & View Toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Campus Freelance Hub</h1>
          <p className="text-sm text-slate-500">
            {user?.institution || 'Campus Network'} • Connected as <span className="font-semibold capitalize text-emerald-600">{activeRole}</span>
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveRole('buyer')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
              activeRole === 'buyer' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Buyer Mode (Hire)
          </button>
          <button
            onClick={() => setActiveRole('seller')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
              activeRole === 'seller' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Seller Mode (Work)
          </button>
        </div>
      </div>

      {/* BUYER MODE: Gig Grid (Fiverr/Upwork Style) */}
      {activeRole === 'buyer' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search services (e.g., Web Dev, Cybersecurity, Graphic Design)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 border border-slate-300 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {services
              .filter(s => s.title.toLowerCase().includes(search.toLowerCase()))
              .map((gig) => (
                <div key={gig.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition flex flex-col justify-between">
                  <div className="p-4">
                    {/* Seller Profile Header */}
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                        {gig.seller_name?.[0] || 'U'}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{gig.seller_name}</p>
                        <p className="text-[10px] text-slate-500">{gig.institution || user.institution}</p>
                      </div>
                    </div>

                    <h3 className="font-bold text-slate-800 text-sm hover:text-emerald-600 cursor-pointer line-clamp-2">
                      {gig.title}
                    </h3>
                    
                    <div className="flex items-center space-x-1 mt-2 text-amber-500 text-xs font-bold">
                      <span>★ {gig.rating || '5.0'}</span>
                      <span className="text-slate-400 font-normal">({gig.reviews_count || 0})</span>
                    </div>
                  </div>

                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Starting at</span>
                    <span className="text-base font-extrabold text-slate-900">₦{gig.starting_price}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* SELLER MODE: Active Gigs & Service Management */}
      {activeRole === 'seller' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-slate-900">Your Active Service Listings</h2>
            <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition">
              + Create New Service
            </button>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-400 uppercase">
                <th className="py-3">Service Title</th>
                <th className="py-3">Starting Rate</th>
                <th className="py-3">Orders Completed</th>
                <th className="py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              <tr>
                <td className="py-3 font-semibold text-slate-800">Custom React & Tailwind Development</td>
                <td className="py-3 text-emerald-600 font-bold">₦25,000</td>
                <td className="py-3 text-slate-500">12 orders</td>
                <td className="py-3">
                  <button className="text-xs text-red-600 hover:underline font-bold">Delete Gig</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
