import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ShoppingBag, 
  Home, 
  ShieldCheck, 
  BookOpen, 
  UserCheck, 
  ArrowRight, 
  Menu, 
  X,
  Sparkles
} from 'lucide-react';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: <ShoppingBag className="w-7 h-7 text-blue-600" />,
      title: "Campus Marketplace",
      desc: "Buy and sell gadgets, textbooks, and essentials securely with verified peers."
    },
    {
      icon: <Home className="w-7 h-7 text-blue-600" />,
      title: "Student Housing",
      desc: "Find vetted off-campus apartments, rooms, and compatible roommates."
    },
    {
      icon: <BookOpen className="w-7 h-7 text-blue-600" />,
      title: "Academic Hub",
      desc: "Share past questions, lecture summaries, and connect with peer tutors."
    },
    {
      icon: <ShieldCheck className="w-7 h-7 text-blue-600" />,
      title: "Verified Identities",
      desc: "Enhanced trust using multi-step student ID verification badges."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans overflow-x-hidden">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/30">
              C
            </div>
            <span className="text-2xl font-extrabold bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent">
              CampusLink
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8 font-medium text-slate-600">
            <a href="#features" className="hover:text-blue-600 transition">Features</a>
            <a href="#about" className="hover:text-blue-600 transition">About</a>
            <Link to="/auth" className="text-slate-700 hover:text-blue-600 font-semibold transition">
              Sign In
            </Link>
            <Link 
              to="/auth" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md shadow-blue-600/20 hover:shadow-lg transition transform hover:-translate-y-0.5"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Hamburger Button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-600 hover:text-blue-600"
          >
            {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-4">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-slate-600 font-medium">Features</a>
            <a href="#about" onClick={() => setMobileMenuOpen(false)} className="text-slate-600 font-medium">About</a>
            <Link to="/auth" onClick={() => setMobileMenuOpen(false)} className="text-blue-600 font-semibold">Sign In / Register</Link>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-28 px-6 max-w-7xl mx-auto w-full flex flex-col items-center text-center">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold mb-8 border border-blue-100"
        >
          <Sparkles className="w-4 h-4 text-blue-600" />
          The Ultimate Student Ecosystem
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-tight max-w-4xl"
        >
          Connect, Trade, and Thrive Across Your <span className="text-blue-600 underline decoration-blue-200 decoration-wavy">Campus</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl leading-relaxed"
        >
          CampusLink unifies student services, verified peer trading, housing search, and academic collaboration on one secure platform.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-10 flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center"
        >
          <Link
            to="/auth"
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-xl shadow-blue-600/30 hover:shadow-blue-600/40 transition transform hover:-translate-y-1"
          >
            Create Your Account <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>

        {/* Floating Stat Badges */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.8 }}
          className="mt-16 grid grid-cols-2 md:grid-cols-3 gap-6 w-full max-w-3xl"
        >
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
            <span className="text-3xl font-extrabold text-blue-600">100%</span>
            <span className="text-sm font-medium text-slate-500 mt-1">Verified Students</span>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
            <span className="text-3xl font-extrabold text-blue-600">Instant</span>
            <span className="text-sm font-medium text-slate-500 mt-1">Peer Connect</span>
          </div>
          <div className="col-span-2 md:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
            <span className="text-3xl font-extrabold text-blue-600">Zero</span>
            <span className="text-sm font-medium text-slate-500 mt-1">Middleman Fees</span>
          </div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-white border-t border-slate-200/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
              Built Specifically for Campus Needs
            </h2>
            <p className="text-slate-600 mt-4 text-lg">
              Everything you need during your academic journey integrated seamlessly into a modern web interface.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((item, index) => (
              <motion.div
                key={index}
                whileHover={{ y: -8 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="bg-slate-50 p-8 rounded-2xl border border-slate-200/80 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/5 transition duration-300 flex flex-col items-start"
              >
                <div className="p-3 bg-blue-100/70 rounded-xl mb-6">
                  {item.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                <p className="text-slate-600 leading-relaxed text-sm">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer Section */}
      <section className="bg-gradient-to-b from-blue-600 to-blue-700 text-white py-16 px-6 text-center mt-auto">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">Ready to Join CampusLink?</h2>
          <p className="text-blue-100 text-lg mb-8 max-w-xl mx-auto">
            Get started in seconds, create your verified student profile, and explore services today.
          </p>
          <Link
            to="/auth"
            className="inline-block bg-white text-blue-700 hover:bg-slate-100 px-8 py-4 rounded-xl font-bold text-lg shadow-lg transition transform hover:-translate-y-0.5"
          >
            Access Portal
          </Link>
        </div>
      </section>

      <footer className="bg-slate-900 text-slate-400 py-8 px-6 text-center text-sm">
        <p>© 2026 CampusLink. Designed for Seamless Student Connection.</p>
      </footer>
    </div>
  );
}