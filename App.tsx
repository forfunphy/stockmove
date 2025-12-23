import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  TrendingUp, 
  Settings, 
  BarChart2,
  Upload,
  Calendar,
  FileText,
  Download,
  MousePointerClick,
  Target
} from 'lucide-react';
import { RAW_CSV_DATA } from './constants';
import { StockData, BacktestConfig, StrategyType, PriceType, Trade, MaVisibility } from './types';
import CandlestickChart from './components/CandlestickChart';

// --- Helper: Calculate MAs ---
const calculateMovingAverages = (data: StockData[]): StockData[] => {
  const periods = [5, 10, 20, 60, 120, 240];
  
  return data.map((item, index, array) => {
    const newItem = { ...item };
    
    periods.forEach(period => {
      if (index >= period - 1) {
        const slice = array.slice(index - period + 1, index + 1);
        const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
        const avg = sum / period;
        // @ts-ignore - dynamic assignment
        newItem[`ma${period}`] = avg;
      }
    });
    
    return newItem;
  });
};

// --- Helper: Parse CSV (New 8-column format) ---
const parseCSV = (csv: string): Record<string, StockData[]> => {
  const lines = csv.trim().split('\n');
  const stockMap: Record<string, StockData[]> = {};
  
  // Skip header (index 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Improved regex to handle quoted fields and commas
    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    
    if (matches && matches.length >= 7) {
      const clean = (val: string) => parseFloat(val.replace(/"/g, '').replace(/,/g, ''));
      const dateStr = matches[0].replace(/"/g, '');
      const code = matches[1].replace(/"/g, '');
      const name = matches[2].replace(/"/g, '');
      
      const timestamp = new Date(dateStr).getTime();
      
      if (!isNaN(timestamp)) {
        if (!stockMap[code]) {
          stockMap[code] = [];
        }
        
        stockMap[code].push({
          date: dateStr,
          code: code,
          name: name,
          open: clean(matches[3]),
          high: clean(matches[4]),
          low: clean(matches[5]),
          close: clean(matches[6]),
          volume: matches.length >= 8 ? clean(matches[7]) : 0,
          timestamp: timestamp,
        });
      }
    }
  }
  
  // Sort and calculate MAs for each stock
  Object.keys(stockMap).forEach(code => {
    const sorted = stockMap[code].sort((a, b) => a.timestamp - b.timestamp);
    stockMap[code] = calculateMovingAverages(sorted);
  });

  return stockMap;
};

const App: React.FC = () => {
  // --- Data Management State ---
  const [stockDataMap, setStockDataMap] = useState<Record<string, StockData[]>>({});
  const [selectedStockCode, setSelectedStockCode] = useState<string>('');
  
  // --- Simulation State ---
  const [currentData, setCurrentData] = useState<StockData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(100);
  const [windowSize, setWindowSize] = useState(60);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [maVisibility, setMaVisibility] = useState<MaVisibility>({
    ma5: true, ma10: true, ma20: true, ma60: true, ma120: false, ma240: false,
  });
  
  const [trades, setTrades] = useState<Trade[]>([]);
  const [currentPosition, setCurrentPosition] = useState<Trade | null>(null);
  const [balance, setBalance] = useState(1000000);
  
  const [config, setConfig] = useState<BacktestConfig>({
    strategy: StrategyType.BUY_TODAY_SELL_TOMORROW,
    priceType: PriceType.CLOSE,
    startYear: 2024,
    startMonth: 1,
    buyDay: 1,
    sellDay: 3,
    initialCapital: 1000000,
  });

  const allStocks = useMemo(() => {
    return Object.keys(stockDataMap).map(code => ({
      code,
      name: stockDataMap[code][0]?.name || code
    }));
  }, [stockDataMap]);

  const activeStockData = useMemo(() => {
    return selectedStockCode ? stockDataMap[selectedStockCode] || [] : [];
  }, [selectedStockCode, stockDataMap]);

  const availableYears = useMemo(() => {
    if (activeStockData.length === 0) return [2024];
    const years = new Set(activeStockData.map(d => new Date(d.date).getFullYear()));
    return Array.from(years).sort((a: number, b: number) => a - b);
  }, [activeStockData]);

  // --- Initialization ---
  useEffect(() => {
    const parsed = parseCSV(RAW_CSV_DATA);
    setStockDataMap(parsed);
    const firstCode = Object.keys(parsed)[0];
    if (firstCode) {
      setSelectedStockCode(firstCode);
      initializeSimulation(parsed[firstCode], config.startYear, config.startMonth);
    }
  }, []);

  const initializeSimulation = (data: StockData[], year: number, month: number) => {
    if (!data || data.length === 0) return;
    
    const targetDate = new Date(year, month - 1, 1); 
    const targetTimestamp = targetDate.getTime();
    let startIndex = data.findIndex(d => d.timestamp >= targetTimestamp);
    if (startIndex === -1) startIndex = 0;

    setCurrentIndex(startIndex);
    const startSlice = Math.max(0, startIndex + 1 - windowSize);
    setCurrentData(data.slice(startSlice, startIndex + 1));
    setBalance(1000000);
    setTrades([]);
    setCurrentPosition(null);
    setIsPlaying(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        try {
          const parsed = parseCSV(text);
          const firstCode = Object.keys(parsed)[0];
          if (!firstCode) {
            alert("格式錯誤，請確保 A:日期 B:代碼 C:名稱 D:開盤 E:最高 F:最低 G:收盤 H:成交量");
            return;
          }
          setStockDataMap(parsed);
          setSelectedStockCode(firstCode);
          
          const firstDate = new Date(parsed[firstCode][0].date);
          const newConfig = {
            ...config,
            startYear: firstDate.getFullYear(),
            startMonth: firstDate.getMonth() + 1
          };
          setConfig(newConfig);
          initializeSimulation(parsed[firstCode], newConfig.startYear, newConfig.startMonth);
        } catch (error) {
          alert("讀取檔案失敗");
        }
      }
    };
    reader.readAsText(file);
  };

  const handleStockChange = (code: string) => {
    setSelectedStockCode(code);
    initializeSimulation(stockDataMap[code], config.startYear, config.startMonth);
  };

  const resetSimulation = () => {
    initializeSimulation(activeStockData, config.startYear, config.startMonth);
  };

  // --- Simulation Loop ---
  useEffect(() => {
    let intervalId: any;
    if (isPlaying && currentIndex < activeStockData.length - 1) {
      intervalId = setInterval(() => {
        const nextIndex = currentIndex + 1;
        const todayData = activeStockData[nextIndex];
        setCurrentData(prev => {
            const newData = [...prev, todayData];
            return newData.length > windowSize ? newData.slice(newData.length - windowSize) : newData;
        });
        setCurrentIndex(nextIndex);
        processStrategy(todayData);
      }, speed);
    } else if (currentIndex >= activeStockData.length - 1) {
      setIsPlaying(false);
    }
    return () => clearInterval(intervalId);
  }, [isPlaying, currentIndex, activeStockData, speed, config, currentPosition, windowSize]);

  const processStrategy = (day: StockData) => {
    if (config.strategy === StrategyType.MANUAL) return;
    const price = config.priceType === PriceType.OPEN ? day.open : day.close;
    
    if (currentPosition) {
        const daysHeld = (day.timestamp - new Date(currentPosition.entryDate).getTime()) / (1000 * 60 * 60 * 24);
        if (shouldSell(day, config, true, daysHeld)) {
            const profit = price - currentPosition.entryPrice;
            const closed: Trade = { ...currentPosition, exitDate: day.date, exitPrice: price, profit, profitPercent: (profit / currentPosition.entryPrice) * 100, status: 'CLOSED' };
            setTrades(prev => [...prev, closed]);
            setBalance(prev => prev + profit);
            setCurrentPosition(null);
        }
    } else if (shouldBuy(day, config, false)) {
        setCurrentPosition({ entryDate: day.date, entryPrice: price, status: 'OPEN', type: 'LONG' });
    }
  };

  const shouldBuy = (day: StockData, cfg: BacktestConfig, hasPos: boolean) => {
    const dow = new Date(day.date).getDay();
    if (hasPos || cfg.strategy === StrategyType.MANUAL) return false;
    if (cfg.strategy === StrategyType.BUY_TODAY_SELL_TOMORROW) return true;
    if (cfg.strategy === StrategyType.WEEKDAY_STRATEGY) return dow === cfg.buyDay;
    return false;
  };

  const shouldSell = (day: StockData, cfg: BacktestConfig, hasPos: boolean, held: number) => {
    const dow = new Date(day.date).getDay();
    if (!hasPos || cfg.strategy === StrategyType.MANUAL) return false;
    if (cfg.strategy === StrategyType.BUY_TODAY_SELL_TOMORROW) return held >= 1;
    if (cfg.strategy === StrategyType.WEEKDAY_STRATEGY) return dow === cfg.sellDay;
    return false;
  };

  const handleManualBuy = () => {
    if (currentPosition) return;
    const day = currentData[currentData.length - 1];
    const price = config.priceType === PriceType.OPEN ? day.open : day.close;
    setCurrentPosition({ entryDate: day.date, entryPrice: price, status: 'OPEN', type: 'LONG' });
  };

  const handleManualSell = () => {
    if (!currentPosition) return;
    const day = currentData[currentData.length - 1];
    const price = config.priceType === PriceType.OPEN ? day.open : day.close;
    const profit = price - currentPosition.entryPrice;
    setTrades([...trades, { ...currentPosition, exitDate: day.date, exitPrice: price, profit, profitPercent: (profit/currentPosition.entryPrice)*100, status: 'CLOSED' }]);
    setBalance(balance + profit);
    setCurrentPosition(null);
  };

  const winRate = useMemo(() => {
      const closed = trades.filter(t => t.status === 'CLOSED');
      return closed.length ? (closed.filter(t => (t.profit || 0) > 0).length / closed.length) * 100 : 0;
  }, [trades]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-900 text-gray-200 font-sans">
      <div className="w-80 flex-shrink-0 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-6 border-b border-gray-700">
           <h1 className="text-2xl font-bold text-red-500 flex items-center gap-2"><TrendingUp className="w-8 h-8" />台股回測 Pro</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2"><FileText size={14}/> 資料與標的</h2>
              
              <div>
                <label className="block text-xs text-gray-500 mb-1">選擇回測標的</label>
                <select 
                  value={selectedStockCode}
                  onChange={(e) => handleStockChange(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none"
                >
                  {allStocks.map(s => <option key={s.code} value={s.code}>{s.code} {s.name}</option>)}
                </select>
              </div>

              <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors border border-gray-600 border-dashed"><Upload size={16} />匯入 CSV</button>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv, .txt" className="hidden" />
              <p className="text-[10px] text-gray-500 text-center">格式: 日期, 代碼, 名稱, 開盤, 最高, 最低, 收盤, 成交量</p>
            </div>

            <div className="space-y-4 border-t border-gray-700 pt-6">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">控制項</h2>
                <div className="flex gap-2">
                    <button onClick={() => setIsPlaying(!isPlaying)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold ${isPlaying ? 'bg-yellow-600' : 'bg-green-600'}`}>{isPlaying ? <Pause size={18}/> : <Play size={18}/>}</button>
                    <button onClick={resetSimulation} className="p-3 bg-gray-700 rounded-lg"><RotateCcw size={18} /></button>
                </div>
                <div className="space-y-3">
                   <div className="flex justify-between text-xs"><label>播放速度</label><span>{speed}ms</span></div>
                   <input type="range" min="10" max="1000" step="10" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-full accent-blue-500 h-1 rounded-lg appearance-none cursor-pointer" />
                   <div className="flex justify-between text-xs"><label>K棒數量</label><span>{windowSize}</span></div>
                   <input type="range" min="20" max="200" step="10" value={windowSize} onChange={(e) => setWindowSize(Number(e.target.value))} className="w-full accent-blue-500 h-1 rounded-lg appearance-none cursor-pointer" />
                </div>
            </div>

            {config.strategy === StrategyType.MANUAL && (
                 <div className="space-y-4 border-t border-gray-700 pt-6">
                    <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2"><MousePointerClick size={14}/> 手動交易</h2>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={handleManualBuy} disabled={!!currentPosition} className={`py-3 rounded-lg font-bold ${!!currentPosition ? 'bg-gray-700 text-gray-500' : 'bg-red-600'}`}>買進</button>
                        <button onClick={handleManualSell} disabled={!currentPosition} className={`py-3 rounded-lg font-bold ${!currentPosition ? 'bg-gray-700 text-gray-500' : 'bg-green-600'}`}>賣出</button>
                    </div>
                 </div>
            )}

            <div className="space-y-4 border-t border-gray-700 pt-6">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Settings size={14}/> 策略與時間</h2>
                <div className="grid grid-cols-2 gap-2">
                    <select value={config.startYear} onChange={(e) => { setConfig({...config, startYear: Number(e.target.value)}); initializeSimulation(activeStockData, Number(e.target.value), config.startMonth); }} className="bg-gray-700 border border-gray-600 rounded p-1 text-xs">
                        {availableYears.map(y => <option key={y} value={y}>{y}年</option>)}
                    </select>
                    <select value={config.startMonth} onChange={(e) => { setConfig({...config, startMonth: Number(e.target.value)}); initializeSimulation(activeStockData, config.startYear, Number(e.target.value)); }} className="bg-gray-700 border border-gray-600 rounded p-1 text-xs">
                        {Array.from({length:12},(_,i)=>i+1).map(m => <option key={m} value={m}>{m}月</option>)}
                    </select>
                </div>
                <select value={config.strategy} onChange={(e) => setConfig({...config, strategy: e.target.value as StrategyType})} className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-xs">
                    <option value={StrategyType.BUY_TODAY_SELL_TOMORROW}>隔日沖 (今買明賣)</option>
                    <option value={StrategyType.WEEKDAY_STRATEGY}>星期策略</option>
                    <option value={StrategyType.MANUAL}>手動進出</option>
                </select>
            </div>

            <div className="space-y-4 border-t border-gray-700 pt-6">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2"><BarChart2 size={14}/> 統計數據</h2>
                <div className="grid grid-cols-2 gap-3">
                     <div className="bg-gray-700/50 p-2 rounded text-center"><div className="text-[10px] text-gray-500">交易數</div><div className="text-lg font-mono">{trades.filter(t=>t.status==='CLOSED').length}</div></div>
                     <div className="bg-gray-700/50 p-2 rounded text-center"><div className="text-[10px] text-gray-500">勝率</div><div className="text-lg font-mono">{winRate.toFixed(1)}%</div></div>
                     <div className="bg-gray-700/50 p-2 rounded text-center col-span-2"><div className="text-[10px] text-gray-500">總損益 (點數)</div><div className={`text-xl font-bold font-mono ${trades.reduce((a,t)=>a+(t.profit||0),0)>=0?'text-red-500':'text-green-500'}`}>{trades.reduce((a,t)=>a+(t.profit||0),0).toLocaleString(undefined, {maximumFractionDigits:2})}</div></div>
                </div>
            </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
         <div className="h-16 bg-gray-800 border-b border-gray-700 flex items-center px-6 justify-between">
            <div className="flex items-center gap-4">
                <div className="text-xl font-bold text-white flex items-center gap-2">
                  <Target className="text-red-500 w-5 h-5"/>
                  {activeStockData[0]?.name || '未選擇'} ({selectedStockCode})
                </div>
                <div className="text-sm font-mono text-gray-400 bg-gray-900 px-3 py-1 rounded">
                    {currentData.length > 0 ? currentData[currentData.length - 1].date : '--/--/--'}
                </div>
                <div className={`px-2 py-0.5 rounded text-xs font-bold ${currentPosition ? 'bg-blue-900 text-blue-200' : 'bg-gray-700 text-gray-400'}`}>
                    {currentPosition ? '持有部位' : '空手'}
                </div>
            </div>
         </div>

         <div className="flex-1 p-4 flex flex-col min-h-0">
            <div className="w-full h-full bg-gray-800 rounded-lg shadow-inner overflow-hidden border border-gray-700 p-2">
                {currentData.length > 0 ? (
                    <CandlestickChart data={currentData} trades={currentPosition ? [...trades, currentPosition] : trades} maVisibility={maVisibility} setMaVisibility={setMaVisibility} />
                ) : <div className="flex items-center justify-center h-full text-gray-500 animate-pulse">載入資料中...</div>}
            </div>
         </div>
         
         <div className="h-48 bg-gray-800 border-t border-gray-700 flex flex-col overflow-hidden">
            <div className="px-4 py-2 bg-gray-750 border-b border-gray-700 text-xs font-bold text-gray-400 uppercase">交易紀錄</div>
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-xs">
                    <thead className="bg-gray-800 sticky top-0">
                        <tr className="text-gray-500 border-b border-gray-700">
                            <th className="p-2">#</th><th className="p-2">進場日</th><th className="p-2">價位</th><th className="p-2">出場日</th><th className="p-2">價位</th><th className="p-2 text-right">損益</th>
                        </tr>
                    </thead>
                    <tbody className="font-mono divide-y divide-gray-700">
                        {[...trades].reverse().map((t, i) => (
                            <tr key={i} className="hover:bg-gray-700/30">
                                <td className="p-2 text-gray-500">{trades.length - i}</td><td className="p-2 text-blue-300">{t.entryDate}</td><td className="p-2">{t.entryPrice.toFixed(2)}</td><td className="p-2 text-yellow-300">{t.exitDate || '-'}</td><td className="p-2">{t.exitPrice?.toFixed(2) || '-'}</td><td className={`p-2 text-right font-bold ${t.profit && t.profit > 0 ? 'text-red-500' : 'text-green-500'}`}>{t.profit?.toFixed(2) || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
         </div>
      </div>
    </div>
  );
};

export default App;