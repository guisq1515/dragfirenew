import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Palette, X, Sparkles, CheckCircle2, ChevronRight, Tags, Award, Sun } from 'lucide-react';
import { PROFILE_THEMES, ProfileThemeDef, BADGES, NEON_COLORS, StoreItem } from '../constants/themes';
import { UserProfile } from '../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export function ThemeStoreModal({ 
  profile, 
  onClose,
  onUpdate 
}: { 
  profile: UserProfile; 
  onClose: () => void;
  onUpdate: (data: Partial<UserProfile>) => void;
}) {
  const [activeTab, setActiveTab] = useState<'exclusive' | 'brands' | 'badges' | 'neon'>('exclusive');
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);

  const unlockedThemes = profile.unlockedThemes || ['default'];
  const unlockedBadges = profile.unlockedBadges || [];
  const unlockedNeonColors = profile.unlockedNeonColors || [];
  
  const currentActiveTheme = profile.activeThemeId || 'default';
  const currentActiveBadge = profile.activeBadgeId;
  const currentActiveNeon = profile.activeNeonColor;

  const exclusiveThemes = PROFILE_THEMES.filter(t => !t.isBrand);
  const brandThemes = PROFILE_THEMES.filter(t => t.isBrand);

  const handleAction = async (item: ProfileThemeDef | StoreItem, type: 'theme' | 'badge' | 'neon') => {
    try {
      setLoadingItemId(item.id);
      const ref = doc(db, 'users', profile.uid);

      if (type === 'theme') {
        const isUnlocked = unlockedThemes.includes(item.id) || item.id === 'default';
        if (isUnlocked) {
          if (currentActiveTheme !== item.id) {
            await updateDoc(ref, { activeThemeId: item.id });
            onUpdate({ activeThemeId: item.id });
          }
        } else {
          const theme = item as ProfileThemeDef;
          if ((profile.dfCoins || 0) < theme.price) {
            alert(`Saldo Insuficiente! Você precisa de ${theme.price} DC.`);
            return;
          }
          const newUnlocked = [...unlockedThemes, theme.id];
          const newBalance = (profile.dfCoins || 0) - theme.price;
          await updateDoc(ref, { unlockedThemes: newUnlocked, activeThemeId: theme.id, dfCoins: newBalance });
          onUpdate({ unlockedThemes: newUnlocked, activeThemeId: theme.id, dfCoins: newBalance });
        }
      } else if (type === 'badge') {
        const isUnlocked = unlockedBadges.includes(item.id);
        if (isUnlocked) {
          const newBadge = currentActiveBadge === item.id ? null : item.id;
          await updateDoc(ref, { activeBadgeId: newBadge });
          onUpdate({ activeBadgeId: newBadge });
        } else {
          const badge = item as StoreItem;
          if ((profile.dfCoins || 0) < badge.price) {
            alert(`Saldo Insuficiente! Você precisa de ${badge.price} DC.`);
            return;
          }
          const newUnlocked = [...unlockedBadges, badge.id];
          const newBalance = (profile.dfCoins || 0) - badge.price;
          await updateDoc(ref, { unlockedBadges: newUnlocked, activeBadgeId: badge.id, dfCoins: newBalance });
          onUpdate({ unlockedBadges: newUnlocked, activeBadgeId: badge.id, dfCoins: newBalance });
        }
      } else if (type === 'neon') {
        const isUnlocked = unlockedNeonColors.includes(item.id);
        if (isUnlocked) {
          const newNeon = currentActiveNeon === (item as StoreItem).color ? null : (item as StoreItem).color;
          await updateDoc(ref, { activeNeonColor: newNeon, hasNeon: !!newNeon });
          onUpdate({ activeNeonColor: newNeon, hasNeon: !!newNeon });
        } else {
          const neon = item as StoreItem;
          if ((profile.dfCoins || 0) < neon.price) {
            alert(`Saldo Insuficiente! Você precisa de ${neon.price} DC.`);
            return;
          }
          const newUnlocked = [...unlockedNeonColors, neon.id];
          const newBalance = (profile.dfCoins || 0) - neon.price;
          await updateDoc(ref, { unlockedNeonColors: newUnlocked, activeNeonColor: neon.color, hasNeon: true, dfCoins: newBalance });
          onUpdate({ unlockedNeonColors: newUnlocked, activeNeonColor: neon.color, hasNeon: true, dfCoins: newBalance });
        }
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao processar item.');
    } finally {
      setLoadingItemId(null);
    }
  };

  const DEV_addCoins = async () => {
    const ref = doc(db, 'users', profile.uid);
    const newBalance = (profile.dfCoins || 0) + 500;
    await updateDoc(ref, { dfCoins: newBalance });
    onUpdate({ dfCoins: newBalance });
    alert('500 DFCoin adicionados para testes!');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="bg-zinc-950 w-full sm:max-w-md rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 relative bg-zinc-900 shrink-0">
           <button onClick={onClose} className="absolute top-6 right-6 p-2 text-zinc-400 bg-black/40 rounded-xl">
             <X className="w-5 h-5" />
           </button>
           
           <div className="flex justify-between items-start mb-2 pr-12">
             <div>
               <h2 className="text-2xl font-display font-black italic text-white leading-none flex items-center gap-2">
                  <Palette className="w-5 h-5 text-brand-primary" /> DRAGFIRE STORE
               </h2>
               <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Skins Exclusivas de Perfil</p>
             </div>
             
             <div className="flex flex-col items-end">
               <div className="flex items-center gap-1.5 bg-zinc-950 px-3 py-1.5 rounded-lg border border-yellow-500/30">
                 <span className="text-lg">🪙</span>
                 <span className="text-white font-black italic">{profile.dfCoins || 0}</span>
               </div>
               <button 
                 onClick={DEV_addCoins}
                 className="text-[9px] text-zinc-500 font-bold uppercase hover:text-white transition-colors mt-1"
               >
                 + Recarregar (Teste)
               </button>
             </div>
           </div>
        </div>

        <div className="flex bg-zinc-900 border-b border-white/5 shrink-0 overflow-x-auto scrollbar-none">
          <button 
            onClick={() => setActiveTab('exclusive')}
            className={`min-w-[100px] py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 flex justify-center items-center gap-1.5 ${activeTab === 'exclusive' ? 'border-brand-primary text-white' : 'border-transparent text-zinc-500 hover:text-white'}`}
          >
            <Sparkles className="w-3 h-3" /> Especiais
          </button>
          <button 
            onClick={() => setActiveTab('brands')}
            className={`min-w-[100px] py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 flex justify-center items-center gap-1.5 ${activeTab === 'brands' ? 'border-brand-primary text-white' : 'border-transparent text-zinc-500 hover:text-white'}`}
          >
            <Tags className="w-3 h-3" /> Marcas
          </button>
          <button 
            onClick={() => setActiveTab('badges')}
            className={`min-w-[100px] py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 flex justify-center items-center gap-1.5 ${activeTab === 'badges' ? 'border-brand-primary text-white' : 'border-transparent text-zinc-500 hover:text-white'}`}
          >
            <Award className="w-3 h-3" /> Badges
          </button>
          <button 
            onClick={() => setActiveTab('neon')}
            className={`min-w-[100px] py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 flex justify-center items-center gap-1.5 ${activeTab === 'neon' ? 'border-brand-primary text-white' : 'border-transparent text-zinc-500 hover:text-white'}`}
          >
            <Sun className="w-3 h-3" /> Neon
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
           {activeTab === 'exclusive' || activeTab === 'brands' ? (activeTab === 'exclusive' ? exclusiveThemes : brandThemes).map(theme => {
             const hasTheme = unlockedThemes.includes(theme.id) || theme.id === 'default';
             const isEquipped = currentActiveTheme === theme.id;
             const isProcessing = loadingItemId === theme.id;

             return (
               <div key={theme.id} className={`rounded-2xl border overflow-hidden transition-all ${theme.borderClass} ${theme.backgroundClass}`}>
                 <div className={`h-24 ${theme.headerClass} relative`}>
                    {theme.bannerUrl && <img src={theme.bannerUrl} className="w-full h-full object-cover opacity-50" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    {isEquipped && (
                      <div className="absolute top-2 right-2 bg-black/60 rounded-lg px-2 py-1 flex items-center gap-1 text-white text-[9px] font-black uppercase">
                         <CheckCircle2 className={`w-3 h-3 ${theme.accentText}`} /> Utilizando
                      </div>
                    )}
                 </div>
                 
                 <div className="p-4 flex items-center justify-between">
                    <div>
                       <h3 className="font-black italic text-white text-lg uppercase leading-none">{theme.name}</h3>
                       {!hasTheme && <p className="text-[10px] text-zinc-400 font-bold tracking-widest uppercase mt-1">Skin de Perfil</p>}
                    </div>

                    <button 
                      onClick={() => handleAction(theme, 'theme')}
                      disabled={isEquipped || isProcessing}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-transform active:scale-95 flex items-center justify-center min-w-[100px] 
                         ${isEquipped ? 'bg-zinc-800 text-zinc-500 opacity-50' : 
                           hasTheme ? `${theme.accentBg} text-white` : 
                           'bg-brand-primary text-white shadow-lg'}`
                      }
                    >
                      {isProcessing ? '...' : isEquipped ? 'Equipado' : hasTheme ? 'Equipar' : `Comprar ${theme.priceLabel}`}
                    </button>
                 </div>
               </div>
             );
           }) : activeTab === 'badges' ? BADGES.map(badge => {
             const hasBadge = unlockedBadges.includes(badge.id);
             const isEquipped = currentActiveBadge === badge.id;
             const isProcessing = loadingItemId === badge.id;

             return (
               <div key={badge.id} className="bg-zinc-900 border border-white/5 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-black flex items-center justify-center overflow-hidden border border-white/5">
                    <img src={badge.imageUrl} className="w-10 h-10 object-contain" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-black italic text-white text-md uppercase leading-none">{badge.name}</h3>
                    <p className="text-[9px] text-zinc-500 font-bold tracking-widest uppercase mt-1">Badge de Perfil</p>
                  </div>
                  <button 
                    onClick={() => handleAction(badge, 'badge')}
                    disabled={isProcessing}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-transform active:scale-95 flex items-center justify-center min-w-[100px] 
                       ${isEquipped ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                         hasBadge ? 'bg-zinc-800 text-white' : 
                         'bg-brand-primary text-white'}`
                    }
                  >
                    {isProcessing ? '...' : isEquipped ? 'Desequipar' : hasBadge ? 'Equipar' : `Comprar ${badge.priceLabel}`}
                  </button>
               </div>
             );
           }) : NEON_COLORS.map(neon => {
             const hasNeon = unlockedNeonColors.includes(neon.id);
             const isEquipped = currentActiveNeon === neon.color;
             const isProcessing = loadingItemId === neon.id;

             return (
               <div key={neon.id} className="bg-zinc-900 border border-white/5 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full border-4 flex items-center justify-center" style={{ borderColor: `${neon.color}44`, backgroundColor: `${neon.color}22` }}>
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: neon.color, boxShadow: `0 0 15px ${neon.color}` }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-black italic text-white text-md uppercase leading-none">{neon.name}</h3>
                    <p className="text-[9px] text-zinc-500 font-bold tracking-widest uppercase mt-1">Aura de Borda</p>
                  </div>
                  <button 
                    onClick={() => handleAction(neon, 'neon')}
                    disabled={isProcessing}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-transform active:scale-95 flex items-center justify-center min-w-[100px] 
                       ${isEquipped ? 'bg-zinc-800 text-zinc-500 border border-white/5' : 
                         hasNeon ? 'bg-zinc-800 text-white' : 
                         'bg-brand-primary text-white'}`
                    }
                  >
                    {isProcessing ? '...' : isEquipped ? 'Desativar' : hasNeon ? 'Ativar' : `Comprar ${neon.priceLabel}`}
                  </button>
               </div>
             );
           })}
        </div>

      </motion.div>
    </motion.div>
  );
}
