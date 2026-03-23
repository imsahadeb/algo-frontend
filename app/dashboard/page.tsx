"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ChartWidget from "./ChartWidget";

export default function Dashboard() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  
  const [marketWatch, setMarketWatch] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [paperTrades, setPaperTrades] = useState<any[]>([]);
  const [algos, setAlgos] = useState<any[]>([]);
  const [currentView, setCurrentView] = useState("DASHBOARD");
  const [tradingMode, setTradingMode] = useState("PAPER"); // "REAL" or "PAPER"
  const [activeTab, setActiveTab] = useState("POSITIONS");
  const [userStatus, setUserStatus] = useState({ funds: 0, realM2m: 0, name: "Loading..." });
  const [selectedSymbol, setSelectedSymbol] = useState("NSE:NIFTY");
  const [timeframe, setTimeframe] = useState("1D");
  const [panelHeight, setPanelHeight] = useState(60);

  const startDrag = (e: React.MouseEvent) => {
     e.preventDefault();
     const startY = e.clientY;
     const startHeight = panelHeight;

     const onMouseMove = (moveEvt: MouseEvent) => {
        const delta = moveEvt.clientY - startY;
        const deltaPercent = (delta / window.innerHeight) * 100;
        let newH = startHeight + deltaPercent;
        if (newH < 20) newH = 20;
        if (newH > 85) newH = 85;
        setPanelHeight(newH);
     };

     const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        window.dispatchEvent(new Event('resize')); 
     };

     document.addEventListener("mousemove", onMouseMove);
     document.addEventListener("mouseup", onMouseUp);
  };

  useEffect(() => {
    setIsClient(true);
    const storedToken = localStorage.getItem("smartapi_token");
    if (!storedToken) {
      router.push("/");
      return;
    }

    const fetchMarketData = async (token: string) => {
      try {
        const res = await fetch("http://localhost:8000/api/market-data", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ mode: "FULL", exchangeTokens: { "NSE": ["26000", "26009", "2885", "1594"] }})
        });
        const json = await res.json();
        if (json.status && json.data && json.data.fetched) {
           setMarketWatch(json.data.fetched.map((f: any) => ({
              symbol: f.tradingSymbol.replace("-EQ", ""),
              ltp: parseFloat(f.ltp).toFixed(2),
              change: parseFloat(f.netChange) > 0 ? `+${f.netChange}` : `${f.netChange}`,
              pChg: parseFloat(f.percentChange) > 0 ? `+${f.percentChange}%` : `${f.percentChange}%`,
           })));
        }
      } catch (e) {
        console.error(e);
      }
    };

    const fetchPositions = async (token: string) => {
      try {
        const res = await fetch("http://localhost:8000/api/positions", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.status && json.data) {
           setPositions(json.data);
        } else {
           setPositions([]);
        }
      } catch (e) {
        console.error(e);
      }
    };

    const fetchPaperTrades = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/paper-trades");
        const json = await res.json();
        if (json.status && json.data) {
           setPaperTrades(json.data);
        }
      } catch (e) {
        console.error(e);
      }
    };

    const fetchAlgos = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/algos");
        const json = await res.json();
        if (json.status && json.data) setAlgos(json.data);
      } catch (e) {}
    };

    const fetchUserStatus = async (token: string) => {
        try {
            const res = await fetch("http://localhost:8000/api/user-status", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const json = await res.json();
            if (json.status) setUserStatus({ funds: json.funds, realM2m: json.m2m, name: json.name });
        } catch(e) {}
    };

    // Initial Fetch
    fetchMarketData(storedToken);
    fetchPositions(storedToken);
    fetchPaperTrades();
    fetchAlgos();
    fetchUserStatus(storedToken);

    // Connect to WebSocket for true live tick data
    const ws = new WebSocket(`ws://localhost:8000/ws/market-data?token=${encodeURIComponent(storedToken)}`);
    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.type === "MARKET_DATA" && msg.data && msg.data.fetched) {
                setMarketWatch((prev) => {
                   return prev.map((p) => {
                      const f = msg.data.fetched.find((i: any) => i.tradingSymbol.replace("-EQ", "") === p.symbol);
                      if (f) {
                          return {
                             ...p,
                             ltp: parseFloat(f.ltp).toFixed(2),
                             ...(f.netChange ? { change: parseFloat(f.netChange) > 0 ? `+${f.netChange}` : `${f.netChange}` } : {}),
                             ...(f.percentChange ? { pChg: parseFloat(f.percentChange) > 0 ? `+${f.percentChange}%` : `${f.percentChange}%` } : {})
                          };
                      }
                      return p;
                   });
                });
            }
        } catch(e) {}
    };

    // Poll other less frequent data every 5 seconds
    const interval = setInterval(() => {
       fetchUserStatus(storedToken);
       if (activeTab === 'POSITIONS' || tradingMode === 'REAL') fetchPositions(storedToken);
       if (activeTab === 'ALGO LOGS') fetchPaperTrades();
       if (currentView === 'ALGOS') fetchAlgos();
    }, 5000);

    return () => {
       clearInterval(interval);
       ws.close();
    };
  }, [router, activeTab, currentView]);

  const toggleAlgoStatus = async (algo: any) => {
      const newStatus = algo.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const updateData = {
          status: newStatus,
          run_days: algo.run_days,
          target_premium: algo.target_premium,
          sl_points: algo.sl_points,
          tp_points: algo.tp_points,
          opt_type: algo.opt_type,
          deploy_days: 1 // default deploy
      };
      try {
          await fetch(`http://localhost:8000/api/algos/${algo.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updateData)
          });
      } catch (e) {}
  };

  const handleUpdateAlgo = async (algoId: number, e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const days = ['0','1','2','3','4'].filter(d => formData.get(`day_${d}`) === 'on').join(',');
      
      const updateData = {
          status: formData.get('status') as str === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
          run_days: days,
          target_premium: parseFloat(formData.get('target_premium') as string),
          sl_points: parseFloat(formData.get('sl_points') as string),
          tp_points: parseFloat(formData.get('tp_points') as string),
          opt_type: formData.get('opt_type') as string,
          deploy_days: parseInt(formData.get('deploy_days') as string)
      };

      try {
          const res = await fetch(`http://localhost:8000/api/algos/${algoId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updateData)
          });
          const json = await res.json();
          if (json.status) alert('Strategy configuration explicitly updated and deployed.');
          else alert('Deployment failed: ' + json.error);
      } catch (err) {}
  };

  const handleLogout = () => {
    localStorage.removeItem("smartapi_token");
    router.push("/");
  };

  if (!isClient) return null; // Prevent hydration errors

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-300 font-sans flex flex-col uppercase selection:bg-emerald-500/30">
      
      <header className="h-16 border-b border-zinc-800/80 bg-[#111] flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981] animate-pulse"></span>
            <span className="text-zinc-100 font-bold tracking-widest text-sm">DEB'S TERMINAL</span>
          </div>

          <div className="flex bg-[#0a0a0a] p-1 rounded-full border border-zinc-800 shadow-inner max-md:hidden ml-2">
             <button onClick={() => { setTradingMode("REAL"); setCurrentView("DASHBOARD"); }} className={`px-4 py-1.5 rounded-full text-[9px] font-bold tracking-widest transition-all ${tradingMode === 'REAL' ? 'bg-[#2962FF] text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>REAL DASHBOARD</button>
             <button onClick={() => { setTradingMode("PAPER"); setCurrentView("DASHBOARD"); }} className={`px-4 py-1.5 rounded-full text-[9px] font-bold tracking-widest transition-all ${tradingMode === 'PAPER' ? 'bg-emerald-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>PAPER / ALGO MODE</button>
          </div>

          <nav className="hidden md:flex items-center gap-1 text-[11px] font-bold tracking-widest pl-2">
            <button onClick={() => setCurrentView('DASHBOARD')} className={`px-3 py-1.5 rounded transition-colors ${currentView === 'DASHBOARD' ? 'bg-zinc-800 text-zinc-100' : 'hover:bg-zinc-800/50 text-zinc-400'}`}>Dashboard</button>
            <button onClick={() => setCurrentView('ALGOS')} className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${currentView === 'ALGOS' ? 'bg-[#2962FF]/10 text-[#2962FF]' : 'hover:bg-zinc-800/50 text-zinc-400'}`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                ALGOS 
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden lg:flex items-center gap-6 tracking-widest font-semibold border-r border-zinc-800/80 pr-6 pl-2">
            <div className="text-right">
              <span className="text-zinc-500 block text-[9px]">FUNDS AVAILABLE</span>
              <span className="text-zinc-200 text-xs font-mono font-bold tracking-tight">₹ {userStatus.funds.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="text-right">
              <span className="text-zinc-500 block text-[9px]">{tradingMode === 'REAL' ? 'REAL M2M P&L' : 'ALGO M2M P&L'}</span>
              {tradingMode === 'REAL' ? (
                 <span className={`text-xs font-mono font-bold ${userStatus.realM2m >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                     {userStatus.realM2m > 0 ? '+' : ''}₹ {userStatus.realM2m.toFixed(2)}
                 </span>
              ) : (
                 <span className={`text-xs font-mono font-bold ${positions.filter(p => p.tradingsymbol?.includes("[ALGO]")).reduce((acc, p) => acc + parseFloat(p.pnl), 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                     {positions.filter(p => p.tradingsymbol?.includes("[ALGO]")).reduce((acc, p) => acc + parseFloat(p.pnl), 0) >= 0 ? '+' : ''}₹ {positions.filter(p => p.tradingsymbol?.includes("[ALGO]")).reduce((acc, p) => acc + parseFloat(p.pnl), 0).toFixed(2)}
                 </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="block text-[9px] text-zinc-500 font-bold tracking-widest uppercase">Angel One</span>
              <span className="block text-[11px] font-bold text-zinc-100 tracking-wider truncate max-w-[120px]">{userStatus.name.toUpperCase()}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="h-8 px-3 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 rounded text-[10px] font-bold tracking-widest transition-colors flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              DISCONNECT
            </button>
          </div>
        </div>
      </header>

      {/* Main Terminal Grid */}
      {currentView === 'DASHBOARD' && (
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Sidebar: Market Watch */}
        <div className="w-full lg:w-80 border-r border-zinc-800/80 bg-[#0f0f0f] flex flex-col shrink-0">
          <div className="p-3 border-b border-zinc-800/80 shrink-0">
            <h2 className="text-[10px] font-bold tracking-widest text-zinc-500 mb-2">Market Watch</h2>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search instrument..." 
                className="w-full bg-[#1a1a1a] border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600 placeholder:text-zinc-600 font-mono lowercase"
              />
              <svg className="absolute right-2 top-2 text-zinc-600" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
              {marketWatch.length === 0 && (
                <div className="p-4 text-center text-xs text-zinc-600 font-bold uppercase tracking-widest mt-10">
                   Loading Market Data...
                </div>
              )}
              {marketWatch.map((item, idx) => {
                const changeStr = String(item.change);
                const isPos = changeStr.startsWith("+") || parseFloat(changeStr) > 0;
                
                // Format for TradingView compatibility
                const tvSymbol = "NSE:" + item.symbol.replace(" 50", "");
                const isSelected = selectedSymbol === tvSymbol;
                
                return (
                  <div 
                    key={idx} 
                    onClick={() => setSelectedSymbol(tvSymbol)}
                    className={`flex items-center justify-between p-3 border-b border-zinc-800/50 cursor-pointer transition-colors ${isSelected ? 'bg-zinc-800/80' : 'hover:bg-[#1a1a1a] group'}`}
                  >
                    <div>
                      <span className="block text-xs font-bold text-zinc-200">{item.symbol}</span>
                    <span className="block text-[10px] text-zinc-600 font-mono mt-0.5">NSE_EQ</span>
                  </div>
                  <div className="text-right">
                    <span className={`block text-xs font-mono font-bold ${isPos ? "text-emerald-400" : "text-red-400"}`}>{item.ltp}</span>
                    <span className="block text-[10px] font-mono text-zinc-500 mt-0.5 group-hover:text-zinc-400 transition-colors">
                      {item.change} ({item.pChg})
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Center Panel: Charts & Active Data */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">
          
          {/* Chart Placeholder Area */}
          <div style={{ height: `${panelHeight}%` }} className="border-b border-zinc-800/80 flex flex-col relative group shrink-0">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-50"></div>
            
            <div className="h-10 border-b border-zinc-800/80 flex items-center px-4 justify-between bg-[#0a0a0a] z-10 shrink-0">
              <div className="flex items-center text-[12px] font-bold tracking-wide text-zinc-400 h-full">
                <span className="text-zinc-200 border-r border-zinc-700/50 pr-4 mr-3">{selectedSymbol.replace("NSE:", "")}</span>
                <span className="cursor-pointer hover:bg-zinc-800/30 p-1.5 rounded-full mr-4"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg></span>
                
                {['1m', '5m', '15m', '30m', '1H', '1D', '1W', '1M'].map(tf => (
                   <button 
                     key={tf} 
                     onClick={() => setTimeframe(tf)}
                     className={`px-2 py-0.5 mx-0.5 rounded transition-colors ${timeframe === tf ? 'text-[#2962FF]' : 'hover:bg-zinc-800/60 text-zinc-300'}`}
                   >{tf}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] tracking-widest rounded">BUY</button>
                <button className="px-2 py-1 bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] tracking-widest rounded">SELL</button>
              </div>
            </div>
            
            <div className="flex-1 relative overflow-hidden bg-[#0a0a0a] p-0">
              <ChartWidget 
                symbol={selectedSymbol} 
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                ltp={Number(marketWatch.find(m => "NSE:" + m.symbol.replace(" 50", "") === selectedSymbol)?.ltp || 0)} 
              />
            </div>
          </div>

          {/* Horizontal Resizer Drag Handle */}
          <div 
             onMouseDown={startDrag} 
             className="h-[5px] w-full cursor-row-resize bg-zinc-800/80 hover:bg-[#2962FF]/80 active:bg-[#2962FF] z-20 shrink-0 transition-colors shadow-2xl relative"
          >
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-[2px] bg-zinc-400 rounded-full pointer-events-none" />
          </div>

          {/* Bottom Panel: Positions & Orders */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#0a0a0a]">
            <div className="h-10 border-b border-zinc-800/80 bg-[#0f0f0f] flex items-center gap-1 px-2 shrink-0">
               {tradingMode === 'REAL' && (
                  <>
                     <button className="px-4 h-full border-b-2 border-[#2962FF] text-zinc-100 text-[10px] font-bold tracking-widest">REAL POSITIONS ({positions.filter(p => !p.tradingsymbol?.includes("[ALGO]")).length})</button>
                     <button className="px-4 h-full text-zinc-500 hover:text-zinc-300 transition-colors text-[10px] font-bold tracking-widest">ORDER BOOK</button>
                  </>
               )}
               {tradingMode === 'PAPER' && (
                  <>
                     <button 
                        onClick={() => setActiveTab("POSITIONS")}
                        className={`px-4 h-full text-[10px] font-bold tracking-widest transition-colors ${activeTab === 'POSITIONS' ? 'border-b-2 border-emerald-500 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>ALGO POSITIONS ({positions.filter(p => p.tradingsymbol?.includes("[ALGO]")).length})</button>
                     <button 
                        onClick={() => setActiveTab("ALGO LOGS")}
                        className={`px-4 h-full text-[10px] font-bold tracking-widest transition-colors ${activeTab === 'ALGO LOGS' ? 'border-b-2 border-[#2962FF] text-[#2962FF]' : 'text-zinc-500 hover:text-[#2962FF]/80'}`}>ALGO LOGS</button>
                  </>
               )}
            </div>
            
            <div className="flex-1 overflow-auto custom-scrollbar">
              {((tradingMode === 'REAL') || (tradingMode === 'PAPER' && activeTab === 'POSITIONS')) && (
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#111] sticky top-0 border-b border-zinc-800/80 z-10">
                  <tr>
                    <th className="p-3 text-[10px] font-bold tracking-widest text-zinc-500 whitespace-nowrap">Instrument</th>
                    <th className="p-3 text-[10px] font-bold tracking-widest text-zinc-500 text-center whitespace-nowrap">Type</th>
                    <th className="p-3 text-[10px] font-bold tracking-widest text-zinc-500 text-right whitespace-nowrap">Qty</th>
                    <th className="p-3 text-[10px] font-bold tracking-widest text-zinc-500 text-right whitespace-nowrap">Avg. Price</th>
                    <th className="p-3 text-[10px] font-bold tracking-widest text-zinc-500 text-right whitespace-nowrap">LTP</th>
                    <th className="p-3 text-[10px] font-bold tracking-widest text-zinc-500 text-right whitespace-nowrap">P&L</th>
                    <th className="p-3 text-[10px] font-bold tracking-widest text-zinc-500 text-right whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-mono font-bold">
                  {(tradingMode === 'REAL' ? positions.filter(p => !p.tradingsymbol?.includes("[ALGO]")) : positions.filter(p => p.tradingsymbol?.includes("[ALGO]"))).length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-zinc-500 font-sans tracking-widest text-[10px]">NO ACTIVE TRADES IN {tradingMode} MODE</td>
                    </tr>
                  )}
                  {(tradingMode === 'REAL' ? positions.filter(p => !p.tradingsymbol?.includes("[ALGO]")) : positions.filter(p => p.tradingsymbol?.includes("[ALGO]"))).map((pos, idx) => {
                     // SmartAPI live structure mapping, with fallback to our demo struct if needed
                     const qty = parseInt(pos.netqty || pos.sellqty || pos.qty || "0");
                     const isLong = qty > 0;
                     const type = isLong ? "LONG" : (qty < 0 ? "SHORT" : "CLOSED");
                     
                     const pnlVal = parseFloat(pos.pnl || pos.m2m || pos.pnl || "0");
                     const isProfit = pnlVal >= 0;
                     const pnlStr = isProfit ? `+₹${pnlVal.toFixed(2)}` : `-₹${Math.abs(pnlVal).toFixed(2)}`;
                     
                     const symbol = pos.tradingsymbol || pos.symbol || "UNKNOWN";
                     const avgPrice = parseFloat(pos.buyavgprice || pos.averageprice || pos.avgPrice || "0");
                     const ltp = parseFloat(pos.ltp || "0");

                     return (
                      <tr key={idx} className="border-b border-zinc-800/40 hover:bg-[#1a1a1a]/50 transition-colors">
                        <td className="p-3 text-zinc-200">{symbol}</td>
                        <td className="p-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] ${isLong ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                            {type}
                          </span>
                        </td>
                        <td className="p-3 text-right text-zinc-300">{qty}</td>
                        <td className="p-3 text-right text-zinc-400">{avgPrice.toFixed(2)}</td>
                        <td className="p-3 text-right text-zinc-200">{ltp.toFixed(2)}</td>
                        <td className={`p-3 text-right ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>{pnlStr}</td>
                        <td className="p-3 text-right">
                           <button className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[9px] tracking-widest border border-zinc-700 font-sans transition-colors">EXIT</button>
                        </td>
                      </tr>
                     )
                  })}
                </tbody>
              </table>
              )}

              {tradingMode === 'PAPER' && activeTab === 'ALGO LOGS' && (
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#111] sticky top-0 border-b border-zinc-800/80 z-10 shadow-lg">
                      <tr>
                        <th className="p-3 text-[9px] font-bold tracking-widest text-[#2962FF] whitespace-nowrap">Time</th>
                        <th className="p-3 text-[9px] font-bold tracking-widest text-[#2962FF] whitespace-nowrap">Symbol</th>
                        <th className="p-3 text-[9px] font-bold tracking-widest text-[#2962FF] whitespace-nowrap text-center">Toss Strategy</th>
                        <th className="p-3 text-[9px] font-bold tracking-widest text-[#2962FF] whitespace-nowrap text-right">Entry</th>
                        <th className="p-3 text-[9px] font-bold tracking-widest text-zinc-600 whitespace-nowrap text-right">SL / TP Boundary</th>
                        <th className="p-3 text-[9px] font-bold tracking-widest text-[#2962FF] whitespace-nowrap text-right">Exit Price</th>
                        <th className="p-3 text-[9px] font-bold tracking-widest text-[#2962FF] whitespace-nowrap text-center">Exit Reason</th>
                        <th className="p-3 text-[9px] font-bold tracking-widest text-[#2962FF] whitespace-nowrap text-right">Net PnL</th>
                        <th className="p-3 text-[9px] font-bold tracking-widest text-[#2962FF] whitespace-nowrap text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-mono font-bold">
                      {paperTrades.length === 0 && (
                        <tr><td colSpan={9} className="p-8 text-center text-zinc-500 font-sans tracking-widest text-[10px]">NO ALGO LOGS RUNNING TODAY</td></tr>
                      )}
                      {paperTrades.map((log: any, idx: number) => (
                         <tr key={idx} className="border-b border-zinc-800/40 hover:bg-[#1a1a1a]/80 transition-colors">
                            <td className="p-3 text-zinc-400 text-[10px] font-sans">{log.entry_time}</td>
                            <td className="p-3 text-zinc-200">{log.symbol}</td>
                            <td className="p-3 text-center">
                               <span className={`px-2 py-0.5 rounded text-[9px] tracking-widest ${log.toss === 'HEAD' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>{log.toss} : {log.type}</span>
                            </td>
                            <td className="p-3 text-right text-zinc-300">₹{log.entry_price}</td>
                            <td className="p-3 text-right text-zinc-500 text-[10px]">-₹{Math.abs(log.entry_price - log.sl).toFixed(0)} / +₹{Math.abs(log.tp - log.entry_price).toFixed(0)}</td>
                            <td className="p-3 text-right text-zinc-200">{log.exit_price !== 0.0 ? `₹${log.exit_price}` : '-'}</td>
                            <td className="p-3 text-center text-zinc-400 text-[10px] tracking-widest font-sans">{log.exit_reason !== 'Pending' ? log.exit_reason : '—'}</td>
                            <td className={`p-3 text-right ${log.net_pnl > 0 ? "text-emerald-400" : log.net_pnl < 0 ? "text-red-400" : "text-zinc-600"}`}>{log.net_pnl !== 0.0 ? `₹${log.net_pnl.toFixed(2)}` : '-'}</td>
                            <td className="p-3 text-center">
                               <span className={`px-2 py-0.5 rounded text-[9px] tracking-widest ${log.status === 'OPEN' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 animate-pulse' : 'bg-zinc-800/80 text-zinc-500 border border-zinc-800'}`}>{log.status}</span>
                            </td>
                         </tr>
                      ))}
                    </tbody>
                  </table>
              )}
            </div>
          </div>
        </div>
      </main>
      )}

      {currentView === 'ALGOS' && (
      <main className="flex-1 flex flex-col overflow-auto bg-[#0a0a0a] p-8 custom-scrollbar">
         <div className="max-w-6xl mx-auto w-full">
            <h1 className="text-xl font-bold text-zinc-100 mb-8 tracking-widest flex items-center gap-3">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2962FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
               ALGORITHMIC STRATEGIES
            </h1>
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {algos.map((algo) => (
                    <div key={algo.id} className={`border rounded-lg bg-[#111] overflow-hidden transition-all ${algo.status === 'ACTIVE' ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'border-zinc-800'}`}>
                        <div className="p-5 border-b border-zinc-800/80 flex items-start justify-between">
                            <div>
                                <h3 className="text-zinc-100 font-bold tracking-wider text-sm mb-1">{algo.name}</h3>
                                <p className="text-zinc-500 text-[11px] leading-relaxed max-w-sm">{algo.description}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest ${algo.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                    {algo.status}
                                </span>
                                {algo.deploy_until && algo.status === 'ACTIVE' && (
                                   <span className="text-[9px] text-zinc-500 tracking-wider">UNTIL {algo.deploy_until.split(' ')[0]}</span>
                                )}
                            </div>
                        </div>

                        <form onSubmit={(e) => handleUpdateAlgo(algo.id, e)} className="p-5 px-6">
                           <input type="hidden" name="status" value={algo.status} />
                           {/* Inputs Grid */}
                           <div className="grid grid-cols-2 gap-x-8 gap-y-6 mb-6">
                               <div>
                                   <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-2">Deploy Window (Days)</label>
                                   <select name="deploy_days" defaultValue="7" className="w-full bg-[#1a1a1a] border border-zinc-800 rounded p-2 text-xs font-mono text-zinc-200 outline-none focus:border-[#2962FF]">
                                       <option value="1">1 Day (EOD Expire)</option>
                                       <option value="7">7 Days (Weekly)</option>
                                       <option value="30">30 Days (Monthly)</option>
                                   </select>
                               </div>

                               <div>
                                   <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-2">Options Bias</label>
                                   <select name="opt_type" defaultValue={algo.opt_type} className="w-full bg-[#1a1a1a] border border-zinc-800 rounded p-2 text-xs font-mono text-zinc-200 outline-none focus:border-[#2962FF]">
                                       <option value="BOTH">TOSS RANDOM (CE / PE)</option>
                                       <option value="CE">CE ONLY (BULLISH)</option>
                                       <option value="PE">PE ONLY (BEARISH)</option>
                                   </select>
                               </div>
                               
                               <div>
                                   <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-2">Target Premium (Rs)</label>
                                   <input type="number" name="target_premium" defaultValue={algo.target_premium} step="0.5" className="w-full bg-[#1a1a1a] border border-zinc-800 rounded p-2 text-xs font-mono text-zinc-200 outline-none focus:border-[#2962FF]"/>
                               </div>
                               
                               <div className="grid grid-cols-2 gap-4">
                                   <div>
                                       <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-2">SL Pts</label>
                                       <input type="number" name="sl_points" defaultValue={algo.sl_points} className="w-full bg-[#1a1a1a] border border-zinc-800 rounded p-2 text-xs font-mono text-red-400 outline-none focus:border-red-500"/>
                                   </div>
                                   <div>
                                       <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-2">TP Pts</label>
                                       <input type="number" name="tp_points" defaultValue={algo.tp_points} className="w-full bg-[#1a1a1a] border border-zinc-800 rounded p-2 text-xs font-mono text-emerald-400 outline-none focus:border-emerald-500"/>
                                   </div>
                               </div>

                               <div className="col-span-2 mt-2">
                                  <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-3">Execute On (Trading Days)</label>
                                  <div className="flex gap-4">
                                      {['Mo', 'Tu', 'We', 'Th', 'Fr'].map((day, idx) => (
                                          <label key={idx} className="flex items-center gap-2 cursor-pointer group">
                                              <input type="checkbox" name={`day_${idx}`} defaultChecked={algo.run_days.includes(idx.toString())} className="accent-[#2962FF] bg-[#1a1a1a] aspect-square transition-all"/>
                                              <span className="text-[10px] font-bold text-zinc-400 group-hover:text-zinc-200 tracking-widest">{day}</span>
                                          </label>
                                      ))}
                                  </div>
                               </div>
                           </div>

                           <div className="flex items-center justify-between pt-5 border-t border-zinc-800/50">
                               <button type="button" onClick={() => toggleAlgoStatus(algo)} className={`px-4 py-2 font-bold tracking-widest text-[10px] rounded transition-colors border ${algo.status === 'ACTIVE' ? 'bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20'}`}>
                                   {algo.status === 'ACTIVE' ? 'TURN OFF' : 'DEPLOY'}
                               </button>
                               <button type="submit" className="px-8 py-2 font-bold tracking-widest text-[10px] bg-zinc-800 text-zinc-100 hover:bg-zinc-700 rounded transition-colors shadow-lg">
                                   SAVE CONFIGURATION
                               </button>
                           </div>
                        </form>
                    </div>
                ))}
            </div>
            {algos.length === 0 && (
                <div className="p-8 text-center text-zinc-500 font-sans tracking-widest text-xs">NO ALGORITHMS FOUND IN DATABASE</div>
            )}
         </div>
      </main>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #0a0a0a;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #27272a;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-corner {
          background: transparent;
        }
      `}} />
    </div>
  );
}
