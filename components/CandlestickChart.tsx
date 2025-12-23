import React from 'react';
import {
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceDot,
} from 'recharts';
import { StockData, Trade, MaVisibility } from '../types';

interface CandlestickChartProps {
  data: StockData[];
  trades: Trade[];
  maVisibility: MaVisibility;
  setMaVisibility: React.Dispatch<React.SetStateAction<MaVisibility>>;
}

const MA_COLORS = {
  ma5: '#ffffff', // White
  ma10: '#facc15', // Yellow
  ma20: '#a855f7', // Purple
  ma60: '#22c55e', // Green
  ma120: '#3b82f6', // Blue
  ma240: '#f97316', // Orange
};

const CandlestickChart: React.FC<CandlestickChartProps> = ({ data, trades, maVisibility, setMaVisibility }) => {
  // Find entries and exits for current data slice
  const getTradeMarker = (item: StockData) => {
    const entry = trades.find((t) => t.entryDate === item.date);
    const exit = trades.find((t) => t.exitDate === item.date);
    return { entry, exit };
  };

  const formattedData = data.map((d) => {
    const isUp = d.close > d.open;
    const isDown = d.close < d.open;
    const color = isUp ? '#ef4444' : isDown ? '#22c55e' : '#fbbf24';

    return {
      ...d,
      // We use [low, high] for the Bar to ensure the SVG element covers the full height
      // This allows us to calculate internal positions (Open/Close) accurately
      candleRange: [d.low, d.high],
      color, 
    };
  });

  // Custom Candlestick Shape
  const renderCandle = (props: any) => {
    const { x, y, width, height, payload } = props;
    const { open, close, high, low, color } = payload;
    
    // Use pre-calculated color from formattedData for consistency
    const stroke = color;
    const fill = color;
    const isFlat = open === close;

    // Recharts passes 'y' as the top pixel coordinate (High price)
    // 'height' is the total height in pixels (High - Low)
    
    const totalRange = high - low;
    
    // Handle the case where High === Low (completely flat day)
    if (totalRange === 0 || height === 0) {
       const centerY = y;
       return (
          <line 
            x1={x} 
            y1={centerY} 
            x2={x + width} 
            y2={centerY} 
            stroke={stroke} 
            strokeWidth={2} 
          />
       );
    }

    const pixelRatio = height / totalRange;

    // Calculate Open and Close offsets from the Top (High)
    // SVG Coordinate: 0 is top. 
    // y is High. y + height is Low.
    
    const openOffset = (high - open) * pixelRatio;
    const closeOffset = (high - close) * pixelRatio;

    const bodyTopOffset = Math.min(openOffset, closeOffset);
    const bodyBottomOffset = Math.max(openOffset, closeOffset);
    
    let bodyHeight = bodyBottomOffset - bodyTopOffset;
    
    // Ensure the body is at least 1px high so it's visible, unless it's perfectly flat
    if (bodyHeight < 1 && !isFlat) bodyHeight = 1;
    
    // For flat candles (Open == Close), draw a stronger line
    if (isFlat) bodyHeight = 1.5;

    const centerX = x + width / 2;
    const bodyY = y + bodyTopOffset;

    return (
      <g>
        {/* Wick (High to Low) - The central line */}
        <line
          x1={centerX}
          y1={y}
          x2={centerX}
          y2={y + height}
          stroke={stroke}
          strokeWidth={1.5}
        />
        {/* Body (Open to Close) */}
        <rect
          x={x}
          y={bodyY}
          width={width}
          height={bodyHeight}
          fill={isFlat ? stroke : fill} // If flat, use stroke color (no fill)
          stroke="none"
        />
      </g>
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
     if (active && payload && payload.length) {
       // The payload source might differ depending on which chart triggered it,
       // but since dataKey matches, payload[0].payload should be the full data object.
       const data = payload[0].payload;
       const isUp = data.close > data.open;
       const isDown = data.close < data.open;
       const colorClass = isUp ? 'text-red-400' : isDown ? 'text-green-400' : 'text-yellow-400';
       
       return (
         <div className="bg-gray-800 p-3 border border-gray-700 rounded shadow-lg text-sm z-50">
           <p className="font-bold mb-2 text-gray-200">{label}</p>
           <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2">
             <p className="text-gray-400">開盤:</p> <p className="text-right text-white font-mono">{data.open}</p>
             <p className="text-gray-400">最高:</p> <p className="text-right text-white font-mono">{data.high}</p>
             <p className="text-gray-400">最低:</p> <p className="text-right text-white font-mono">{data.low}</p>
             <p className="text-gray-400">收盤:</p> <p className={`text-right font-mono font-bold ${colorClass}`}>{data.close}</p>
             <p className="text-gray-400">成交量:</p> <p className="text-right text-white font-mono">{data.volume ? data.volume.toLocaleString() : 'N/A'}</p>
           </div>
           
           {/* MA Values in Tooltip */}
           <div className="border-t border-gray-600 pt-2 grid grid-cols-2 gap-x-4 gap-y-1">
             {maVisibility.ma5 && data.ma5 && <><p style={{color: MA_COLORS.ma5}}>MA5:</p> <p className="text-right font-mono text-gray-300">{data.ma5.toFixed(2)}</p></>}
             {maVisibility.ma10 && data.ma10 && <><p style={{color: MA_COLORS.ma10}}>MA10:</p> <p className="text-right font-mono text-gray-300">{data.ma10.toFixed(2)}</p></>}
             {maVisibility.ma20 && data.ma20 && <><p style={{color: MA_COLORS.ma20}}>MA20:</p> <p className="text-right font-mono text-gray-300">{data.ma20.toFixed(2)}</p></>}
             {maVisibility.ma60 && data.ma60 && <><p style={{color: MA_COLORS.ma60}}>MA60:</p> <p className="text-right font-mono text-gray-300">{data.ma60.toFixed(2)}</p></>}
             {maVisibility.ma120 && data.ma120 && <><p style={{color: MA_COLORS.ma120}}>MA120:</p> <p className="text-right font-mono text-gray-300">{data.ma120.toFixed(2)}</p></>}
             {maVisibility.ma240 && data.ma240 && <><p style={{color: MA_COLORS.ma240}}>MA240:</p> <p className="text-right font-mono text-gray-300">{data.ma240.toFixed(2)}</p></>}
           </div>
         </div>
       );
     }
     return null;
  };

  const toggleMA = (key: keyof MaVisibility) => {
    setMaVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex flex-col w-full h-full gap-2 relative group">
      
      {/* MA Toggles Overlay - Absolute Top Right */}
      <div className="absolute top-2 right-14 z-20 flex flex-wrap gap-2 bg-gray-800/80 p-2 rounded border border-gray-700 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200">
         {[
           { k: 'ma5', label: '5日', color: MA_COLORS.ma5 },
           { k: 'ma10', label: '10日', color: MA_COLORS.ma10 },
           { k: 'ma20', label: '20日', color: MA_COLORS.ma20 },
           { k: 'ma60', label: '60日', color: MA_COLORS.ma60 },
           { k: 'ma120', label: '120日', color: MA_COLORS.ma120 },
           { k: 'ma240', label: '240日', color: MA_COLORS.ma240 },
         ].map(({k, label, color}) => (
            <label key={k} className="flex items-center gap-1 cursor-pointer hover:bg-gray-700 px-1 rounded">
               <input 
                 type="checkbox" 
                 checked={maVisibility[k as keyof MaVisibility]} 
                 onChange={() => toggleMA(k as keyof MaVisibility)}
                 className="w-3 h-3 rounded accent-blue-500"
               />
               <span className="text-xs font-bold" style={{color}}>{label}</span>
            </label>
         ))}
      </div>

      {/* Top: Price Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart 
            syncId="chartId"
            data={formattedData} 
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} vertical={false} />
            <XAxis dataKey="date" hide />
            <YAxis 
              domain={['auto', 'auto']} 
              stroke="#9ca3af" 
              tick={{ fontSize: 12 }}
              width={60}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: '#6b7280', strokeDasharray: '4 4' }}
            />
            
            {/* The Candle uses candleRange [low, high] for layout */}
            <Bar
              dataKey="candleRange"
              shape={renderCandle}
              isAnimationActive={false}
            />

            {/* Moving Averages */}
            {maVisibility.ma5 && <Line type="monotone" dataKey="ma5" stroke={MA_COLORS.ma5} dot={false} strokeWidth={1} isAnimationActive={false} />}
            {maVisibility.ma10 && <Line type="monotone" dataKey="ma10" stroke={MA_COLORS.ma10} dot={false} strokeWidth={1} isAnimationActive={false} />}
            {maVisibility.ma20 && <Line type="monotone" dataKey="ma20" stroke={MA_COLORS.ma20} dot={false} strokeWidth={1} isAnimationActive={false} />}
            {maVisibility.ma60 && <Line type="monotone" dataKey="ma60" stroke={MA_COLORS.ma60} dot={false} strokeWidth={1} isAnimationActive={false} />}
            {maVisibility.ma120 && <Line type="monotone" dataKey="ma120" stroke={MA_COLORS.ma120} dot={false} strokeWidth={1} isAnimationActive={false} />}
            {maVisibility.ma240 && <Line type="monotone" dataKey="ma240" stroke={MA_COLORS.ma240} dot={false} strokeWidth={1} isAnimationActive={false} />}

            {/* Buy Markers */}
            {formattedData.map((d, i) => {
                const { entry } = getTradeMarker(d);
                if (entry) {
                    return (
                        <ReferenceDot
                            key={`buy-${i}`}
                            x={d.date}
                            y={d.low * 0.995} // Place slightly below Low
                            r={5}
                            fill="#3b82f6" // Blue
                            stroke="#fff"
                            strokeWidth={1}
                            label={{ position: 'bottom', value: 'B', fill: '#60a5fa', fontSize: 12, fontWeight: 'bold' }}
                        />
                    )
                }
                return null;
            })}

            {/* Sell Markers */}
            {formattedData.map((d, i) => {
                const { exit } = getTradeMarker(d);
                if (exit) {
                    return (
                        <ReferenceDot
                            key={`sell-${i}`}
                            x={d.date}
                            y={d.high * 1.005} // Place slightly above High
                            r={5}
                            fill="#f59e0b" // Amber
                            stroke="#fff"
                            strokeWidth={1}
                            label={{ position: 'top', value: 'S', fill: '#fbbf24', fontSize: 12, fontWeight: 'bold' }}
                        />
                    )
                }
                return null;
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom: Volume Chart */}
      <div className="h-[20%] min-h-[100px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            syncId="chartId"
            data={formattedData}
            margin={{ top: 0, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} vertical={false} />
            <XAxis 
              dataKey="date" 
              stroke="#9ca3af" 
              tick={{ fontSize: 12 }} 
              minTickGap={15}
            />
            <YAxis 
               width={60} 
               stroke="#9ca3af" 
               tick={{ fontSize: 10 }}
               tickFormatter={(val) => {
                   if (val === 0) return '';
                   if (val >= 1000000) return `${(val/1000000).toFixed(1)}M`;
                   if (val >= 1000) return `${(val/1000).toFixed(1)}K`;
                   return val;
               }}
            />
            <Tooltip
               content={<CustomTooltip />}
               cursor={{ stroke: '#6b7280', strokeDasharray: '4 4' }}
            />
            <Bar dataKey="volume" isAnimationActive={false}>
              {formattedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CandlestickChart;