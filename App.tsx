
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { StreakData } from './types';

// Supabase credentials provided by the user
const SUPABASE_URL = 'https://aifnvakipmgvrrgqlwtu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_M-Yxjk1TiMVfWuZEullDpw_pNV2C1lS';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

const App: React.FC = () => {
  const [masterKey, setMasterKey] = useState<string | null>(localStorage.getItem('purepath_master_key'));
  const [tempKey, setTempKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState<StreakData>({ 
    currentStreak: 0, 
    maxStreak: 0, 
    lastCheckIn: null, 
    history: [] 
  });

  // 1. Clock effect to drive timers
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Fetch data from Supabase if masterKey exists
  useEffect(() => {
    const fetchData = async () => {
      if (!masterKey) return;
      setLoading(true);
      try {
        const { data: dbData, error } = await supabase
          .from('streaks')
          .select('payload')
          .eq('id', masterKey)
          .single();

        if (dbData) {
          setData(dbData.payload);
        } else if (error && error.code === 'PGRST116') {
          // New user: create record
          await supabase.from('streaks').insert([{ id: masterKey, payload: data }]);
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [masterKey]);

  // 3. Sync to Cloud
  const syncToCloud = async (newData: StreakData) => {
    if (!masterKey) return;
    setSyncing(true);
    try {
      await supabase
        .from('streaks')
        .upsert({ id: masterKey, payload: newData });
    } catch (err) {
      console.error("Cloud sync failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  // 4. Streak Reset Logic (48h rule)
  useEffect(() => {
    if (!data.lastCheckIn) return;
    const diff = now - data.lastCheckIn;
    if (diff >= FORTY_EIGHT_HOURS && data.currentStreak > 0) {
      const resetData = { ...data, currentStreak: 0 };
      setData(resetData);
      syncToCloud(resetData);
    }
  }, [now, data.lastCheckIn, data.currentStreak]);

  const canCheckIn = useMemo(() => {
    if (!data.lastCheckIn) return true;
    return (now - data.lastCheckIn) >= TWENTY_FOUR_HOURS;
  }, [now, data.lastCheckIn]);

  const handleCheckIn = useCallback(async () => {
    if (!canCheckIn) return;

    const currentTime = Date.now();
    const newData = {
      ...data,
      currentStreak: data.currentStreak + 1,
      maxStreak: Math.max(data.maxStreak, data.currentStreak + 1),
      lastCheckIn: currentTime,
      history: [...data.history, currentTime]
    };

    setData(newData);
    await syncToCloud(newData);
  }, [canCheckIn, data]);

  const handleLogin = () => {
    if (tempKey.trim().length < 4) return;
    localStorage.setItem('purepath_master_key', tempKey);
    setMasterKey(tempKey);
  };

  const handleLogout = () => {
    if (window.confirm("Logout? Data stays on your key.")) {
      localStorage.removeItem('purepath_master_key');
      setMasterKey(null);
      setData({ currentStreak: 0, maxStreak: 0, lastCheckIn: null, history: [] });
    }
  };

  const cooldownTimer = useMemo(() => {
    if (!data.lastCheckIn || canCheckIn) return null;
    const remaining = TWENTY_FOUR_HOURS - (now - data.lastCheckIn);
    const h = Math.floor(remaining / (1000 * 60 * 60));
    const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((remaining % (1000 * 60)) / 1000);
    return `${h}h ${m}m ${s}s`;
  }, [now, data.lastCheckIn, canCheckIn]);

  const timeUntilReset = useMemo(() => {
    if (!data.lastCheckIn || data.currentStreak === 0) return null;
    const remaining = FORTY_EIGHT_HOURS - (now - data.lastCheckIn);
    return Math.max(0, Math.floor(remaining / (1000 * 60 * 60)));
  }, [now, data.lastCheckIn, data.currentStreak]);

  if (!masterKey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 relative overflow-hidden">
        {/* Soft background decor */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-emerald-100 rounded-full blur-[120px] opacity-40"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-slate-200 rounded-full blur-[120px] opacity-40"></div>

        <div className="w-full max-w-sm space-y-10 text-center relative z-10">
          <div className="space-y-3">
            <h1 className="text-6xl font-black text-slate-900 tracking-tighter">
              Pure<span className="text-emerald-600">Path</span>
            </h1>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-600/60">Mastery Sync Protocol</p>
          </div>
          
          <div className="space-y-4">
            <div className="relative group">
              <input 
                type={showPassword ? "text" : "password"}
                placeholder="Enter Private Key"
                className="w-full p-6 rounded-[32px] border-2 border-slate-100 focus:border-emerald-500 focus:bg-white outline-none text-center text-lg font-bold transition-all bg-white shadow-sm text-slate-900 placeholder-slate-300"
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-emerald-600 transition-colors"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>
            
            <button 
              onClick={handleLogin}
              className="w-full py-6 bg-emerald-600 text-white rounded-[32px] font-black text-lg hover:bg-emerald-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-emerald-100"
            >
              Start Syncing
            </button>
          </div>
          
          <div className="pt-4">
            <p className="text-[10px] uppercase tracking-[0.2em] font-black text-emerald-600/50">
              One Key • All Devices • Total Privacy
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white relative overflow-hidden">
      
      {/* Visual background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-50 rounded-full blur-[100px] opacity-50 pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-slate-50 rounded-full blur-[100px] opacity-50 pointer-events-none"></div>

      <div className="absolute top-8 right-8 flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
        <div className={`w-1.5 h-1.5 rounded-full ${syncing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`}></div>
        <span>{syncing ? 'Syncing...' : 'Live Sync'}</span>
      </div>

      <button 
        onClick={handleLogout}
        className="absolute top-8 left-8 text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:text-rose-500 transition-colors"
      >
        Sign Out
      </button>

      <div className="w-full max-w-sm text-center space-y-16 relative z-10">
        <div className="space-y-2">
          <div className="text-9xl font-black text-slate-900 tracking-tighter tabular-nums drop-shadow-sm">
            {data.currentStreak}
          </div>
          <p className="text-xs font-black uppercase tracking-[0.4em] text-emerald-600">
            Consecutive Days
          </p>
        </div>

        <div className="space-y-6">
          <button
            onClick={handleCheckIn}
            disabled={!canCheckIn}
            className={`w-full py-8 rounded-[40px] font-black text-2xl transition-all active:scale-95 shadow-2xl ${
              canCheckIn 
                ? 'bg-emerald-600 text-white shadow-emerald-100 hover:bg-emerald-700 hover:-translate-y-1' 
                : 'bg-slate-50 text-slate-300 cursor-not-allowed shadow-none border border-slate-100'
            }`}
          >
            {canCheckIn ? "Log Victory" : "Locked"}
          </button>
          
          {!canCheckIn && cooldownTimer && (
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
              Next log in: {cooldownTimer}
            </p>
          )}
        </div>

        <div className="space-y-6 pt-4">
          {data.currentStreak > 0 && timeUntilReset !== null && (
            <div className="inline-block px-4 py-2 rounded-full bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Streak expires in <span className={timeUntilReset < 12 ? 'text-rose-500' : 'text-slate-900'}>{timeUntilReset} hours</span>
            </div>
          )}
          
          <div className="pt-8 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-300 border-t border-slate-50">
            <div className="flex flex-col items-start text-left">
              <span className="text-[8px] text-slate-200">Personal Best</span>
              <span className="text-slate-500 text-sm">{data.maxStreak} Days</span>
            </div>
            <div className="text-right">
              24h Lock<br/>48h Reset
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;
