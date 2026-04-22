import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, X, Sparkles, CheckCircle2, ChevronRight, Tags, Award, Sun, Coins, ShieldCheck } from 'lucide-react';
import { PROFILE_THEMES, ProfileThemeDef, BADGES, NEON_COLORS, TITLES, StoreItem } from '../constants/themes';
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
  const [activeTab, setActiveTab] = useState<'themes' | 'badges' | 'neon' | 'titles'>('themes');
  const [themeCategory, setThemeCategory] = useState<'all' | 'normal' | 'brands' | 'motos'>('all');
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);

  const unlockedThemes = profile.unlockedThemes || ['default'];
  const unlockedBadges = profile.unlockedBadges || [];
  const unlockedNeonColors = profile.unlockedNeonColors || [];
  const unlockedTitles = profile.unlockedTitles || [];
  
  const currentActiveTheme = profile.activeThemeId || 'default';
  const currentActiveBadge = profile.activeBadgeId;
  const currentActiveNeon = profile.activeNeonColor;
  const currentActiveTitle = profile.activeTitleId;

  // Filter themes and sort them (equipped/unlocked first)
  const filteredThemes = PROFILE_THEMES.filter(t => {
    if (themeCategory === 'all') return true;
    if (themeCategory === 'normal') return !t.isBrand && !t.isMoto && t.id !== 'default';
    if (themeCategory === 'brands') return t.isBrand && !t.isMoto;
    if (themeCategory === 'motos') return !!t.isMoto;
    return true;
  });

  const allThemes = (activeTab === 'themes' ? filteredThemes : PROFILE_THEMES).sort((a, b) => {
    const aUnlocked = unlockedThemes.includes(a.id) || a.id === 'default';
    const bUnlocked = unlockedThemes.includes(b.id) || b.id === 'default';
    if (aUnlocked && !bUnlocked) return -1;
    if (!aUnlocked && bUnlocked) return 1;
    return a.price - b.price;
  });

  const handleAction = async (item: ProfileThemeDef | StoreItem, type: 'theme' | 'badge' | 'neon' | 'title') => {
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
      } else if (type === 'title') {
        const isUnlocked = unlockedTitles.includes(item.id);
        if (isUnlocked) {
          const newTitle = currentActiveTitle === item.id ? null : item.id;
          await updateDoc(ref, { activeTitleId: newTitle });
          onUpdate({ activeTitleId: newTitle });
        } else {
          const title = item as StoreItem;
          if ((profile.dfCoins || 0) < title.price) {
            alert(`Saldo Insuficiente! Você precisa de ${title.price} DC.`);
            return;
          }
          const newUnlocked = [...unlockedTitles, title.id];
          const newBalance = (profile.dfCoins || 0) - title.price;
          await updateDoc(ref, { unlockedTitles: newUnlocked, activeTitleId: title.id, dfCoins: newBalance });
          onUpdate({ unlockedTitles: newUnlocked, activeTitleId: title.id, dfCoins: newBalance });
        }
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao processar item.');
    } finally {
      setLoadingItemId(null);
    }
  };

  const isAdmin = profile.email === 'guisq1515@gmail.com';

  const DEV_addCoins = async () => {
    const ref = doc(db, 'users', profile.uid);
    const newBalance = (profile.dfCoins || 0) + 9999;
    await updateDoc(ref, { dfCoins: newBalance });
    onUpdate({ dfCoins: newBalance });
    alert('9.999 DFCoin adicionados para testes!');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/95 backdrop-blur-md"
    >
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="bg-zinc-950 w-full sm:max-w-2xl sm:rounded-[40px] overflow-hidden border-t sm:border border-white/10 shadow-2xl flex flex-col h-[90vh] sm:h-auto sm:max-h-[85vh]"
      >
        {/* Header Section */}
        <div className="p-6 pb-2 relative shrink-0">
           <button 
             onClick={onClose} 
             className="absolute top-6 right-6 p-2 text-zinc-500 bg-white/5 hover:bg-white/10 hover:text-white rounded-xl transition-all active:scale-90"
           >
             <X className="w-5 h-5" />
           </button>
           
           <div className="flex justify-between items-center mb-6">
             <div>
                <div className="flex items-center gap-2 mb-1">
                  <Palette className="w-4 h-4 text-brand-primary" />
                  <h2 className="text-xl font-display font-black italic text-white uppercase tracking-tighter">
                    LOJA <span className="text-brand-primary">PREMIUM</span>
                  </h2>
                </div>
                <p className="text-[7px] text-zinc-500 font-black uppercase tracking-[0.4em] flex items-center gap-1.5">
                  <ShieldCheck className="w-2.5 h-2.5" /> High-End Social Custom
                </p>
             </div>
             
             <div className="flex flex-col items-end pr-10 sm:pr-0">
                <div className="flex items-center gap-2 bg-zinc-900 border border-white/5 px-3 py-1.5 rounded-xl shadow-inner group">
                  <Coins className="w-3.5 h-3.5 text-yellow-500 transition-transform group-hover:rotate-12" />
                  <span className="text-lg font-display font-black italic text-white leading-none">
                    {(profile.dfCoins || 0).toLocaleString()} <span className="text-[8px] text-zinc-500 ml-0.5 tracking-widest">DC</span>
                  </span>
                </div>
                {isAdmin && (
                  <button 
                    onClick={DEV_addCoins}
                    className="text-[8px] text-emerald-500 font-black uppercase tracking-widest hover:text-white transition-colors mt-1.5 underline decoration-emerald-500/30 underline-offset-4"
                  >
                    + Admin Refill (9999)
                  </button>
                )}
             </div>
           </div>
        </div>

        {/* Categories */}
        <div className="px-6 shrink-0 mb-4">
          <div className="flex bg-zinc-900/50 p-1 rounded-2xl border border-white/5 gap-1">
            {[
              { id: 'themes', label: 'Temas', icon: Palette },
              { id: 'badges', label: 'Badges', icon: Award },
              { id: 'titles', label: 'Títulos', icon: Tags },
              { id: 'neon', label: 'Auras', icon: Sun },
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-3 px-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex justify-center items-center gap-2 relative overflow-hidden
                  ${activeTab === tab.id ? 'bg-brand-primary text-white shadow-xl shadow-brand-primary/20' : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/5'}`}
              >
                <tab.icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? '' : 'opacity-40'}`} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Store Content */}
        <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-4 hide-scrollbar pb-10">
           {/* Sub-Category Menu for Themes */}
           {activeTab === 'themes' && (
             <motion.div 
               initial={{ opacity: 0, y: -10 }}
               animate={{ opacity: 1, y: 0 }}
               className="flex items-center gap-2 mb-2"
             >
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'normal', label: 'Geral' },
                  { id: 'brands', label: 'Marcas' },
                  { id: 'motos', label: 'Motos' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setThemeCategory(cat.id as any)}
                    className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border
                      ${themeCategory === cat.id ? 'bg-white text-black border-white' : 'bg-zinc-900 text-zinc-500 border-white/5 hover:text-white hover:bg-zinc-800'}`}
                  >
                    {cat.label}
                  </button>
                ))}
             </motion.div>
           )}

           <AnimatePresence mode="wait">
             <motion.div
               key={activeTab}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               transition={{ duration: 0.2 }}
               className="grid grid-cols-1 gap-4"
             >
               {activeTab === 'themes' ? allThemes.map(theme => {
                 const hasTheme = unlockedThemes.includes(theme.id) || theme.id === 'default';
                 const isEquipped = currentActiveTheme === theme.id;
                 const isProcessing = loadingItemId === theme.id;

                 return (
                   <div key={theme.id} className={`group rounded-[28px] border-2 overflow-hidden transition-all duration-300 ${theme.borderClass} ${theme.backgroundClass}`}>
                     <div className="relative aspect-[16/7] overflow-hidden">
                        {theme.bannerUrl ? (
                          <img src={theme.bannerUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="" />
                        ) : (
                          <div className={`w-full h-full ${theme.headerClass}`} />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                        
                        <div className="absolute top-3 left-4">
                          {isEquipped && (
                            <div className="bg-black/60 backdrop-blur-md rounded-lg px-2 py-1 flex items-center gap-1.5 text-white text-[8px] font-black uppercase border border-white/10">
                               <CheckCircle2 className={`w-3 h-3 ${theme.accentText} fill-current`} /> Equipado
                            </div>
                          )}
                        </div>

                        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                           <div className="min-w-0">
                              <h3 className="font-display font-black italic text-lg text-white uppercase tracking-tighter leading-tight mb-0.5 truncate">{theme.name}</h3>
                              <p className="text-[7px] text-zinc-400 font-black tracking-widest uppercase truncate opacity-60">Custom Profile Wrap</p>
                           </div>

                           <button 
                             onClick={() => handleAction(theme, 'theme')}
                             disabled={isEquipped || isProcessing}
                             className={`px-4 py-2.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all min-w-[100px] border active:scale-95
                                ${isEquipped ? 'bg-white/5 text-zinc-700 border-white/5 opacity-50 cursor-default' : 
                                  hasTheme ? `${theme.accentBg} text-white border-white/10` : 
                                  'bg-white text-black border-white hover:bg-brand-primary hover:text-white'}`
                             }
                           >
                             {isProcessing ? (
                               <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto" />
                             ) : isEquipped ? 'Ativado' : hasTheme ? 'Equipar' : theme.priceLabel}
                           </button>
                        </div>
                     </div>
                   </div>
                 );
               }) : activeTab === 'badges' ? (
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-8">
                   {BADGES.map(badge => {
                     const hasBadge = unlockedBadges.includes(badge.id);
                     const isEquipped = currentActiveBadge === badge.id;
                     const isProcessing = loadingItemId === badge.id;

                     return (
                       <div key={badge.id} className="bg-zinc-900/50 backdrop-blur-md border border-white/5 rounded-2xl p-4 flex items-center gap-4 group hover:border-brand-primary/30 transition-all">
                           <div className="w-12 h-12 rounded-xl bg-black/40 flex items-center justify-center overflow-hidden border border-white/5 p-1">
                             <img 
                               src={badge.imageUrl} 
                               className="w-10 h-10 object-contain contrast-[1.2] brightness-110" 
                               style={{ filter: 'url(#remove-black-filter)' }}
                               alt="" 
                             />
                           </div>
                          <div className="flex-1 min-w-0">
                             <h3 className="font-black italic text-white text-xs uppercase truncate leading-none mb-1.5">{badge.name}</h3>
                             <p className="text-[7px] text-zinc-500 font-black tracking-widest uppercase">Elite Badge</p>
                          </div>
                          <button 
                            onClick={() => handleAction(badge, 'badge')}
                            disabled={isProcessing}
                            className={`w-10 h-10 rounded-xl transition-all active:scale-90 flex items-center justify-center border shadow-lg
                               ${isEquipped ? 'bg-emerald-500 text-white border-emerald-400' : 
                                 hasBadge ? 'bg-zinc-800 text-white border-white/10 hover:bg-zinc-700' : 
                                 'bg-brand-primary text-white border-brand-primary'}`
                            }
                          >
                            {isProcessing ? (
                              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : isEquipped ? <X className="w-4 h-4" /> : hasBadge ? <CheckCircle2 className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                       </div>
                     );
                   })}
                 </div>
               ) : activeTab === 'titles' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-8">
                    {TITLES.map(title => {
                      const hasTitle = unlockedTitles.includes(title.id);
                      const isEquipped = currentActiveTitle === title.id;
                      const isProcessing = loadingItemId === title.id;

                      return (
                        <div key={title.id} className="bg-zinc-900 border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:border-brand-primary/20 transition-all">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center border border-white/5">
                                <Tags className={`w-5 h-5 ${isEquipped ? 'text-brand-primary' : 'text-zinc-500'}`} />
                              </div>
                              <div>
                                <h3 className="font-display font-black italic text-white text-xs uppercase tracking-tighter mb-0.5">{title.name}</h3>
                                <p className="text-[7px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Honorário</p>
                              </div>
                           </div>
                           <button 
                             onClick={() => handleAction(title, 'title')}
                             disabled={isProcessing}
                             className={`px-4 py-2.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all active:scale-95
                                ${isEquipped ? 'bg-zinc-800 text-zinc-500 border border-white/5' : 
                                  hasTitle ? 'bg-white text-black border-white' : 
                                  'bg-brand-primary text-white border-brand-primary'}`
                             }
                           >
                             {isProcessing ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto" /> : isEquipped ? 'Ativado' : hasTitle ? 'Equipar' : title.priceLabel}
                           </button>
                        </div>
                      );
                    })}
                  </div>
               ) : (
                 <div className="grid grid-cols-1 gap-3 pb-8">
                    {NEON_COLORS.map(neon => {
                      const hasNeon = unlockedNeonColors.includes(neon.id);
                      const isEquipped = currentActiveNeon === neon.color;
                      const isProcessing = loadingItemId === neon.id;

                      return (
                        <div key={neon.id} className="bg-zinc-900 border border-white/5 rounded-3xl p-4 flex items-center gap-4 relative overflow-hidden">
                           <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ background: `radial-gradient(circle at center, ${neon.color}, transparent)` }} />
                           <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center relative z-10" style={{ borderColor: `${neon.color}33`, backgroundColor: `${neon.color}08` }}>
                             <div className="w-4 h-4 rounded-full" style={{ backgroundColor: neon.color, boxShadow: `0 0 15px ${neon.color}` }} />
                           </div>
                           <div className="flex-1 min-w-0 relative z-10">
                             <h3 className="font-display font-black italic text-white text-sm uppercase leading-none mb-1.5">{neon.name}</h3>
                             <p className="text-[7px] text-zinc-500 font-bold uppercase tracking-widest">Aura Perimetral</p>
                           </div>
                           <button 
                             onClick={() => handleAction(neon, 'neon')}
                             disabled={isProcessing}
                             className={`px-6 py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all relative z-10 active:scale-95
                                ${isEquipped ? 'bg-zinc-800 text-zinc-500 border border-white/5' : 
                                  hasNeon ? 'bg-white text-black border-white' : 
                                  'bg-brand-primary text-white border-brand-primary'}`
                             }
                           >
                             {isProcessing ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto" /> : isEquipped ? 'Desativar' : hasNeon ? 'Ativ.' : neon.priceLabel}
                           </button>
                        </div>
                      );
                    })}
                 </div>
               )}
             </motion.div>
           </AnimatePresence>
        </div>

        {/* Footer info */}
        <div className="p-4 bg-zinc-950 border-t border-white/5 text-center shrink-0">
           <p className="text-[6px] text-zinc-600 font-black uppercase tracking-[0.5em] italic">Propulsado por DragFire Performance System</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
