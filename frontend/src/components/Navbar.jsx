import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, ShieldCheck, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 text-slate-800 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center space-x-2.5 group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-black tracking-tight text-slate-900">
            CAMPUS<span className="text-sky-600">LINK</span>
          </span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden lg:flex items-center space-x-7 text-xs font-semibold text-slate-600">
          <a href="#marketplace" className="hover:text-sky-600 transition-colors">Marketplace</a>
          <a href="#services" className="hover:text-sky-600 transition-colors">Campus Services</a>
          <a href="#reels" className="hover:text-sky-600 transition-colors">Campus Reels</a>
          <a href="#safety" className="hover:text-sky-600 transition-colors">Safety Verification</a>
          <a href="#faq" className="hover:text-sky-600 transition-colors">FAQ</a>
          <Link to="/admin" className="text-sky-600 hover:text-sky-700 font-bold flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Admin Portal</span>
          </Link>
        </div>

        {/* Desktop CTA */}
        <div className="hidden lg:flex items-center space-x-3 text-xs font-bold">
          <Link
            to="/login"
            className="text-slate-700 hover:text-sky-600 px-4 py-2 transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/signup"
            className="rounded-full px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold transition-all shadow-md shadow-sky-500/25 flex items-center space-x-1.5"
          >
            <span>Get Started</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setIsOpen(!isOpen)}
          className="lg:hidden p-2 text-slate-600 hover:text-slate-900"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-white border-b border-slate-200 px-6 py-6 flex flex-col space-y-4 text-xs font-semibold"
          >
            <a href="#marketplace" onClick={() => setIsOpen(false)} className="text-slate-700 hover:text-sky-600 py-2">Marketplace</a>
            <a href="#services" onClick={() => setIsOpen(false)} className="text-slate-700 hover:text-sky-600 py-2">Campus Services</a>
            <a href="#reels" onClick={() => setIsOpen(false)} className="text-slate-700 hover:text-sky-600 py-2">Campus Reels</a>
            <a href="#safety" onClick={() => setIsOpen(false)} className="text-slate-700 hover:text-sky-600 py-2">Safety Verification</a>
            <a href="#faq" onClick={() => setIsOpen(false)} className="text-slate-700 hover:text-sky-600 py-2">FAQ</a>
            <Link to="/admin" onClick={() => setIsOpen(false)} className="text-sky-600 font-bold py-2 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Admin Portal</span>
            </Link>
            
            <div className="pt-4 border-t border-slate-100 flex flex-col space-y-3">
              <Link
                to="/login"
                onClick={() => setIsOpen(false)}
                className="w-full text-center py-2.5 text-slate-700 border border-slate-200 rounded-full font-bold hover:bg-slate-50"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                onClick={() => setIsOpen(false)}
                className="w-full text-center py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-full font-bold shadow-md shadow-sky-500/25"
              >
                Get Started Free
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}