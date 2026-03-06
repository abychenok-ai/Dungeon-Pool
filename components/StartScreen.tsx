import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Difficulty, BallStyle } from '../types';
import { BALL_TIERS } from '../constants';

interface StartScreenProps {
  onStart: () => void;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  ballStyle: BallStyle;
  setBallStyle: (s: BallStyle) => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ 
  onStart, 
  difficulty, 
  setDifficulty,
  ballStyle,
  setBallStyle
}) => {
  const [showLevels, setShowLevels] = useState(false);
  const [showTheme, setShowTheme] = useState(false);

  const ballStyles: { name: string, value: BallStyle, emoji: string, desc: string }[] = [
    { name: 'Dungeon', value: 'DUNGEON', emoji: '🧟', desc: 'Stone Dungeon' },
    { name: 'Pacman', value: 'PACMAN', emoji: '👻', desc: 'Neon Purple Table' },
    { name: 'Classic', value: 'CLASSIC', emoji: '🎱', desc: 'Green Felt & Wood' },
    { name: 'Minimal', value: 'MINIMAL', emoji: '🟠', desc: 'Dark Gray & Neon' },
  ];

  const backgroundBalls = useMemo(() => Array.from({ length: 25 }).map((_, i) => {
    const ball = BALL_TIERS[i % BALL_TIERS.length];
    return {
      color: ball.color,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      size: 60 + Math.random() * 140,
      opacity: ballStyle === 'DUNGEON' ? 0.08 : 0.1 + Math.random() * 0.2,
      blur: ballStyle === 'DUNGEON' ? 8 : 15 + Math.random() * 25,
      duration: 20 + Math.random() * 30,
      delay: -Math.random() * 20,
      xMove: (Math.random() - 0.5) * 200,
      yMove: (Math.random() - 0.5) * 200,
    };
  }), [ballStyle]);

  return (
    <div className={`relative flex flex-col items-center justify-between h-full py-12 px-6 overflow-hidden text-white transition-colors duration-700 ${
        ballStyle === 'DUNGEON' ? 'bg-[#57534e]' : 
        ballStyle === 'PACMAN' ? 'bg-slate-950' :
        ballStyle === 'CLASSIC' ? 'bg-[#0a2919]' :
        'bg-slate-900'
    }`}>
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {ballStyle === 'DUNGEON' && (
            <>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0),rgba(0,0,0,0.4))]"></div>
                {/* Tile Grid */}
                <div className="absolute inset-0 opacity-20" style={{ 
                    backgroundImage: 'linear-gradient(rgba(0,0,0,0.5) 2px, transparent 2px), linear-gradient(90deg, rgba(0,0,0,0.5) 2px, transparent 2px)',
                    backgroundSize: '60px 60px'
                }}></div>
                {/* Noise/Texture */}
                <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                }}></div>
            </>
        )}
        {backgroundBalls.map((ball, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            initial={{ 
              top: ball.top, 
              left: ball.left,
              x: 0,
              y: 0
            }}
            animate={{
              x: [0, ball.xMove, -ball.xMove, 0],
              y: [0, ball.yMove, -ball.yMove, 0],
            }}
            transition={{
              duration: ball.duration,
              repeat: Infinity,
              ease: "linear",
              delay: ball.delay
            }}
            style={{
              width: ball.size,
              height: ball.size,
              backgroundColor: ball.color,
              opacity: ball.opacity,
              boxShadow: ballStyle === 'DUNGEON' ? `inset 0 0 20px rgba(0,0,0,0.5), 0 0 10px rgba(0,0,0,0.3)` : `0 0 ${ball.blur}px ${ball.color}, inset 0 0 10px rgba(255,255,255,0.5)`,
            }}
          >
             <div className="absolute top-[20%] left-[20%] w-[30%] h-[30%] bg-white rounded-full opacity-40 blur-[2px]"></div>
          </motion.div>
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center mt-6">
        <div className="relative group">
          <div className={`absolute -inset-1 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition duration-1000 ${
            ballStyle === 'PACMAN' ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
            ballStyle === 'DUNGEON' ? 'bg-gradient-to-r from-stone-600 to-red-900' :
            ballStyle === 'CLASSIC' ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
            'bg-white'
          }`}></div>
          
          {ballStyle === 'PACMAN' ? (
            <div className="w-28 h-28 bg-yellow-400 rounded-full mb-4 relative animate-bounce-slow shadow-[0_0_30px_rgba(250,204,21,0.3)]">
               <div className="absolute top-[20%] right-[30%] w-3 h-3 bg-black rounded-full"></div>
               <div className="absolute top-1/2 right-[-10%] w-full h-full bg-black" style={{ clipPath: 'polygon(100% 0, 50% 50%, 100% 100%)', transform: 'translateY(-50%) rotate(-20deg)' }}></div>
            </div>
          ) : ballStyle === 'DUNGEON' ? (
            <div className="w-28 h-28 mb-4 relative animate-bounce-slow">
               {/* Bandana Tails (Triangular like in-game) */}
               <div className="absolute top-[15%] -left-7 w-10 h-10 pointer-events-none">
                  <div className="absolute top-0 right-0 w-full h-4 bg-[#ef4444] shadow-sm" style={{ clipPath: 'polygon(100% 40%, 0 0, 0 100%)', transform: 'rotate(-15deg)' }}></div>
                  <div className="absolute top-3 right-0 w-full h-4 bg-[#ef4444] shadow-sm" style={{ clipPath: 'polygon(100% 40%, 0 0, 0 100%)', transform: 'rotate(10deg)' }}></div>
               </div>
               
               {/* Main Head */}
               <div className="w-full h-full bg-[#ffdbac] rounded-full relative border-2 border-stone-800 shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden">
                  {/* Red Headband */}
                  <div className="absolute top-[8%] w-full h-[24%] bg-[#ef4444] border-y border-red-700"></div>
                  
                  {/* Eyes (Slightly larger and better positioned) */}
                  <div className="absolute top-[48%] left-[24%] w-3.5 h-3.5 bg-black rounded-full"></div>
                  <div className="absolute top-[48%] right-[24%] w-3.5 h-3.5 bg-black rounded-full"></div>
                  
                  {/* Angry Eyebrows (Thicker) */}
                  <div className="absolute top-[40%] left-[10%] w-8 h-2 bg-black rotate-[15deg] rounded-full"></div>
                  <div className="absolute top-[40%] right-[10%] w-8 h-2 bg-black rotate-[-15deg] rounded-full"></div>
                  
                  {/* Mouth (Angry Arc) */}
                  <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 w-10 h-5 border-b-[3px] border-black rounded-full"></div>
               </div>
            </div>
          ) : ballStyle === 'CLASSIC' ? (
            <div className="w-28 h-28 bg-green-800 border-4 border-green-600 rounded-full mb-4 relative animate-bounce-slow shadow-[0_0_30px_rgba(22,101,52,0.4)] flex items-center justify-center">
               <span className="text-6xl">🎱</span>
            </div>
          ) : (
            <div className="w-28 h-28 bg-slate-800 border-4 border-slate-600 rounded-full mb-4 relative animate-bounce-slow shadow-[0_0_30px_rgba(255,255,255,0.1)] flex items-center justify-center">
               <span className="text-6xl">⚪</span>
            </div>
          )}

          <div className="relative text-6xl font-black text-center leading-tight">
            <span className={`block bg-clip-text text-transparent drop-shadow-xl ${
              ballStyle === 'PACMAN' ? 'bg-gradient-to-b from-yellow-400 to-orange-300' :
              ballStyle === 'DUNGEON' ? 'bg-gradient-to-b from-amber-400 to-orange-600' :
              ballStyle === 'CLASSIC' ? 'bg-gradient-to-b from-green-300 to-green-500' :
              'bg-gradient-to-b from-white to-slate-400'
            }`}>
              {ballStyle === 'PACMAN' ? 'PAC' : ballStyle === 'DUNGEON' ? 'DUNGEON' : ballStyle === 'CLASSIC' ? 'CLASSIC' : 'MINIMAL'}
            </span>
            <span className={`block bg-clip-text text-transparent -mt-2 drop-shadow-xl ${
              ballStyle === 'DUNGEON' ? 'bg-gradient-to-b from-white to-orange-200' : 'bg-gradient-to-b from-white to-slate-400'
            }`}>POOL</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-sm gap-6 mb-6">
        <button onClick={onStart} className="group relative w-full transform transition-all active:scale-95">
            <div className={`absolute inset-0 blur-xl rounded-2xl transition-all duration-500 ${
                ballStyle === 'DUNGEON' ? 'bg-stone-900/60 group-hover:bg-stone-900/80' : 'bg-yellow-500/20 group-hover:bg-yellow-500/30'
            }`}></div>
            <div className={`relative backdrop-blur-md border-[3px] py-6 px-8 rounded-2xl flex flex-col items-center justify-center transition-all shadow-2xl ${
                ballStyle === 'DUNGEON' ? 
                'bg-yellow-500 border-yellow-400 shadow-[0_10px_0_rgb(180,83,9),0_20px_40px_rgba(0,0,0,0.6)] group-hover:bg-yellow-400 group-hover:border-yellow-300 active:translate-y-[4px] active:shadow-[0_6px_0_rgb(180,83,9)]' :
                'bg-slate-900/90 border-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.4),inset_0_0_15px_rgba(250,204,21,0.2)] group-hover:shadow-[0_0_40px_rgba(250,204,21,0.6),inset_0_0_25px_rgba(250,204,21,0.3)] group-hover:border-yellow-300'
            }`}>
                <span className={`font-black text-3xl tracking-tighter animate-pulse ${
                    ballStyle === 'DUNGEON' ? 'text-yellow-900 drop-shadow-[0_1px_2px_rgba(255,255,255,0.3)]' : 'text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)] group-hover:text-yellow-300'
                }`}>
                    INSERT COIN
                </span>
                {ballStyle === 'DUNGEON' && (
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden rounded-2xl opacity-20">
                        <div className="absolute top-2 left-4 w-12 h-0.5 bg-white/40 rotate-12"></div>
                        <div className="absolute bottom-4 right-6 w-16 h-0.5 bg-black/40 -rotate-6"></div>
                    </div>
                )}
            </div>
        </button>
        <div className={`px-4 py-2 backdrop-blur-sm rounded-full border flex items-center gap-2 ${
            ballStyle === 'DUNGEON' ? 'bg-stone-800/90 border-stone-600' : 'bg-slate-800/80 border-yellow-500/20'
        }`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${ballStyle === 'DUNGEON' ? 'bg-stone-400' : 'bg-yellow-500'}`}></span>
            <p className={`text-xs font-bold uppercase tracking-widest ${ballStyle === 'DUNGEON' ? 'text-stone-400' : 'text-slate-300'}`}>
              Mode: <span className={ballStyle === 'DUNGEON' ? 'text-stone-200' : 'text-yellow-400'}>{difficulty}</span>
            </p>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-md grid grid-cols-4 gap-3 p-2">
        <button className="group flex flex-col items-center gap-1 opacity-70 hover:opacity-100 transition-opacity">
          <div className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-3xl transition-all duration-300 ${
              ballStyle === 'DUNGEON' ? 'bg-stone-900 border-stone-700 text-stone-500 group-hover:border-stone-400 group-hover:text-stone-300 group-hover:bg-stone-800' : 
              'bg-slate-900 border-slate-700 text-slate-500 group-hover:border-yellow-400 group-hover:text-yellow-400 group-hover:shadow-[0_0_20px_rgba(250,204,21,0.5)] group-hover:bg-yellow-950/20'
          }`}>🏆</div>
          <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${
              ballStyle === 'DUNGEON' ? 'text-stone-500 group-hover:text-stone-300' : 'text-slate-500 group-hover:text-yellow-400'
          }`}>Rank</span>
        </button>
        <button onClick={() => setShowLevels(true)} className="group flex flex-col items-center gap-1 active:scale-95 transition-transform">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl transition-all duration-300 border-2 shadow-lg ${
              showLevels ? 
              (ballStyle === 'DUNGEON' ? 'bg-stone-800 border-stone-400 text-stone-200 shadow-[0_0_20px_rgba(0,0,0,0.5)]' : 'bg-cyan-950/40 border-cyan-400 text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.5)]') : 
              (ballStyle === 'DUNGEON' ? 'bg-stone-900 border-stone-700 text-stone-500 group-hover:border-stone-400 group-hover:text-stone-300' : 'bg-slate-900 border-slate-700 text-slate-500 group-hover:border-cyan-400 group-hover:text-cyan-400 group-hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] group-hover:bg-cyan-950/20')
          }`}>📊</div>
          <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${
              showLevels ? 
              (ballStyle === 'DUNGEON' ? 'text-stone-200' : 'text-cyan-400') : 
              (ballStyle === 'DUNGEON' ? 'text-stone-500 group-hover:text-stone-300' : 'text-slate-500 group-hover:text-cyan-400')
          }`}>Levels</span>
        </button>
        <button onClick={() => setShowTheme(true)} className="group flex flex-col items-center gap-1 active:scale-95 transition-transform">
           <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl transition-all duration-300 border-2 shadow-lg ${
               showTheme ? 
               (ballStyle === 'DUNGEON' ? 'bg-stone-800 border-stone-400 text-stone-200 shadow-[0_0_20px_rgba(0,0,0,0.5)]' : 'bg-pink-950/40 border-pink-500 text-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.5)]') : 
               (ballStyle === 'DUNGEON' ? 'bg-stone-900 border-stone-700 text-stone-500 group-hover:border-stone-400 group-hover:text-stone-300' : 'bg-slate-900 border-slate-700 text-slate-500 group-hover:border-pink-500 group-hover:text-pink-500 group-hover:shadow-[0_0_15px_rgba(236,72,153,0.4)] group-hover:bg-pink-950/20')
           }`}>🎨</div>
          <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${
              showTheme ? 
              (ballStyle === 'DUNGEON' ? 'text-stone-200' : 'text-pink-500') : 
              (ballStyle === 'DUNGEON' ? 'text-stone-500 group-hover:text-stone-300' : 'text-slate-500 group-hover:text-pink-500')
          }`}>Theme</span>
        </button>
        <button className="group flex flex-col items-center gap-1 opacity-70 hover:opacity-100 transition-opacity">
          <div className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-3xl transition-all duration-300 ${
              ballStyle === 'DUNGEON' ? 'bg-stone-900 border-stone-700 text-stone-500 group-hover:border-stone-400 group-hover:text-stone-300 group-hover:bg-stone-800' : 
              'bg-slate-900 border-slate-700 text-slate-500 group-hover:border-green-500 group-hover:text-green-500 group-hover:shadow-[0_0_20px_rgba(34,197,94,0.5)] group-hover:bg-green-950/20'
          }`}>⚙️</div>
          <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${
              ballStyle === 'DUNGEON' ? 'text-stone-500 group-hover:text-stone-300' : 'text-slate-500 group-hover:text-green-500'
          }`}>Set</span>
        </button>
      </div>

      {showLevels && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center transition-all animate-in fade-in duration-200">
           <div className="absolute inset-0" onClick={() => setShowLevels(false)}></div>
           <div className={`relative w-full max-w-md border-t-4 sm:border-4 rounded-t-[2rem] sm:rounded-[2rem] p-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-300 ${
               ballStyle === 'DUNGEON' ? 'bg-stone-900 border-stone-700' : 'bg-slate-900 border-slate-700'
           }`}>
              <div className="flex justify-between items-center mb-8">
                 <div className="flex items-center gap-3">
                    <span className="text-3xl">📊</span>
                    <h2 className="text-2xl font-black text-white uppercase italic tracking-wider">Select Level</h2>
                 </div>
                 <button onClick={() => setShowLevels(false)} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
                     ballStyle === 'DUNGEON' ? 'bg-stone-800 text-stone-400 hover:bg-red-900 hover:text-white' : 'bg-slate-800 text-slate-400 hover:bg-red-500 hover:text-white'
                 }`}>✕</button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                 {(['SIMPLE', 'MEDIUM', 'HARD', 'TIMER', 'SORT', 'PRECISION'] as const).map((level) => (
                   <button
                     key={level}
                     onClick={() => { setDifficulty(level); setShowLevels(false); }}
                     className={`group flex items-center justify-between p-5 rounded-2xl border-2 transition-all active:scale-95 ${
                         difficulty === level ? 
                         (ballStyle === 'DUNGEON' ? 'bg-stone-800 border-stone-400 shadow-[0_0_30px_rgba(0,0,0,0.5)]' : 'bg-yellow-900/40 border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.15)]') : 
                         (ballStyle === 'DUNGEON' ? 'bg-stone-900 border-stone-800 hover:border-stone-600 hover:bg-stone-850' : 'bg-slate-800 border-slate-700 hover:border-slate-500 hover:bg-slate-750')
                     }`}
                   >
                     <div className="flex flex-col items-start gap-1">
                        <span className={`text-xl font-black tracking-wide ${
                            difficulty === level ? 
                            (ballStyle === 'DUNGEON' ? 'text-stone-200' : 'text-yellow-400') : 
                            'text-white group-hover:text-yellow-200'
                        }`}>{level}</span>
                        <span className={`text-xs font-bold uppercase tracking-widest ${ballStyle === 'DUNGEON' ? 'text-stone-500' : 'text-slate-400'}`}>
                           {level === 'SIMPLE' && "6 Ghosts • 1 Large Pocket"}
                           {level === 'MEDIUM' && "10 Ghosts • 3 Pockets"}
                           {level === 'HARD' && "15 Ghosts • 5 Pockets"}
                           {level === 'TIMER' && "10 Ghosts • ⏱️ 100s Limit"}
                           {level === 'SORT' && "10 Ghosts • 🧟 vs 😈 Sorting"}
                           {level === 'PRECISION' && "5 Enemies • 5 Neutrals • 1 Hole"}
                        </span>
                     </div>
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                         difficulty === level ? 
                         (ballStyle === 'DUNGEON' ? 'bg-stone-600 border-stone-400 text-stone-200' : 'bg-yellow-500 border-yellow-500 text-black') : 
                         'border-slate-600 text-transparent group-hover:border-yellow-500/50'
                     }`}>✓</div>
                   </button>
                 ))}
              </div>
           </div>
        </div>
      )}

      {showTheme && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center transition-all animate-in fade-in duration-200">
           <div className="absolute inset-0" onClick={() => setShowTheme(false)}></div>
           <div className={`relative w-full max-w-md border-t-4 sm:border-4 rounded-t-[2rem] sm:rounded-[2rem] p-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-300 max-h-[85vh] overflow-y-auto ${
               ballStyle === 'DUNGEON' ? 'bg-stone-900 border-stone-700' : 'bg-slate-900 border-slate-700'
           }`}>
              <div className="flex justify-between items-center mb-6">
                 <div className="flex items-center gap-3"><span className="text-3xl">🎨</span><h2 className="text-2xl font-black text-white uppercase italic tracking-wider">Theme</h2></div>
                 <button onClick={() => setShowTheme(false)} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
                     ballStyle === 'DUNGEON' ? 'bg-stone-800 text-stone-400 hover:bg-red-900 hover:text-white' : 'bg-slate-800 text-slate-400 hover:bg-red-500 hover:text-white'
                 }`}>✕</button>
              </div>
              <div className="mb-8">
                 <div className="grid grid-cols-1 gap-4">
                    {ballStyles.map((style) => (
                      <button 
                        key={style.value} 
                        onClick={() => setBallStyle(style.value)} 
                        className={`p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                            ballStyle === style.value ? 
                            (ballStyle === 'DUNGEON' ? 'bg-stone-800 border-stone-400 text-white shadow-lg' : 'bg-yellow-900/40 border-yellow-500 text-white shadow-lg') : 
                            (ballStyle === 'DUNGEON' ? 'bg-stone-900 border-stone-800 text-stone-500 hover:bg-stone-850 hover:border-stone-600' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750 hover:border-slate-500')
                        }`}
                      >
                        <div className="flex items-center gap-4">
                            <span className="text-4xl">{style.emoji}</span>
                            <div className="flex flex-col items-start">
                                <span className="font-bold text-lg">{style.name}</span>
                                <span className="text-xs uppercase tracking-wide opacity-70">{style.desc}</span>
                            </div>
                        </div>
                        {ballStyle === style.value && (
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${ballStyle === 'DUNGEON' ? 'bg-stone-600 text-stone-200' : 'bg-yellow-500 text-black'}`}>✓</div>
                        )}
                      </button>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default StartScreen;