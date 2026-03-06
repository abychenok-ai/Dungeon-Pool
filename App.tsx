import React, { useState, useEffect, useCallback } from 'react';
import { GameState, Pocket, Ball, Difficulty, Obstacle, BallStyle, Coin } from './types';
import { BALL_TIERS, CANVAS_WIDTH, CANVAS_HEIGHT, DEFAULT_POCKET_RADIUS, CUE_BALL_TIER, COIN_RADIUS } from './constants';
import GameCanvas from './components/GameCanvas';
import StartScreen from './components/StartScreen';

type View = 'START' | 'GAME';

const TIMER_START_SECONDS = 100;

const App: React.FC = () => {
  const [view, setView] = useState<View>('START');
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  const [ballStyle, setBallStyle] = useState<BallStyle>('DUNGEON'); 
  
  const generatePockets = (): Pocket[] => {
      const pockets: Pocket[] = [];
      let count = 3; 
      let pocketRadius = DEFAULT_POCKET_RADIUS;

      const cueStartPos = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 100 };
      const safeZoneRadius = 120;

      if (difficulty === 'SIMPLE') {
        pocketRadius = 45;
        count = 1;
      } else if (difficulty === 'MEDIUM' || difficulty === 'TIMER') {
        pocketRadius = DEFAULT_POCKET_RADIUS;
        count = 3;
      } else if (difficulty === 'SORT') {
        pocketRadius = DEFAULT_POCKET_RADIUS;
        count = 2;
      } else if (difficulty === 'PRECISION') {
        pocketRadius = 30;
        count = 1;
      } else {
        pocketRadius = 28;
        count = 5;
      }

      for (let i = 0; i < count; i++) {
          let pos;
          let valid = false;
          let attempts = 0;
          
          while (!valid && attempts < 100) {
              attempts++;
              pos = {
                  x: 40 + Math.random() * (CANVAS_WIDTH - 80),
                  y: 40 + Math.random() * (CANVAS_HEIGHT - 80)
              };

              const distToCue = Math.sqrt(Math.pow(pos.x - cueStartPos.x, 2) + Math.pow(pos.y - cueStartPos.y, 2));
              if (distToCue < safeZoneRadius) continue;
              
              let overlaps = false;
              for (const p of pockets) {
                  const distToPocket = Math.sqrt(Math.pow(pos.x - p.pos.x, 2) + Math.pow(pos.y - p.pos.y, 2));
                  if (distToPocket < pocketRadius * 2.5) {
                      overlaps = true;
                      break;
                  }
              }
              if (!overlaps) valid = true;
          }
          
          if (pos) {
              pockets.push({ id: i.toString(), pos: pos, radius: pocketRadius });
          }
      }
      return pockets;
  };

  const generateObstacles = (pockets: Pocket[]): Obstacle[] => {
    if (difficulty === 'SIMPLE' || difficulty === 'TIMER' || difficulty === 'SORT') return [];
    const obstacles: Obstacle[] = [];
    const triangleCount = (difficulty === 'HARD' || difficulty === 'PRECISION') ? 3 : (3 + Math.floor(Math.random() * 2));
    const size = 30;

    for (let i = 0; i < triangleCount; i++) {
      let pos;
      let valid = false;
      let attempts = 0;
      while (!valid && attempts < 100) {
        attempts++;
        pos = {
          x: 60 + Math.random() * (CANVAS_WIDTH - 120),
          y: 60 + Math.random() * (CANVAS_HEIGHT - 120)
        };
        const cueStart = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 100 };
        const distCue = Math.sqrt((pos.x - cueStart.x)**2 + (pos.y - cueStart.y)**2);
        if (distCue < 120) continue;
        let nearPocket = false;
        for (const p of pockets) {
          const dist = Math.sqrt((pos.x - p.pos.x)**2 + (pos.y - p.pos.y)**2);
          if (dist < p.radius + size + 20) { nearPocket = true; break; }
        }
        if (nearPocket) continue;
        let overlap = false;
        for (const obs of obstacles) {
          const dist = Math.sqrt((pos.x - obs.center.x)**2 + (pos.y - obs.center.y)**2);
          if (dist < (size + obs.radius) * 1.5) { overlap = true; break; }
        }
        if (overlap) continue;
        valid = true;
      }
      if (valid && pos) {
        const angle = Math.random() * Math.PI * 2;
        const vertices: {x: number, y: number}[] = [];
        for (let j = 0; j < 3; j++) {
          const vAngle = angle + (j * 2 * Math.PI) / 3;
          vertices.push({ x: pos.x + Math.cos(vAngle) * size, y: pos.y + Math.sin(vAngle) * size });
        }
        obstacles.push({ id: `obs-tri-${i}`, type: 'triangle', center: pos, vertices, radius: size });
      }
    }
    return obstacles;
  };

  const setupTable = (pockets: Pocket[], obstacles: Obstacle[]): Ball[] => {
      const balls: Ball[] = [];
      const cueBallPos = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 100 };
      const activeCueTier = { ...CUE_BALL_TIER };
      if (ballStyle === 'DUNGEON') activeCueTier.radius = 26;

      balls.push({ id: 'cue', type: activeCueTier, pos: cueBallPos, vel: { x: 0, y: 0 }, mass: activeCueTier.radius * 2, isCue: true });

      let targetCount = 10;
      if (difficulty === 'SIMPLE') targetCount = 6;
      if (difficulty === 'HARD') targetCount = 15;
      if (difficulty === 'SORT') targetCount = 10;
      if (difficulty === 'PRECISION') targetCount = 10;

      for (let i = 0; i < targetCount; i++) {
          let pos;
          let valid = false;
          let attempts = 0;
          let type = BALL_TIERS[i % BALL_TIERS.length];
          
          if (difficulty === 'SORT') {
              if (ballStyle === 'DUNGEON') {
                  // 5 zombies (id 0), 5 devils (id 7)
                  type = i < 5 ? BALL_TIERS[0] : BALL_TIERS[7];
              } else {
                  // 5 blue (id 1), 5 red (id 2)
                  type = i < 5 ? BALL_TIERS[1] : BALL_TIERS[2];
              }
          }

          if (difficulty === 'PRECISION') {
              // 5 enemy (id 0 - Zombie), 5 neutral (id 15 - Villager)
              type = i < 5 ? BALL_TIERS[0] : BALL_TIERS[15];
          }

          while (!valid && attempts < 200) {
              attempts++;
              pos = { x: 50 + Math.random() * (CANVAS_WIDTH - 100), y: 50 + Math.random() * (CANVAS_HEIGHT - 150) };
              const distToCue = Math.sqrt(Math.pow(pos.x - cueBallPos.x, 2) + Math.pow(pos.y - cueBallPos.y, 2));
              if (distToCue < activeCueTier.radius + type.radius + 15) continue;
              let nearPocket = false;
              for (const p of pockets) {
                  const dist = Math.sqrt(Math.pow(pos.x - p.pos.x, 2) + Math.pow(pos.y - p.pos.y, 2));
                  if (dist < p.radius + type.radius + 10) { nearPocket = true; break; }
              }
              if (nearPocket) continue;
              let nearObstacle = false;
              for (const obs of obstacles) {
                  const dist = Math.sqrt((pos.x - obs.center.x)**2 + (pos.y - obs.center.y)**2);
                  if (dist < obs.radius + type.radius + 10) { nearObstacle = true; break; }
              }
              if (nearObstacle) continue;
              let overlaps = false;
              for (const b of balls) {
                  const dist = Math.sqrt(Math.pow(pos.x - b.pos.x, 2) + Math.pow(pos.y - b.pos.y, 2));
                  if (dist < b.type.radius + type.radius + 5) { overlaps = true; break; }
              }
              if (overlaps) continue;
              valid = true;
          }
          if (pos && valid) {
              balls.push({ id: `ball-${i}`, type, pos, vel: { x: 0, y: 0 }, mass: type.radius * 2 });
          }
      }
      return balls;
  };

  const generateCoins = (pockets: Pocket[], obstacles: Obstacle[], balls: Ball[]): Coin[] => {
      const coins: Coin[] = [];
      const count = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
          let pos;
          let valid = false;
          let attempts = 0;
          while (!valid && attempts < 100) {
              attempts++;
              pos = { x: 30 + Math.random() * (CANVAS_WIDTH - 60), y: 30 + Math.random() * (CANVAS_HEIGHT - 60) };
              let safe = true;
              for (const p of pockets) if (Math.hypot(pos.x - p.pos.x, pos.y - p.pos.y) < p.radius + COIN_RADIUS + 10) safe = false;
              if(safe) for (const o of obstacles) if (Math.hypot(pos.x - o.center.x, pos.y - o.center.y) < o.radius + COIN_RADIUS + 10) safe = false;
              if(safe) for (const b of balls) if (Math.hypot(pos.x - b.pos.x, pos.y - b.pos.y) < b.type.radius + COIN_RADIUS + 10) safe = false;
              if(safe) for (const c of coins) if (Math.hypot(pos.x - c.pos.x, pos.y - c.pos.y) < COIN_RADIUS * 3) safe = false;
              if (safe) valid = true;
          }
          if (pos && valid) coins.push({ id: `coin-${i}`, pos, radius: COIN_RADIUS });
      }
      return coins;
  };

  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    balls: [],
    pockets: [],
    obstacles: [],
    coinsOnTable: [],
    highScore: 0, 
    isGameOver: false,
    isWon: false,
    lives: 3,
    coins: 0,
    timeLeft: undefined,
    difficulty: 'MEDIUM'
  });

  useEffect(() => {
      const pockets = generatePockets();
      const obstacles = generateObstacles(pockets);
      const balls = setupTable(pockets, obstacles);
      const coinsOnTable = generateCoins(pockets, obstacles, balls);
      setGameState(prev => ({
          ...prev,
          pockets,
          obstacles,
          balls,
          coinsOnTable,
          lives: 3,
          coins: 0,
          timeLeft: difficulty === 'TIMER' ? TIMER_START_SECONDS : undefined,
          difficulty
      }));
  }, [difficulty]); 

  // Timer Effect
  useEffect(() => {
    if (difficulty !== 'TIMER' || gameState.isGameOver || gameState.isWon || view !== 'GAME') return;

    const timer = setInterval(() => {
        setGameState(prev => {
            if (prev.timeLeft === undefined) return prev;
            if (prev.timeLeft <= 1) {
                clearInterval(timer);
                return { ...prev, timeLeft: 0, isGameOver: true };
            }
            return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
    }, 1000);

    return () => clearInterval(timer);
  }, [difficulty, gameState.isGameOver, gameState.isWon, view]);

  const handleWin = useCallback(() => setGameState(prev => ({ ...prev, isWon: true })), []);
  const handleGameOver = useCallback(() => setGameState(prev => ({ ...prev, isGameOver: true })), []);
  const handleScratch = useCallback(() => {
    setGameState(prev => {
        const newLives = prev.lives - 1;
        if (newLives <= 0) return { ...prev, lives: 0, isGameOver: true };
        return { ...prev, lives: newLives };
    });
  }, []);

  const resetGame = () => {
    const pockets = generatePockets();
    const obstacles = generateObstacles(pockets);
    const balls = setupTable(pockets, obstacles);
    const coinsOnTable = generateCoins(pockets, obstacles, balls);
    setGameState({
      score: 0,
      balls,
      pockets,
      obstacles,
      coinsOnTable,
      highScore: 0,
      isGameOver: false,
      isWon: false,
      lives: 3,
      coins: 0,
      timeLeft: difficulty === 'TIMER' ? TIMER_START_SECONDS : undefined,
      difficulty
    });
    setView('GAME');
  };

  const getAppBackground = () => {
    switch (ballStyle) {
        case 'CLASSIC': return 'bg-[#0a2919]';
        case 'DUNGEON': return 'bg-[#1c1917]';
        case 'MINIMAL': return 'bg-slate-900'; 
        case 'PACMAN': 
        default: return 'bg-slate-950';
    }
  };

  if (view === 'START') {
    return (
      <div className={`w-full h-screen ${getAppBackground()}`}>
        <StartScreen 
          onStart={() => {
              resetGame();
              setView('GAME');
          }}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          ballStyle={ballStyle}
          setBallStyle={setBallStyle}
        />
      </div>
    );
  }

  const targetBallsCount = gameState.balls.filter(b => !b.isCue).length;

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-500 font-sans text-white relative overflow-hidden ${getAppBackground()}`}>
      <div className="absolute inset-0 pointer-events-none">
         {ballStyle === 'PACMAN' && (
            <>
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-purple-900/20 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-cyan-900/20 blur-[120px] rounded-full"></div>
            </>
         )}
         {ballStyle === 'DUNGEON' && <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0),rgba(0,0,0,0.8))]"></div>}
         {ballStyle === 'CLASSIC' && <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05),transparent)]"></div>}
      </div>

      <div className="w-full max-w-4xl flex justify-between items-center mb-6 relative z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setView('START')}
            className={`w-14 h-14 flex items-center justify-center backdrop-blur-sm border-2 rounded-2xl shadow-lg transition-all duration-300 group ${
                ballStyle === 'PACMAN' ? 'bg-slate-900/80 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]' :
                ballStyle === 'DUNGEON' ? 'bg-stone-800 border-stone-600 text-stone-400 hover:bg-stone-700' :
                ballStyle === 'CLASSIC' ? 'bg-green-900/80 border-green-400 text-green-300 hover:bg-green-800' :
                'bg-slate-800 border-white/20 text-white'
            }`}
          >
            <span className="text-3xl filter drop-shadow-[0_0_3px_rgba(255,255,255,0.2)]">🏠</span>
          </button>
          <div className="cursor-pointer group" onClick={() => setView('START')}>
            <h1 className={`text-4xl font-extrabold bg-clip-text text-transparent group-hover:scale-105 transition-transform drop-shadow-sm ${
                ballStyle === 'PACMAN' ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                ballStyle === 'DUNGEON' ? 'bg-gradient-to-r from-amber-400 to-orange-600' :
                ballStyle === 'CLASSIC' ? 'bg-gradient-to-r from-green-300 to-emerald-500' :
                'bg-white'
            }`}>
              {ballStyle === 'PACMAN' ? 'PAC POOL' : ballStyle === 'DUNGEON' ? 'DUNGEON POOL' : ballStyle === 'CLASSIC' ? 'CLASSIC POOL' : 'MINIMAL POOL'}
            </h1>
            <p className="text-white/60 text-sm font-semibold tracking-widest uppercase">{difficulty} Mode</p>
          </div>
        </div>
        
        <div className="flex gap-8 items-center">
          {/* Timer Display */}
          {gameState.timeLeft !== undefined && (
             <div className="flex flex-col items-center">
                <p className="text-xs text-white/50 uppercase font-bold tracking-wider mb-2">Time</p>
                <div className={`px-4 py-1 rounded-lg border-2 font-mono text-3xl font-black shadow-lg transition-colors ${gameState.timeLeft <= 20 ? 'border-red-500 bg-red-950/40 text-red-500 animate-pulse' : 'border-cyan-500 bg-cyan-950/40 text-cyan-400'}`}>
                    {Math.floor(gameState.timeLeft / 60)}:{(gameState.timeLeft % 60).toString().padStart(2, '0')}
                </div>
             </div>
          )}

          <div className="flex flex-col items-center">
             <p className="text-xs text-white/50 uppercase font-bold tracking-wider mb-2">Coins</p>
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 relative flex items-center justify-center group">
                    {(ballStyle === 'PACMAN' || ballStyle === 'MINIMAL') && <div className="absolute inset-0 bg-yellow-500 rounded-full blur-[6px] opacity-50 group-hover:opacity-80 transition-opacity"></div>}
                    <div className={`relative z-10 w-full h-full rounded-full border-2 flex items-center justify-center shadow-lg ${ballStyle === 'PACMAN' || ballStyle === 'MINIMAL' ? 'border-yellow-300 bg-yellow-950/30' : 'border-yellow-600 bg-yellow-900'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-6 h-6 ${ballStyle === 'PACMAN' || ballStyle === 'MINIMAL' ? 'text-yellow-300 drop-shadow-[0_0_5px_rgba(253,224,71,0.8)]' : 'text-yellow-500'}`}><path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" /></svg>
                    </div>
                </div>
                <p className={`text-3xl font-black font-mono ${ballStyle === 'PACMAN' || ballStyle === 'MINIMAL' ? 'text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]' : 'text-yellow-200'}`}>{gameState.coins}</p>
             </div>
          </div>

          {gameState.difficulty !== 'TIMER' && (
            <div className="flex flex-col items-center">
               <p className="text-xs text-white/50 uppercase font-bold tracking-wider mb-2">Lives</p>
               <div className="flex gap-3">
                  {[...Array(3)].map((_, i) => {
                      const isActive = i < gameState.lives;
                      return (
                          <div key={i} className={`relative transition-all duration-500 transform ${isActive ? 'scale-100' : 'scale-90 opacity-30'}`}>
                              {isActive && (ballStyle === 'PACMAN' || ballStyle === 'MINIMAL') && <div className="absolute inset-0 bg-pink-500 blur-md opacity-40 rounded-full scale-125"></div>}
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={`w-9 h-9 relative z-10 transition-all duration-300 ${isActive ? ((ballStyle === 'PACMAN' || ballStyle === 'MINIMAL') ? 'fill-pink-500 drop-shadow-[0_0_10px_rgba(236,72,153,0.8)]' : 'fill-red-500') : 'fill-transparent stroke-white/20 stroke-2'}`}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" /></svg>
                          </div>
                      );
                  })}
               </div>
            </div>
          )}

          <div className="text-center">
            <p className="text-xs text-white/50 uppercase font-bold tracking-wider">Balls</p>
            <p className={`text-4xl font-black ${ballStyle === 'PACMAN' || ballStyle === 'MINIMAL' ? 'text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'text-white'}`}>{targetBallsCount}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center relative z-10">
        <div className="relative">
          <GameCanvas 
            onScoreUpdate={(p) => setGameState(s => ({ ...s, score: s.score + p }))} 
            onGameOver={handleGameOver}
            onScratch={handleScratch}
            onWin={handleWin}
            gameState={gameState}
            setGameState={setGameState}
            ballStyle={ballStyle}
          />
          
          {gameState.isGameOver && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-all duration-300">
              <div className="bg-slate-900 border-[6px] border-slate-700 rounded-[2rem] p-10 max-w-sm w-full text-center shadow-2xl transform scale-100 hover:scale-[1.02] transition-transform duration-300">
                <div className="w-24 h-24 bg-red-500/10 rounded-full mx-auto mb-6 flex items-center justify-center shadow-[inset_0_0_20px_rgba(220,38,38,0.2)] border-4 border-red-500/20">
                   {gameState.timeLeft === 0 ? (
                       <span className="text-5xl">⏱️</span>
                   ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                   )}
                </div>
                <h2 className="text-4xl font-black text-red-500 mb-2 tracking-wide uppercase drop-shadow-md">GAME OVER</h2>
                <p className="text-slate-300 mb-8 font-medium leading-relaxed">
                   {gameState.timeLeft === 0 ? "You ran out of time!" : "You ran out of lives."}<br/>
                   <span className="text-sm text-slate-500">Try again!</span>
                </p>
                <div className="flex flex-col gap-3">
                  <button onClick={resetGame} className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl text-xl shadow-[0_4px_0_rgb(161,98,7)] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center gap-2 group"><span className="group-hover:rotate-180 transition-transform duration-500">🔄</span> TRY AGAIN</button>
                  <button onClick={() => setView('START')} className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl text-lg transition-colors">EXIT TO MENU</button>
                </div>
              </div>
            </div>
          )}

          {gameState.isWon && (
            <div className="absolute inset-0 bg-yellow-900/90 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl p-8 text-center shadow-2xl z-50">
              <h2 className="text-6xl font-black text-white mb-4 tracking-tighter">YOU WIN!</h2>
              <p className="text-2xl text-yellow-200 mb-8 font-medium">Stage Cleared!</p>
              <div className="text-yellow-300 text-lg mb-6 font-bold flex items-center justify-center gap-3">
                <span>Coins Earned:</span>
                <span className="text-3xl flex items-center gap-2 bg-black/30 px-4 py-2 rounded-lg">{gameState.coins} <div className="w-8 h-8 relative flex items-center justify-center"><div className="absolute inset-0 bg-yellow-500 rounded-full blur-[4px] opacity-60"></div><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="relative z-10 w-6 h-6 text-yellow-300 drop-shadow-[0_0_3px_rgba(253,224,71,1)]"><path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" /></svg></div></span>
              </div>
              <div className="flex gap-4">
                <button onClick={resetGame} className="px-8 py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-full text-xl transition-all hover:scale-105 active:scale-95 shadow-xl shadow-yellow-500/30">PLAY AGAIN</button>
                <button onClick={() => setView('START')} className="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white font-black rounded-full text-xl transition-all hover:scale-105 active:scale-95">MENU</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;