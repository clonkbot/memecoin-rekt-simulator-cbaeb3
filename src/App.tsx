import { useState, useEffect, useCallback, useRef } from 'react';
import './styles.css';

interface Coin {
  id: string;
  name: string;
  ticker: string;
  price: number;
  color: string;
  bgColor: string;
  history: number[];
  emoji: string;
}

interface Holding {
  coinId: string;
  amount: number;
  avgBuyPrice: number;
}

interface LogEntry {
  id: number;
  message: string;
  type: 'buy' | 'sell' | 'rekt' | 'info';
  timestamp: Date;
}

const initialCoins: Coin[] = [
  { id: 'clawstr', name: 'CLAWSTR', ticker: '$CLAWSTR', price: 0.00420, color: '#ff3366', bgColor: 'rgba(255, 51, 102, 0.15)', history: [], emoji: '🐾' },
  { id: 'clawnch', name: 'CLAWNCH', ticker: '$CLAWNCH', price: 0.00069, color: '#00ff88', bgColor: 'rgba(0, 255, 136, 0.15)', history: [], emoji: '🦴' },
  { id: 'clawd', name: 'CLAWD', ticker: '$CLAWD', price: 0.01337, color: '#ffaa00', bgColor: 'rgba(255, 170, 0, 0.15)', history: [], emoji: '☁️' },
];

function generateInitialHistory(price: number): number[] {
  const history: number[] = [];
  let currentPrice = price * 1.5;
  for (let i = 0; i < 50; i++) {
    const downwardBias = 0.97;
    const volatility = (Math.random() - 0.5) * 0.15;
    currentPrice = currentPrice * (downwardBias + volatility);
    currentPrice = Math.max(currentPrice, price * 0.1);
    history.push(currentPrice);
  }
  return history;
}

function MiniChart({ history, color }: { history: number[]; color: string }) {
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;

  const points = history.map((val, i) => {
    const x = (i / (history.length - 1)) * 100;
    const y = 100 - ((val - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 100" className="w-full h-16 md:h-20" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
        vectorEffect="non-scaling-stroke"
      />
      <polygon
        fill={`url(#grad-${color.replace('#', '')})`}
        points={`0,100 ${points} 100,100`}
      />
    </svg>
  );
}

function App() {
  const [coins, setCoins] = useState<Coin[]>(() =>
    initialCoins.map(c => ({ ...c, history: generateInitialHistory(c.price) }))
  );
  const [balance, setBalance] = useState(1000);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [totalLost, setTotalLost] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null);
  const [buyAmount, setBuyAmount] = useState('');
  const [isGlitching, setIsGlitching] = useState(false);
  const logCounter = useRef(0);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((message: string, type: LogEntry['type']) => {
    logCounter.current += 1;
    setLogs(prev => [...prev.slice(-49), { id: logCounter.current, message, type, timestamp: new Date() }]);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCoins(prevCoins => {
        return prevCoins.map(coin => {
          const downwardBias = 0.985;
          const pumpChance = Math.random() > 0.92;
          const multiplier = pumpChance
            ? 1 + Math.random() * 0.3
            : downwardBias + (Math.random() - 0.5) * 0.08;

          const newPrice = Math.max(coin.price * multiplier, 0.00000001);
          const newHistory = [...coin.history.slice(-49), newPrice];

          return { ...coin, price: newPrice, history: newHistory };
        });
      });
    }, 800);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    const currentValue = holdings.reduce((sum, h) => {
      const coin = coins.find(c => c.id === h.coinId);
      return sum + (coin ? coin.price * h.amount : 0);
    }, 0);

    const investedValue = holdings.reduce((sum, h) => sum + h.avgBuyPrice * h.amount, 0);
    const loss = investedValue - currentValue;

    if (loss > 0) {
      setTotalLost(prev => {
        const newLoss = loss - prev;
        if (newLoss > 10) {
          setIsGlitching(true);
          setTimeout(() => setIsGlitching(false), 500);
        }
        return loss;
      });
    }
  }, [coins, holdings]);

  const handleBuy = (coinId: string) => {
    const amount = parseFloat(buyAmount);
    if (isNaN(amount) || amount <= 0) return;

    const coin = coins.find(c => c.id === coinId);
    if (!coin) return;

    const cost = amount;
    if (cost > balance) {
      addLog(`INSUFFICIENT FUNDS for ${coin.ticker}`, 'rekt');
      return;
    }

    const coinsReceived = amount / coin.price;
    setBalance(prev => prev - cost);

    setHoldings(prev => {
      const existing = prev.find(h => h.coinId === coinId);
      if (existing) {
        const newTotal = existing.amount + coinsReceived;
        const newAvg = (existing.avgBuyPrice * existing.amount + cost) / newTotal;
        return prev.map(h => h.coinId === coinId ? { ...h, amount: newTotal, avgBuyPrice: newAvg } : h);
      }
      return [...prev, { coinId, amount: coinsReceived, avgBuyPrice: coin.price }];
    });

    addLog(`BOUGHT ${coinsReceived.toFixed(2)} ${coin.ticker} @ $${coin.price.toFixed(8)}`, 'buy');
    setBuyAmount('');
    setSelectedCoin(null);
  };

  const handleSell = (coinId: string) => {
    const holding = holdings.find(h => h.coinId === coinId);
    if (!holding || holding.amount <= 0) return;

    const coin = coins.find(c => c.id === coinId);
    if (!coin) return;

    const sellValue = holding.amount * coin.price;
    const buyValue = holding.amount * holding.avgBuyPrice;
    const pnl = sellValue - buyValue;

    setBalance(prev => prev + sellValue);
    setHoldings(prev => prev.filter(h => h.coinId !== coinId));

    if (pnl < 0) {
      addLog(`SOLD ${holding.amount.toFixed(2)} ${coin.ticker} for $${sellValue.toFixed(2)} [REKT: -$${Math.abs(pnl).toFixed(2)}]`, 'rekt');
      setIsGlitching(true);
      setTimeout(() => setIsGlitching(false), 800);
    } else {
      addLog(`SOLD ${holding.amount.toFixed(2)} ${coin.ticker} for $${sellValue.toFixed(2)} [+$${pnl.toFixed(2)}]`, 'sell');
    }
  };

  const getHolding = (coinId: string) => holdings.find(h => h.coinId === coinId);

  const portfolioValue = holdings.reduce((sum, h) => {
    const coin = coins.find(c => c.id === h.coinId);
    return sum + (coin ? coin.price * h.amount : 0);
  }, 0);

  return (
    <div className={`min-h-screen bg-black text-green-400 font-mono relative overflow-hidden ${isGlitching ? 'glitch-effect' : ''}`}>
      <div className="scanlines" />
      <div className="noise" />

      <div className="relative z-10 p-3 md:p-6 max-w-7xl mx-auto min-h-screen flex flex-col">
        <header className="mb-4 md:mb-8 text-center">
          <h1 className="text-2xl md:text-4xl lg:text-6xl font-bold tracking-tighter glitch-text mb-2">
            <span className="text-red-500">[</span>
            MEMECOIN SIMULATOR
            <span className="text-red-500">]</span>
          </h1>
          <p className="text-xs md:text-sm text-green-600 tracking-widest">// guaranteed to lose money //</p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
          <div className="stat-box col-span-2 md:col-span-1">
            <span className="text-xs text-green-600 block mb-1">BALANCE</span>
            <span className="text-lg md:text-2xl font-bold text-green-400">${balance.toFixed(2)}</span>
          </div>
          <div className="stat-box">
            <span className="text-xs text-green-600 block mb-1">PORTFOLIO</span>
            <span className="text-lg md:text-2xl font-bold text-cyan-400">${portfolioValue.toFixed(2)}</span>
          </div>
          <div className="stat-box">
            <span className="text-xs text-green-600 block mb-1">TOTAL LOST</span>
            <span className="text-lg md:text-2xl font-bold text-red-500 animate-pulse">-${totalLost.toFixed(2)}</span>
          </div>
          <div className="stat-box col-span-2 md:col-span-1">
            <span className="text-xs text-green-600 block mb-1">REKT STATUS</span>
            <span className={`text-base md:text-xl font-bold ${totalLost > 500 ? 'text-red-500' : totalLost > 100 ? 'text-yellow-500' : 'text-green-400'}`}>
              {totalLost > 500 ? 'MEGA REKT' : totalLost > 100 ? 'GETTING REKT' : 'NOT YET REKT'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6 flex-grow">
          {coins.map(coin => {
            const holding = getHolding(coin.id);
            const priceChange = coin.history.length > 1
              ? ((coin.price - coin.history[0]) / coin.history[0]) * 100
              : 0;

            return (
              <div
                key={coin.id}
                className="coin-card relative overflow-hidden"
                style={{ borderColor: coin.color, background: coin.bgColor }}
              >
                <div className="absolute top-0 right-0 text-4xl md:text-6xl opacity-20 p-2">{coin.emoji}</div>

                <div className="flex justify-between items-start mb-2 md:mb-4 relative z-10">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold" style={{ color: coin.color }}>{coin.ticker}</h2>
                    <p className="text-xs text-green-600">{coin.name}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg md:text-xl font-bold" style={{ color: coin.color }}>
                      ${coin.price.toFixed(8)}
                    </div>
                    <div className={`text-xs md:text-sm ${priceChange >= 0 ? 'text-green-400' : 'text-red-500'}`}>
                      {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)}%
                    </div>
                  </div>
                </div>

                <MiniChart history={coin.history} color={coin.color} />

                {holding && (
                  <div className="mt-2 md:mt-4 p-2 md:p-3 bg-black/50 rounded border border-green-900">
                    <div className="flex justify-between text-xs md:text-sm">
                      <span>HOLDING:</span>
                      <span className="font-bold">{holding.amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs md:text-sm">
                      <span>VALUE:</span>
                      <span className="font-bold">${(holding.amount * coin.price).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs md:text-sm">
                      <span>P/L:</span>
                      <span className={`font-bold ${(holding.amount * coin.price - holding.amount * holding.avgBuyPrice) >= 0 ? 'text-green-400' : 'text-red-500'}`}>
                        ${(holding.amount * coin.price - holding.amount * holding.avgBuyPrice).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-2 md:mt-4 flex gap-2">
                  {selectedCoin === coin.id ? (
                    <>
                      <input
                        type="number"
                        placeholder="$ Amount"
                        value={buyAmount}
                        onChange={(e) => setBuyAmount(e.target.value)}
                        className="flex-1 bg-black border border-green-600 rounded px-2 md:px-3 py-2 text-sm md:text-base text-green-400 focus:outline-none focus:border-green-400 min-w-0"
                        inputMode="decimal"
                      />
                      <button
                        onClick={() => handleBuy(coin.id)}
                        className="buy-btn px-3 md:px-4 py-2 text-sm md:text-base"
                        style={{ borderColor: coin.color, color: coin.color }}
                      >
                        BUY
                      </button>
                      <button
                        onClick={() => setSelectedCoin(null)}
                        className="px-2 py-2 text-red-500 border border-red-500 rounded hover:bg-red-500/20 text-sm"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setSelectedCoin(coin.id)}
                        className="flex-1 buy-btn py-2 md:py-3 text-sm md:text-base"
                        style={{ borderColor: coin.color, color: coin.color }}
                      >
                        APE IN 🦍
                      </button>
                      {holding && (
                        <button
                          onClick={() => handleSell(coin.id)}
                          className="flex-1 sell-btn py-2 md:py-3 text-sm md:text-base"
                        >
                          PAPER HANDS 📄
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="log-container mt-auto">
          <div className="flex items-center gap-2 mb-2 text-green-600 text-xs md:text-sm">
            <span className="animate-pulse">●</span>
            <span>TRANSACTION LOG</span>
          </div>
          <div className="h-24 md:h-32 overflow-y-auto bg-black/80 border border-green-900 rounded p-2 text-xs md:text-sm">
            {logs.length === 0 && (
              <div className="text-green-700 italic">{'>>'} Awaiting transactions...</div>
            )}
            {logs.map(log => (
              <div
                key={log.id}
                className={`log-entry ${log.type}`}
              >
                <span className="text-green-700">[{log.timestamp.toLocaleTimeString()}]</span>{' '}
                <span className={
                  log.type === 'buy' ? 'text-cyan-400' :
                  log.type === 'sell' ? 'text-yellow-400' :
                  log.type === 'rekt' ? 'text-red-500' : 'text-green-400'
                }>
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>

        <footer className="mt-4 md:mt-6 pt-3 border-t border-green-900/50 text-center">
          <p className="text-[10px] md:text-xs text-green-800 tracking-wide">
            Requested by @thokani · Built by @clonkbot
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
