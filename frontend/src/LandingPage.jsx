// src/LandingPage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from './components/Navbar';
import {
  ShieldCheck, ArrowRight, CheckCircle2,
  MapPin, Search, ChevronDown, BookOpen,
  Laptop, Home, Sparkles,
  Zap, Users, MessageSquare, PhoneCall, MessageCircle,
  Lock, Share2, Heart, GraduationCap, Store,
  Video, ShoppingBag, Eye, Clock, ExternalLink,
  ChevronLeft, ChevronRight, Wrench, Scissors, Camera, FileText
} from 'lucide-react';

export default function LandingPage() {
  const [heroTab, setHeroTab] = useState('buy'); // 'buy' | 'sell'
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState(null);
  const [currentHeroSlide, setCurrentHeroSlide] = useState(0);
  const [marketplaceTab, setMarketplaceTab] = useState('products'); // 'products' | 'services'

  // Rotating Hero Showcase featuring verified student laptops, hostel living gear, kicks & campus services (100% unique, realistic images)
  const heroSlides = [
    {
      id: 1,
      title: "Student Laptops, Calculators & Coding Workstations",
      subtitle: "Verified MacBooks, HP EliteBooks, scientific calculators & engineering essentials with student warranty.",
      badge: "Student Tech & PC Hub",
      category: "Laptops & Gadgets",
      image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1400&q=80"
    },
    {
      id: 2,
      title: "Hostel Essentials, Rechargeable Fans & Study Gear",
      subtitle: "Rechargeable study desk fans, fast-boil kettles & hostel dorm room living essentials verified by peers.",
      badge: "Hostel Living & Study Hub",
      category: "Hostel Essentials",
      image: "https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&w=1400&q=80"
    },
    {
      id: 3,
      title: "Campus Kicks, Graphic Hoodies & Hall Streetwear",
      subtitle: "Nike Dunk Lows, heavyweight fleece hoodies & vintage thrift fits from verified hall merchants.",
      badge: "Campus Fashion & Kicks",
      category: "Campus Fashion",
      image: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=1400&q=80"
    },
    {
      id: 4,
      title: "Final Year Binding, Laundry Pickup & Tech Repairs",
      subtitle: "Same-day hardcover binding, hostel wash & fold laundry, phone screen fixes & barbering.",
      badge: "Verified Student Services",
      category: "Campus Services",
      image: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=1400&q=80"
    },
    {
      id: 5,
      title: "Real University Peers. 100% Student ID Verified",
      subtitle: "Connect with real peers across UNILAG, UI, OAU, FUTA and Nigerian tertiary institutions safely.",
      badge: "Campus Directory & Safety",
      category: "Student Community",
      image: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1400&q=80"
    }
  ];

  // Auto-advance hero slides every 4.5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHeroSlide((prev) => (prev + 1) % heroSlides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  const categories = [
    { id: 'All', label: 'All Items' },
    { id: 'Tech', label: 'Laptops & Tech' },
    { id: 'Academic', label: 'Textbooks & Calculators' },
    { id: 'Hostel', label: 'Hostel Gear & Kicks' },
    { id: 'Services', label: 'Student Services' },
  ];

  const marketplaceItems = [
    {
      id: 1,
      title: 'Apple MacBook Pro Retina 13" (16GB RAM / 512GB SSD)',
      category: 'Tech',
      price: 'Negotiable in Chat',
      campus: 'UNILAG (Faculty of Science)',
      seller: 'Campus Tech Hub (Verified Vendor)',
      condition: 'Clean UK Used / 6-Month Warranty',
      highlight: 'Core i5 • 16GB RAM • Battery 8+ Hours',
      image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80',
      badge: 'Verified Student Tech'
    },
    {
      id: 2,
      title: 'Rechargeable High-Velocity Hostel Study Desk Fan (with LED Light)',
      category: 'Hostel',
      price: 'Negotiable in Chat',
      campus: 'UI (Kuti Hall)',
      seller: 'Dorm Essentials (Verified Vendor)',
      condition: 'Brand New In Box / 8-Hour Battery',
      highlight: 'USB Charging • Ultra Quiet • 3 Speeds',
      image: 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&w=800&q=80',
      badge: 'Hostel Essential'
    },
    {
      id: 3,
      title: 'Rapid-Boil Stainless Steel Electric Hostel Kettle (1.8 Liters)',
      category: 'Hostel',
      price: 'Negotiable in Chat',
      campus: 'OAU (Awolowo Hall)',
      seller: 'Hall Mart (Verified Vendor)',
      condition: 'Brand New In Box / Auto-Shutoff',
      highlight: '1500W Fast Boil • Food-Grade Stainless',
      image: 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?auto=format&fit=crop&w=800&q=80',
      badge: 'Hostel Essential'
    },
    {
      id: 4,
      title: "Nike Air Force 1 '07 - Triple White Classic",
      category: 'Hostel',
      price: 'Negotiable in Chat',
      campus: 'UNILAG (SUB Quad)',
      seller: 'Campus Kicks (Verified Vendor)',
      condition: 'Brand New In Box',
      highlight: 'Crisp Triple White • Sizes 40-46',
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
      badge: 'Verified Kicks'
    },
    {
      id: 5,
      title: 'HP EliteBook 840 G6 Ultrabook (Core i5 / 16GB RAM)',
      category: 'Tech',
      price: 'Negotiable in Chat',
      campus: 'UI (Independence Hall)',
      seller: 'Campus Tech Hub (Verified Vendor)',
      condition: 'Direct UK Used / Warranty',
      highlight: 'Core i5 • 16GB RAM • 512GB SSD',
      image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=80',
      badge: 'Verified Vendor'
    },
    {
      id: 6,
      title: 'Casio fx-991EX ClassWiz Scientific Engineering Calculator',
      category: 'Academic',
      price: 'Negotiable in Chat',
      campus: 'FUTA (Obakekere Hall)',
      seller: 'Campus Tech Hub (Verified Vendor)',
      condition: 'Original / 552 Functions',
      highlight: '552 Functions • Solar + Battery',
      image: 'https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?auto=format&fit=crop&w=800&q=80',
      badge: 'Faculty Approved'
    },
    {
      id: 7,
      title: 'Higher Engineering Mathematics & Calculus Vol. 1 & 2',
      category: 'Academic',
      price: 'Negotiable in Chat',
      campus: 'OAU (Senate Quad)',
      seller: 'Book Barn (Verified Vendor)',
      condition: 'Clean / Complete Working Notes',
      highlight: 'Bird & Stroud • Complete Worked Answers',
      image: 'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?auto=format&fit=crop&w=800&q=80',
      badge: 'Essential Text'
    },
    {
      id: 8,
      title: 'Heavyweight Fleece Oversized Graphic Streetwear Hoodie',
      category: 'Hostel',
      price: 'Negotiable in Chat',
      campus: 'UNILAG (Engineering Quad)',
      seller: 'Campus Kicks (Verified Vendor)',
      condition: 'Unisex / 420 GSM Cotton',
      highlight: '420 GSM Cotton • Unisex Oversized',
      image: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80',
      badge: 'Campus Fashion'
    }
  ];

  const campusServicesList = [
    {
      id: 1,
      title: "Final Year Project Binding & Color Printing",
      category: "Academic",
      price: "Negotiable in Chat",
      campus: "UNILAG / UI / OAU Quads",
      provider: "Campus Print Hub",
      turnaround: "Same-Day Delivery",
      description: "Hardcover black/gold embossing, spiral binding & high-res laser color printing.",
      image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80",
      badge: "Verified Service"
    },
    {
      id: 2,
      title: "Hostel Express Wash, Dry & Fold Laundry Service",
      category: "Hostel",
      price: "Negotiable in Chat",
      campus: "UNILAG (New Hall & Moremi)",
      provider: "SpeedyClean Hostel Pickup",
      turnaround: "24h Room Dropoff",
      description: "Doorstep pickup and room dropoff for student laundry, bedding and curtains.",
      image: "https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=800&q=80",
      badge: "Verified Service"
    },
    {
      id: 3,
      title: "Laptop Screen, Battery & Motherboard Repair",
      category: "Tech",
      price: "Negotiable in Chat",
      campus: "UI (SUB Tech Corner)",
      provider: "Tunde Gadget Repairs",
      turnaround: "Free Diagnosis",
      description: "Cracked screen fix, battery change, OS installation & board diagnostics.",
      image: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=800&q=80",
      badge: "Verified Service"
    },
    {
      id: 4,
      title: "Hostel Barbing, Sharp Fades & Hair Braiding",
      category: "Personal",
      price: "Negotiable in Chat",
      campus: "FUTA (Obakekere Hall)",
      provider: "Campus Touch Salon",
      turnaround: "Hostel Room Visits",
      description: "Experienced student barbers and stylists offering fades, dreadlock retwist & braids.",
      image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80",
      badge: "Verified Service"
    },
    {
      id: 5,
      title: "Engineering, Python Coding & Statistics Academic Tutoring",
      category: "Academic",
      price: "Negotiable in Chat",
      campus: "UNILAG / UI Faculty",
      provider: "Campus Scholar Mentors",
      turnaround: "1-on-1 Sessions",
      description: "Personalized revision for Engineering Maths, Python programming, and Statistics.",
      image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80",
      badge: "Verified Service"
    },
    {
      id: 6,
      title: "Campus Events, Convocation & Studio Photography",
      category: "Media",
      price: "Negotiable in Chat",
      campus: "All Partner Universities",
      provider: "LensCraft Campus Media",
      turnaround: "High-Res Edited Files",
      description: "Professional student matriculation, final year sign-out, and departmental event shoots.",
      image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80",
      badge: "Verified Service"
    }
  ];

  const campusReelsSample = [
    {
      id: 1,
      title: "HP EliteBook Speed Test for Python & MATLAB at SUB Quad",
      author: "Campus Tech Hub",
      role: "Verified Vendor",
      location: "UNILAG SUB Quad",
      likes: 184,
      comments: 32,
      image: "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=80"
    },
    {
      id: 2,
      title: "Final Year Hardcover Gold Embossing Process",
      author: "Campus Print Hub",
      role: "Verified Vendor",
      location: "Central Library Walkway",
      likes: 219,
      comments: 45,
      image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80"
    },
    {
      id: 3,
      title: "Group Study & Night Coding Setup at Library Quad",
      author: "Segun Adeleke",
      role: "Student",
      location: "New Hall Commercial Walkway",
      likes: 314,
      comments: 63,
      image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=800&q=80"
    }
  ];

  const filteredItems = marketplaceItems.filter((item) => {
    const matchCat = selectedCategory === 'All' || item.category === selectedCategory;
    const matchSearch =
      searchQuery.trim() === '' ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.campus.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.seller.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const faqs = [
    {
      q: 'What is CampusLink?',
      a: 'CampusLink is a modern campus ecosystem connecting university students with verified student merchants, essential campus services (printing, laundry, gadgets, repairs), and short video reels for universities across Nigeria.'
    },
    {
      q: 'How does vendor ID verification work?',
      a: 'All campus vendors must provide high-resolution photos of the Front and Back of their student or national ID card and state their campus stall location. A campus administrator inspects and verifies credentials before any products or services can be published.'
    },
    {
      q: 'Can students connect with vendors and other students as friends?',
      a: 'Yes. CampusLink features a comprehensive Community Directory where you can discover peers and verified merchants, view their role and hostel/department, send friend requests, and start direct chats.'
    },
    {
      q: 'What products and services can I buy on CampusLink?',
      a: 'You can negotiate directly with verified student peers for laptops, scientific calculators, textbooks, rechargeable hostel desk fans, campus streetwear, and book verified campus services like final year project binding, express laundry, and device repairs.'
    },
    {
      q: 'Can I delete or comment on campus reels?',
      a: 'Yes. Every student and vendor can watch campus video reels, leave comments, toggle likes, and creators can delete their own reels anytime with a single click.'
    }
  ];

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased overflow-x-hidden selection:bg-sky-500 selection:text-white">
      <Navbar />

      {/* --- HERO SECTION WITH AUTHENTIC CAMPUS PHOTOGRAPHY --- */}
      <section className="relative pt-28 pb-16 lg:pt-36 lg:pb-24 flex flex-col justify-center items-center text-center px-4 sm:px-6 overflow-hidden bg-gradient-to-b from-sky-50/70 via-white to-slate-50">
        
        {/* Soft Ambient Radial Lights */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] bg-sky-200/40 blur-[130px] rounded-full pointer-events-none" />
        <div className="absolute top-2/3 right-10 w-[350px] h-[250px] bg-blue-100/40 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto flex flex-col items-center">
          
          {/* Top Pill Tag */}
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-white border border-sky-200/80 text-sky-700 text-xs font-bold mb-6 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
            <span>Verified Campus Marketplace • Campus Services • Student Community</span>
          </div>

          {/* Interactive Dual Mode Switcher */}
          <div className="inline-flex rounded-full bg-white p-1.5 border border-slate-200 mb-6 shadow-sm">
            <button
              onClick={() => setHeroTab('buy')}
              className={`w-36 sm:w-44 py-2.5 text-xs sm:text-sm font-bold rounded-full transition-all cursor-pointer ${
                heroTab === 'buy'
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Shop Campus
            </button>
            <button
              onClick={() => setHeroTab('sell')}
              className={`w-36 sm:w-44 py-2.5 text-xs sm:text-sm font-bold rounded-full transition-all cursor-pointer ${
                heroTab === 'sell'
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Become a Vendor
            </button>
          </div>

          {/* Headline */}
          <motion.h1
            key={heroTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 max-w-4xl mx-auto leading-[1.15]"
          >
            {heroTab === 'buy' ? (
              <>
                The verified marketplace & community <br />
                <span className="bg-gradient-to-r from-sky-600 to-blue-700 bg-clip-text text-transparent">
                  tailored for your university campus.
                </span>
              </>
            ) : (
              <>
                Launch your campus storefront <br />
                <span className="bg-gradient-to-r from-sky-600 to-blue-700 bg-clip-text text-transparent">
                  with strict ID verification & zero fees.
                </span>
              </>
            )}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            key={heroTab + '-desc'}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 }}
            className="mt-4 text-sm sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal"
          >
            {heroTab === 'buy'
              ? 'Connect with verified student peers, negotiate tech and hostel products, book campus services, and watch campus video drops.'
              : 'Submit your student or national ID card for admin inspection, list tech products and student services, and showcase video drops directly to campus.'}
          </motion.p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center mt-8 gap-4 w-full sm:w-auto">
            <Link
              to={heroTab === 'buy' ? '/signup?type=student' : '/signup?type=vendor'}
              className="w-full sm:w-auto px-8 py-3.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-full transition-all shadow-md shadow-sky-500/25 text-xs sm:text-sm flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>{heroTab === 'buy' ? 'Explore Marketplace' : 'Register as Vendor'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <a
              href="#services"
              className="w-full sm:w-auto px-7 py-3.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-bold rounded-full border border-slate-200 transition-all text-xs sm:text-sm shadow-xs flex items-center justify-center space-x-1.5"
            >
              <Wrench className="w-4 h-4 text-sky-500" />
              <span>Campus Services</span>
            </a>
          </div>

          {/* Realistic Dynamic Visual Carousel (Laptops, Hostel Gear, Fashion, Campus Services) */}
          <div className="mt-12 w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 relative group bg-slate-900">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentHeroSlide}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.6 }}
                className="w-full h-[340px] sm:h-[480px] relative"
              >
                <img
                  src={heroSlides[currentHeroSlide].image}
                  alt={heroSlides[currentHeroSlide].title}
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-black/15" />
                
                {/* Top Badge on Slide */}
                <div className="absolute top-5 left-5 sm:top-6 sm:left-6">
                  <span className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white text-[11px] font-bold shadow-sm">
                    <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                    <span>{heroSlides[currentHeroSlide].badge}</span>
                  </span>
                </div>

                {/* Bottom Overlay Info */}
                <div className="absolute bottom-6 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-left text-white">
                  <div>
                    <h3 className="text-xl sm:text-3xl font-black tracking-tight leading-snug">
                      {heroSlides[currentHeroSlide].title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-200 mt-1 max-w-xl">
                      {heroSlides[currentHeroSlide].subtitle}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <Link
                      to="/signup"
                      className="px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-full shadow-lg transition-colors flex items-center space-x-1.5"
                    >
                      <span>Explore {heroSlides[currentHeroSlide].category}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation Arrows */}
            <button
              type="button"
              onClick={() => setCurrentHeroSlide((prev) => (prev === 0 ? heroSlides.length - 1 : prev - 1))}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-20"
              aria-label="Previous Slide"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentHeroSlide((prev) => (prev + 1) % heroSlides.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-20"
              aria-label="Next Slide"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Slide Indicators */}
            <div className="absolute top-5 right-5 sm:top-6 sm:right-6 flex items-center space-x-1.5 z-20">
              {heroSlides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentHeroSlide(idx)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    currentHeroSlide === idx
                      ? 'w-7 bg-sky-400'
                      : 'w-2 bg-white/50 hover:bg-white/80'
                  }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Trust Metric Badges */}
          <div className="mt-12 pt-6 border-t border-slate-200/70 flex flex-wrap items-center justify-center gap-6 sm:gap-12 text-xs font-semibold text-slate-500">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Admin ID Verified Vendors</span>
            </div>
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-sky-500" />
              <span>Direct Peer Friending & Chat</span>
            </div>
            <div className="flex items-center space-x-2">
              <Video className="w-4 h-4 text-blue-500" />
              <span>Interactive Campus Reels</span>
            </div>
            <div className="flex items-center space-x-2">
              <Wrench className="w-4 h-4 text-sky-500" />
              <span>Verified Student Services</span>
            </div>
          </div>
        </div>
      </section>

      {/* --- CAMPUS MARKETPLACE (JUMIA STYLE) --- */}
      <section id="marketplace" className="py-16 px-4 lg:px-8 max-w-7xl mx-auto content-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-bold mb-2">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Verified Campus Catalog</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Featured Campus Products
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Shop directly from merchants with verified student or national ID cards.
            </p>
          </div>

          {/* Search Bar */}
          <div className="w-full md:w-80 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search sneakers, meals, textbooks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 shadow-xs"
            />
          </div>
        </div>

        {/* Dual Mode Switcher: Products vs Campus Services */}
        <div className="flex items-center space-x-2.5 mb-8">
          <button
            type="button"
            onClick={() => setMarketplaceTab('products')}
            className={`px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all flex items-center space-x-2 cursor-pointer ${
              marketplaceTab === 'products'
                ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-sky-400" />
            <span>Campus Products ({marketplaceItems.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setMarketplaceTab('services')}
            className={`px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all flex items-center space-x-2 cursor-pointer ${
              marketplaceTab === 'services'
                ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Wrench className="w-4 h-4 text-emerald-400" />
            <span>Campus Services ({campusServicesList.length})</span>
          </button>
        </div>

        {/* --- PRODUCTS VIEW --- */}
        {marketplaceTab === 'products' && (
          <>
            {/* Category Pills */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-4 mb-6 text-xs font-bold">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`px-4 py-2 rounded-full transition-all cursor-pointer shrink-0 ${
                    selectedCategory === c.id
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="h-52 w-full bg-slate-100 relative overflow-hidden">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-full text-[10px] font-bold text-sky-700 shadow-xs flex items-center space-x-1">
                        <MapPin className="w-3 h-3 text-sky-600" />
                        <span>{item.campus}</span>
                      </span>
                      <span className="absolute top-3 right-3 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full text-[10px] font-bold text-emerald-700 shadow-xs flex items-center space-x-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>{item.badge}</span>
                      </span>
                    </div>

                    <div className="p-5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs sm:text-sm font-black text-sky-700 bg-sky-50 px-2.5 py-1 rounded-xl border border-sky-200 inline-flex items-center space-x-1">
                          <MessageCircle className="w-3.5 h-3.5 text-sky-600" />
                          <span>Price Negotiable via Chat</span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">{item.condition}</span>
                      </div>
                      <h3 className="font-bold text-base text-slate-900 line-clamp-1">{item.title}</h3>
                      {item.highlight && (
                        <div className="mt-1.5 inline-flex items-center px-2.5 py-0.5 rounded-md bg-sky-50 text-sky-700 text-[10px] font-bold">
                          <Sparkles className="w-3 h-3 mr-1 text-sky-500" />
                          <span>{item.highlight}</span>
                        </div>
                      )}
                      <span className="text-xs text-slate-500 font-medium block mt-1.5">Seller: {item.seller}</span>
                      <p className="text-[11px] text-slate-500 mt-2 flex items-center space-x-1">
                        <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>Chat to negotiate and confirm campus meeting spot before payment.</span>
                      </p>
                    </div>
                  </div>

                  <div className="p-5 pt-0">
                    <Link
                      to="/signup?type=student"
                      className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Chat with Seller to Negotiate & Inspect</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* --- SERVICES VIEW DIRECTLY IN MARKETPLACE --- */}
        {marketplaceTab === 'services' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {campusServicesList.map((svc) => (
              <div
                key={svc.id}
                className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="h-52 w-full bg-slate-100 relative overflow-hidden">
                    <img
                      src={svc.image}
                      alt={svc.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-800 shadow-xs flex items-center space-x-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      <span>{svc.badge}</span>
                    </span>
                    <span className="absolute top-3 right-3 bg-black/60 backdrop-blur-xs text-white px-2.5 py-1 rounded-full text-[10px] font-bold shadow-xs flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-sky-400" />
                      <span>{svc.turnaround}</span>
                    </span>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs sm:text-sm font-black text-slate-800 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200 inline-flex items-center space-x-1">
                        <Wrench className="w-3.5 h-3.5 text-slate-600" />
                        <span>Fee & Scope Negotiable in Chat</span>
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{svc.category}</span>
                    </div>
                    <h3 className="font-bold text-base text-slate-900 line-clamp-1">{svc.title}</h3>
                    <span className="text-xs text-sky-700 font-bold block mt-1">{svc.provider}</span>
                    <span className="text-xs text-slate-500 flex items-center space-x-1 mt-1">
                      <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                      <span className="truncate">{svc.campus}</span>
                    </span>

                    <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                      {svc.description}
                    </p>
                  </div>
                </div>

                <div className="p-5 pt-0">
                  <Link
                    to="/signup?type=student"
                    className="w-full py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Chat with Provider to Agree & Schedule</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

      </section>

      {/* --- CAMPUS REELS SHOWCASE (TIKTOK / STORIES) --- */}
      <section id="reels" className="py-16 px-4 lg:px-8 max-w-7xl mx-auto bg-white rounded-3xl border border-slate-200 my-10 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-600 text-xs font-bold mb-2">
              <Video className="w-3.5 h-3.5" />
              <span>Campus Reels & Video Drops</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Watch Interactive Campus Reels
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Short unboxings, study spots, fresh food batches, and student lifestyle clips with live comments and likes.
            </p>
          </div>

          <Link
            to="/signup?type=student"
            className="px-5 py-2.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-sm transition-all self-start md:self-auto"
          >
            Post Your Reel
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {campusReelsSample.map((reel) => (
            <div key={reel.id} className="h-96 rounded-3xl overflow-hidden relative shadow-xs group">
              <img src={reel.image} alt={reel.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-black/20" />
              
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-xs text-white px-3 py-1 rounded-full text-[11px] font-bold flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-sky-400" />
                <span>{reel.location}</span>
              </div>

              <div className="absolute bottom-4 left-4 right-4 text-white">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black">{reel.author}</span>
                  <span className="text-[10px] bg-sky-500 px-2 py-0.5 rounded-full font-bold">{reel.role}</span>
                </div>
                <h4 className="font-bold text-sm leading-snug">{reel.title}</h4>
                <div className="mt-2.5 flex items-center space-x-4 text-xs">
                  <span className="flex items-center space-x-1 text-rose-400 font-bold">
                    <Heart className="w-4 h-4 fill-current" />
                    <span>{reel.likes}</span>
                  </span>
                  <span className="flex items-center space-x-1 text-slate-300 font-bold">
                    <MessageSquare className="w-4 h-4" />
                    <span>{reel.comments} comments</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --- CAMPUS SERVICES & STUDENT BUSINESSES SHOWCASE --- */}
      <section id="services" className="py-16 px-4 lg:px-8 max-w-7xl mx-auto content-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-bold mb-2">
              <Wrench className="w-3.5 h-3.5 text-sky-600" />
              <span>Verified Campus Services & Skills</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Essential Student & Campus Services
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Final year hardcover project binding, hostel express laundry, device diagnostics, hair styling & tutoring.
            </p>
          </div>

          <Link
            to="/signup?type=student"
            className="px-5 py-2.5 rounded-full bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-sm transition-all self-start md:self-auto flex items-center space-x-1.5"
          >
            <span>Book Services in Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {campusServicesList.map((svc) => (
            <div
              key={svc.id}
              className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="h-44 w-full bg-slate-100 relative overflow-hidden">
                  <img
                    src={svc.image}
                    alt={svc.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-800 shadow-xs flex items-center space-x-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>{svc.badge}</span>
                  </span>
                  <span className="absolute top-3 right-3 bg-black/60 backdrop-blur-xs text-white px-2.5 py-1 rounded-full text-[10px] font-bold shadow-xs flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-sky-400" />
                    <span>{svc.turnaround}</span>
                  </span>
                </div>

                <div className="p-5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-black text-sky-700">{svc.price}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{svc.category}</span>
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 line-clamp-2 leading-snug">{svc.title}</h3>
                  <span className="text-[11px] text-sky-700 font-bold block mt-1">{svc.provider}</span>
                  <span className="text-xs text-slate-500 flex items-center space-x-1 mt-1">
                    <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                    <span className="truncate">{svc.campus}</span>
                  </span>

                  <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                    {svc.description}
                  </p>
                </div>
              </div>

              <div className="p-5 pt-0">
                <Link
                  to="/signup?type=student"
                  className="w-full py-2.5 bg-sky-50 hover:bg-sky-500 text-sky-700 hover:text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center space-x-1.5"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Request Service</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --- STRICT VENDOR VERIFICATION & SAFETY --- */}
      <section id="safety" className="py-16 px-4 lg:px-8 max-w-7xl mx-auto content-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Bank-Grade Trust Architecture</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            How Campus ID Verification Protects You
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-2">
            We manually review every merchant with our dedicated campus administrator panel.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center font-bold mb-4">
              1
            </div>
            <h3 className="font-bold text-base text-slate-900">ID Card Submission</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Every merchant must upload high-resolution photos of the Front and Back of their student or national ID card along with their physical stall location.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center font-bold mb-4">
              2
            </div>
            <h3 className="font-bold text-base text-slate-900">Admin Inspection Gate</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Vendors remain unverified and cannot post items or services until a campus administrator reviews the cards and authorizes the store.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-4">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="font-bold text-base text-slate-900">Verified Badge & Safe Meetups</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Approved merchants display the Verified Vendor badge. Transactions and pickups happen at designated safe campus quads like the SUB and Library.
            </p>
          </div>
        </div>
      </section>

      {/* --- FAQ SECTION --- */}
      <section id="faq" className="py-16 px-4 lg:px-8 max-w-4xl mx-auto content-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Everything you need to know about CampusLink.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs"
            >
              <button
                onClick={() => toggleFaq(index)}
                className="w-full p-4 text-left flex items-center justify-between text-xs sm:text-sm font-bold text-slate-900 cursor-pointer"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    openFaq === index ? 'rotate-180 text-sky-600' : ''
                  }`}
                />
              </button>
              {openFaq === index && (
                <div className="px-4 pb-4 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="bg-white border-t border-slate-200 py-12 px-4 lg:px-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center font-bold text-white text-xs">
              CL
            </div>
            <span className="font-extrabold text-sm text-slate-900">
              CAMPUS<span className="text-sky-600">LINK</span>
            </span>
          </div>

          <div className="flex items-center space-x-6 font-semibold">
            <Link to="/login" className="hover:text-sky-600">Student Login</Link>
            <Link to="/signup?type=vendor" className="hover:text-sky-600">Vendor Registration</Link>
            <Link to="/admin" className="text-sky-600 hover:text-sky-700 font-bold">Admin Portal</Link>
          </div>

          <p>© 2026 CampusLink Nigeria. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
}