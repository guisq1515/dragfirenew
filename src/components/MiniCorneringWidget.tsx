import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Navigation } from 'lucide-react';
import { CurveData } from '../types';

interface MiniCorneringWidgetProps {
  nextCurve: CurveData | null;
  isVisible: boolean;
}

export function MiniCorneringWidget({ nextCurve, isVisible }: MiniCorneringWidgetProps) {
  if (!isVisible || !nextCurve) return null;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'hard': return 'bg-red-500/20 text-red-500 border-red-500/40';
      case 'hairpin': return 'bg-purple-500/20 text-purple-500 border-purple-500/40';
      case 'medium': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/40';
      default: return 'bg-green-500/20 text-green-500 border-green-500/40';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20, scale: 0.8 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className={`fixed right-6 top-32 z-[80] p-4 rounded-3xl border glass-panel flex flex-col items-center gap-1 shadow-2xl min-w-[100px] ${getSeverityColor(nextCurve.severity)}`}
      >
        <motion.div
          animate={{ rotate: nextCurve.direction === 'left' ? -nextCurve.angle/2 : nextCurve.angle/2 }}
          className="relative"
        >
          <Navigation 
            className={`w-10 h-10 ${nextCurve.direction === 'left' ? '-scale-x-100' : ''}`}
            style={{ filter: 'drop-shadow(0 0 10px currentColor)' }}
          />
        </motion.div>
        
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Próxima</span>
          <span className="text-lg font-black italic tracking-tighter">
            {nextCurve.distance}m
          </span>
        </div>

        {/* Dynamic Angle Tag */}
        <div className="absolute -top-2 -right-2 bg-white text-zinc-950 text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-lg">
          {nextCurve.angle}°
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
