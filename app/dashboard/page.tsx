"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  
  const [marketWatch, setMarketWatch] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);

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

    // Initial Fetch
    fetchMarketData(storedToken);
    fetchPositions(storedToken);

    // Poll market data every 3 seconds for live visual updates
    const interval = setInterval(() => {
       fetchMarketData(storedToken);
    }, 3000);

    return () => clearInterval(interval);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("smartapi_token");
    router.push("/");
  };

  if (!isClient) return null; // Prevent hydration errors

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-300 font-sans flex flex-col uppercase selection:bg-emerald-500/30">
      
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-zinc-800/80 bg-[#111] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 bg-emerald-500 rounded-sm shadow-[0_0_10px_#10b981]"></span>
            <span className="text-zinc-100 font-bold tracking-widest text-sm">SMARTAPI TERMINAL</span>
          </div>
          <nav className="hidden md:flex items-center gap-1 text-[11px] font-bold tracking-widest">
            <button className="px-3 py-1.5 rounded bg-zinc-800 text-zinc-100">Dashboard</button>
            <button className="px-3 py-1.5 rounded hover:bg-zinc-800/50 hover:text-zinc-100 transition-colors">Orders</button>
            <button className="px-3 py-1.5 rounded hover:bg-zinc-800/50 hover:text-zinc-100 transition-colors">Positions</button>
            <button className="px-3 py-1.5 rounded hover:bg-zinc-800/50 hover:text-zinc-100 transition-colors">Algos</button>
          </nav>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden lg:flex items-center gap-4 text-[10px] tracking-widest font-semibold border-r border-zinc-800 pr-6">
            <div>
              <span className="text-zinc-500 block">Funds Available</span>
              <span className="text-zinc-200 text-xs">₹ 14,52,430.00</span>
            </div>
            <div>
              <span className="text-zinc-500 block">M2M P&L</span>
              <span className="text-emerald-400 text-xs">+₹ 5,059.00</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="block text-[10px] text-zinc-500 font-bold tracking-wider">Angel One</span>
              <span className="block text-xs font-bold text-zinc-200">User S273572</span>
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
              return (
                <div key={idx} className="flex items-center justify-between p-3 border-b border-zinc-800/50 hover:bg-[#1a1a1a] cursor-pointer group transition-colors">
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
          <div className="h-[55%] border-b border-zinc-800/80 flex flex-col relative group">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-50"></div>
            
            <div className="h-10 border-b border-zinc-800/80 flex items-center px-4 justify-between bg-[#0f0f0f] z-10 shrink-0">
              <div className="flex items-center gap-4 text-[10px] font-bold tracking-widest text-zinc-400">
                <span className="text-zinc-200 border-b-2 border-emerald-500 pb-[10px] pt-[8px]">NIFTY 50 . 1M</span>
                <span className="hover:text-zinc-200 cursor-pointer">5M</span>
                <span className="hover:text-zinc-200 cursor-pointer">15M</span>
                <span className="hover:text-zinc-200 cursor-pointer">1D</span>
              </div>
              <div className="flex gap-2">
                <button className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] tracking-widest rounded">BUY</button>
                <button className="px-2 py-1 bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] tracking-widest rounded">SELL</button>
              </div>
            </div>
            
            <div className="flex-1 flex items-center justify-center relative overflow-hidden">
               {/* Aesthetic Chart lines */}
               <svg className="absolute inset-0 w-full h-full opacity-30" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <polyline fill="none" stroke="#10b981" strokeWidth="0.5" points="0,80 10,75 20,85 30,50 40,60 50,40 60,45 70,20 80,30 90,10 100,15" />
                  <polyline fill="rgba(16,185,129,0.1)" stroke="none" points="0,100 0,80 10,75 20,85 30,50 40,60 50,40 60,45 70,20 80,30 90,10 100,15 100,100" />
               </svg>
               <p className="text-xs text-zinc-700 tracking-widest font-bold z-10 border border-zinc-800 bg-[#0a0a0a]/80 px-4 py-2 rounded">SMARTAPI STREAMING CHART (PLACEHOLDER)</p>
            </div>
          </div>

          {/* Bottom Panel: Positions & Orders */}
          <div className="flex-1 flex flex-col min-h-[300px]">
            <div className="h-10 border-b border-zinc-800/80 bg-[#0f0f0f] flex items-center gap-1 px-2 shrink-0">
              <button className="px-4 h-full border-b-2 border-emerald-500 text-zinc-200 text-[10px] font-bold tracking-widest">OPEN POSITIONS (3)</button>
              <button className="px-4 h-full text-zinc-500 hover:text-zinc-300 transition-colors text-[10px] font-bold tracking-widest">ORDER BOOK</button>
              <button className="px-4 h-full text-zinc-500 hover:text-zinc-300 transition-colors text-[10px] font-bold tracking-widest">ALGO LOGS</button>
            </div>
            
            <div className="flex-1 overflow-auto custom-scrollbar">
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
                  {positions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-zinc-500 font-sans tracking-widest text-[10px]">NO ACTIVE POSITIONS IN ACCOUNT</td>
                    </tr>
                  )}
                  {positions.map((pos, idx) => {
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
            </div>
          </div>
        </div>
      </main>

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
