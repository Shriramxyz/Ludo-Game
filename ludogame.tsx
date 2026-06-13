import React, { useState, useEffect } from 'react';

// --- Constants & Game Data ---
const COLORS = ['red', 'green', 'yellow', 'blue'];

const COLOR_THEMES = {
  red: { main: 'bg-red-500', light: 'bg-red-200', border: 'border-red-600', text: 'text-red-600' },
  green: { main: 'bg-green-500', light: 'bg-green-200', border: 'border-green-600', text: 'text-green-600' },
  yellow: { main: 'bg-yellow-400', light: 'bg-yellow-100', border: 'border-yellow-500', text: 'text-yellow-600' },
  blue: { main: 'bg-blue-500', light: 'bg-blue-200', border: 'border-blue-600', text: 'text-blue-600' }
};

// 52-step main path coordinates (x, y)
const PATH = [
  [6, 14], [6, 13], [6, 12], [6, 11], [6, 10], [6, 9], // 0-5
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],      // 6-11
  [0, 7],                                              // 12
  [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],      // 13-18
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],      // 19-24
  [7, 0],                                              // 25
  [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],      // 26-31
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], // 32-37
  [14, 7],                                             // 38
  [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8], // 39-44
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14], // 45-50
  [7, 14]                                              // 51
];

// Global indices for safe spots (Starts + Stars)
const SAFE_SPOTS = [1, 9, 14, 22, 27, 35, 40, 48];

// Offset to calculate global path position from local 0-50 path position
const GLOBAL_OFFSETS = { red: 1, green: 14, yellow: 27, blue: 40 };

const HOME_STRETCHES = {
  red: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  yellow: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]]
};

const BASES = {
  green: [[2, 2], [3, 2], [2, 3], [3, 3]],
  yellow: [[11, 2], [12, 2], [11, 3], [12, 3]],
  red: [[2, 11], [3, 11], [2, 12], [3, 12]],
  blue: [[11, 11], [12, 11], [11, 12], [12, 12]]
};

// --- SVGs ---
const StarSVG = ({ className = "w-full h-full text-black/20" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const DiceFace = ({ value, isRolling }) => {
  const dotClass = "bg-white rounded-full w-2.5 h-2.5 md:w-3 md:h-3 shadow-inner";
  const layout = {
    1: <div className={dotClass} />,
    2: <><div className={dotClass} /><div className={dotClass} /></>,
    3: <><div className={dotClass} /><div className={dotClass} /><div className={dotClass} /></>,
    4: <div className="grid grid-cols-2 gap-1 md:gap-2"><div className={dotClass} /><div className={dotClass} /><div className={dotClass} /><div className={dotClass} /></div>,
    5: <div className="grid grid-cols-2 gap-1 md:gap-2 relative"><div className={dotClass} /><div className={dotClass} /><div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${dotClass}`} /><div className={dotClass} /><div className={dotClass} /></div>,
    6: <div className="grid grid-cols-2 gap-y-1 md:gap-y-2 gap-x-2 md:gap-x-3"><div className={dotClass} /><div className={dotClass} /><div className={dotClass} /><div className={dotClass} /><div className={dotClass} /><div className={dotClass} /></div>
  };

  return (
    <div className={`w-12 h-12 md:w-16 md:h-16 bg-red-600 rounded-xl shadow-lg border-b-4 border-red-800 flex items-center justify-center ${isRolling ? 'animate-bounce' : ''}`}>
      {value ? layout[value] : <div className="text-white font-bold text-xl">?</div>}
    </div>
  );
};

export default function LudoGame() {
  // --- Game State ---
  const [turn, setTurn] = useState(0); // 0: red, 1: green, 2: yellow, 3: blue
  const [dice, setDice] = useState(null);
  const [canRoll, setCanRoll] = useState(true);
  const [isRolling, setIsRolling] = useState(false);
  const [winners, setWinners] = useState([]);
  const [statusMsg, setStatusMsg] = useState("Game Started! Red's turn to roll.");

  const [tokens, setTokens] = useState({
    red: [-1, -1, -1, -1],
    green: [-1, -1, -1, -1],
    yellow: [-1, -1, -1, -1],
    blue: [-1, -1, -1, -1]
  });

  // --- Utilities ---
  const getGlobalPosition = (color, localPos) => {
    return (localPos + GLOBAL_OFFSETS[color]) % 52;
  };

  const hasValidMoves = (color, diceValue) => {
    return tokens[color].some(pos => {
      if (pos === -1 && diceValue === 6) return true;
      if (pos >= 0 && pos + diceValue <= 56) return true;
      return false;
    });
  };

  const passTurn = (currentWinners = winners) => {
    let next = (turn + 1) % 4;
    while (currentWinners.includes(COLORS[next]) && currentWinners.length < 3) {
      next = (next + 1) % 4;
    }
    setTurn(next);
    setCanRoll(true);
    setDice(null);
    setStatusMsg(`${COLORS[next].charAt(0).toUpperCase() + COLORS[next].slice(1)}'s turn to roll.`);
  };

  // --- Auto pass turn if no moves ---
  useEffect(() => {
    if (!canRoll && !isRolling && dice) {
      const activeColor = COLORS[turn];
      if (!hasValidMoves(activeColor, dice)) {
        setStatusMsg(`${activeColor} has no valid moves.`);
        const timer = setTimeout(() => {
          passTurn();
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [canRoll, isRolling, dice, turn, tokens]);

  // --- Handlers ---
  const rollDice = () => {
    if (!canRoll || isRolling || winners.includes(COLORS[turn])) return;

    setIsRolling(true);
    setCanRoll(false);
    let ticks = 0;
    const interval = setInterval(() => {
      setDice(Math.floor(Math.random() * 6) + 1);
      ticks++;
      if (ticks > 12) {
        clearInterval(interval);
        const finalDice = Math.floor(Math.random() * 6) + 1;
        setDice(finalDice);
        setIsRolling(false);
        setStatusMsg(`${COLORS[turn]} rolled a ${finalDice}!`);
      }
    }, 40);
  };

  const handleTokenClick = (color, id) => {
    if (COLORS[turn] !== color || canRoll || isRolling) return;

    const pos = tokens[color][id];
    let newPos = pos;

    if (pos === -1 && dice === 6) {
      newPos = 0;
    } else if (pos >= 0 && pos + dice <= 56) {
      newPos = pos + dice;
    } else {
      return; // Invalid move
    }

    let newTokens = { ...tokens };
    newTokens[color] = [...tokens[color]];
    newTokens[color][id] = newPos;

    let extraTurn = false;
    let killMsg = "";

    // Check Kill
    if (newPos >= 0 && newPos <= 50) {
      const globalPos = getGlobalPosition(color, newPos);
      if (!SAFE_SPOTS.includes(globalPos)) {
        COLORS.forEach(oppColor => {
          if (oppColor !== color) {
            newTokens[oppColor].forEach((oppPos, oppId) => {
              if (oppPos >= 0 && oppPos <= 50 && getGlobalPosition(oppColor, oppPos) === globalPos) {
                newTokens[oppColor] = [...newTokens[oppColor]];
                newTokens[oppColor][oppId] = -1; // Send to home
                extraTurn = true;
                killMsg = `${color} killed ${oppColor}'s token! Extra turn!`;
              }
            });
          }
        });
      }
    }

    let winMsg = "";
    if (newPos === 56) {
      extraTurn = true;
      winMsg = `${color} token reached Home! Extra turn!`;
    }

    setTokens(newTokens);

    // Check Player Win
    const hasWon = newTokens[color].every(p => p === 56);
    let newWinners = [...winners];
    if (hasWon && !winners.includes(color)) {
      newWinners.push(color);
      setWinners(newWinners);
      winMsg = `${color.toUpperCase()} WINS!`;
    }

    if (newWinners.length >= 3) {
      setStatusMsg(`GAME OVER! ${newWinners.join(', ')} won!`);
      return;
    }

    if (killMsg || winMsg) {
      setStatusMsg(winMsg || killMsg);
    }

    if (dice === 6 || extraTurn) {
      setCanRoll(true);
      if (!killMsg && !winMsg) setStatusMsg(`${color} gets an extra turn! Roll again.`);
    } else {
      setTimeout(() => passTurn(newWinners), 500);
    }
  };

  const resetGame = () => {
    setTokens({
      red: [-1, -1, -1, -1],
      green: [-1, -1, -1, -1],
      yellow: [-1, -1, -1, -1],
      blue: [-1, -1, -1, -1]
    });
    setTurn(0);
    setDice(null);
    setCanRoll(true);
    setWinners([]);
    setStatusMsg("Game Reset! Red's turn.");
  };

  // --- Rendering Helpers ---
  const getXY = (color, pos, id) => {
    if (pos === -1) return BASES[color][id];
    if (pos === 56) return [7, 7]; // Center
    if (pos >= 51 && pos <= 55) return HOME_STRETCHES[color][pos - 51];
    return PATH[getGlobalPosition(color, pos)];
  };

  const allTokens = COLORS.flatMap(c => 
    tokens[c].map((pos, id) => ({ color: c, id, pos, xy: getXY(c, pos, id) }))
  );

  // Group tokens to handle overlap
  const overlapMap = {};
  allTokens.forEach(t => {
    const key = `${t.xy[0]},${t.xy[1]}`;
    if (!overlapMap[key]) overlapMap[key] = [];
    overlapMap[key].push(t);
  });

  // --- Board Layout Generation ---
  const pathCells = PATH.map((coords, i) => {
    const isSafe = SAFE_SPOTS.includes(i);
    let bg = 'bg-white';
    let iconColor = 'text-gray-300';
    if (i === 1) { bg = COLOR_THEMES.red.light; iconColor = COLOR_THEMES.red.text; }
    if (i === 14) { bg = COLOR_THEMES.green.light; iconColor = COLOR_THEMES.green.text; }
    if (i === 27) { bg = COLOR_THEMES.yellow.light; iconColor = COLOR_THEMES.yellow.text; }
    if (i === 40) { bg = COLOR_THEMES.blue.light; iconColor = COLOR_THEMES.blue.text; }
    
    return { x: coords[0], y: coords[1], bg, isSafe, iconColor };
  });

  const stretchCells = COLORS.flatMap(color => 
    HOME_STRETCHES[color].map(coords => ({
      x: coords[0], y: coords[1], bg: COLOR_THEMES[color].light, isSafe: false
    }))
  );

  const allBoardCells = [...pathCells, ...stretchCells];

  const PlayerPanel = ({ color, index, name, alignment }) => {
    const isActive = turn === index;
    const hasWon = winners.includes(color);
    const theme = COLOR_THEMES[color];
    
    return (
      <div className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-4 transition-all duration-300 shadow-md bg-white
        ${isActive && !hasWon ? `scale-110 shadow-xl ${theme.border} ring-4 ring-opacity-50 ring-${theme.main.split('-')[1]}-400 z-10` : 'border-gray-200 opacity-90 scale-95'}
        ${hasWon ? 'opacity-50 grayscale' : ''}
      `}>
        <div className={`font-bold text-lg md:text-xl uppercase tracking-wider ${theme.text}`}>
          {hasWon ? 'WINNER!' : name}
        </div>
        
        {/* Dice Slot */}
        <div className="h-20 flex items-center justify-center">
          {isActive && !hasWon ? (
             <div onClick={rollDice} className={`cursor-pointer transition-transform ${canRoll ? 'hover:scale-110' : ''}`}>
               <DiceFace value={dice} isRolling={isRolling} />
             </div>
          ) : (
             <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl border-2 border-dashed ${theme.border} opacity-20 flex items-center justify-center text-xs font-bold text-gray-400`}>
               {hasWon ? '1st' : 'WAIT'}
             </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-2 sm:p-6 font-sans select-none text-slate-800">
      
      {/* Header */}
      <div className="w-full max-w-3xl flex justify-between items-end mb-4 px-2">
        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter drop-shadow-md">LUDO <span className="text-red-500">M</span><span className="text-green-500">A</span><span className="text-yellow-400">N</span><span className="text-blue-500">I</span><span className="text-white">A</span></h1>
        <button onClick={resetGame} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold shadow transition-colors text-sm border border-slate-600">
          Reset Game
        </button>
      </div>

      {/* Status Bar */}
      <div className="w-full max-w-3xl bg-white/10 backdrop-blur border border-white/20 rounded-xl p-3 mb-6 text-center shadow-lg">
        <p className="text-xl md:text-2xl font-bold text-white tracking-wide">{statusMsg}</p>
      </div>

      {/* Main Layout: Players + Board */}
      <div className="w-full max-w-3xl grid grid-cols-2 md:grid-cols-4 gap-4 items-center justify-items-center">
        
        {/* Mobile Top Players / Desktop Left Players */}
        <div className="col-span-1 md:col-span-1 w-full max-w-[150px] order-1 md:order-1 self-start space-y-4">
           <PlayerPanel color="green" index={1} name="Green" />
           <div className="hidden md:block h-8"></div>
           <PlayerPanel color="red" index={0} name="Red" />
        </div>

        {/* Board */}
        <div className="col-span-2 md:col-span-2 w-full max-w-[500px] order-3 md:order-2">
          <div className="relative w-full aspect-square bg-white rounded-2xl shadow-2xl border-8 border-slate-800 overflow-hidden box-border p-1">
            <div className="relative w-full h-full">
              
              {/* Home Areas (Large Backgrounds) */}
              <div className={`absolute top-0 left-0 w-[40%] h-[40%] ${COLOR_THEMES.green.main} border-[1px] border-black/20 flex items-center justify-center p-3 sm:p-5 rounded-tl-lg`}>
                <div className="w-full h-full bg-white rounded-xl shadow-inner flex flex-wrap p-2 sm:p-4 gap-1"></div>
              </div>
              <div className={`absolute top-0 right-0 w-[40%] h-[40%] ${COLOR_THEMES.yellow.main} border-[1px] border-black/20 flex items-center justify-center p-3 sm:p-5 rounded-tr-lg`}>
                <div className="w-full h-full bg-white rounded-xl shadow-inner flex flex-wrap p-2 sm:p-4 gap-1"></div>
              </div>
              <div className={`absolute bottom-0 left-0 w-[40%] h-[40%] ${COLOR_THEMES.red.main} border-[1px] border-black/20 flex items-center justify-center p-3 sm:p-5 rounded-bl-lg`}>
                <div className="w-full h-full bg-white rounded-xl shadow-inner flex flex-wrap p-2 sm:p-4 gap-1"></div>
              </div>
              <div className={`absolute bottom-0 right-0 w-[40%] h-[40%] ${COLOR_THEMES.blue.main} border-[1px] border-black/20 flex items-center justify-center p-3 sm:p-5 rounded-br-lg`}>
                <div className="w-full h-full bg-white rounded-xl shadow-inner flex flex-wrap p-2 sm:p-4 gap-1"></div>
              </div>

              {/* Center Finish */}
              <div className="absolute top-[40%] left-[40%] w-[20%] h-[20%]">
                 <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polygon points="0,0 50,50 0,100" fill="#22c55e" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
                    <polygon points="0,0 100,0 50,50" fill="#eab308" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
                    <polygon points="100,0 100,100 50,50" fill="#3b82f6" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
                    <polygon points="0,100 100,100 50,50" fill="#ef4444" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
                 </svg>
              </div>

              {/* Path Cells */}
              {allBoardCells.map((cell, idx) => (
                <div 
                  key={`cell-${idx}`} 
                  className={`absolute border-[0.5px] border-black/15 flex items-center justify-center ${cell.bg}`}
                  style={{ 
                    left: `${(cell.x / 15) * 100}%`, 
                    top: `${(cell.y / 15) * 100}%`, 
                    width: `${100/15}%`, 
                    height: `${100/15}%` 
                  }}
                >
                  {cell.isSafe && <div className="w-2/3 h-2/3"><StarSVG className={cell.iconColor} /></div>}
                </div>
              ))}

              {/* Tokens */}
              {allTokens.map(({ color, id, pos, xy }) => {
                const key = `${xy[0]},${xy[1]}`;
                const group = overlapMap[key];
                const overlapIndex = group.findIndex(t => t.color === color && t.id === id);
                const isOverlapping = group.length > 1 && pos !== -1 && pos !== 56;
                
                let dx = 0; let dy = 0; let scale = 1;
                
                if (isOverlapping) {
                  scale = 0.65;
                  const offsets = [ [-25, -25], [25, -25], [-25, 25], [25, 25], [0, 0], [-25, 0], [25, 0], [0, -25] ];
                  const off = offsets[overlapIndex % offsets.length];
                  dx = off[0]; dy = off[1];
                } else if (pos === 56) {
                  scale = 0.5;
                  // Scatter slightly in center based on color and id so they look piled up
                  const colorOffsets = { red: [0, 20], green: [-20, 0], yellow: [0, -20], blue: [20, 0] };
                  dx = colorOffsets[color][0] + (id % 2 === 0 ? -10 : 10);
                  dy = colorOffsets[color][1] + (id < 2 ? -10 : 10);
                } else if (pos === -1) {
                  // Home bases inside the white box, we placed them logically but let's visually adjust
                  scale = 0.8;
                }

                const isClickable = turn === COLORS.indexOf(color) && !canRoll && !isRolling && 
                  ((pos === -1 && dice === 6) || (pos >= 0 && pos + dice <= 56));

                return (
                  <div
                    key={`${color}-${id}`}
                    onClick={() => handleTokenClick(color, id)}
                    className={`absolute rounded-full shadow-[0_3px_5px_rgba(0,0,0,0.5)] border-[2px] border-white transition-all duration-300 ease-in-out ${COLOR_THEMES[color].main}
                      ${isClickable ? 'cursor-pointer ring-[3px] ring-white ring-offset-[2px] ring-offset-slate-900 animate-pulse z-40 scale-110' : 'z-20 hover:z-30'}`
                    }
                    style={{
                      width: `${100/15 * 0.8}%`, 
                      height: `${100/15 * 0.8}%`,
                      left: `${(xy[0] + 0.5) * 100 / 15}%`,
                      top: `${(xy[1] + 0.5) * 100 / 15}%`,
                      transform: `translate(calc(-50% + ${dx}%), calc(-50% + ${dy}%)) scale(${scale})`
                    }}
                  >
                    {/* Inner highlight for 3D effect */}
                    <div className="absolute inset-0 rounded-full border-[3px] border-white/30 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.4)]"></div>
                  </div>
                );
              })}

            </div>
          </div>
        </div>

        {/* Mobile Bottom Players / Desktop Right Players */}
        <div className="col-span-1 md:col-span-1 w-full max-w-[150px] order-2 md:order-3 self-end space-y-4">
           <PlayerPanel color="yellow" index={2} name="Yellow" />
           <div className="hidden md:block h-8"></div>
           <PlayerPanel color="blue" index={3} name="Blue" />
        </div>

      </div>
      
    </div>
  );
}