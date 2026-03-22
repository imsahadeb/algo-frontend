"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, ColorType, CandlestickSeries } from "lightweight-charts";

export default function ChartWidget({ symbol, ltp, timeframe, onTimeframeChange }: { symbol: string, ltp: number, timeframe: string, onTimeframeChange?: (tf: string) => void }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<any>(null);
  const chartRef = useRef<any>(null);
  const dataRef = useRef<any[]>([]);
  const [activeRange, setActiveRange] = useState('All');

  const applyRangeLogic = useCallback((range: string, data: any[]) => {
     if (!chartRef.current || data.length === 0) return;
     const len = data.length;
     const timeScale = chartRef.current.timeScale();
     if (range === 'All') {
         timeScale.fitContent();
         return;
     }

     const lastData = data[len - 1];
     const lastTime = typeof lastData.time === 'number' ? lastData.time * 1000 : new Date(lastData.time).getTime();
     
     let msToSubtract = 0;
     switch(range) {
       case '1D': msToSubtract = 1 * 24 * 60 * 60 * 1000; break;
       case '5D': msToSubtract = 5 * 24 * 60 * 60 * 1000; break;
       case '1M': msToSubtract = 30 * 24 * 60 * 60 * 1000; break;
       case '3M': msToSubtract = 90 * 24 * 60 * 60 * 1000; break;
       case '6M': msToSubtract = 180 * 24 * 60 * 60 * 1000; break;
       case '1Y': msToSubtract = 365 * 24 * 60 * 60 * 1000; break;
       case '5Y': msToSubtract = 5 * 365 * 24 * 60 * 60 * 1000; break;
     }
     
     let fromIndex = 0;
     if (msToSubtract > 0) {
         const targetTime = lastTime - msToSubtract;
         fromIndex = data.findIndex(d => {
             const t = typeof d.time === 'number' ? d.time * 1000 : new Date(d.time).getTime();
             return t >= targetTime;
         });
     } else if (range === 'YTD') {
         const currentYear = new Date().getFullYear();
         fromIndex = data.findIndex(d => {
             const t = typeof d.time === 'number' ? d.time * 1000 : new Date(d.time).getTime();
             return new Date(t).getFullYear() === currentYear;
         });
     }
     
     if (fromIndex === -1) fromIndex = 0;
     timeScale.setVisibleLogicalRange({ from: fromIndex, to: len - 1 });
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a1a1aa",
      },
      grid: {
        vertLines: { color: "#27272a", style: 1 },
        horzLines: { color: "#27272a", style: 1 },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "#27272a",
      },
      rightPriceScale: {
        borderColor: "#27272a",
      }
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });
    
    seriesRef.current = candlestickSeries;
    chartRef.current = chart;

    const fetchHistoricalData = async () => {
       try {
          const res = await fetch(`http://localhost:8000/api/historical/${symbol}?interval=${timeframe}`);
          const json = await res.json();
          if (json.status && json.data && json.data.length > 0) {
             dataRef.current = json.data;
             candlestickSeries.setData(json.data);
             applyRangeLogic(activeRange, json.data);
          }
       } catch (err) {
          console.error("Failed to fetch history:", err);
       }
    };
    
    fetchHistoricalData();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [symbol, timeframe]);

  // Real-time updates effect
  useEffect(() => {
    if (seriesRef.current && ltp > 0 && dataRef.current.length > 0) {
       const lastCandle = dataRef.current[dataRef.current.length - 1];
       
       // Correctly lock the tick's timeframe string exactly back to the current active series item
       const tick = {
         time: lastCandle.time,
         open: lastCandle.open,
         high: Math.max(lastCandle.high, ltp),
         low: Math.min(lastCandle.low, ltp),
         close: ltp
       };
       seriesRef.current.update(tick as any);
    }
  }, [ltp]);

  const changeRange = (range: string) => {
     setActiveRange(range);
     
     let newTf = timeframe;
     if (range === '1D') newTf = '5m';
     else if (range === '5D') newTf = '15m'; 
     else if (range === '1M' || range === '3M' || range === '6M' || range === 'YTD' || range === '1Y') newTf = '1D';
     else if (range === '5Y' || range === 'All') newTf = '1W';

     if (newTf !== timeframe && onTimeframeChange) {
         onTimeframeChange(newTf);
     } else {
         applyRangeLogic(range, dataRef.current);
     }
  };

  return (
    <div className="w-full h-full flex flex-col group bg-[#0a0a0a]">
      {/* Native Chart Canvas */}
      <div ref={chartContainerRef} className="flex-1 w-full [&_a]:!hidden" />

      {/* Logical Range (Zoom) Toolbar placed precisely bottom-left natively alongside X-axis mimicking TradingView */}
      <div className="w-full shrink-0 flex items-center px-4 py-1.5 gap-4 border-t border-zinc-800/30">
         {['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'All'].map(r => (
            <button 
               key={r} 
               onClick={() => changeRange(r)} 
               className={`text-[12px] font-bold cursor-pointer transition-colors ${activeRange === r ? 'text-[#2962FF]' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
               {r}
            </button>
         ))}
      </div>
    </div>
  );
}
