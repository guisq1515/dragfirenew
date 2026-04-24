import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  Activity, 
  Zap, 
  Search as SearchIcon, 
  Maximize2, 
  Minimize2,
  MapPin,
  Volume2,
  VolumeX,
  Layers,
  X,
  SignalHigh,
  CloudOff,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Navigation
} from 'lucide-react';
import { CurveData, RoadNode } from '../services/CurveAnalysisService';
import { IMUData } from '../services/SensorFusionService';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

interface CorneringAssistantHUDProps {
  nextCurve: CurveData | null;
  posteriorCurve: CurveData | null;
  upcomingNodes: RoadNode[];
  currentLat: number | null;
  currentLng: number | null;
  currentHeading: number | null;
  speedKmh: number;
  lookAheadDistance: number;
  destination: string | null;
  setDestination: (dest: string | null) => void;
  isRouteMode: boolean;
  onBack: () => void;
  currentRoadName: string | null;
  snappedLocation: RoadNode | null;
  smoothLocation?: { lat: number, lng: number, heading: number } | null;
  isLoading?: boolean;
  allRegionalWays?: RoadNode[][];
  imu?: IMUData | null;
  minimapZoomMultiplier?: number;
}

export function CorneringAssistantHUD({
  nextCurve,
  posteriorCurve,
  upcomingNodes,
  currentLat,
  currentLng,
  currentHeading,
  speedKmh,
  lookAheadDistance,
  destination,
  setDestination,
  isRouteMode,
  onBack,
  currentRoadName,
  snappedLocation,
  smoothLocation,
  isLoading = false,
  allRegionalWays = [],
  imu,
  minimapZoomMultiplier = 30000
}: CorneringAssistantHUDProps) {
  const [isMirrored, setIsMirrored] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [isMuted, setIsMuted] = useState(true);
  const [displayMode, setDisplayMode] = useState<'vector' | 'sign'>('sign');
  const [hasNetwork, setHasNetwork] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    const updateStatus = () => setHasNetwork(navigator.onLine);
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  const reportError = async (type: string) => {
    try {
      await addDoc(collection(db, 'map_feedback'), {
        type,
        lat: currentLat,
        lng: currentLng,
        roadName: currentRoadName,
        timestamp: Date.now(),
        userAgent: navigator.userAgent
      });
      setShowFeedback(false);
      alert("Feedback enviado com sucesso!");
    } catch (e) {
      console.error(e);
    }
  };

  const getSeverityBaseColor = (severity?: string) => {
    switch (severity) {
      case 'straight': return '#22c55e';
      case 'soft': return '#22c55e';
      case 'medium': return '#eab308';
      case 'hard': return '#ef4444';
      case 'hairpin': return '#7f1d1d';
      case 's-curve': return '#a855f7';
      case 'chicane': return '#ec4899';
      default: return '#3b82f6';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'straight': return 'Pista Livre / Reta';
      case 'soft': return 'Curva Suave';
      case 'medium': return 'Curva Médiana';
      case 'hard': return 'Curva Fechada';
      case 'hairpin': return 'Grampo 180°';
      case 's-curve': return 'Sequência Curvas S';
      case 'chicane': return 'Chicane Técnica';
      default: return 'Curva Rápida';
    }
  };

  const renderPredefinedPlate = (curve: CurveData, size: 'normal' | 'small' = 'normal') => {
    const color = getSeverityBaseColor(curve.severity);
    const isNormal = size === 'normal';
    const isLeft = curve.direction === 'left';
    const isStraight = curve.severity === 'straight';
    let path = "M 50 80 L 50 20";
    let arrowHead = "M 40 30 L 50 20 L 60 30";
    if (isStraight) { path = "M 50 85 L 50 15"; arrowHead = "M 40 30 L 50 15 L 60 30"; }
    else if (curve.severity === 'soft') { path = isLeft ? "M 50 85 C 50 50, 45 40, 30 30" : "M 50 85 C 50 50, 55 40, 70 30"; arrowHead = isLeft ? "M 32 42 L 30 30 L 42 32" : "M 58 32 L 70 30 L 68 42"; }
    else if (curve.severity === 'medium') { path = isLeft ? "M 50 85 C 50 50, 40 45, 20 40" : "M 50 85 C 50 50, 60 45, 80 40"; arrowHead = isLeft ? "M 25 50 L 20 40 L 30 35" : "M 70 35 L 80 40 L 75 50"; }
    else if (curve.severity === 'hard' || curve.severity === 'hairpin') { path = isLeft ? "M 50 85 L 50 40 L 20 40" : "M 50 85 L 50 40 L 80 40"; arrowHead = isLeft ? "M 28 50 L 20 40 L 28 30" : "M 72 30 L 80 40 L 72 50"; if (curve.severity === 'hairpin') { path = isLeft ? "M 50 85 L 50 30 C 50 15, 20 15, 20 30 L 20 60" : "M 50 85 L 50 30 C 50 15, 80 15, 80 30 L 80 60"; arrowHead = isLeft ? "M 12 52 L 20 60 L 28 52" : "M 72 52 L 80 60 L 88 52"; } }
    
    return (
      <div className={`relative ${isNormal ? 'w-56 h-56' : 'w-24 h-24'} flex items-center justify-center`}>
         <motion.div animate={{ backgroundColor: color }} className={`absolute ${isNormal ? 'w-48 h-48 border-4' : 'w-20 h-20 border-2'} border-white/20 rounded-[2.5rem] shadow-2xl rotate-45`} />
         <svg viewBox="0 0 100 100" className={`${isNormal ? 'w-32 h-32' : 'w-14 h-14'} relative z-10`}>
            <motion.path d={path} fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" animate={{ pathLength: 1 }} />
            <motion.path d={arrowHead} fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" />
         </svg>
         {isNormal && curve.slope !== undefined && Math.abs(curve.slope) > 1 && (
            <div className="absolute top-4 right-4 flex items-center gap-1 bg-black/40 px-2 py-1 rounded-full border border-white/10">
               {curve.isUphill ? <ArrowUpRight className="w-3 h-3 text-emerald-400" /> : <ArrowDownRight className="w-3 h-3 text-red-400" />}
               <span className="text-[8px] font-black text-white">{Math.abs(curve.slope)}%</span>
            </div>
         )}
      </div>
    );
  };

  return (
    <div className={`fixed inset-0 z-[200] flex flex-col font-display overflow-hidden transition-all duration-700 ${isMirrored ? 'scale-x-[-1]' : ''} bg-zinc-950`}>
      {/* Top Bar */}
      <div className="relative z-50 p-3 flex items-center justify-between gap-3">
        <button onClick={onBack} className="bg-white/5 border border-white/10 p-3 rounded-xl"><ChevronLeft className="w-5 h-5 text-zinc-400" /></button>
        <div className="flex-1"><button onClick={() => setIsSearching(true)} className="w-full bg-zinc-900/50 border border-white/10 rounded-xl py-2.5 px-3 flex items-center gap-2"><SearchIcon className="w-3.5 h-3.5 text-zinc-600" /><span className="text-[9px] font-black uppercase text-zinc-500">{destination || 'Definir Destino...'}</span></button></div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFeedback(true)} className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400"><AlertTriangle className="w-5 h-5" /></button>
          <button onClick={() => setIsMuted(!isMuted)} className={`p-3 rounded-xl border ${isMuted ? 'bg-zinc-900 border-white/5 text-zinc-600' : 'bg-cyan-500/20 border-cyan-500 text-cyan-400'}`}>{isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}</button>
          <div className={`${hasNetwork ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'} px-3 py-1.5 rounded-xl flex items-center gap-2`}><SignalHigh className={`w-3 h-3 ${hasNetwork ? 'text-emerald-500' : 'text-red-500'}`} /><span className={`text-[8px] font-black ${hasNetwork ? 'text-emerald-400' : 'text-red-400'} uppercase`}>{hasNetwork ? 'DADOS ATIVOS' : 'OFFLINE'}</span></div>
          <button onClick={() => setIsMirrored(!isMirrored)} className={`p-3 rounded-xl border ${isMirrored ? 'bg-brand-primary/20 border-brand-primary text-brand-primary' : 'bg-white/5 border-white/10 text-zinc-400'}`}>{isMirrored ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}</button>
        </div>
      </div>

      {/* G-Force Panel (Lateral G) */}
      <div className="absolute left-6 top-24 flex flex-col items-center gap-2 z-50">
         <div className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Lateral G</div>
         <div className="w-2 h-32 bg-white/5 rounded-full relative overflow-hidden border border-white/5">
            <motion.div 
               animate={{ height: `${Math.abs(imu?.lateralG || 0) * 50}%`, y: (imu?.lateralG || 0) > 0 ? '50%' : '-50%' }}
               className={`w-full absolute top-1/2 rounded-full ${(imu?.lateralG || 0) > 0.8 ? 'bg-red-500' : 'bg-cyan-400'}`}
               style={{ boxShadow: `0 0 10px ${(imu?.lateralG || 0) > 0.8 ? '#ef4444' : '#22d3ee'}` }}
            />
         </div>
         <div className="text-xs font-black text-white italic">{(imu?.lateralG || 0).toFixed(2)}</div>
      </div>

      <div className="px-6 mb-2 flex items-center justify-between">
        <div className="flex flex-col"><span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.5em] mb-1">Via Atual</span><div className="text-sm font-black text-white italic truncate uppercase max-w-[60vw]">{isLoading && upcomingNodes.length === 0 ? 'Mapeando Via...' : (currentRoadName || 'Analisando Trecho...')}</div></div>
      </div>

      {/* Progress Bar */}
      <div className="px-6 mt-4">
        <div className="h-2 bg-white/5 rounded-full overflow-hidden relative border border-white/5 backdrop-blur-md">{nextCurve && <motion.div animate={{ width: `${Math.max(0, Math.min(100, (1 - nextCurve.distance / lookAheadDistance) * 100))}%`, backgroundColor: getSeverityBaseColor(nextCurve.severity) }} className="h-full rounded-full" />}<div className="absolute left-[80%] top-0 bottom-0 w-0.5 bg-white/20" /></div>
      </div>

      {/* Main Display */}
      <motion.div className="flex-1 flex flex-col items-center justify-center relative z-10">
        <AnimatePresence mode="wait">
          {isLoading && upcomingNodes.length === 0 ? (
            <motion.div className="flex flex-col items-center gap-6"><Activity className="w-20 h-20 text-zinc-800 animate-pulse" /><div className="text-xs font-black text-zinc-650 uppercase tracking-[0.6em]">Mapeando Via...</div></motion.div>
          ) : nextCurve ? (
            <motion.div key={nextCurve.direction + nextCurve.severity} className="flex flex-col items-center">{renderPredefinedPlate(nextCurve)}<div className="mt-4 text-center space-y-1"><div className={`text-2xl font-black uppercase italic ${nextCurve.severity === 'soft' || nextCurve.severity === 'straight' ? 'text-emerald-500' : 'text-red-500'}`}>{getSeverityLabel(nextCurve.severity)}</div><div className="text-6xl font-black text-white italic tracking-tighter leading-none">{nextCurve.distance}<span className="text-xl text-zinc-600 ml-1.5 font-black NOT-italic tracking-widest uppercase">m</span></div></div></motion.div>
          ) : (
            <motion.div className="flex flex-col items-center opacity-20"><Zap className="w-16 h-16 text-zinc-500 mb-4" /><span className="text-[10px] font-black uppercase tracking-[0.4em]">Aguardando Dados...</span></motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Minimap & Velocity */}
      <div className="relative z-10 p-6 pb-12 flex items-end justify-between bg-gradient-to-t from-zinc-950 to-transparent">
        <div className="relative">
          <div className="w-36 h-36 rounded-[2rem] border border-white/5 bg-zinc-900/40 overflow-hidden relative shadow-2xl">
            {currentLat && currentLng && (
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                <g style={{ transform: `rotate(${-(currentHeading || 0)}deg)`, transformOrigin: '50% 50%', transition: 'transform 0.4s ease-out' }}>
                  {(() => {
                    const mapScale = minimapZoomMultiplier; 
                    const cLat = smoothLocation?.lat || currentLat; 
                    const cLng = smoothLocation?.lng || currentLng;
                    return (
                      <>
                        {allRegionalWays.map((way, idx) => (
                           <polyline key={idx} points={way.map(n => `${50 + (n.lng - cLng) * mapScale},${50 - (n.lat - cLat) * mapScale}`).join(' ')} fill="none" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.08" strokeLinecap="round" />
                        ))}
                        {upcomingNodes.length > 0 && (
                          <motion.polyline points={upcomingNodes.map(n => `${50 + (n.lng - cLng) * mapScale},${50 - (n.lat - cLat) * mapScale}`).join(' ')} fill="none" stroke={isRouteMode ? "#22c55e" : "#ef4444"} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                        )}
                      </>
                    );
                  })()}
                </g>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"><div className="w-4 h-4 bg-white rounded-full shadow-[0_0_15px_white] flex items-center justify-center"><div className="w-1.5 h-1.5 bg-black rounded-full" /></div></div>
              </svg>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-6 text-right">
           <div className="space-y-0 relative"><div className="absolute -top-6 right-0 text-[8px] font-black text-brand-primary uppercase tracking-[0.3em] animate-pulse">Live Velocity</div><div className="text-7xl font-black text-white italic leading-none tracking-tighter flex items-baseline">{Math.round(speedKmh)}<span className="text-xl text-zinc-800 ml-2 font-black uppercase">Kmh</span></div></div>
        </div>
      </div>

      {/* Feedback & Search Overlays */}
      <AnimatePresence>
        {showFeedback && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed inset-x-0 bottom-0 bg-zinc-900 rounded-t-[3rem] p-8 z-[300] border-t border-white/10 shadow-2xl">
             <div className="flex items-center justify-between mb-8"><h3 className="text-xl font-black italic text-white uppercase italic">Reportar Erro no Mapa</h3><button onClick={() => setShowFeedback(false)} className="p-3 bg-white/5 rounded-xl"><X /></button></div>
             <div className="grid grid-cols-2 gap-4">
                <button onClick={() => reportError('curva_nao_detectada')} className="p-6 bg-white/5 rounded-3xl border border-white/10 text-white font-black uppercase text-[10px] italic hover:bg-red-500/20 transition-all">Curva nǜo detectada</button>
                <button onClick={() => reportError('severidade_errada')} className="p-6 bg-white/5 rounded-3xl border border-white/10 text-white font-black uppercase text-[10px] italic hover:bg-yellow-500/20 transition-all">Severidade errada</button>
                <button onClick={() => reportError('via_errada')} className="p-6 bg-white/5 rounded-3xl border border-white/10 text-white font-black uppercase text-[10px] italic hover:bg-blue-500/20 transition-all">Via errada (Snapping)</button>
                <button onClick={() => reportError('outros')} className="p-6 bg-white/5 rounded-3xl border border-white/10 text-white font-black uppercase text-[10px] italic hover:bg-zinc-500/20 transition-all">Outros problemas</button>
             </div>
          </motion.div>
        )}
        {isSearching && (
          <motion.div initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }} className="fixed inset-0 bg-zinc-950/95 backdrop-blur-3xl z-[200] p-8 flex flex-col items-center">
            <div className="w-full max-w-xl space-y-8 mt-20"><div className="flex items-center justify-between"><div><h3 className="text-3xl font-black italic text-white uppercase italic tracking-tighter">NAVEGAÇÃO</h3><p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Detecção Inteligente de Trajeto</p></div><button onClick={() => setIsSearching(false)} className="p-4 bg-white/5 rounded-2xl text-zinc-500"><X /></button></div><form onSubmit={(e) => { e.preventDefault(); if (searchInput.trim()) { setDestination(searchInput); setIsSearching(false); } }} className="relative"><MapPin className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-brand-primary" /><input autoFocus type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Destino ou Coordenada..." className="w-full bg-zinc-900 border border-white/5 rounded-3xl py-6 pl-16 pr-6 text-white text-lg focus:border-brand-primary outline-none font-black italic" /></form></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
