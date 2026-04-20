import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Star, TrendingUp, X, Sparkles, Medal } from 'lucide-react';
import { RankingEntry } from '../types';

interface PodiumRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClaim: () => void;
  position: '1' | '2' | '3';
  rewardAmount: number;
  type: 'global' | 'regional';
  month: string;
}

export function PodiumRewardModal({ 
  isOpen, 
  onClose, 
  onClaim, 
  position, 
  rewardAmount,
  type,
  month
}: PodiumRewardModalProps) {
  
  const colors = {
    '1': {
      bg: 'from-yellow-400 via-yellow-600 to-yellow-900',
      text: 'text-yellow-400',
      border: 'border-yellow-500/50',
      glow: 'shadow-yellow-500/20',
      label: 'CAMPEÃO'
    },
    '2': {
      bg: 'from-zinc-300 via-zinc-400 to-zinc-600',
      text: 'text-zinc-300',
      border: 'border-zinc-400/50',
      glow: 'shadow-zinc-400/20',
      label: 'VICE-CAMPEÃO'
    },
    '3': {
      bg: 'from-amber-600 via-amber-700 to-amber-900',
      text: 'text-amber-600',
      border: 'border-amber-700/50',
      glow: 'shadow-amber-700/20',
      label: '3º LUGAR'
    }
  };

  const config = colors[position];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-950/90 backdrop-blur-xl"
          />

          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`relative w-full max-w-sm bg-zinc-900 rounded-[32px] border ${config.border} p-8 overflow-hidden shadow-2xl ${config.glow}`}
          >
            {/* Ambient Background Glow */}
            <div className={`absolute -top-24 -left-24 w-48 h-48 bg-brand-primary/20 rounded-full blur-[80px]`} />
            <div className={`absolute -bottom-24 -right-24 w-48 h-48 ${config.text.replace('text', 'bg')}/20 rounded-full blur-[80px]`} />

            <div className="relative flex flex-col items-center text-center space-y-6">
              {/* Icon / Trophy */}
              <motion.div 
                animate={{ 
                  y: [0, -10, 0],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${config.bg} flex items-center justify-center shadow-2xl relative group`}
              >
                <Trophy className="w-12 h-12 text-white" />
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0, 1, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-3xl bg-white/30"
                />
              </motion.div>

              <div className="space-y-1">
                <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${config.text} bg-white/5 py-1 px-3 rounded-full border ${config.border}`}>
                   Pódio {type === 'global' ? 'Global' : 'Regional'}
                </span>
                <h3 className="text-3xl font-display font-black italic text-white pt-2 leading-none">
                  {config.label}
                </h3>
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                  Temporada de {month}
                </p>
              </div>

              <div className="w-full bg-zinc-950/50 rounded-2xl p-6 border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Medal className={`w-5 h-5 ${config.text}`} />
                    <div className="text-left">
                      <p className="text-[10px] text-zinc-500 font-bold uppercase leading-none">Posição</p>
                      <p className="text-sm font-black text-white">{position}º Lugar</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-brand-primary" />
                  </div>
                </div>

                <div className="h-px bg-white/5" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-brand-primary/20 flex items-center justify-center">
                      <Star className="w-3 h-3 text-brand-primary fill-brand-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] text-zinc-500 font-bold uppercase leading-none">Recompensa</p>
                      <p className="text-sm font-black text-white">{rewardAmount} DC</p>
                    </div>
                  </div>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
              </div>

              <div className="flex flex-col w-full gap-3">
                <button 
                  onClick={onClaim}
                  className={`w-full py-5 bg-white text-zinc-950 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2`}
                >
                  <Sparkles className="w-4 h-4" />
                  Resgatar Recompensas
                </button>
                <button 
                  onClick={onClose}
                  className="w-full py-3 text-zinc-600 font-bold uppercase tracking-widest text-[9px] hover:text-zinc-400 transition-colors"
                >
                  Ver depois
                </button>
              </div>
            </div>

            {/* Confetti decoration (mock) */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20 overflow-hidden">
               {[...Array(20)].map((_, i) => (
                 <motion.div 
                   key={i}
                   initial={{ 
                     top: -20, 
                     left: `${Math.random() * 100}%`,
                     rotate: 0 
                   }}
                   animate={{ 
                     top: '120%', 
                     rotate: 360,
                     left: `${(Math.random() * 20) - 10 + (i * 5)}%` 
                   }}
                   transition={{ 
                     duration: Math.random() * 5 + 3, 
                     repeat: Infinity,
                     delay: Math.random() * 2 
                   }}
                   className={`absolute w-1.5 h-1.5 rounded-full ${i % 2 === 0 ? 'bg-brand-primary' : 'bg-yellow-500'}`}
                 />
               ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
