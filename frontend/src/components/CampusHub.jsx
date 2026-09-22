import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, Zap, Smartphone, Wifi, Tv, GraduationCap, Building2,
  BookOpen, Search, Plus, CheckCircle2, AlertCircle, ArrowUpRight,
  ArrowDownLeft, Clock, Copy, Check, Download, Share2, Phone,
  MapPin, ShieldCheck, RefreshCw, ChevronRight, X, Sparkles,
  DollarSign, FileText, Calculator, Home as HomeIcon, Award, Eye
} from 'lucide-react';
import API from '../api';
import SafeImage from './SafeImage';

export default function CampusHub({
  currentUser,
  universityName = 'CampusLink University',
  notices = [],
  onOpenReportNoticeModal,
  onResolveNotice,
  isVendor = false
}) {
  // Main Hub Category Switcher: 'bank' | 'academics' | 'lodges' | 'notices'
  const [hubTab, setHubTab] = useState('bank');

  // =========================================================
  // 1. MINI BANK & VTU STATE
  // =========================================================
  const [vtuCategory, setVtuCategory] = useState('data'); // 'airtime' | 'data' | 'electricity' | 'cable' | 'education'
  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [isLoadingWallet, setIsLoadingWallet] = useState(true);
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);

  // Modals & Receipts
  const [fundModalOpen, setFundModalOpen] = useState(false);
  const [fundAmount, setFundAmount] = useState('1000');
  const [isFunding, setIsFunding] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // VTU Purchase Form State
  const [selectedNetwork, setSelectedNetwork] = useState('MTN');
  const [recipientPhone, setRecipientPhone] = useState(currentUser?.phone_number || '');
  const [airtimeAmount, setAirtimeAmount] = useState('500');
  const [selectedDataPlan, setSelectedDataPlan] = useState('mtn_sme_1gb');

  // Electricity State
  const [selectedDisco, setSelectedDisco] = useState('ikedc');
  const [meterType, setMeterType] = useState('prepaid');
  const [meterNumber, setMeterNumber] = useState('');
  const [electricityAmount, setElectricityAmount] = useState('2000');

  // Cable State
  const [selectedCable, setSelectedCable] = useState('GOTV');
  const [selectedBouquet, setSelectedBouquet] = useState('gotv_jolli');
  const [smartcardNumber, setSmartcardNumber] = useState('');

  // Education PIN State
  const [selectedPinType, setSelectedPinType] = useState('jamb_utme');
  const [educationProfileCode, setEducationProfileCode] = useState('');

  // =========================================================
  // 2. ACADEMICS VAULT STATE
  // =========================================================
  const [pastQuestions, setPastQuestions] = useState([]);
  const [academicSearch, setAcademicSearch] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [viewPqModal, setViewPqModal] = useState(null);

  // Interactive CGPA Calculator State (5.0 scale)
  const [calcCourses, setCalcCourses] = useState([
    { id: 1, code: 'GST 111', units: 2, grade: 'A' },
    { id: 2, code: 'MTH 101', units: 3, grade: 'A' },
    { id: 3, code: 'CSC 201', units: 3, grade: 'B' },
    { id: 4, code: 'PHY 101', units: 3, grade: 'B' },
  ]);

  // =========================================================
  // 3. LODGES STATE
  // =========================================================
  const [lodges, setLodges] = useState([]);
  const [lodgeSearch, setLodgeSearch] = useState('');
  const [selectedRoomType, setSelectedRoomType] = useState('all');
  const [postLodgeModalOpen, setPostLodgeModalOpen] = useState(false);
  const [newLodge, setNewLodge] = useState({
    title: '',
    lodge_name: '',
    location: '',
    price_per_year: '',
    room_type: 'Self-contained',
    amenities: 'Running Water, Prepaid Meter, Fenced, Security',
    contact_phone: currentUser?.phone_number || ''
  });

  // =========================================================
  // 4. NOTICES FILTER STATE
  // =========================================================
  const [noticeFilter, setNoticeFilter] = useState('all'); // 'all' | 'lost' | 'found' | 'announcement'

  // Fetch initial data
  useEffect(() => {
    fetchWalletBalance();
    fetchTransactions();
    fetchPastQuestions();
    fetchLodges();
  }, []);

  const fetchWalletBalance = async () => {
    try {
      const res = await API.get('/wallet/balance');
      if (res.data) {
        setWalletBalance(res.data.wallet_balance || 0);
      }
    } catch {
      // Fallback local balance
      const cached = localStorage.getItem('cl_wallet_balance');
      if (cached) setWalletBalance(parseFloat(cached));
    } finally {
      setIsLoadingWallet(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await API.get('/wallet/transactions');
      if (Array.isArray(res.data)) {
        setTransactions(res.data);
      }
    } catch {
      // Fallback transactions
    }
  };

  const fetchPastQuestions = async () => {
    try {
      const res = await API.get('/campus/past-questions');
      if (Array.isArray(res.data)) {
        setPastQuestions(res.data);
      }
    } catch {
      // Handled
    }
  };

  const fetchLodges = async () => {
    try {
      const res = await API.get('/campus/lodges');
      if (Array.isArray(res.data)) {
        setLodges(res.data);
      }
    } catch {
      // Handled
    }
  };

  // Fund Wallet Action
  const handleFundWallet = async () => {
    const amt = parseFloat(fundAmount);
    if (isNaN(amt) || amt < 100) {
      alert('Please enter a valid amount (minimum ₦100).');
      return;
    }
    setIsFunding(true);
    try {
      const res = await API.post('/wallet/fund', {
        amount: amt,
        method: 'demo_card'
      });
      if (res.data && res.data.success) {
        setWalletBalance(res.data.new_balance);
        localStorage.setItem('cl_wallet_balance', String(res.data.new_balance));
        setFundModalOpen(false);
        fetchTransactions();
        alert(`🎉 Successfully funded wallet with ₦${amt.toLocaleString()}!`);
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to fund wallet.');
    } finally {
      setIsFunding(false);
    }
  };

  // Purchase VTU Service
  const handlePurchaseVTU = async () => {
    let payload = {};
    let finalAmount = 0;

    if (vtuCategory === 'airtime') {
      const amt = parseFloat(airtimeAmount);
      if (isNaN(amt) || amt < 50) {
        alert('Minimum airtime amount is ₦50.');
        return;
      }
      if (!recipientPhone || recipientPhone.length < 10) {
        alert('Please enter a valid phone number.');
        return;
      }
      // Apply 2% instant discount
      const discount = selectedNetwork === 'GLO' ? 0.03 : selectedNetwork === '9MOBILE' ? 0.035 : 0.02;
      finalAmount = Math.round(amt * (1 - discount));

      payload = {
        service_category: 'airtime',
        network_provider: selectedNetwork,
        package_name: `₦${amt.toLocaleString()} ${selectedNetwork} Recharge (${Math.round(discount * 100)}% Bonus)`,
        amount: finalAmount,
        recipient: recipientPhone
      };
    } else if (vtuCategory === 'data') {
      if (!recipientPhone || recipientPhone.length < 10) {
        alert('Please enter a valid recipient phone number.');
        return;
      }
      const plan = dataPlansMap[selectedDataPlan];
      if (!plan) {
        alert('Please select a data plan.');
        return;
      }
      finalAmount = plan.amount;
      payload = {
        service_category: 'data',
        network_provider: selectedNetwork,
        package_name: plan.name,
        package_id: plan.id,
        amount: finalAmount,
        recipient: recipientPhone
      };
    } else if (vtuCategory === 'electricity') {
      const amt = parseFloat(electricityAmount);
      if (isNaN(amt) || amt < 500) {
        alert('Minimum electricity payment is ₦500.');
        return;
      }
      if (!meterNumber || meterNumber.length < 6) {
        alert('Please enter a valid meter number.');
        return;
      }
      finalAmount = amt;
      const discoObj = discosList.find(d => d.id === selectedDisco);
      payload = {
        service_category: 'electricity',
        network_provider: discoObj?.code || selectedDisco,
        package_name: `${discoObj?.name || 'Electricity'} (${meterType.toUpperCase()})`,
        amount: finalAmount,
        recipient: meterNumber,
        meter_type: meterType
      };
    } else if (vtuCategory === 'cable') {
      if (!smartcardNumber || smartcardNumber.length < 8) {
        alert('Please enter a valid smartcard/IUC number.');
        return;
      }
      const bq = cableBouquets[selectedCable]?.find(b => b.id === selectedBouquet);
      finalAmount = bq ? bq.amount : 3500;
      payload = {
        service_category: 'cable',
        network_provider: selectedCable,
        package_name: bq ? bq.name : selectedBouquet,
        amount: finalAmount,
        recipient: smartcardNumber
      };
    } else if (vtuCategory === 'education') {
      const pinObj = educationPinsList.find(p => p.id === selectedPinType);
      finalAmount = pinObj ? pinObj.amount : 7700;
      payload = {
        service_category: 'education',
        network_provider: pinObj?.id || 'JAMB',
        package_name: pinObj?.name || 'JAMB e-PIN',
        amount: finalAmount,
        recipient: educationProfileCode || currentUser?.phone_number || 'Candidate'
      };
    }

    if (walletBalance < finalAmount) {
      alert(`Insufficient balance (₦${walletBalance.toLocaleString()}). You need ₦${finalAmount.toLocaleString()}. Please fund your wallet first.`);
      setFundModalOpen(true);
      return;
    }

    setIsProcessingPurchase(true);
    try {
      const res = await API.post('/vtu/purchase', payload);
      if (res.data && res.data.success) {
        setWalletBalance(res.data.balance_after);
        localStorage.setItem('cl_wallet_balance', String(res.data.balance_after));
        setCurrentReceipt(res.data);
        setReceiptModalOpen(true);
        fetchTransactions();
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Transaction failed. Please try again.');
    } finally {
      setIsProcessingPurchase(false);
    }
  };

  // Data Plans Definition
  const dataPlansMap = useMemo(() => {
    return {
      mtn_sme_500mb: { id: 'mtn_sme_500mb', name: 'MTN SME 500MB (30 Days)', amount: 150, size: '500MB' },
      mtn_sme_1gb: { id: 'mtn_sme_1gb', name: 'MTN SME 1.0GB (30 Days)', amount: 290, size: '1.0GB', badge: 'Cheapest 🔥' },
      mtn_sme_2gb: { id: 'mtn_sme_2gb', name: 'MTN SME 2.0GB (30 Days)', amount: 580, size: '2.0GB' },
      mtn_sme_3gb: { id: 'mtn_sme_3gb', name: 'MTN SME 3.0GB (30 Days)', amount: 870, size: '3.0GB' },
      mtn_sme_5gb: { id: 'mtn_sme_5gb', name: 'MTN SME 5.0GB (30 Days)', amount: 1450, size: '5.0GB' },
      mtn_sme_10gb: { id: 'mtn_sme_10gb', name: 'MTN SME 10.0GB (30 Days)', amount: 2900, size: '10.0GB' },

      airtel_cg_500mb: { id: 'airtel_cg_500mb', name: 'Airtel CG 500MB (30 Days)', amount: 160, size: '500MB' },
      airtel_cg_1gb: { id: 'airtel_cg_1gb', name: 'Airtel CG 1.0GB (30 Days)', amount: 300, size: '1.0GB', badge: 'Fast' },
      airtel_cg_2gb: { id: 'airtel_cg_2gb', name: 'Airtel CG 2.0GB (30 Days)', amount: 600, size: '2.0GB' },
      airtel_cg_5gb: { id: 'airtel_cg_5gb', name: 'Airtel CG 5.0GB (30 Days)', amount: 1500, size: '5.0GB' },

      glo_cg_1gb: { id: 'glo_cg_1gb', name: 'Glo SME 1.0GB (30 Days)', amount: 280, size: '1.0GB', badge: 'Budget' },
      glo_cg_2gb: { id: 'glo_cg_2gb', name: 'Glo SME 2.0GB (30 Days)', amount: 560, size: '2.0GB' },
      glo_cg_5gb: { id: 'glo_cg_5gb', name: 'Glo SME 5.0GB (30 Days)', amount: 1400, size: '5.0GB' },

      '9mobile_cg_1gb': { id: '9mobile_cg_1gb', name: '9mobile 1.0GB (30 Days)', amount: 260, size: '1.0GB', badge: 'Cheapest' },
      '9mobile_cg_2gb': { id: '9mobile_cg_2gb', name: '9mobile 2.0GB (30 Days)', amount: 520, size: '2.0GB' },
    };
  }, []);

  const discosList = [
    { id: 'ikedc', name: 'Ikeja Electric (IKEDC)', code: 'IKEDC' },
    { id: 'ekedc', name: 'Eko Electric (EKEDC)', code: 'EKEDC' },
    { id: 'ibedc', name: 'Ibadan Electric (IBEDC)', code: 'IBEDC' },
    { id: 'aedc', name: 'Abuja Electric (AEDC)', code: 'AEDC' },
    { id: 'eedc', name: 'Enugu Electric (EEDC)', code: 'EEDC' },
    { id: 'kedco', name: 'Kano Electric (KEDCO)', code: 'KEDCO' },
    { id: 'phed', name: 'Port Harcourt (PHED)', code: 'PHED' },
  ];

  const cableBouquets = {
    GOTV: [
      { id: 'gotv_smallie', name: 'GOtv Smallie - ₦1,575', amount: 1575 },
      { id: 'gotv_jinja', name: 'GOtv Jinja - ₦3,300', amount: 3300 },
      { id: 'gotv_jolli', name: 'GOtv Jolli - ₦4,850', amount: 4850 },
      { id: 'gotv_max', name: 'GOtv Max - ₦7,200', amount: 7200 },
    ],
    DSTV: [
      { id: 'dstv_padi', name: 'DStv Padi - ₦3,600', amount: 3600 },
      { id: 'dstv_yanga', name: 'DStv Yanga - ₦5,100', amount: 5100 },
      { id: 'dstv_confam', name: 'DStv Confam - ₦9,300', amount: 9300 },
      { id: 'dstv_compact', name: 'DStv Compact - ₦15,700', amount: 15700 },
    ],
    STARTIMES: [
      { id: 'startimes_nova', name: 'Startimes Nova - ₦1,700', amount: 1700 },
      { id: 'startimes_basic', name: 'Startimes Basic - ₦3,300', amount: 3300 },
      { id: 'startimes_classic', name: 'Startimes Classic - ₦5,000', amount: 5000 },
    ]
  };

  const educationPinsList = [
    { id: 'jamb_utme', name: 'JAMB UTME 2026 Registration e-PIN', amount: 7700 },
    { id: 'jamb_de', name: 'JAMB Direct Entry (DE) e-PIN', amount: 6200 },
    { id: 'waec_result', name: 'WAEC Result Checker PIN', amount: 4200 },
    { id: 'neco_token', name: 'NECO Result Token', amount: 1600 },
  ];

  // CGPA Calculator Logic
  const gradePoints = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };
  const calculatedGPA = useMemo(() => {
    let totalPoints = 0;
    let totalUnits = 0;
    calcCourses.forEach(c => {
      const u = parseFloat(c.units) || 0;
      const pts = gradePoints[c.grade] ?? 0;
      totalPoints += u * pts;
      totalUnits += u;
    });
    if (totalUnits === 0) return 0;
    return (totalPoints / totalUnits).toFixed(2);
  }, [calcCourses]);

  const classOfDegree = useMemo(() => {
    const gpa = parseFloat(calculatedGPA);
    if (gpa >= 4.5) return { label: 'First Class Honours 🏆', color: 'bg-emerald-500 text-white' };
    if (gpa >= 3.5) return { label: 'Second Class Upper (2:1) 🌟', color: 'bg-sky-600 text-white' };
    if (gpa >= 2.4) return { label: 'Second Class Lower (2:2) 👍', color: 'bg-amber-500 text-white' };
    if (gpa >= 1.5) return { label: 'Third Class', color: 'bg-orange-500 text-white' };
    return { label: 'Pass', color: 'bg-slate-500 text-white' };
  }, [calculatedGPA]);

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-20 sm:pb-8">
      {/* --- HERO BANNER & SUB-NAV CAPSULE --- */}
      <div className="bg-gradient-to-tr from-slate-950 via-indigo-950 to-slate-900 rounded-3xl p-4 sm:p-6 text-white shadow-lg border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-400/30">
                All-in-One Campus Super Hub
              </span>
              <span className="text-[11px] text-slate-400">📍 {universityName}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1 tracking-tight">
              CampusLink Mini Bank & Essentials
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Buy ultra-cheap SME data, recharge airtime with bonus, pay electricity tokens, study past questions, and find off-campus lodges.
            </p>
          </div>

          {/* Quick Wallet Summary Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-4 border border-white/15 shrink-0 flex items-center justify-between sm:flex-col sm:items-start gap-3">
            <div>
              <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider block">
                Campus Wallet Balance
              </span>
              <span className="text-xl sm:text-2xl font-black text-white">
                ₦{walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setFundModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-bold text-xs shadow-xs hover:from-sky-600 hover:to-indigo-700 active:scale-95 transition-all cursor-pointer flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Fund Wallet</span>
            </button>
          </div>
        </div>

        {/* --- MODERN TAB CAPSULE --- */}
        <div className="mt-5 grid grid-cols-4 gap-1 sm:gap-2 p-1 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
          {[
            { id: 'bank', icon: Wallet, label: 'Mini Bank & Bills' },
            { id: 'academics', icon: BookOpen, label: 'Academic Vault' },
            { id: 'lodges', icon: Building2, label: 'Campus Lodges' },
            { id: 'notices', icon: Sparkles, label: 'Notices & Claims' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = hubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setHubTab(tab.id)}
                className={`py-2 px-1 sm:px-3 rounded-xl font-extrabold text-[10px] sm:text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer truncate ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-md scale-101'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: MINI BANK & VTU PLUG */}
      {/* ========================================================= */}
      {hubTab === 'bank' && (
        <div className="space-y-4">
          {/* VTU Services Selector Bar */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-3 sm:p-4 shadow-xs">
            <div className="flex items-center space-x-2 overflow-x-auto scrollbar-none pb-1">
              {[
                { id: 'data', icon: Wifi, label: 'Cheapest Data', tag: 'From ₦150' },
                { id: 'airtime', icon: Smartphone, label: 'Airtime', tag: 'Up to 3.5% Off' },
                { id: 'electricity', icon: Zap, label: 'Electricity Token', tag: 'All DisCos' },
                { id: 'cable', icon: Tv, label: 'Cable TV', tag: 'DStv / GOtv' },
                { id: 'education', icon: GraduationCap, label: 'Exam PINs', tag: 'JAMB / WAEC' },
              ].map((serv) => {
                const Icon = serv.icon;
                const isSelected = vtuCategory === serv.id;
                return (
                  <button
                    key={serv.id}
                    type="button"
                    onClick={() => setVtuCategory(serv.id)}
                    className={`shrink-0 py-2 px-3.5 rounded-2xl flex items-center space-x-2 font-bold text-xs transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-sky-400' : 'text-slate-500'}`} />
                    <span>{serv.label}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-extrabold ${isSelected ? 'bg-sky-500/30 text-sky-200' : 'bg-slate-200 text-slate-700'}`}>
                      {serv.tag}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Service Form Container */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              {/* --- 1. DATA VENDING --- */}
              {vtuCategory === 'data' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                      Select Network Provider
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {['MTN', 'AIRTEL', 'GLO', '9MOBILE'].map((net) => (
                        <button
                          key={net}
                          type="button"
                          onClick={() => {
                            setSelectedNetwork(net);
                            if (net === 'MTN') setSelectedDataPlan('mtn_sme_1gb');
                            else if (net === 'AIRTEL') setSelectedDataPlan('airtel_cg_1gb');
                            else if (net === 'GLO') setSelectedDataPlan('glo_cg_1gb');
                            else setSelectedDataPlan('9mobile_cg_1gb');
                          }}
                          className={`py-2 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer text-center ${
                            selectedNetwork === net
                              ? 'bg-sky-50 border-sky-500 text-sky-900 ring-2 ring-sky-200'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {net}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Data Packages Grid */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                      Choose {selectedNetwork} Data Bundle
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.values(dataPlansMap)
                        .filter(p => p.id.startsWith(selectedNetwork.toLowerCase()))
                        .map((plan) => (
                          <div
                            key={plan.id}
                            onClick={() => setSelectedDataPlan(plan.id)}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer relative ${
                              selectedDataPlan === plan.id
                                ? 'bg-sky-500/10 border-sky-500 ring-2 ring-sky-300'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            {plan.badge && (
                              <span className="absolute top-2 right-2 text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500 text-white">
                                {plan.badge}
                              </span>
                            )}
                            <span className="text-base font-black text-slate-900 block">
                              {plan.size}
                            </span>
                            <span className="text-xs font-extrabold text-sky-600 block mt-0.5">
                              ₦{plan.amount.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              30 Days Validity
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Recipient Phone */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Recipient Phone Number
                      </label>
                      {currentUser?.phone_number && (
                        <button
                          type="button"
                          onClick={() => setRecipientPhone(currentUser.phone_number)}
                          className="text-[10px] text-sky-600 font-bold hover:underline cursor-pointer"
                        >
                          Use My Phone ({currentUser.phone_number})
                        </button>
                      )}
                    </div>
                    <input
                      type="tel"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder="e.g. 08012345678"
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-bold text-slate-900"
                    />
                  </div>

                  {/* Buy Button */}
                  <button
                    type="button"
                    onClick={handlePurchaseVTU}
                    disabled={isProcessingPurchase}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-extrabold text-sm shadow-md hover:from-sky-700 hover:to-indigo-700 active:scale-98 transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    {isProcessingPurchase ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Wifi className="w-4 h-4" />
                        <span>
                          Purchase {dataPlansMap[selectedDataPlan]?.size || 'Data'} for ₦{dataPlansMap[selectedDataPlan]?.amount || 0}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* --- 2. AIRTIME RECHARGE --- */}
              {vtuCategory === 'airtime' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                      Select Network Provider (Instant Bonus / Discount)
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { name: 'MTN', bonus: '2% Off' },
                        { name: 'AIRTEL', bonus: '2% Off' },
                        { name: 'GLO', bonus: '3% Off' },
                        { name: '9MOBILE', bonus: '3.5% Off' }
                      ].map((net) => (
                        <button
                          key={net.name}
                          type="button"
                          onClick={() => setSelectedNetwork(net.name)}
                          className={`py-2 px-1 rounded-xl text-center border transition-all cursor-pointer ${
                            selectedNetwork === net.name
                              ? 'bg-sky-50 border-sky-500 text-sky-900 ring-2 ring-sky-200'
                              : 'border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          <span className="font-black text-xs block">{net.name}</span>
                          <span className="text-[9px] text-emerald-600 font-bold block">{net.bonus}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Recipient Phone */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Recipient Phone Number
                      </label>
                      {currentUser?.phone_number && (
                        <button
                          type="button"
                          onClick={() => setRecipientPhone(currentUser.phone_number)}
                          className="text-[10px] text-sky-600 font-bold hover:underline cursor-pointer"
                        >
                          Use My Phone ({currentUser.phone_number})
                        </button>
                      )}
                    </div>
                    <input
                      type="tel"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder="e.g. 08012345678"
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-bold text-slate-900"
                    />
                  </div>

                  {/* Amount Buttons & Input */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                      Recharge Amount (₦)
                    </label>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {['100', '200', '500', '1000'].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setAirtimeAmount(amt)}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            airtimeAmount === amt
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          ₦{parseInt(amt).toLocaleString()}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      value={airtimeAmount}
                      onChange={(e) => setAirtimeAmount(e.target.value)}
                      placeholder="Or enter custom amount (e.g. 750)"
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-bold text-slate-900"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handlePurchaseVTU}
                    disabled={isProcessingPurchase}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-extrabold text-sm shadow-md hover:from-emerald-700 hover:to-teal-700 active:scale-98 transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    {isProcessingPurchase ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Smartphone className="w-4 h-4" />
                        <span>Recharge ₦{parseInt(airtimeAmount || '0').toLocaleString()} Airtime</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* --- 3. ELECTRICITY TOKENS --- */}
              {vtuCategory === 'electricity' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                      Select Electricity Distribution Company (DisCo)
                    </label>
                    <select
                      value={selectedDisco}
                      onChange={(e) => setSelectedDisco(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-bold text-slate-900 bg-white"
                    >
                      {discosList.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Meter Type */}
                  <div className="grid grid-cols-2 gap-2">
                    {['prepaid', 'postpaid'].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMeterType(m)}
                        className={`py-2 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer ${
                          meterType === m
                            ? 'bg-sky-500/10 border-sky-500 text-sky-900 ring-2 ring-sky-200'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        {m} Meter
                      </button>
                    ))}
                  </div>

                  {/* Meter Number */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Meter Number / Account Number
                    </label>
                    <input
                      type="text"
                      value={meterNumber}
                      onChange={(e) => setMeterNumber(e.target.value)}
                      placeholder="e.g. 04238910452"
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-bold text-slate-900"
                    />
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Recharge Amount (₦)
                    </label>
                    <input
                      type="number"
                      value={electricityAmount}
                      onChange={(e) => setElectricityAmount(e.target.value)}
                      placeholder="Minimum ₦500"
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-bold text-slate-900"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handlePurchaseVTU}
                    disabled={isProcessingPurchase}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-extrabold text-sm shadow-md hover:from-amber-600 hover:to-orange-700 active:scale-98 transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    {isProcessingPurchase ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        <span>Generate Instant Prepaid Token (₦{parseInt(electricityAmount || '0').toLocaleString()})</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* --- 4. CABLE TV --- */}
              {vtuCategory === 'cable' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {['GOTV', 'DSTV', 'STARTIMES'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setSelectedCable(c);
                          setSelectedBouquet(cableBouquets[c]?.[0]?.id || '');
                        }}
                        className={`py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                          selectedCable === c
                            ? 'bg-sky-50 border-sky-500 text-sky-900 ring-2 ring-sky-200'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>

                  {/* Bouquets */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Choose Bouquet / Package
                    </label>
                    <select
                      value={selectedBouquet}
                      onChange={(e) => setSelectedBouquet(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-bold text-slate-900 bg-white"
                    >
                      {cableBouquets[selectedCable]?.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Smartcard */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Smartcard / IUC Number
                    </label>
                    <input
                      type="text"
                      value={smartcardNumber}
                      onChange={(e) => setSmartcardNumber(e.target.value)}
                      placeholder="e.g. 7029384812"
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-bold text-slate-900"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handlePurchaseVTU}
                    disabled={isProcessingPurchase}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold text-sm shadow-md hover:from-purple-700 hover:to-indigo-700 active:scale-98 transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <Tv className="w-4 h-4" />
                    <span>Renew Cable TV Subscription</span>
                  </button>
                </div>
              )}

              {/* --- 5. EXAM & EDUCATION PINS --- */}
              {vtuCategory === 'education' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                      Select Education Token or Registration e-PIN
                    </label>
                    <div className="space-y-2">
                      {educationPinsList.map((pin) => (
                        <div
                          key={pin.id}
                          onClick={() => setSelectedPinType(pin.id)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            selectedPinType === pin.id
                              ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-200'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div>
                            <span className="font-extrabold text-xs text-slate-900 block">{pin.name}</span>
                            <span className="text-[10px] text-slate-500">Official Portal Verified Token</span>
                          </div>
                          <span className="font-black text-sm text-sky-600">
                            ₦{pin.amount.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Candidate Profile Code / Phone Number
                    </label>
                    <input
                      type="text"
                      value={educationProfileCode}
                      onChange={(e) => setEducationProfileCode(e.target.value)}
                      placeholder="e.g. 10-digit JAMB Profile Code or Phone"
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-bold text-slate-900"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handlePurchaseVTU}
                    disabled={isProcessingPurchase}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-extrabold text-sm shadow-md hover:from-sky-700 hover:to-indigo-700 active:scale-98 transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Purchase Official Exam PIN</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Recent Mini Bank Transactions List */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-sky-600" />
                <span>Recent Mini Bank Activities</span>
              </h3>
              <button
                type="button"
                onClick={fetchTransactions}
                className="text-[10px] text-slate-500 hover:text-sky-600 font-bold flex items-center space-x-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>

            {transactions.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <Wallet className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-semibold">No transactions yet.</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Top up your wallet or buy cheap SME data above!</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {transactions.slice(0, 8).map((tx) => (
                  <div
                    key={tx.id || tx.reference}
                    onClick={() => {
                      setCurrentReceipt(tx);
                      setReceiptModalOpen(true);
                    }}
                    className="py-3 flex items-center justify-between hover:bg-slate-50/80 px-2 rounded-xl transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        tx.service_category === 'deposit'
                          ? 'bg-emerald-100 text-emerald-700'
                          : tx.service_category === 'data'
                          ? 'bg-sky-100 text-sky-700'
                          : tx.service_category === 'electricity'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {tx.service_category === 'deposit' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <span className="font-extrabold text-xs text-slate-900 truncate block">
                          {tx.package_name || tx.service_category}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {tx.recipient_phone_or_meter} • {tx.created_at ? new Date(tx.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-xs font-black block ${tx.service_category === 'deposit' ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {tx.service_category === 'deposit' ? '+' : '-'}₦{tx.amount.toLocaleString()}
                      </span>
                      <span className="text-[9px] font-bold text-sky-600">View Receipt</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: ACADEMIC VAULT (PAST QUESTIONS & CGPA CALCULATOR) */}
      {/* ========================================================= */}
      {hubTab === 'academics' && (
        <div className="space-y-4">
          {/* CGPA Calculator Card */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center space-x-2">
                  <Calculator className="w-4 h-4 text-sky-600" />
                  <span>Interactive 5.0 CGPA & GPA Predictor</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Calculate your current semester GPA and project target grades for graduation honours.
                </p>
              </div>

              {/* GPA Badge */}
              <div className="flex items-center space-x-2 shrink-0">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold block">Current GPA</span>
                  <span className="text-xl font-black text-slate-900">{calculatedGPA} / 5.0</span>
                </div>
                <span className={`px-2.5 py-1 rounded-xl text-xs font-extrabold shadow-2xs ${classOfDegree.color}`}>
                  {classOfDegree.label}
                </span>
              </div>
            </div>

            {/* Course Rows */}
            <div className="space-y-2 mb-3">
              {calcCourses.map((c, idx) => (
                <div key={c.id} className="flex items-center space-x-2 bg-slate-50 p-2 rounded-2xl border border-slate-100 text-xs">
                  <input
                    type="text"
                    value={c.code}
                    onChange={(e) => {
                      const updated = [...calcCourses];
                      updated[idx].code = e.target.value;
                      setCalcCourses(updated);
                    }}
                    placeholder="Course Code"
                    className="w-24 sm:w-28 px-2 py-1.5 rounded-xl border border-slate-200 font-extrabold text-slate-900 bg-white"
                  />
                  <div className="flex items-center space-x-1">
                    <span className="text-[10px] font-bold text-slate-400">Units:</span>
                    <select
                      value={c.units}
                      onChange={(e) => {
                        const updated = [...calcCourses];
                        updated[idx].units = parseInt(e.target.value);
                        setCalcCourses(updated);
                      }}
                      className="px-2 py-1.5 rounded-xl border border-slate-200 font-bold text-slate-900 bg-white"
                    >
                      {[1, 2, 3, 4, 5, 6].map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-[10px] font-bold text-slate-400">Grade:</span>
                    <select
                      value={c.grade}
                      onChange={(e) => {
                        const updated = [...calcCourses];
                        updated[idx].grade = e.target.value;
                        setCalcCourses(updated);
                      }}
                      className="px-2 py-1.5 rounded-xl border border-slate-200 font-bold text-slate-900 bg-white"
                    >
                      {Object.keys(gradePoints).map(g => (
                        <option key={g} value={g}>{g} ({gradePoints[g]} pts)</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCalcCourses(calcCourses.filter(item => item.id !== c.id))}
                    className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 ml-auto cursor-pointer"
                    title="Remove course"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setCalcCourses([...calcCourses, { id: Date.now(), code: '', units: 2, grade: 'A' }])}
                className="py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center space-x-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Course</span>
              </button>
              <button
                type="button"
                onClick={() => setCalcCourses([
                  { id: 1, code: 'GST 111', units: 2, grade: 'A' },
                  { id: 2, code: 'MTH 101', units: 3, grade: 'A' }
                ])}
                className="py-1.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs transition-colors cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Past Questions Vault */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-sky-600" />
                  <span>Departmental Past Questions & Exam Handouts</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Verified examination papers and revision questions by level and course.
                </p>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={academicSearch}
                  onChange={(e) => setAcademicSearch(e.target.value)}
                  placeholder="Search course e.g. MTH 101..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Questions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {pastQuestions
                .filter(pq => {
                  if (!academicSearch.trim()) return true;
                  const term = academicSearch.toLowerCase();
                  return pq.course_code.toLowerCase().includes(term) || pq.course_title.toLowerCase().includes(term);
                })
                .map((pq) => (
                  <div
                    key={pq.id}
                    onClick={() => setViewPqModal(pq)}
                    className="p-3.5 rounded-2xl border border-slate-200/90 hover:border-sky-400 hover:shadow-xs transition-all cursor-pointer bg-slate-50/50 hover:bg-white"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-sky-100 text-sky-800">
                        {pq.course_code}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {pq.level} • {pq.semester}
                      </span>
                    </div>
                    <h4 className="font-bold text-xs text-slate-900 line-clamp-1">
                      {pq.course_title}
                    </h4>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Dept: {pq.department} ({pq.faculty})
                    </span>

                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400">
                      <span>📥 {pq.downloads_count || 120} reads</span>
                      <span className="text-sky-600 font-extrabold flex items-center space-x-0.5">
                        <span>Read Paper</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: CAMPUS LODGES & ROOMMATE FINDER */}
      {/* ========================================================= */}
      {hubTab === 'lodges' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-sky-600" />
                  <span>Off-Campus Lodges & Roommate Matcher</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Verified student hostels, direct caretaker contacts, and shared rooms near campus.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPostLodgeModalOpen(true)}
                className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Post Lodge / Bed Space</span>
              </button>
            </div>

            {/* Lodge Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {lodges.map((lodge) => (
                <div
                  key={lodge.id}
                  className="rounded-2xl border border-slate-200/90 overflow-hidden bg-white shadow-2xs hover:shadow-xs transition-all"
                >
                  <div className="aspect-[16/9] w-full bg-slate-100 relative overflow-hidden">
                    <SafeImage
                      src={lodge.image_url}
                      alt={lodge.title}
                      fallbackType="general"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-black/60 text-white backdrop-blur-xs">
                      {lodge.room_type}
                    </span>
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-xl text-xs font-black bg-emerald-600 text-white shadow-sm">
                      ₦{lodge.price_per_year.toLocaleString()}/yr
                    </span>
                  </div>

                  <div className="p-3.5 space-y-1.5">
                    <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 line-clamp-1">
                      {lodge.lodge_name}
                    </h4>
                    <p className="text-[11px] text-slate-500 flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-sky-500 shrink-0" />
                      <span className="truncate">{lodge.location}</span>
                    </p>
                    {lodge.amenities && (
                      <p className="text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-100 line-clamp-1">
                        ✨ {lodge.amenities}
                      </p>
                    )}

                    <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                      <span className="text-[10px] font-semibold text-slate-400">Direct Contact:</span>
                      <a
                        href={`tel:${lodge.contact_phone}`}
                        className="py-1 px-2.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs flex items-center space-x-1 transition-colors"
                      >
                        <Phone className="w-3 h-3" />
                        <span>Call {lodge.contact_phone}</span>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: NOTICES & LOST/FOUND */}
      {/* ========================================================= */}
      {hubTab === 'notices' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-sky-600" />
                  <span>Campus Notices & Lost / Found Hub</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Report misplaced student ID cards, phones, books, or claim found items.
                </p>
              </div>

              {onOpenReportNoticeModal && (
                <button
                  type="button"
                  onClick={onOpenReportNoticeModal}
                  className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Report Notice / Item</span>
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center space-x-2 mb-3">
              {[
                { id: 'all', label: 'All Items' },
                { id: 'lost', label: 'Lost Items' },
                { id: 'found', label: 'Found Items' },
                { id: 'announcement', label: 'Announcements' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setNoticeFilter(f.id)}
                  className={`py-1 px-3 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                    noticeFilter === f.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Notices List */}
            {notices.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p className="text-xs font-semibold">No campus notices or lost items reported yet.</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Found or lost something? Tap 'Report Notice / Item' above.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {notices
                  .filter(n => noticeFilter === 'all' || n.type === noticeFilter)
                  .map((n) => (
                    <div
                      key={n.id}
                      className="p-3.5 rounded-2xl border border-slate-200/90 bg-white hover:border-slate-300 transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          n.type === 'lost' ? 'bg-rose-100 text-rose-800' : n.type === 'found' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                        }`}>
                          {n.type === 'lost' ? 'Lost Item' : n.type === 'found' ? 'Found Property' : 'Announcement'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {n.date_lost_or_found || 'Recent'}
                        </span>
                      </div>

                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1">
                        {n.title}
                      </h4>
                      <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                        {n.description}
                      </p>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                        <span className="flex items-center space-x-1">
                          <MapPin className="w-3 h-3 text-sky-500" />
                          <span className="truncate">{n.location}</span>
                        </span>
                        {n.contact_phone && (
                          <a href={`tel:${n.contact_phone}`} className="font-bold text-sky-600 hover:underline">
                            Contact
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* FUND WALLET MODAL */}
      {/* ========================================================= */}
      <AnimatePresence>
        {fundModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFundModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 z-10 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center space-x-1.5">
                  <Wallet className="w-4 h-4 text-sky-600" />
                  <span>Top Up CampusLink Wallet</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setFundModalOpen(false)}
                  className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Select Quick Top-Up Amount (₦)
                </label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {['500', '1000', '2000', '5000', '10000'].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setFundAmount(amt)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        fundAmount === amt
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      ₦{parseInt(amt).toLocaleString()}
                    </button>
                  ))}
                </div>

                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Or Custom Amount (₦)
                </label>
                <input
                  type="number"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  placeholder="Min ₦100"
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-bold text-slate-900"
                />
              </div>

              <div className="p-3 rounded-2xl bg-sky-50 text-sky-900 text-[11px] font-medium leading-relaxed">
                💡 Instant processing. In demonstration mode, funds are credited immediately to your balance.
              </div>

              <button
                type="button"
                onClick={handleFundWallet}
                disabled={isFunding}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-extrabold text-sm shadow-md hover:from-sky-700 hover:to-indigo-700 active:scale-98 transition-all cursor-pointer flex items-center justify-center space-x-2"
              >
                {isFunding ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Deposit ₦{parseInt(fundAmount || '0').toLocaleString()} to Wallet</span>
                )}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* TRANSACTION RECEIPT MODAL */}
      {/* ========================================================= */}
      <AnimatePresence>
        {receiptModalOpen && currentReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReceiptModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 z-10 space-y-4 text-slate-900"
            >
              {/* Receipt Header */}
              <div className="text-center pb-3 border-b border-dashed border-slate-200">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-base text-slate-900">
                  CampusLink Transaction Receipt
                </h3>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Reference: {currentReceipt.reference}
                </span>
              </div>

              {/* Electricity Token or Exam PIN Display */}
              {currentReceipt.token_or_pin && (
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-center space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">
                    {currentReceipt.service_category === 'electricity' ? 'Prepaid Meter Token' : 'Official PIN / Token'}
                  </span>
                  <span className="text-base sm:text-lg font-mono font-black text-amber-950 tracking-wider select-all block">
                    {currentReceipt.token_or_pin}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(currentReceipt.token_or_pin);
                      setCopiedToken(true);
                      setTimeout(() => setCopiedToken(false), 2000);
                    }}
                    className="text-[10px] font-bold text-amber-700 hover:text-amber-900 inline-flex items-center space-x-1 cursor-pointer pt-1"
                  >
                    {copiedToken ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedToken ? 'Copied Token!' : 'Copy Token'}</span>
                  </button>
                </div>
              )}

              {/* Receipt Details Breakdown */}
              <div className="space-y-2 text-xs divide-y divide-slate-100">
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Service:</span>
                  <span className="font-bold text-slate-900">{currentReceipt.package_name || currentReceipt.service_category}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Recipient:</span>
                  <span className="font-bold text-slate-900">{currentReceipt.recipient || currentReceipt.recipient_phone_or_meter}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Amount Paid:</span>
                  <span className="font-black text-slate-900">₦{parseFloat(currentReceipt.amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Status:</span>
                  <span className="font-black text-emerald-600 uppercase text-[10px]">Successful</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setReceiptModalOpen(false)}
                className="w-full py-2.5 rounded-2xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close Receipt
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* PAST QUESTION PREVIEW MODAL */}
      {/* ========================================================= */}
      <AnimatePresence>
        {viewPqModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewPqModal(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 z-10 space-y-4 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[10px] font-black uppercase">
                    {viewPqModal.course_code}
                  </span>
                  <h3 className="font-extrabold text-sm text-slate-900 mt-1">
                    {viewPqModal.course_title}
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    {viewPqModal.department} • {viewPqModal.level} • {viewPqModal.exam_year}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setViewPqModal(null)}
                  className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 space-y-3 text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-2xl border border-slate-100 font-mono">
                {viewPqModal.content_text || 'Official question paper preview available.'}
              </div>

              <button
                type="button"
                onClick={() => {
                  alert('Past Question text copied to clipboard for revision!');
                  navigator.clipboard.writeText(viewPqModal.content_text || viewPqModal.course_title);
                }}
                className="w-full py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center justify-center space-x-1 transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Questions to Revision Notes</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* POST LODGE MODAL */}
      {/* ========================================================= */}
      <AnimatePresence>
        {postLodgeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPostLodgeModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 z-10 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center space-x-1.5">
                  <Building2 className="w-4 h-4 text-sky-600" />
                  <span>List Off-Campus Lodge or Bed Space</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setPostLodgeModalOpen(false)}
                  className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="font-bold text-slate-600 block mb-0.5">Lodge / Villa Name</label>
                  <input
                    type="text"
                    value={newLodge.lodge_name}
                    onChange={(e) => setNewLodge({ ...newLodge, lodge_name: e.target.value })}
                    placeholder="e.g. Royal Palms Lodge"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-600 block mb-0.5">Location near Campus</label>
                  <input
                    type="text"
                    value={newLodge.location}
                    onChange={(e) => setNewLodge({ ...newLodge, location: e.target.value })}
                    placeholder="e.g. Behind Main Campus Gate (3 mins walk)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-600 block mb-0.5">Annual Rent (₦)</label>
                    <input
                      type="number"
                      value={newLodge.price_per_year}
                      onChange={(e) => setNewLodge({ ...newLodge, price_per_year: e.target.value })}
                      placeholder="e.g. 160000"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block mb-0.5">Room Type</label>
                    <select
                      value={newLodge.room_type}
                      onChange={(e) => setNewLodge({ ...newLodge, room_type: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-900 bg-white"
                    >
                      <option value="Self-contained">Self-contained</option>
                      <option value="Single Room">Single Room</option>
                      <option value="2-Bedroom Flat">2-Bedroom Flat</option>
                      <option value="Bed Space">Shared Bed Space</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-600 block mb-0.5">Caretaker / Agent Contact Phone</label>
                  <input
                    type="tel"
                    value={newLodge.contact_phone}
                    onChange={(e) => setNewLodge({ ...newLodge, contact_phone: e.target.value })}
                    placeholder="e.g. 08031234567"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-900"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  if (!newLodge.lodge_name || !newLodge.price_per_year || !newLodge.contact_phone) {
                    alert('Please fill out all required lodge details.');
                    return;
                  }
                  try {
                    const res = await API.post('/campus/lodges', {
                      ...newLodge,
                      title: `${newLodge.room_type} at ${newLodge.lodge_name}`,
                      price_per_year: parseFloat(newLodge.price_per_year)
                    });
                    if (res.data) {
                      setLodges([res.data, ...lodges]);
                      setPostLodgeModalOpen(false);
                      alert('🎉 Lodge listing published successfully!');
                    }
                  } catch {
                    alert('Failed to post lodge.');
                  }
                }}
                className="w-full py-2.5 rounded-2xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Publish Listing
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
