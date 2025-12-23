export interface StockData {
  date: string;
  code: string;
  name: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
  // Moving Averages
  ma5?: number;
  ma10?: number;
  ma20?: number;
  ma60?: number;
  ma120?: number;
  ma240?: number;
}

export enum StrategyType {
  BUY_TODAY_SELL_TOMORROW = 'BUY_TODAY_SELL_TOMORROW',
  WEEKDAY_STRATEGY = 'WEEKDAY_STRATEGY',
  MANUAL = 'MANUAL',
}

export enum PriceType {
  OPEN = 'OPEN',
  CLOSE = 'CLOSE',
}

export interface Trade {
  entryDate: string;
  entryPrice: number;
  exitDate?: string;
  exitPrice?: number;
  profit?: number;
  profitPercent?: number;
  status: 'OPEN' | 'CLOSED';
  type: 'LONG';
}

export interface BacktestConfig {
  strategy: StrategyType;
  priceType: PriceType;
  startYear: number;
  startMonth: number;
  buyDay: number; // 1 = Monday, 5 = Friday
  sellDay: number;
  initialCapital: number;
}

export interface SimulationState {
  currentIndex: number;
  isPlaying: boolean;
  speed: number;
  balance: number;
  trades: Trade[];
  currentPositions: Trade[];
}

export interface MaVisibility {
  ma5: boolean;
  ma10: boolean;
  ma20: boolean;
  ma60: boolean;
  ma120: boolean;
  ma240: boolean;
}