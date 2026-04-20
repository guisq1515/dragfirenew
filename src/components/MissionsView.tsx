import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Target, 
  CheckCircle2, 
  ChevronRight, 
  Coins, 
  Clock, 
  Calendar,
  Zap,
  Sparkles,
  Share2,
  Car,
  UserPlus,
  Sun,
  Fuel,
  ArrowRight
} from 'lucide-react';
import { ACHIEVEMENTS, Achievement } from '../constants/achievements';
import { UserProfile } from '../types';
import { doc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { db } from '../firebase';

const ICON_MAP: Record<string, any> = {
  Sun,
  Car,
  UserPlus,
  Share2,
  Sparkles,
  Fuel
};

export function MissionsView({ 
  profile, 
  onUpdate 
}: { 
  profile: UserProfile; 
  onUpdate: (data: Partial<UserProfile>) => void;
}) {
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const completedIds = profile.completedMissions || [];
  const progress = profile.missionProgress || {};

  const categories = [
    { id: 'daily', label: 'Diárias', icon: Sun },
    { id: 'weekly', label: 'Semanais', icon: Calendar },
    { id: 'once', label: 'Conquistas', icon: Trophy }
  ];

  const handleClaim = async (achievement: Achievement) => {
    if (claimingId) return;
    setClaimingId(achievement.id);
    
    try {
      const ref = doc(db, 'users', profile.uid);
      const reward = achievement.reward;
      
      // Update Firestore
      await updateDoc(ref, {
        completedMissions: arrayUnion(achievement.id),
        dfCoins: increment(reward)
      });
      
      // Update local state
      onUpdate({
        completedMissions: [...completedIds, achievement.id],
        dfCoins: (profile.dfCoins || 0) + reward
      });

    } catch (e) {
      console.error(e);
      alert('Erro ao resgatar recompensa.');
    } finally {
      setClaimingId(null);
    }
  };

  const isMissionComplete = (ach: Achievement) => {
    // Logic to determine if mission criteria met but not yet claimed
    // For simple one-off missions like 'register_vehicle', we check if it was triggered
    // In a real app, you'd check specific fields. 
    // Here we'll rely on the 'missionProgress[ach.id] === true' flag set by other components.
    return progress[ach.id] === true || progress[ach.id] >= 1;
  };

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 overflow-y-auto hide-scrollbar pb-24">
      {/* Header */}
      <div className="p-8 pb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-display font-black italic text-white uppercase tracking-tighter">Missões & <span className="text-brand-primary">Conquistas</span></h2>
          <div className="bg-zinc-900 border border-white/5 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <Coins className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-black text-white italic">{(profile.dfCoins || 0).toLocaleString()}</span>
          </div>
        </div>
        <p className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.4em]">Complete tarefas e ganhe recompensas exclusivas</p>
      </div>

      {/* Categories Grid */}
      <div className="px-8 grid grid-cols-3 gap-2 mb-8">
        {categories.map(cat => (
          <div key={cat.id} className="bg-zinc-900/50 border border-white/5 p-3 rounded-2xl flex flex-col items-center">
            <cat.icon className="w-4 h-4 text-zinc-600 mb-2" />
            <span className="text-[7px] font-black uppercase text-zinc-400 tracking-widest leading-none">{cat.label}</span>
          </div>
        ))}
      </div>

      {/* Mission List */}
      <div className="px-6 space-y-3">
        {ACHIEVEMENTS.map((ach) => {
          const isClaimed = completedIds.includes(ach.id);
          const isReady = isMissionComplete(ach) && !isClaimed;
          const Icon = ICON_MAP[ach.icon] || Target;

          return (
            <motion.div 
              key={ach.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`relative overflow-hidden rounded-3xl border transition-all duration-500
                ${isReady ? 'bg-zinc-900 border-brand-primary/40 shadow-lg shadow-brand-primary/5' : 
                  isClaimed ? 'bg-zinc-950/50 border-white/5 opacity-60' : 
                  'bg-zinc-900/40 border-white/5'}`}
            >
              {/* Ready to Claim Glow */}
              {isReady && (
                <div className="absolute inset-0 bg-brand-primary/5 animate-pulse pointer-events-none" />
              )}

              <div className="p-4 flex items-center gap-4">
                {/* Icon Container */}
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors
                  ${isReady ? 'bg-brand-primary text-white scale-110 shadow-xl' : 
                    isClaimed ? 'bg-zinc-800 text-zinc-600' : 'bg-zinc-800/50 text-zinc-500'}`}
                >
                  <Icon className="w-6 h-6" />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-display font-black italic text-sm text-white uppercase tracking-tight truncate">{ach.title}</h3>
                    {ach.type !== 'once' && (
                      <span className="text-[6px] font-black uppercase px-1.5 py-0.5 bg-white/5 text-zinc-500 rounded-md border border-white/5 tracking-widest">{ach.type}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-500 font-bold leading-tight">{ach.description}</p>
                </div>

                {/* Action Button */}
                <div className="shrink-0 flex items-center gap-3">
                  {isClaimed ? (
                    <div className="bg-emerald-500/10 text-emerald-500 p-2 rounded-xl border border-emerald-500/20">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  ) : isReady ? (
                    <button 
                      onClick={() => handleClaim(ach)}
                      disabled={claimingId === ach.id}
                      className="bg-brand-primary px-4 py-3 rounded-2xl text-white font-display font-black italic text-[10px] uppercase tracking-widest shadow-xl shadow-brand-primary/20 active:scale-90 transition-all flex items-center gap-2"
                    >
                      {claimingId === ach.id ? (
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>RESGATAR <span className="text-white/50">{ach.reward}DC</span></>
                      )}
                    </button>
                  ) : (
                    <div className="flex flex-col items-center gap-1 opacity-40">
                      <div className="flex items-center gap-1">
                        <Coins className="w-3 h-3 text-yellow-500" />
                        <span className="text-xs font-display font-black text-white italic">{ach.reward}</span>
                      </div>
                      <span className="text-[6px] font-black uppercase text-zinc-500 tracking-tighter">Pendente</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Info Card */}
      <div className="mt-8 px-6">
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 rounded-3xl border border-white/5 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-brand-primary/10 blur-3xl rounded-full" />
          <Zap className="w-6 h-6 text-brand-primary mb-3" />
          <h4 className="text-white font-display font-black italic uppercase tracking-tight mb-2">Dica de Piloto</h4>
          <p className="text-[10px] text-zinc-500 font-bold leading-relaxed">
            As missões semnais resetam toda **Segunda-feira às 04:00**. Fique atento para não perder suas moedas semanais!
          </p>
        </div>
      </div>
    </div>
  );
}
