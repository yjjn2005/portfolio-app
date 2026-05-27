import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, List, Settings,
  Plus, RefreshCw, Download, Upload, X, Search, ChevronUp, ChevronDown,
  Wallet, Building2, Trash2, Zap, Cloud, CheckCircle2, AlertCircle, TrendingUp, TrendingDown,
  Activity, PieChart, ArrowUpRight, BarChart3, Coins, Percent, RefreshCcw, FileText, Camera, Key, User, Smartphone,
  Sparkles, ChevronRight, Globe,
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';

// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
//  ì¬ì©ì ì¤ì  ë¡ë (src/user-config.js)
// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
import { USER_CONFIG } from './user-config.js';

const {
  appUserId,
  ownerName: CONFIG_OWNER,
  defaultRates: CONFIG_RATES,
  brokers: CONFIG_BROKERS,
  accountTypes: CONFIG_ACCOUNTS,
  initialStocks: INITIAL_STOCKS,
} = USER_CONFIG;

// ë¡ì»¬ì¤í ë¦¬ì§ í¤ (ì¬ì©ìë³ ë¶ë¦¬)
const LS_KEY        = `portfolio_v4_${appUserId}`;
const LS_OWNER_KEY  = `portfolio_owner_${appUserId}`;
const LS_SETUP_KEY  = `portfolio_setup_done_${appUserId}`;
const LS_GEMINI_KEY = `portfolio_gemini_${appUserId}`;

// Firebase ì»¬ë ì ì´ë¦ (ì¬ì©ìë³ ë¶ë¦¬)
const FB_STOCKS_COL   = `stocks_${appUserId}`;
const FB_SETTINGS_DOC = `settings_${appUserId}`;

// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
//  Firebase ì´ê¸°í (index.html ì __FIREBASE_CONFIG__ ì¬ì©)
// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const firebaseConfig = (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__) || {};
const fbApp  = Object.keys(firebaseConfig).length > 0 && firebaseConfig.apiKey
  ? initializeApp(firebaseConfig) : null;
const auth = fbApp ? getAuth(fbApp) : null;
const db   = fbApp ? getFirestore(fbApp) : null;
const FB_APP_ID = firebaseConfig.appId || 'default';

// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
//  ì í¸ í¨ì
// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const comma  = (n) => Math.round(n || 0).toLocaleString('ko-KR');
const fmtW   = (n) => { const abs=Math.abs(n||0),sg=n<0?'-':''; if(abs>=1e8) return `${sg}${(abs/1e8).toFixed(2)}ìµ`; if(abs>=1e4) return `${sg}${Math.round(abs/1e4).toLocaleString()}ë§`; return `${sg}${Math.round(abs).toLocaleString()}`; };
const fmtP   = (n) => `${n>=0?'+':''}${(n||0).toFixed(2)}%`;
const getRate = (cur,rates) => cur==='USD'?rates.USDKRW : cur==='JPY'?rates.JPYKRW : cur==='HKD'?rates.HKDKRW : 1;

const colorPos = 'text-[#FF3D00]';
const colorNeg = 'text-[#2979FF]';
const colorNeu = 'text-slate-400';
const pnlColor = (n) => n>0?colorPos : n<0?colorNeg : colorNeu;
const pnlBg    = (n) => n>0?'bg-[#FF3D00]/10 text-[#FF3D00]' : n<0?'bg-[#2979FF]/10 text-[#2979FF]' : 'bg-slate-800 text-slate-300';
const pnlSign  = (n) => n>0?'+':'';

const getMetrics = (s, prices, rates) => {
  let priceKRW = s.base;
  if (s.yt && s.sh > 0 && prices[s.yt]) {
    priceKRW = Math.round(prices[s.yt] * getRate(s.cur, rates));
  } else if (s.cur === 'USD') {
    priceKRW = Math.round(s.base * getRate(s.cur, rates));
  }
  if (!s.yt || s.sh === 0) {
    const val = priceKRW, pnl = val - s.inv, ret = s.inv > 0 ? (pnl/s.inv)*100 : 0;
    return { priceKRW, val, pnl, ret };
  }
  const val = priceKRW * s.sh, pnl = val - s.inv, ret = s.inv > 0 ? (pnl/s.inv)*100 : 0;
  return { priceKRW, val, pnl, ret };
};

const getTotals = (arr, prices, rates) =>
  arr.reduce((a,s) => { const m=getMetrics(s,prices,rates); return {inv:a.inv+s.inv,val:a.val+m.val,pnl:a.pnl+m.pnl}; }, {inv:0,val:0,pnl:0});

// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
//  ë±ì§ ì»´í¬ëí¸
// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const Badge = ({ type }) => {
  const colors = {
    'êµ­ë´ì£¼ì':'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
    'êµ­ë´ETF':'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    'ë¯¸êµ­ì£¼ì':'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    'ë¯¸êµ­ETF':'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    'ISA':'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
    'ìí':'bg-slate-700/30 text-slate-300 border border-slate-700/40',
    'í´ì¸ìí':'bg-rose-500/10 text-rose-400 border border-rose-500/20',
    'ìê¸/íê¸':'bg-slate-700/50 text-slate-400 border border-slate-700/40',
    'ì°ê¸':'bg-pink-500/10 text-pink-400 border border-pink-500/20',
    'IRP':'bg-sky-500/10 text-sky-400 border border-sky-500/20',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wide whitespace-nowrap ${colors[type]||'bg-slate-800 text-slate-400'}`}>
      {type}
    </span>
  );
};

// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
//  ð ì¨ë³´ë© ììë (ì²« ì¤í ì íì)
// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const OnboardingWizard = ({ onComplete, configOwner }) => {
  const [step, setStep]     = useState(1);
  const [name, setName]     = useState(configOwner || '');
  const [useDemo, setUseDemo] = useState(true);

  const finish = () => {
    localStorage.setItem(LS_OWNER_KEY, name || configOwner);
    localStorage.setItem(LS_SETUP_KEY, '1');
    onComplete(name || configOwner, useDemo);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0B0F19]">
      {/* ë°°ê²½ ë¹ í¨ê³¼ */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md mx-4 bg-[#121B2E] border border-slate-700/80 rounded-3xl p-8 shadow-2xl">
        {/* ì§í ì  */}
        <div className="flex justify-center gap-2 mb-8">
          {[1,2,3].map(i => (
            <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i===step?'w-8 bg-blue-500':i<step?'w-2 bg-emerald-500':'w-2 bg-slate-700'}`}/>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 mx-auto">
              <Sparkles className="text-blue-400" size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white mb-2">Portfolio Proì ì¤ì  ê±¸ íìí©ëë¤</h2>
              <p className="text-slate-400 text-sm">ì²« ì¤í ì¤ì ì ëìëë¦´ê²ì. ë± 1ë¶ì´ë©´ ë©ëë¤.</p>
            </div>
            <button onClick={() => setStep(2)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2">
              ììíê¸° <ChevronRight size={18}/>
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-white mb-1 flex items-center gap-2">
                <User className="text-emerald-400" size={22}/> ìì ì ì´ë¦ ì¤ì 
              </h2>
              <p className="text-slate-400 text-sm">ëìë³´ëì íìë  ì´ë¦ì ìë ¥íì¸ì.</p>
            </div>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="ì: íê¸¸ë"
              className="w-full bg-[#0B0F19] border border-slate-700 text-white rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none text-base"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all">ì´ì </button>
              <button onClick={() => setStep(3)} disabled={!name.trim()} className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2">
                ë¤ì <ChevronRight size={18}/>
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-white mb-1 flex items-center gap-2">
                <BarChart3 className="text-purple-400" size={22}/> ì´ê¸° ë°ì´í° ì í
              </h2>
              <p className="text-slate-400 text-sm">ì´ë»ê² ììíìê² ì´ì?</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => setUseDemo(true)}
                className={`w-full p-4 rounded-xl border text-left transition-all ${useDemo?'border-blue-500 bg-blue-500/10':'border-slate-700 bg-slate-800/30 hover:border-slate-500'}`}
              >
                <div className="font-bold text-white mb-0.5 flex items-center gap-2"><CheckCircle2 size={16} className="text-blue-400"/> ë°ëª¨ ë°ì´í°ë¡ ìì</div>
                <p className="text-xs text-slate-400">ì í´ì¸ í¬í¸í´ë¦¬ì¤ ìí ë°ì´í°ê° ë¯¸ë¦¬ ì±ìì§ëë¤. (ì´í ìì /ì­ì  ê°ë¥)</p>
              </button>
              <button
                onClick={() => setUseDemo(false)}
                className={`w-full p-4 rounded-xl border text-left transition-all ${!useDemo?'border-emerald-500 bg-emerald-500/10':'border-slate-700 bg-slate-800/30 hover:border-slate-500'}`}
              >
                <div className="font-bold text-white mb-0.5 flex items-center gap-2"><Plus size={16} className="text-emerald-400"/> ë¹ í¬í¸í´ë¦¬ì¤ë¡ ìì</div>
                <p className="text-xs text-slate-400">ìë¬´ ë°ì´í°ë ìì´ ê¹¨ëíê² ì§ì  ìë ¥í©ëë¤.</p>
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all">ì´ì </button>
              <button onClick={finish} className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2">
                <CheckCircle2 size={18}/> ìì!
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
//  ëìë³´ë ë·°
// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const DashboardView = ({ stocks, prices, rates, setTab, setFilterBroker, setFilterAcct, ownerName }) => {
  const all = getTotals(stocks, prices, rates);
  const ret = all.inv > 0 ? (all.pnl / all.inv) * 100 : 0;

  const ACCT_COLORS = {
    'ìí':  ['bg-blue-500/10 text-blue-400 border border-blue-500/20',    'bg-blue-500'],
    'ISA':   ['bg-emerald-500/10 text-emerald-400 border border-emerald-500/20','bg-emerald-400'],
    'í´ì¸ìí':['bg-rose-500/10 text-rose-400 border border-rose-500/20',   'bg-rose-500'],
    'ì°ê¸':  ['bg-pink-500/10 text-pink-400 border border-pink-500/20',     'bg-pink-500'],
    'IRP':   ['bg-sky-500/10 text-sky-400 border border-sky-500/20',        'bg-sky-400'],
  };
  const BR_COLORS = {
    'ë¯¸ëììì¦ê¶':['bg-orange-500/10 text-orange-400 border border-orange-500/20','bg-orange-500'],
    'ì¼ì±ì¦ê¶':   ['bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',  'bg-indigo-500'],
    'íêµ­í¬ìì¦ê¶':['bg-blue-500/10 text-blue-400 border border-blue-500/20',        'bg-blue-400'],
  };
  const DEFAULT_COL = ['bg-slate-500/10 text-slate-300 border border-slate-700/50', 'bg-slate-500'];

  const accounts = CONFIG_ACCOUNTS.map(name => {
    const arr = stocks.filter(s => s.ac === name);
    if (!arr.length) return null;
    const t = getTotals(arr,prices,rates), r = t.inv>0?(t.pnl/t.inv)*100:0, pct = all.val>0?(t.val/all.val)*100:0;
    const [iconCol, barCol] = ACCT_COLORS[name] || DEFAULT_COL;
    return { name, count:arr.length, t, r, pct, iconCol, barCol };
  }).filter(Boolean);

  const brokers = CONFIG_BROKERS.map(name => {
    const arr = stocks.filter(s => s.br === name);
    if (!arr.length) return null;
    const t = getTotals(arr,prices,rates), r = t.inv>0?(t.pnl/t.inv)*100:0, pct = all.val>0?(t.val/all.val)*100:0;
    const [iconCol, barCol] = BR_COLORS[name] || DEFAULT_COL;
    return { name, count:arr.length, t, r, pct, iconCol, barCol };
  }).filter(Boolean);

  return (
    <div className="space-y-10 pb-12 max-w-7xl mx-auto">
      {/* íì´ë¡ ì¹ì */}
      <section className="relative overflow-hidden rounded-[2.5rem] border border-slate-800/80 bg-gradient-to-br from-[#121B2E] via-[#0F172A] to-[#0A0E1A] shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4 pointer-events-none"/>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/4 pointer-events-none"/>
        <div className="relative p-8 md:p-14">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500/10 to-blue-500/10 px-4 py-1.5 text-xs font-extrabold tracking-widest text-emerald-400 border border-emerald-500/20">
                <PieChart size={13}/> {ownerName} PREMIUM ASSETS
              </div>
              <p className="text-xs font-bold text-slate-500 tracking-wider uppercase">ì´ íê° ìê³ </p>
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white">â©{comma(all.val)}</h1>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 backdrop-blur-md border border-white/5 font-bold text-base md:text-lg ${pnlColor(all.pnl)}`}>
                {all.pnl >= 0 ? <TrendingUp size={20}/> : <TrendingDown size={20}/>}
                <span>{pnlSign(all.pnl)}â©{comma(all.pnl)}</span>
                <span className="text-slate-500/50">|</span>
                <span className="px-3 py-1 bg-white/5 rounded-xl">{fmtP(ret)}</span>
              </div>
            </div>
            <div className="w-full md:w-auto grid grid-cols-2 md:flex md:flex-col gap-4">
              <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-800/80 min-w-[200px] space-y-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ì´ ë§¤ììê¸</p>
                <p className="text-2xl font-black text-slate-100">â©{fmtW(all.inv)}</p>
              </div>
              <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-800/80 min-w-[200px] space-y-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ì´ì© ìì° ì</p>
                <p className="text-2xl font-black text-emerald-400">{stocks.length} <span className="text-sm font-semibold text-slate-400">ê° í­ëª©</span></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ì¦ê¶ì¬ / ê³ì¢ ê·¸ë¦¬ë */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* ì¦ê¶ì¬ë³ */}
        <section className="space-y-6">
          <div className="flex items-center border-l-4 border-orange-500 pl-4 py-1">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2"><Building2 size={20} className="text-orange-500"/> ì¦ê¶ì¬ë³ ë³´ì  ìê³ </h2>
              <p className="text-xs text-slate-500 font-bold mt-0.5">ê° ê¸ìµ ê¸°ê´ë³ ì¤ìê° ë¹ì¤ ë° ì´ì© ììµ</p>
            </div>
          </div>
          <div className="grid gap-4">
            {brokers.map(b => (
              <div key={b.name} onClick={() => { setFilterBroker(b.name); setTab('allstocks'); }}
                className="group cursor-pointer rounded-3xl border border-slate-800/80 bg-gradient-to-br from-[#131B2E]/60 to-[#0F172A]/80 p-6 transition-all hover:border-slate-700/80 hover:bg-[#131B2E] shadow-lg hover:shadow-xl active:scale-[0.99]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl font-black text-lg shadow-inner ${b.iconCol}`}>{b.name.charAt(0)}</div>
                    <div>
                      <h3 className="text-base font-extrabold text-white group-hover:text-orange-400 transition-colors">{b.name}</h3>
                      <p className="text-xs text-slate-500 font-bold">{b.count}ê° ì¢ëª© ë³´ì </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter mb-0.5">íê°ê¸ì¡</p>
                    <p className="text-xl font-black text-white">â©{comma(b.t.val)}</p>
                  </div>
                </div>
                <div className="flex items-end justify-between gap-6">
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
                      <span>ë¹ì¤ {b.pct.toFixed(1)}%</span>
                      <span className={pnlColor(b.r)}>{fmtP(b.r)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900/50">
                      <div className={`h-full rounded-full transition-all duration-1000 ease-out ${b.barCol}`} style={{width:`${b.pct}%`}}/>
                    </div>
                  </div>
                  <ArrowUpRight size={18} className="text-slate-700 group-hover:text-white transition-colors pb-1"/>
                </div>
              </div>
            ))}
            {brokers.length === 0 && (
              <div className="rounded-3xl border border-dashed border-slate-700 p-12 text-center text-slate-500">
                <Plus size={32} className="mx-auto mb-3 text-slate-700"/>
                <p className="text-sm font-bold">ìì§ ìì°ì´ ììµëë¤</p>
                <p className="text-xs mt-1">ì°ì¸¡ íë¨ + ë²í¼ì¼ë¡ ì¶ê°íì¸ì</p>
              </div>
            )}
          </div>
        </section>

        {/* ê³ì¢ë³ */}
        <section className="space-y-6">
          <div className="flex items-center border-l-4 border-blue-500 pl-4 py-1">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2"><Wallet size={20} className="text-blue-500"/> ê³ì¢ ì íë³ ë³´ì  ìê³ </h2>
              <p className="text-xs text-slate-500 font-bold mt-0.5">ê° ìì° ì±ê²©ë³ ìë³¸ íë¦ íí©</p>
            </div>
          </div>
          <div className="grid gap-4">
            {accounts.map(a => (
              <div key={a.name} onClick={() => { setFilterAcct(a.name); setTab('allstocks'); }}
                className="group cursor-pointer rounded-3xl border border-slate-800/80 bg-gradient-to-br from-[#131B2E]/60 to-[#0F172A]/80 p-6 transition-all hover:border-slate-700/80 hover:bg-[#131B2E] shadow-lg hover:shadow-xl active:scale-[0.99]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-inner ${a.iconCol}`}><Wallet size={20}/></div>
                    <div>
                      <h3 className="text-base font-extrabold text-white group-hover:text-blue-400 transition-colors">{a.name}</h3>
                      <p className="text-xs text-slate-500 font-bold">{a.count}ê° ìì° ì´ì©</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter mb-0.5">ëì  ììµ</p>
                    <p className={`text-xl font-black ${pnlColor(a.t.pnl)}`}>{pnlSign(a.t.pnl)}â©{comma(Math.abs(a.t.pnl))}</p>
                  </div>
                </div>
                <div className="flex items-end justify-between gap-6">
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
                      <span>ë¹ì¤ {a.pct.toFixed(1)}%</span>
                      <span className="text-white">â©{fmtW(a.t.val)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900/50">
                      <div className={`h-full rounded-full transition-all duration-1000 ease-out ${a.barCol}`} style={{width:`${a.pct}%`}}/>
                    </div>
                  </div>
                  <ArrowUpRight size={18} className="text-slate-700 group-hover:text-white transition-colors pb-1"/>
                </div>
              </div>
            ))}
            {accounts.length === 0 && (
              <div className="rounded-3xl border border-dashed border-slate-700 p-12 text-center text-slate-500">
                <Plus size={32} className="mx-auto mb-3 text-slate-700"/>
                <p className="text-sm font-bold">ìì§ ìì°ì´ ììµëë¤</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
//  ì ì²´ ìì° ë·°
// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const AllStocksView = ({ stocks, prices, rates, setEditingStock, setIsModalOpen, filterAcct, setFilterAcct, filterBroker, setFilterBroker, search, setSearch, sortKey, setSortKey, sortDir, setSortDir }) => {
  let arr = [...stocks];
  if (filterAcct !== 'ì ì²´') arr = arr.filter(s => s.ac === filterAcct);
  if (filterBroker !== 'ì ì²´') arr = arr.filter(s => s.br === filterBroker);
  if (search) {
    const q = search.toLowerCase();
    arr = arr.filter(s => s.n.toLowerCase().includes(q) || s.c.toLowerCase().includes(q) || (s.yt||'').toLowerCase().includes(q));
  }
  const totalVal = stocks.reduce((sum,s) => sum+getMetrics(s,prices,rates).val, 0);
  arr.sort((a,b) => {
    const ma=getMetrics(a,prices,rates), mb=getMetrics(b,prices,rates);
    const vals = { n:[a.n,b.n], sh:[a.sh,b.sh], bp:[a.bp,b.bp], inv:[a.inv,b.inv], base:[ma.priceKRW,mb.priceKRW], val:[ma.val,mb.val], pnl:[ma.pnl,mb.pnl], ret:[ma.ret,mb.ret], ratio:[ma.val,mb.val] };
    const [va,vb] = vals[sortKey]||[ma.val,mb.val];
    return typeof va==='string' ? va.localeCompare(vb)*sortDir : (va-vb)*sortDir;
  });
  const accts  = ['ì ì²´', ...new Set(stocks.map(s=>s.ac))];
  const brks   = ['ì ì²´', ...new Set(stocks.map(s=>s.br))];
  const th = (label, key, align='text-right') => (
    <th className={`px-4 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 select-none ${align}`}
        onClick={() => { setSortDir(sortKey===key ? -sortDir : -1); setSortKey(key); }}>
      <div className={`flex items-center gap-1.5 ${align==='text-left'?'justify-start':'justify-end'}`}>
        {label}
        {sortKey===key && (sortDir===1?<ChevronUp size={14} className="text-white"/>:<ChevronDown size={14} className="text-white"/>)}
      </div>
    </th>
  );
  const Chip = ({ label, active, onClick, color='blue' }) => {
    const c = { blue: active?'bg-blue-600 border-blue-600 text-white':'bg-slate-800/40 border-slate-700/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200', orange: active?'bg-orange-600 border-orange-600 text-white':'bg-slate-800/40 border-slate-700/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200' };
    return <button onClick={onClick} className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${c[color]}`}>{label}</button>;
  };
  return (
    <div className="space-y-6 pb-8 max-w-7xl mx-auto">
      <div className="rounded-2xl border border-slate-800/80 bg-[#121B2E]/60 p-5 space-y-5 shadow-lg">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
          <input type="text" placeholder="ì¢ëª©ëª, ì¢ëª©ì½ë, ì¼íí°ì»¤ ê²ì..." value={search} onChange={e=>setSearch(e.target.value)}
            className="w-full bg-[#0B0F19] border border-slate-800 text-base text-white rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-blue-500/50"/>
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase mr-2 w-14">ì¦ê¶ì¬</span>
            {brks.map(b => <Chip key={b} label={b} active={filterBroker===b} onClick={()=>setFilterBroker(b)} color="orange"/>)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase mr-2 w-14">ê³ì¢</span>
            {accts.map(a => <Chip key={a} label={a} active={filterAcct===a} onClick={()=>setFilterAcct(a)} color="blue"/>)}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-[#121B2E]/30 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap min-w-[1100px]">
            <thead className="bg-[#0F172A] border-b border-slate-700">
              <tr>{th('ì¢ëª© ì ë³´','n','text-left')}{th('ë³´ì  ìë','sh')}{th('ë§¤ì ë¨ê°','bp')}{th('ë§¤ì ê¸ì¡','inv')}{th('íì¬ê°','base')}{th('íê° ê¸ì¡','val')}{th('íê° ììµ','pnl')}{th('ììµë¥ ','ret')}{th('ë¹ì¨','ratio')}</tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {arr.map((s, idx) => {
                const m = getMetrics(s, prices, rates);
                const np = prices[s.yt] || (s.sh>0?s.base:null);
                const ratio = totalVal>0?(m.val/totalVal)*100:0;
                return (
                  <tr key={s.id} onClick={() => { setEditingStock(s); setIsModalOpen(true); }}
                    className={`hover:bg-slate-700/40 cursor-pointer transition-colors ${idx%2===0?'bg-transparent':'bg-slate-900/10'}`}>
                    <td className="px-4 py-4">
                      <div className="font-extrabold text-slate-100 text-base">{s.n}</div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-slate-500">ì½ë: {s.c&&s.c!=='-'?s.c:'ìì'}</span>
                        {s.yt && <><span className="text-slate-600 text-xs">â¢</span><span className="text-xs text-slate-500 font-mono">í°ì»¤: {s.yt}</span></>}
                        <span className="text-slate-600 text-xs">â¢</span>
                        <Badge type={s.ac}/><Badge type={s.t}/>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-200">{s.sh>0?s.sh.toLocaleString():'-'}</td>
                    <td className="px-4 py-4 text-right font-medium text-slate-400">{s.sh>0?`â©${comma(s.bp)}`:'-'}</td>
                    <td className="px-4 py-4 text-right font-medium text-slate-400">{s.sh>0?`â©${comma(s.inv)}`:'-'}</td>
                    <td className="px-4 py-4 text-right">
                      <div className="text-slate-300 font-semibold">{s.sh>0?`â©${comma(m.priceKRW)}`:'-'}</div>
                      {np && s.cur!=='KRW' && s.sh>0 && <div className="text-[11px] text-slate-500 font-bold mt-0.5">{s.cur} {np.toLocaleString(undefined,{minimumFractionDigits:s.cur==='USD'?2:0})}</div>}
                    </td>
                    <td className="px-4 py-4 text-right"><div className="font-black text-slate-100 text-base">â©{comma(m.val)}</div></td>
                    <td className="px-4 py-4 text-right"><div className={`font-bold text-base ${pnlColor(m.pnl)}`}>{m.pnl!==0?pnlSign(m.pnl)+comma(Math.abs(m.pnl)):'-'}</div></td>
                    <td className="px-4 py-4 text-right"><div className={`inline-flex px-2 py-1 rounded font-extrabold text-sm ${m.ret!==0?pnlBg(m.ret):'bg-slate-800 text-slate-400'}`}>{m.ret!==0?fmtP(m.ret):'-'}</div></td>
                    <td className="px-4 py-4 text-right"><div className="text-sm font-black text-slate-300 flex items-center justify-end gap-1"><Percent size={12} className="text-slate-500"/>{ratio.toFixed(1)}%</div></td>
                  </tr>
                );
              })}
              {arr.length === 0 && <tr><td colSpan="9" className="px-4 py-12 text-center text-slate-500 font-medium">ìì°ì´ ììµëë¤.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
//  ì¤ì  ë·°
// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const SettingsView = ({ rates, setRates, prices, lastUpdated, saveSettingsToCloud, showToast, handleExport, handleImport, ownerName, setOwnerName, saveOwnerName, stocks, setStocks, user }) => {
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem(LS_GEMINI_KEY) || '');
  const [csvText,    setCsvText]   = useState('');
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrStep,    setOcrStep]   = useState('');
  const fileInputRef = useRef(null);

  const saveGeminiKey = () => { localStorage.setItem(LS_GEMINI_KEY, geminiKey); showToast('ð Gemini API Keyëª¨ ì ì¥ëììµëë¤.'); };

  const handleResetStocks = async () => {
    if (!window.confirm('â ï¸ í¬í¸í´ë¦¬ì¤ì ëª¨ë  ìì° ë°ì´í°ë¥¼ ì­ì íìê² ìµëê¹?\nì´ ììì ëëë¦´ ì ììµëë¤.')) return;
    setStocks([]);
    localStorage.setItem(LS_KEY, JSON.stringify({ stocks:[], prices, rates, lastUpdated }));
    if (user && db) {
      const batch = writeBatch(db);
      stocks.forEach(s => batch.delete(doc(db,'artifacts',FB_APP_ID,'public','data',FB_STOCKS_COL,s.id.toString())));
      await batch.commit();
    }
    showToast('ð§¹ ìì° ë°ì´í°ê° ì´ê¸°íëììµëë¤.');
  };

  const handleRestoreDemo = async () => {
    if (!window.confirm('ë°ëª¨ ë°ì´í°ë¥¼ ë³µìíìê² ìµëê¹?')) return;
    setStocks(INITIAL_STOCKS);
    localStorage.setItem(LS_KEY, JSON.stringify({ stocks:INITIAL_STOCKS, prices, rates, lastUpdated }));
    if (user && db) {
      const batch = writeBatch(db);
      const ref = collection(db,'artifacts',FB_APP_ID,'public','data',FB_STOCKS_COL);
      INITIAL_STOCKS.forEach(s => batch.set(doc(ref,s.id.toString()),s));
      await batch.commit();
    }
    showToast('â ë°ëª¨ ë°ì´í° ë³µì ìë£');
  };

  const handleParseCsv = () => {
    if (!csvText.trim()) return showToast('â ï¸ íì¤í¸ë¥¼ ìë ¥í´ì£¼ì¸ì.');
    try {
      const lines = csvText.split('\n').map(l=>l.trim()).filter(l=>l.length>0);
      const baseId = stocks.reduce((max,s)=>s.id>max?s.id:max, 0)+100;
      const parsed = lines.map((line,idx) => {
        const p = line.split(/[\t,]/).map(x=>x.trim());
        if (p.length < 2) return null;
        const sh=Number(p[1].replace(/[^0-9.]/g,''))||1, bp=Number(p[2]?.replace(/[^0-9.]/g,'')||0), inv=p[3]?Number(p[3].replace(/[^0-9.]/g,'')):(sh*bp), base=p[4]?Number(p[4].replace(/[^0-9.]/g,'')):bp;
        return { id:baseId+idx, n:p[0], c:'-', yt:'', t:'êµ­ë´ETF', sh, bp, inv, base, cur:'KRW', ac:'ìí', br:CONFIG_BROKERS[0] };
      }).filter(Boolean);
      if (parsed.length>0) { const merged=[...stocks,...parsed]; setStocks(merged); localStorage.setItem(LS_KEY,JSON.stringify({stocks:merged,prices,rates,lastUpdated})); setCsvText(''); showToast(`ð ${parsed.length}ê° ì¢ëª© ê°ì ¸ì¤ê¸° ìë£!`); }
      else showToast('â ï¸ ë°ì´í° í´ì ì¤í¨. íìì íì¸í´ì£¼ì¸ì.');
    } catch(e) { showToast('â ï¸ íì± ìë¬'); }
  };

  // ââ AI OCR (Gemini 2.0 Flash) âââââââââââââââââââââââââ
  const handleOcrFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setOcrScanning(true);
    setOcrStep('ì´ë¯¸ì§ ë¶ì ì¤...');

    if (geminiKey.trim()) {
      try {
        setOcrStep('Gemini AI Vision ë¶ì ì¤...');
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const base64Data = evt.target.result.split(',')[1];
            // â ìì : ì íí Gemini ëª¨ë¸ëª ì¬ì©
            const response = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [
                    { text: "ì´ ì´ë¯¸ì§(ì£¼ì/ETF/IRP ìê³  ì¤í¬ë¦°ì·)ìì ì¢ëª©ëª, ë³´ì ìë, ë§¤ìê¸ì¡, ë§¤ìë¨ê°, íì¬ê°ë¥¼ ì¶ì¶í´ì ë¤ì JSON ë°°ì´ íìì¼ë¡ë§ ë°íí´ì¤. [{\"n\":\"ì¢ëª©ëª\",\"sh\":ìë,\"bp\":ë§¤ìë¨ê°,\"inv\":ë§¤ìê¸ì¡,\"base\":íì¬ê°}]" },
                    { inlineData: { mimeType: file.type, data: base64Data } }
                  ] }],
                  generationConfig: { responseMimeType: 'application/json' }
                })
              }
            );
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            const resData = await response.json();
            const textResult = resData.candidates?.[0]?.content?.parts?.[0]?.text;
            const parsedArray = JSON.parse(textResult);
            if (Array.isArray(parsedArray)) {
              const baseId = stocks.reduce((max,s)=>s.id>max?s.id:max,0)+500;
              const converted = parsedArray.map((item,idx) => ({
                id: baseId+idx, n: item.n||'ì¶ì¶ ì¢ëª©', c:'-', yt:'', t:'êµ­ë´ETF',
                sh: Number(item.sh)||0, bp: Number(item.bp)||0,
                inv: Number(item.inv)||(Number(item.sh)*Number(item.bp))||0,
                base: Number(item.base)||Number(item.bp)||0,
                cur: 'KRW', ac: CONFIG_ACCOUNTS[0], br: CONFIG_BROKERS[0]
              }));
              const merged = [...stocks,...converted];
              setStocks(merged);
              localStorage.setItem(LS_KEY, JSON.stringify({stocks:merged,prices,rates,lastUpdated}));
              showToast(`ð¯ AI OCR ì±ê³µ! ${converted.length}ê° ìì° ì¶ê°ë¨`);
            } else throw new Error('ìëµ íì ì¤ë¥');
          } catch(err) { console.error(err); showToast('â ï¸ OCR ì¤í¨: ' + err.message); }
          finally { setOcrScanning(false); }
        };
        reader.readAsDataURL(file);
      } catch { setOcrScanning(false); }
    } else {
      // ìë®¬ë ì´í° ëª¨ë
      setTimeout(() => setOcrStep('ê²©ì ì ë ¬ ë§¤ì¹­ ì¤...'), 800);
      setTimeout(() => setOcrStep('ì¢ëª© ë°ì´í° íì± ì¤...'), 1800);
      setTimeout(() => {
        const sample = [
          {id:Date.now()+1,n:'KODEX ë¯¸êµ­S&P500 ê³ ë°°ë¹',c:'-',yt:'',t:'êµ­ë´ETF',sh:150,bp:12500,inv:1875000,base:13800,cur:'KRW',ac:'ìí',br:CONFIG_BROKERS[0]},
          {id:Date.now()+2,n:'ACE ê¸ë¡ë²ë°ëì²´TOP4',c:'-',yt:'',t:'êµ­ë´ETF',sh:80,bp:15400,inv:1232000,base:16900,cur:'KRW',ac:'ìí',br:CONFIG_BROKERS[0]},
        ];
        const merged = [...stocks,...sample];
        setStocks(merged);
        localStorage.setItem(LS_KEY, JSON.stringify({stocks:merged,prices,rates,lastUpdated}));
        setOcrScanning(false);
        showToast('ð¨ ìë®¬ë ì´í° ëª¨ë: ìí 2ê° ìì° ì¶ê°ë¨ (API Key ìë ¥ ì ì¤ì  OCR ìë)');
      }, 3000);
    }
  };

  return (
    <div className="space-y-8 pb-12 max-w-5xl mx-auto">

      {/* ìì ì ì¤ì  */}
      <div className="rounded-3xl border border-slate-800 bg-[#121B2E]/80 p-6 shadow-xl">
        <h3 className="text-lg font-black text-white mb-2 flex items-center gap-2"><User className="text-emerald-400" size={20}/> ìì ì ì´ë¦ ì¤ì </h3>
        <p className="text-sm text-slate-400 mb-5">ëìë³´ëì íìë  ì´ë¦ì ë³ê²½í©ëë¤. ë¤ë¥¸ ì¬ëì´ ì¬ì©í  ë ì´ë¦ì ì»¤ì¤íí  ì ììµëë¤.</p>
        <div className="flex gap-4">
          <input type="text" value={ownerName} onChange={e=>setOwnerName(e.target.value)}
            className="flex-1 bg-[#0B0F19] border border-slate-700 text-base text-white rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none" placeholder="ì´ë¦ ìë ¥"/>
          <button onClick={saveOwnerName} className="px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all">ì ì¥</button>
        </div>
      </div>

      {/* íì¨ ì¤ì  */}
      <div className="rounded-3xl border border-slate-800 bg-[#121B2E]/80 p-6 shadow-xl">
        <h3 className="text-lg font-black text-white mb-2 flex items-center gap-2"><Globe className="text-blue-400" size={20}/> ê¸°ì¤ íì¨ ì¤ì </h3>
        <p className="text-sm text-slate-400 mb-6">ì¸í ìì°ì ìí íì°ì ì¬ì©ë©ëë¤. ìë°ì´í¸ ë²í¼ì¼ë¡ ìë ì¡°íë ê°ë¥í©ëë¤.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[['USDKRW','USD/KRW (ë¯¸êµ­ë¬ë¬)'],['JPYKRW','JPY/KRW (1ìë¹)'],['HKDKRW','HKD/KRW (íì½©ë¬ë¬)']].map(([key,label]) => (
            <div key={key} className="bg-[#0B0F19] rounded-2xl p-4 border border-slate-800/80">
              <label className="block text-xs font-bold text-slate-400 mb-2">{label}</label>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-white">â©</span>
                <input type="number" value={rates[key]} onChange={e=>setRates({...rates,[key]:Number(e.target.value)})}
                  className="w-full bg-transparent text-xl font-bold text-white focus:outline-none"/>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => { saveSettingsToCloud(prices,rates,lastUpdated); showToast('â íì¨ ëê¸°í ìë£'); }}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-base font-bold rounded-xl transition-all">
          íì¨ ë³ê²½ ë° ì ì¥
        </button>
      </div>

      {/* AI & Excel ìë ¥ íë¸ */}}
      <div className="rounded-3xl border border-slate-800 bg-[#121B2E]/80 p-6 shadow-xl space-y-6">
        <div>
          <h3 className="text-lg font-black text-white mb-1 flex items-center gap-2"><Activity className="text-orange-500 animate-pulse" size={20}/> AI & ìì ì¤ë§í¸ ì¼ê´ ìë ¥</h3>
          <p className="text-sm text-slate-400">ì¢ëª©ì ë°ì´í° íëì© ìë ¥íì¤ ìíì§ ë©ëë¤. ìì ë¶ì¬ë£ê¸° ëê¸°ë¥¼ ë¤ë¤íëì§ AI ì¤ìºì¼ë¡ ì¼ê´ íí©ì ì¼ê´ ë±ë¡í©ëë¤.</p>
        </div>

        {/* ìì ë¶ì¬ë£ê¸° */}
        <div className="bg-[#0B0F19] rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center gap-2 mb-3 text-xs font-extrabold text-slate-300"><FileText size={15} className="text-blue-400"/> ë°©ë² 1: ìì í ë³µì¬ ë¶ì¬ë£ê¸°</div>
          <p className="text-[11px] text-slate-500 mb-3">[ì¢ëª©ëª] [ìë] [ë§¤ìë¨ê°] [ë§¤ììê¸] [íì¬ê°] ìì¼ë¡ ë³µì¬ í ë¶ì¬ë£ê¸°</p>
          <textarea rows="3" value={csvText} onChange={e=>setCsvText(e.target.value)}
            placeholder={"ì¼ì±ì ì\t15\t71500\t1072500\t72000\níëì°¨\t20\t230000\t4600000\t225000"}
            className="w-full bg-[#131B2E] border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none font-mono"/>
          <button onClick={handleParseCsv} className="mt-3 w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold rounded-xl transition-all">
            ìì ë°ì´í° ê°ì ¸ì¤ê¸°
          </button>
        </div>

        {/* AI OCR */}
        <div className="bg-[#0B0F19] rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center gap-2 mb-3 text-xs font-extrabold text-slate-300"><Camera size={15} className="text-emerald-400"/> ë°©ë² 2: ìê³  ì¤í¬ë¦°ì· AI ì¤ìº (Gemini OCR)</div>
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <input type="password" value={geminiKey} onChange={e=>setGeminiKey(e.target.value)}
                placeholder="Google Gemini API Key (ìì¼ë©´ ìë®¬ë ì´í° ëª¨ë)"
                className="w-full bg-[#131B2E] border border-slate-800 text-xs text-slate-200 rounded-xl px-4 py-3 focus:outline-none pr-10 font-mono"/>
              <Key size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"/>
            </div>
            <button onClick={saveGeminiKey} className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-extrabold">í¤ ì ì¥</button>
          </div>
          <div className="flex flex-col items-center justify-center border border-dashed border-slate-700/80 rounded-2xl p-6 bg-[#131B2E]/20">
            {ocrScanning ? (
              <div className="flex flex-col items-center py-6 space-y-4">
                <RefreshCw size={36} className="text-emerald-400 animate-spin"/>
                <p className="text-xs font-extrabold text-emerald-300 animate-pulse text-center">{ocrStep}</p>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <Camera size={40} className="mx-auto text-slate-500"/>
                <button onClick={() => fileInputRef.current?.click()} className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition-all">
                  ì¤ë§í¸í° ìê³  ì¤í¬ë¦°ì· ì¬ë¦¬ê¸°
                </button>
                <p className="text-[10px] text-slate-500">PNG, JPG ì´ë¯¸ì§ ìë¡ë</p>
              </div>
            )}
            <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleOcrFile}/>
          </div>
        </div>
      </div>

      {/* ë°°í¬ ê°ì´ë & ë°±ì */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-slate-800 bg-[#121B2E]/80 p-6 shadow-xl flex flex-col">
          <div className="space-y-3 flex-1">
            <h3 className="text-lg font-black text-white flex items-center gap-2"><Smartphone className="text-blue-400 animate-bounce" size={20}/> ëª¨ë°ì¼ & ë¤ë¥¸ PC ë°°í¬</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Firebase ì°ë ì <strong>ì¤ìê° ë©í° ê¸°ê¸° ëê¸°í</strong>ê° ì§ìë©ëë¤.
            </p>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex gap-2"><span className="text-emerald-400 font-bold">1.</span><span><strong>GitHub Pages ë°°í¬:</strong> GitHubì ì½ë ì¬ë¦¬ê¸° â Actions ìë ë¹ë â ë¬´ë£ ëë©ì¸ ìì±</span></div>
              <div className="flex gap-2"><span className="text-emerald-400 font-bold">2.</span><span><strong>ì¤ìê° ëê¸°í:</strong> ëë©ì¸ ì£¼ìë¡ ì¤ë§í¸í°ì´ë íë¸ë¦¿ìì ì´ë©´ ì¦ì ëê¸°íë©ëë¤.</span></div>
              <div className="flex gap-2"><span className="text-emerald-400 font-bold">3.</span><span><strong>ë¤ë¥¸ ì¬ë ì±:</strong> user-config.js íì¼ë§ ìì íë©´ ë³ë í¬í¸í´ë¦¬ì¤ ì±ì ë§ë¤ ì ììµëë¤.</span></div>
            </div>
          </div>
          <div className="mt-4 bg-[#0B0F19] rounded-xl p-3 border border-slate-800 text-center">
            <p className="text-[10px] text-slate-500">Firebase ì¤ì : index.html â __FIREBASE_CONFIG__ ìì </p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-[#121B2E]/80 p-6 shadow-xl space-y-4">
          <h3 className="text-lg font-black text-white flex items-center gap-2"><Cloud className="text-emerald-400" size={20}/> ë°ì´í° ë°±ì & ë³µì</h3>
          <p className="text-xs text-slate-400">í¬í¸í´ë¦¬ì¤ ë°ì´í°ë¥¼ íì¼ë¡ ì ì¥íê±°ë ë³µìí  ì ììµëë¤.</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleExport} className="flex items-center justify-center gap-2 py-3 bg-[#0B0F19] border border-slate-800 hover:border-slate-500 text-white text-xs font-bold rounded-xl transition-all">
              <Download size={15}/> íì¼ë¡ ì ì¥
            </button>
            <label className="flex items-center justify-center gap-2 py-3 bg-[#0B0F19] border border-slate-800 hover:border-slate-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer">
              <Upload size={15}/> ë°±ì ë³µì
              <input type="file" accept=".json" className="hidden" onChange={handleImport}/>
            </label>
          </div>
          <div className="h-px bg-slate-800"/>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleRestoreDemo} className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all">ë°ëª¨ ë°ì´í° ë³µì</button>
            <button onClick={handleResetStocks} className="py-3 bg-rose-950/40 hover:bg-rose-950/60 text-rose-300 text-xs font-bold rounded-xl transition-all border border-rose-900/50">ì ì²´ ì´ê¸°í</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
//  ìì° ì¶ê°/ìì  ëª¨ë¬
// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const StockModal = ({ isModalOpen, setIsModalOpen, editingStock, stocks, saveStockToCloud, deleteStockFromCloud, showToast, rates }) => {
  const isNew = !editingStock;
  const [mode, setMode] = useState('quick');
  const [form, setForm] = useState({});
  const [evalAmt, setEvalAmt] = useState(0);

  useEffect(() => {
    if (isModalOpen) {
      setMode(isNew ? 'quick' : 'manual');
      setForm(editingStock || { n:'', c:'', yt:'', t:'êµ­ë´ì£¼ì', cur:'KRW', ac:CONFIG_ACCOUNTS[0], br:CONFIG_BROKERS[0], sh:0, bp:0, base:0, inv:0 });
      setEvalAmt(editingStock ? getMetrics(editingStock,{},rates).val : 0);
    }
  }, [isModalOpen, editingStock, isNew, rates]);

  useEffect(() => {
    if (mode==='quick') { setEvalAmt(Number(form.base)||0); }
    else { const sh=Number(form.sh)||0,pr=Number(form.base)||0; if(sh>0) setEvalAmt(Math.round(sh*pr*(form.cur==='USD'?rates.USDKRW:1))); else setEvalAmt(Number(form.inv)||0); }
  }, [form.sh, form.base, form.inv, form.cur, rates.USDKRW, mode]);

  const handleChange = (id, val) => {
    const upd = {...form,[id]:val};
    if (mode==='manual' && (id==='sh'||id==='bp')) {
      const sh=Number(id==='sh'?val:upd.sh)||0, bp=Number(id==='bp'?val:upd.bp)||0;
      upd.inv = Math.round(sh*bp);
    }
    setForm(upd);
  };

  const handleSave = async () => {
    if (!form.n?.trim()) return showToast('â ï¸ ì¢ëª©ëªì ìë ¥í´ì£¼ì¸ì.');
    let s = {...form};
    if (mode==='quick') { s.sh=1; s.bp=Number(form.inv)||0; s.inv=Number(form.inv)||0; s.base=Number(form.base)||0; }
    else { s.sh=Number(form.sh)||0; s.bp=Number(form.bp)||0; s.base=Number(form.base)||0; s.inv=Number(form.inv)||0; }
    if (isNew) { const maxId=stocks.reduce((m,x)=>x.id>m?x.id:m,0); s.id=maxId+1000; }
    await saveStockToCloud(s);
    setIsModalOpen(false);
    showToast('â ì ì¥ëììµëë¤.');
  };

  const handleDelete = async (type) => {
    const msg = type==='sell' ? 'ì ë ë§¤ë ì²ë¦¬íìê² ìµëê¹?' : 'ìë ¥ ì¤ë¥ë¡ ì­ì íìê² ìµëê¹?';
    if (!window.confirm(msg)) return;
    await deleteStockFromCloud(form.id);
    setIsModalOpen(false);
    showToast(type==='sell' ? 'ðï¸ ì ë ë§¤ë ì²ë¦¬ ìë£' : 'ð§¹ ì­ì  ìë£');
  };

  const Inp = ({ label, id, type='text', ...p }) => (
    <div>
      <label className="block text-xs font-bold text-slate-400 mb-1.5">{label}</label>
      <input type={type} className="w-full bg-[#0B0F19] border border-slate-700 text-base text-white rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
        value={form[id]!==undefined&&form[id]!==null?form[id]:''}
        onChange={e => { const v=type==='number'?(e.target.value===''?'':Number(e.target.value)):e.target.value; handleChange(id,v); }} {...p}/>
    </div>
  );
  const Sel = ({ label, id, options }) => (
    <div>
      <label className="block text-xs font-bold text-slate-400 mb-1.5">{label}</label>
      <select className="w-full bg-[#0B0F19] border border-slate-700 text-base text-white rounded-xl px-4 py-3 focus:border-blue-500 outline-none appearance-none cursor-pointer"
        value={form[id]||options[0]} onChange={e=>handleChange(id,e.target.value)}>
        {options.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  if (!isModalOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0F19]/90 backdrop-blur-sm">
      <div className="bg-[#1E293B] border border-slate-700 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col custom-scrollbar">
        <div className="sticky top-0 bg-[#1E293B]/95 backdrop-blur z-10 flex flex-col border-b border-slate-700/50">
          <div className="flex items-center justify-between p-5 pb-3">
            <h3 className="text-xl font-black text-white">{editingStock?`${editingStock.n} ìì `:'ì ìì° ì¶ê°'}</h3>
            <button onClick={() => setIsModalOpen(false)} className="p-2.5 text-slate-400 hover:bg-slate-700 rounded-full"><X size={24}/></button>
          </div>
          <div className="flex px-5 pb-5 gap-3">
            <button onClick={() => setMode('quick')} className={`flex-1 py-3 rounded-xl text-sm font-bold flex justify-center items-center gap-1.5 transition-all ${mode==='quick'?'bg-blue-600 text-white':'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}><Zap size={16}/> ì¤í¼ë ìë ¥</button>
            <button onClick={() => setMode('manual')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${mode==='manual'?'bg-blue-600 text-white':'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>ìì¸ ìë ¥</button>
          </div>
        </div>
        <div className="p-5 md:p-6 space-y-6 flex-1">
          {mode==='quick' ? (
            <div className="space-y-5">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex gap-3 items-start">
                <AlertCircle className="text-emerald-400 shrink-0 mt-0.5" size={18}/>
                <p className="text-sm text-emerald-200">ì¦ê¶ì¬ ì±ì <strong>ì´ ë§¤ìê¸ì¡</strong>ê³¼ <strong>ì´ íê°ê¸ì¡</strong>ë§ ìë ¥íì¸ì!</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2"><Inp label="ì¢ëª©ëª" id="n" placeholder="ì: ì¼ì±ì ì"/></div>
                <Sel label="ì¦ê¶ì¬" id="br" options={CONFIG_BROKERS}/>
                <Sel label="ê³ì¢ ì¢ë¥" id="ac" options={CONFIG_ACCOUNTS}/>
                <div className="md:col-span-2"><Inp label="ì´ ë§¤ìê¸ì¡ (ìê¸)" id="inv" type="number" placeholder="ì: 19832800"/></div>
                <div className="md:col-span-2"><Inp label="íì¬ ì´ íê°ê¸ì¡" id="base" type="number" placeholder="ì: 23556000"/></div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2"><Inp label="ì¢ëª©ëª" id="n" placeholder="ì: ì¼ì±ì ì"/></div>
                <Inp label="ì¢ëª©ì½ë" id="c" placeholder="ì: 005930"/>
                <Inp label="Yahoo í°ì»¤" id="yt" placeholder="ì: 005930.KS"/>
                <Sel label="ìì°ì í" id="t" options={['êµ­ë´ì£¼ì','êµ­ë´ETF','ë¯¸êµ­ì£¼ì','ë¯¸êµ­ETF','ìê¸/íê¸']}/>
                <Sel label="íµí" id="cur" options={['KRW','USD']}/>
                <Sel label="ì¦ê¶ì¬" id="br" options={CONFIG_BROKERS}/>
                <Sel label="ê³ì¢ ì¢ë¥" id="ac" options={CONFIG_ACCOUNTS}/>
              </div>
              <div className="h-px bg-slate-700/50"/>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Inp label="ë³´ì  ìë" id="sh" type="number" step="any" placeholder="0"/>
                <Inp label="ë§¤ì ë¨ê°" id="bp" type="number" step="any" placeholder="0"/>
                <div className="md:col-span-2"><Inp label="ì´ ë§¤ììê¸" id="inv" type="number" step="any" placeholder="0"/></div>
                <Inp label="íì¬ê°(ë¨ê°)" id="base" type="number" step="any" placeholder="0"/>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">íê°ê¸ì¡ (ìëê³ì°)</label>
                  <input type="text" readOnly value={comma(evalAmt)} className="w-full bg-slate-800/30 border border-slate-700 text-base text-slate-400 font-bold rounded-xl px-4 py-3 cursor-not-allowed"/>
                </div>
              </div>
            </div>
          )}
          {editingStock && (
            <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-rose-400 font-extrabold text-sm"><Coins size={16}/> ìì° ì¢ê²° ë° ì¤ë¥ ì­ì </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={()=>handleDelete('sell')} className="py-3 px-4 bg-rose-600/25 hover:bg-rose-600/40 text-rose-200 border border-rose-500/30 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-2">
                  <Coins size={14}/> ì ë ë§¤ë ì²ë¦¬
                </button>
                <button onClick={()=>handleDelete('error')} className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-2">
                  <RefreshCcw size={14}/> ì¤ë¥ ì¦ì ì­ì 
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="sticky bottom-0 bg-[#1E293B] border-t border-slate-700/50 p-5 flex gap-4">
          <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-base font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl">ì·¨ì</button>
          <button onClick={handleSave} className="flex-[2] py-4 text-base font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-500/20">ìë£ ë° ì ì¥</button>
        </div>
      </div>
    </div>
  );
};

// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
//  ë©ì¸ App
// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const TABS = [
  { id:'dashboard', label:'ëìë³´ë', icon:LayoutDashboard },
  { id:'allstocks', label:'ì ì²´ ìì°', icon:List },
  { id:'settings',  label:'ì¤ì  ë° ë°±ì', icon:Settings },
];

export default function App() {
  // ì¨ë³´ë© ìí íì¸
  const [setupDone, setSetupDone] = useState(() => !!localStorage.getItem(LS_SETUP_KEY));

  const [user,         setUser]         = useState(null);
  const [tab,          setTab]          = useState('dashboard');
  const [stocks,       setStocks]       = useState([]);
  const [prices,       setPrices]       = useState({});
  const [rates,        setRates]        = useState(CONFIG_RATES);
  const [lastUpdated,  setLastUpdated]  = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [toastMsg,     setToastMsg]     = useState(null);
  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [editingStock, setEditingStock] = useState(null);
  const [ownerName,    setOwnerName]    = useState(() => localStorage.getItem(LS_OWNER_KEY) || CONFIG_OWNER);
  const [sortKey,      setSortKey]      = useState('val');
  const [sortDir,      setSortDir]      = useState(-1);
  const [search,       setSearch]       = useState('');
  const [filterAcct,   setFilterAcct]   = useState('ì ì²´');
  const [filterBroker, setFilterBroker] = useState('ì ì²´');

  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3500); };
  const saveOwnerName = () => { localStorage.setItem(LS_OWNER_KEY, ownerName); showToast(`ð¤ ì´ë¦ì´ [${ownerName}]ì¼ë¡ ì ì¥ëììµëë¤.`); };

  // ì¨ë³´ë© ìë£ ì½ë°±
  const handleOnboardingComplete = (name, useDemo) => {
    setOwnerName(name);
    const initStocks = useDemo ? INITIAL_STOCKS : [];
    setStocks(initStocks);
    localStorage.setItem(LS_KEY, JSON.stringify({ stocks:initStocks, prices:{}, rates:CONFIG_RATES, lastUpdated:null }));
    setSetupDone(true);
  };

  // Firebase Auth
  useEffect(() => {
    if (!auth) { loadFromLocal(); return; }
    signInAnonymously(auth).catch(() => loadFromLocal());
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  const loadFromLocal = () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.prices)    setPrices(data.prices);
        if (data.rates)     setRates(prev => ({...prev,...data.rates}));
        if (data.lastUpdated) setLastUpdated(data.lastUpdated);
        if (data.stocks)    { setStocks(data.stocks); return; }
      }
    } catch {}
    setStocks(INITIAL_STOCKS);
  };

  // Firebase ì¤ìê° ëê¸°í
  useEffect(() => {
    if (!user || !db) return;
    const stocksRef   = collection(db,'artifacts',FB_APP_ID,'public','data',FB_STOCKS_COL);
    const settingsRef = doc(db,'artifacts',FB_APP_ID,'public','data',`${FB_SETTINGS_DOC}_settings`,'global');

    const unsubStocks = onSnapshot(stocksRef, (snap) => {
      if (snap.empty) {
        const stored = localStorage.getItem(LS_KEY);
        const toSave = stored ? JSON.parse(stored).stocks : INITIAL_STOCKS;
        const batch  = writeBatch(db);
        toSave.forEach(s => batch.set(doc(stocksRef,s.id.toString()),s));
        batch.commit();
        setStocks(toSave);
      } else {
        const loaded = snap.docs.map(d => d.data());
        setStocks(loaded);
        localStorage.setItem(LS_KEY, JSON.stringify({stocks:loaded,prices,rates,lastUpdated}));
      }
    }, console.error);

    const unsubSettings = onSnapshot(settingsRef, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.prices)     setPrices(d.prices);
        if (d.rates)      setRates(d.rates);
        if (d.lastUpdated) setLastUpdated(d.lastUpdated);
      } else {
        setDoc(settingsRef, { prices:{}, rates:CONFIG_RATES, lastUpdated:null });
      }
    }, console.error);

    return () => { unsubStocks(); unsubSettings(); };
  }, [user]);

  // Cloud ì ì¥ í¨ìë¤
  const saveStockToCloud = async (stock) => {
    const newStocks = stocks.find(s=>s.id===stock.id) ? stocks.map(s=>s.id===stock.id?stock:s) : [...stocks,stock];
    setStocks(newStocks);
    localStorage.setItem(LS_KEY, JSON.stringify({stocks:newStocks,prices,rates,lastUpdated}));
    if (user && db) await setDoc(doc(db,'artifacts',FB_APP_ID,'public','data',FB_STOCKS_COL,stock.id.toString()), stock);
  };

  const deleteStockFromCloud = async (id) => {
    const newStocks = stocks.filter(s=>s.id!==id);
    setStocks(newStocks);
    localStorage.setItem(LS_KEY, JSON.stringify({stocks:newStocks,prices,rates,lastUpdated}));
    if (user && db) await deleteDoc(doc(db,'artifacts',FB_APP_ID,'public','data',FB_STOCKS_COL,id.toString()));
  };

  const saveSettingsToCloud = async (newP, newR, newL) => {
    setPrices(newP); setRates(newR); setLastUpdated(newL);
    localStorage.setItem(LS_KEY, JSON.stringify({stocks,prices:newP,rates:newR,lastUpdated:newL}));
    if (user && db) {
      const ref = doc(db,'artifacts',FB_APP_ID,'public','data',`${FB_SETTINGS_DOC}_settings`,'global');
      await setDoc(ref, {prices:newP,rates:newR,lastUpdated:newL}, {merge:true});
    }
  };

  // ì¤ìê° ìì¸ ì¡°í
  const fetchOneTicker = async (ticker) => {
    const urls = [
      `https://corsproxy.io/?${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d`)}`,
    ];
    for (const url of urls) {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) continue;
        const d = await r.json();
        const price = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (price) return price;
      } catch {}
    }
    return null;
  };

  const syncPrices = async () => {
    if (loading) return;
    setLoading(true);
    const tickers = [...new Set(stocks.filter(s=>s.yt&&s.sh>0).map(s=>s.yt))];
    let newPrices = {...prices}, newRates = {...rates};
    for (let i=0; i<tickers.length; i+=5) {
      const batch = tickers.slice(i,i+5);
      await Promise.all(batch.map(async t => { const p=await fetchOneTicker(t); if(p) newPrices[t]=p; }));
    }
    const rateKeys = { USDKRW:'USDKRW=X', JPYKRW:'JPYKRW=X', HKDKRW:'HKDKRW=X' };
    await Promise.all(Object.entries(rateKeys).map(async ([k,t]) => { const p=await fetchOneTicker(t); if(p) newRates[k]=p; }));
    const now = new Date().toISOString();
    await saveSettingsToCloud(newPrices, newRates, now);
    setLoading(false);
    showToast('ð ì¤ìê° ìì¸ ë° íì¨ ìë°ì´í¸ ìë£!');
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify({stocks,prices,rates,lastUpdated},null,2)], {type:'application/json'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download=`${ownerName}_í¬í¸í´ë¦¬ì¤_${new Date().toISOString().slice(0,10)}.json`; a.click();
    showToast('ð¾ ë°±ì íì¼ ë¤ì´ë¡ë ìë£');
  };

  const handleImport = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (user && db && data.stocks) {
          const batch = writeBatch(db);
          const ref = collection(db,'artifacts',FB_APP_ID,'public','data',FB_STOCKS_COL);
          data.stocks.forEach(s => batch.set(doc(ref,s.id.toString()),s));
          await batch.commit();
        }
        if (data.stocks) setStocks(data.stocks);
        await saveSettingsToCloud(data.prices||prices, data.rates||rates, data.lastUpdated||lastUpdated);
        showToast('â ë°±ì ë³µì ìë£');
      } catch { showToast('â ï¸ íì¼ íì ì¤ë¥'); }
    };
    reader.readAsText(file); e.target.value='';
  };

  // ì¨ë³´ë© íë©´
  if (!setupDone) return <OnboardingWizard onComplete={handleOnboardingComplete} configOwner={CONFIG_OWNER}/>;

  return (
    <div className="flex h-screen bg-[#0B0F19] text-slate-100 font-sans overflow-hidden selection:bg-blue-500/30">

      {/* ì¬ì´ëë° */}
      <aside className="hidden md:flex w-72 flex-col border-r border-slate-800 bg-[#0F172A]">
        <div className="p-8">
          <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">Asset Control</div>
          <div className="text-2xl font-black tracking-tight text-white mb-2 leading-none uppercase">
            {ownerName}<br/><span className="text-slate-500 text-sm font-semibold tracking-normal">Portfolio Pro</span>
          </div>
          <div className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-md border border-emerald-400/20">
            <Cloud size={12}/> {user ? 'Cloud ëê¸°í íì±' : 'ë¡ì»¬ ëª¨ë'}
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-1.5 mt-4">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${tab===t.id?'bg-blue-600 text-white shadow-xl shadow-blue-600/30':'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}`}>
                <Icon size={20} className={tab===t.id?'opacity-100':'opacity-70'}/>{t.label}
              </button>
            );
          })}
        </nav>
        <div className="p-6 border-t border-slate-800/80">
          <button onClick={() => {setEditingStock(null);setIsModalOpen(true);}} className="w-full flex items-center justify-center gap-2 py-4 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-2xl transition-all border border-slate-700">
            <Plus size={18}/> ì ìì° ì§ì  ë±ë¡
          </button>
        </div>
      </aside>

      {/* ë©ì¸ í¨ë */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between px-6 md:px-10 py-6 bg-[#0B0F19]/80 backdrop-blur-md border-b border-slate-800/80">
          <div className="md:hidden text-lg font-black text-white">{ownerName}</div>
          <div className="hidden md:block text-xl font-black text-white uppercase tracking-tight">{TABS.find(t=>t.id===tab)?.label}</div>
          <div className="flex items-center gap-5 ml-auto">
            <div className="hidden sm:flex flex-col items-end">
              <div className="text-xs font-bold flex items-center gap-1.5 text-emerald-400">
                <span className="relative flex h-2.5 w-2.5">
                  {!loading && user && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"/>}
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${loading?'bg-amber-400':user?'bg-emerald-500':'bg-red-500'}`}/>
                </span>
                {loading ? 'ìì¸ ì°ëì¤...' : user ? 'í´ë¼ì°ë íì±' : 'ë¡ì»¬ ëª¨ë'}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                ê°±ì : {lastUpdated ? new Date(lastUpdated).toLocaleString('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : 'ìì'}
              </div>
            </div>
            <button onClick={syncPrices} disabled={loading}
              className="flex items-center gap-2 bg-blue-600/10 hover:bg-blue-600/20 disabled:opacity-50 text-blue-400 text-sm font-extrabold py-2.5 px-5 rounded-full border border-blue-500/20 transition-all active:scale-95">
              <Zap size={16} className={loading?'animate-pulse text-yellow-400':''}/><span className="hidden sm:inline">ìë°ì´í¸</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-10 pb-28 md:pb-12 custom-scrollbar">
          {tab==='dashboard' && <DashboardView stocks={stocks} prices={prices} rates={rates} setTab={setTab} setFilterAcct={setFilterAcct} setFilterBroker={setFilterBroker} ownerName={ownerName}/>}
          {tab==='allstocks' && <AllStocksView stocks={stocks} prices={prices} rates={rates} setEditingStock={setEditingStock} setIsModalOpen={setIsModalOpen} filterAcct={filterAcct} setFilterAcct={setFilterAcct} filterBroker={filterBroker} setFilterBroker={setFilterBroker} search={search} setSearch={setSearch} sortKey={sortKey} setSortKey={setSortKey} sortDir={sortDir} setSortDir={setSortDir}/>}
          {tab==='settings' && <SettingsView rates={rates} setRates={setRates} prices={prices} lastUpdated={lastUpdated} saveSettingsToCloud={saveSettingsToCloud} showToast={showToast} handleExport={handleExport} handleImport={handleImport} ownerName={ownerName} setOwnerName={setOwnerName} saveOwnerName={saveOwnerName} stocks={stocks} setStocks={setStocks} user={user}/>}
        </div>
      </main>

      {/* ëª¨ë°ì¼ íë¨ \â´ ë¹ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0F172A]/95 backdrop-blur-xl border-t border-slate-800 pb-8 pt-3 px-6 flex justify-between">
        {TABS.map(t => { const Icon=t.icon; return (
          <button key={t.id} onClick={()=>setTab(t.id)} className={`flex flex-col items-center p-2 transition-colors ${tab===t.id?'text-blue-500':'text-slate-500'}`}>
            <Icon size={24} className="mb-1"/><span className="text-[10px] font-black uppercase tracking-tighter">{t.label}</span>
          </button>
        ); })}
      </nav>

      {/* ëª¨ë°ì¼ FAB */}
      <button onClick={() => {setEditingStock(null);setIsModalOpen(true);}}
        className="md:hidden fixed bottom-28 right-6 z-40 bg-blue-600 text-white p-5 rounded-full shadow-2xl shadow-blue-600/40 active:scale-90 transition-all">
        <Plus size={28}/>
      </button>

      <StockModal isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} editingStock={editingStock} stocks={stocks} saveStockToCloud={saveStockToCloud} deleteStockFromCloud={deleteStockFromCloud} showToast={showToast} rates={rates}/>

      {/* í ì¤í¸ */}
      <div className={`fixed bottom-32 md:bottom-12 left-1/2 -translate-x-1/2 z-50 bg-slate-800 border border-slate-700 text-white text-sm font-bold px-8 py-4 rounded-2xl shadow-2xl transition-all duration-300 flex items-center gap-3 ${toastMsg?'opacity-100 translate-y-0':'opacity-0 translate-y-4 pointer-events-none'}`}>
        <Activity size={18} className="text-blue-400"/> {toastMsg}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width:6px; height:6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background:transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color:#1e293b; border-radius:20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color:#334155; }
      `}</style>
    </div>
  );
}
