import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Navigation, 
  Activity, 
  Zap, 
  Search as SearchIcon, 
  Maximize2, 
  DownloadCloud, 
  Wifi, 
  WifiOff, 
  Minimize2,
  MapPin,
  Volume2,
  VolumeX,
  Layers,
  X,
  MicOff
} from 'lucide-react';
import { CurveData, RoadNode } from '../services/CurveAnalysisService';

interface CorneringAssistantHUDProps {
  nextCurve: CurveData | null;
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
}

export function CorneringAssistantHUD({
  nextCurve,
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
  currentRoadName
}: CorneringAssistantHUDProps) {
  const [isMirrored, setIsMirrored] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [displayMode, setDisplayMode] = useState<'vector' | 'sign'>('sign');

  const getSeverityBaseColor = (severity?: string) => {
    switch (severity) {
      case 'hard': return '#ef4444'; // Red
      case 'hairpin': return '#ef4444'; // Red (User specifically wanted Red for closed)
      case 'medium': return '#eab308'; // Yellow
      case 'soft': return '#22c55e'; // Green
      default: return '#06b6d4'; // Cyan
    }
  };

  const getSeverityBgClass = (severity?: string) => {
    switch (severity) {
      case 'hard': return 'bg-red-950/40 border-red-500/30';
      case 'hairpin': return 'bg-purple-950/40 border-purple-500/30';
      case 'medium': return 'bg-yellow-950/40 border-yellow-500/30';
      case 'soft': return 'bg-emerald-950/40 border-emerald-500/30';
      default: return 'bg-zinc-900/50 border-white/10';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'hard': return 'Curva Fechada';
      case 'hairpin': return 'Grampo 180°';
      case 'medium': return 'Curva Médiana';
      case 'soft': return 'Curva Leve';
      default: return 'Curva Rápida';
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setDestination(searchInput);
      setIsSearching(false);
    }
  };

  // --- SVG Projector Helpers ---
  const renderCurveProjector = (curve: CurveData) => {
    const points = curve.points;
    if (points.length < 2) return null;

    const color = getSeverityBaseColor(curve.severity);
    
    // Normalize points relative to first point for drawing
    const first = points[0];
    const pathData = points.map((p, i) => {
      // Scale: 1 unit = ~0.5 meters (rough)
      const x = 120 + (p.lng - first.lng) * 40000;
      const y = 200 - (p.lat - first.lat) * 40000;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    return (
      <div className="relative w-72 h-72 flex items-center justify-center">
         {/* Perspective Background Lines */}
         <div className="absolute inset-0 opacity-10 flex flex-col justify-between p-10 pointer-events-none">
            <div className="h-px w-full bg-white/20" />
            <div className="h-px w-full bg-white/40" />
            <div className="h-px w-full bg-white/60" />
            <div className="h-px w-full bg-white/80" />
         </div>

         <svg viewBox="0 0 240 240" className="w-full h-full drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
            <defs>
               <linearGradient id="curveGradient" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={color} stopOpacity="1" />
               </linearGradient>
            </defs>
            <motion.path 
              d={pathData}
              fill="none"
              stroke="url(#curveGradient)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
            {/* Motion Dots */}
            <motion.circle r="4" fill="#fff" initial={{ offset: 0 }} animate={{ offset: 1 }} transition={{ repeat: Infinity, duration: 2 }}>
               <animateMotion dur="2s" repeatCount="indefinite" path={pathData} />
            </motion.circle>
         </svg>
      </div>
    );
  };

  const renderCurveSign = (curve: CurveData) => {
    const isLeft = curve.direction === 'left';
    const angle = curve.angle;
    const color = getSeverityBaseColor(curve.severity);
    const isNear = curve.distance <= 100;

    return (
      <div className="relative w-64 h-64 flex items-center justify-center">
         {/* Diamond Road Sign Shape - FULL BACKGROUND COLOR */}
         <motion.div 
            initial={{ rotate: 45, scale: 0.8 }}
            animate={{ 
              scale: isNear ? [1, 1.1, 1] : 1,
              backgroundColor: color 
            }}
            transition={{
              scale: isNear ? { repeat: Infinity, duration: 1 } : { duration: 0.3 }
            }}
            className={`absolute w-56 h-56 border-4 border-white/20 rounded-3xl shadow-[0_0_60px_rgba(0,0,0,0.6)]`}
            style={{ backgroundColor: color }}
         />
         
         {/* Dynamic Arrow - White for contrast against colored background */}
         <svg viewBox="0 0 100 100" className={`w-40 h-40 relative z-10 ${isLeft ? 'scale-x-[-1]' : ''}`}>
           <motion.path 
             d={`M 30 70 Q 30 30 ${30 + Math.min(50, angle/2)} 30`}
             fill="none"
             stroke="#fff"
             strokeWidth="12"
             strokeLinecap="round"
             initial={{ pathLength: 0 }}
             animate={{ pathLength: 1 }}
             style={{ filter: `drop-shadow(0 0 8px rgba(0,0,0,0.3))` }}
           />
           <motion.path 
             d={`M ${30 + Math.min(50, angle/2) - 8} 22 L ${30 + Math.min(50, angle/2) + 8} 30 L ${30 + Math.min(50, angle/2) - 8} 38`}
             fill="none"
             stroke="#fff"
             strokeWidth="12"
             strokeLinecap="round"
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ delay: 0.2 }}
           />
         </svg>

         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-8">
            <span className="text-4xl font-black italic text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{angle}°</span>
         </div>

         {isNear && (
           <motion.div 
             initial={{ opacity: 0, scale: 0.5 }}
             animate={{ opacity: 1, scale: 1 }}
             className="absolute -top-12 bg-white text-black px-4 py-1.5 rounded-full font-black italic text-xs uppercase tracking-widest shadow-2xl z-20"
           >
              REDUZA AGORA
           </motion.div>
         )}
      </div>
    );
  };

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col font-display overflow-hidden transition-all duration-700 ${isMirrored ? 'scale-x-[-1]' : ''} ${nextCurve ? getSeverityBgClass(nextCurve.severity).split(' ')[0] : 'bg-zinc-950'}`}>
      {/* Background Stylized Lines */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className={`absolute inset-0 bg-radial-gradient transition-colors duration-1000 ${nextCurve ? `from-${getSeverityBaseColor(nextCurve.severity)}/20` : 'from-brand-primary/20'} to-transparent`} />
        <div className="grid grid-cols-10 grid-rows-10 h-full w-full">
          {Array.from({ length: 100 }).map((_, i) => (
            <div key={i} className="border-[0.5px] border-white/5" />
          ))}
        </div>
      </div>

      {/* Top Control Bar */}
      <div className="relative z-50 p-3 flex items-center justify-between gap-3">
        <button 
          onClick={onBack}
          className="bg-white/5 border border-white/10 p-3 rounded-xl hover:bg-white/10 transition-all active:scale-95 shrink-0"
        >
          <ChevronLeft className="w-5 h-5 text-zinc-400" />
        </button>

        <div className="flex-1 min-w-0">
          <button 
            onClick={() => setIsSearching(true)}
            className="w-full bg-zinc-900/50 border border-white/10 rounded-xl py-2.5 px-3 flex items-center gap-2 text-zinc-500 hover:border-brand-primary/30 transition-all"
          >
            <SearchIcon className="w-3.5 h-3.5" />
            <span className="text-[9px] font-black uppercase tracking-wider truncate">
              {destination || 'Definir Destino...'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`p-3 rounded-xl border transition-all active:scale-95 ${isMuted ? 'bg-zinc-900 border-white/5 text-zinc-600' : 'bg-cyan-500/20 border-cyan-500 text-cyan-400'}`}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          <button 
            onClick={() => setDisplayMode(displayMode === 'sign' ? 'vector' : 'sign')}
            className={`p-3 rounded-xl border border-white/10 bg-white/5 text-zinc-400 transition-all active:scale-95`}
          >
            <Layers className="w-5 h-5" />
          </button>

          <button 
            onClick={() => setIsMirrored(!isMirrored)}
            className={`p-3 rounded-xl border transition-all active:scale-95 ${isMirrored ? 'bg-brand-primary/20 border-brand-primary text-brand-primary' : 'bg-white/5 border-white/10 text-zinc-400'}`}
          >
            {isMirrored ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Road Info Display */}
      <div className="px-6 mb-2 flex items-center justify-between">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col"
        >
          <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.5em] mb-1">Via Atual</span>
          <div className="text-sm font-black text-white italic truncate uppercase tracking-tighter max-w-[60vw]">
            {currentRoadName || 'Mapeando Via...'}
          </div>
        </motion.div>

        <div className="flex flex-col items-end">
           <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Modo HUD</span>
           <span className="text-[10px] font-black text-white uppercase italic">{displayMode === 'sign' ? 'Placa Dinâmica' : 'Vetor Racing'}</span>
        </div>
      </div>

      {/* Distance Progress Bar (500m to 0m) */}
      <div className="px-6 mt-4">
        <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 backdrop-blur-md relative">
          {nextCurve && (
            <motion.div 
              initial={{ width: '0%' }}
              animate={{ 
                width: `${Math.max(0, Math.min(100, (1 - nextCurve.distance / 500) * 100))}%`,
                backgroundColor: getSeverityBaseColor(nextCurve.severity),
                boxShadow: `0 0 15px ${getSeverityBaseColor(nextCurve.severity)}88`
              }}
              className="h-full rounded-full transition-colors duration-500"
            />
          )}
          {/* 100m Marker */}
          <div className="absolute left-[80%] top-0 bottom-0 w-0.5 bg-white/20" />
        </div>
        <div className="flex justify-between mt-1 px-1">
           <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">500m</span>
           <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">Alerta (100m)</span>
           <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">Curva</span>
        </div>
      </div>

      {/* MAIN VISUAL DISPLAY */}
      <motion.div className="flex-1 flex flex-col items-center justify-center relative z-10">
        <AnimatePresence mode="wait">
          {nextCurve ? (
            <motion.div
              key={nextCurve.direction + nextCurve.severity + displayMode}
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -40, scale: 1.1 }}
              className="flex flex-col items-center"
            >
              {displayMode === 'vector' ? renderCurveProjector(nextCurve) : renderCurveSign(nextCurve)}

              {/* Curve Info */}
              <div className="mt-8 text-center space-y-2">
                <div className={`text-4xl font-black uppercase tracking-tight italic ${nextCurve.severity === 'soft' ? 'text-emerald-500' : getSeverityBgClass(nextCurve.severity).split(' ')[1].replace('border-', 'text-')}`}>
                  {getSeverityLabel(nextCurve.severity)}
                </div>
                <div className="flex flex-col items-center">
                  <div className="text-7xl font-black text-white italic tracking-tighter leading-none flex items-baseline">
                    {nextCurve.distance}
                    <span className="text-2xl text-zinc-600 ml-2 font-black uppercase NOT-italic tracking-widest">m</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-6"
            >
              <div className="relative">
                <Activity className="w-20 h-20 text-zinc-800 animate-pulse" />
                <div className="absolute inset-0 bg-cyan-500/10 rounded-full blur-xl animate-ping" />
              </div>
              <div className="text-center">
                <div className="text-xs font-black text-zinc-650 uppercase tracking-[0.6em] mb-2 leading-loose">
                  {upcomingNodes.length > 0 ? 'Pista Livre: Escaneando' : 'Aguardando Geometria'}
                </div>
                <div className="h-1 w-48 bg-zinc-900 rounded-full overflow-hidden">
                  <motion.div 
                    animate={upcomingNodes.length > 0 ? { opacity: [0.3, 1, 0.3] } : { x: [-192, 192] }}
                    transition={{ duration: upcomingNodes.length > 0 ? 1 : 2, repeat: Infinity, ease: "linear" }}
                    className={`w-full h-full bg-gradient-to-r ${upcomingNodes.length > 0 ? 'from-emerald-500 via-emerald-400 to-emerald-500' : 'from-transparent via-cyan-500 to-transparent'}`}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Bottom Panel */}
      <div className="relative z-10 p-6 pb-12 flex items-end justify-between bg-gradient-to-t from-zinc-950/80 to-transparent">
        {/* Mini Map */}
        <div className="relative group">
          <div className="glass-panel w-32 h-32 rounded-3xl border border-white/5 bg-zinc-900/40 overflow-hidden relative shadow-2xl">
            <div className="absolute inset-0 opacity-10">
              <div className="w-full h-full border border-white/10 rounded-full scale-110" />
              <div className="w-full h-full border border-white/10 rounded-full scale-75" />
            </div>

            {upcomingNodes.length > 0 && currentLat && currentLng && (
              <svg 
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 100 100"
                style={{ rotate: `${-(currentHeading || 0)}deg` }}
              >
                <motion.polyline
                  points={upcomingNodes.map((n, i) => {
                    const x = 50 + (n.lng - currentLng) * 15000;
                    const y = 50 - (n.lat - currentLat) * 15000;
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke={isRouteMode ? "#22c55e" : "#ef4444"}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="50" cy="50" r="3" fill="#fff" className="animate-pulse" />
              </svg>
            )}
          </div>
        </div>

        {/* Telemetry */}
        <div className="flex flex-col items-end gap-6 text-right">
           <div className="space-y-0">
             <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Lookahead</div>
             <div className="text-xl font-black text-white italic">
               {Math.round(lookAheadDistance)}<span className="text-xs text-zinc-700 ml-1">M</span>
             </div>
           </div>

           <div className="space-y-0 relative">
             <div className="absolute -top-6 right-0 text-[8px] font-black text-brand-primary uppercase tracking-[0.3em] animate-pulse">Live Velocity</div>
             <div className="text-7xl font-black text-white italic leading-none tracking-tighter flex items-baseline">
               {Math.round(speedKmh)}
               <span className="text-xl text-zinc-800 ml-2 font-black NOT-italic tracking-tighter uppercase">Kmh</span>
             </div>
           </div>
        </div>
      </div>

      {/* Search Overlay */}
      <AnimatePresence>
        {isSearching && (
          <motion.div 
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className={`fixed inset-0 bg-zinc-950/95 backdrop-blur-3xl z-[200] p-8 flex flex-col items-center ${isMirrored ? 'scale-x-[-1]' : ''}`}
          >
            <div className="w-full max-w-xl space-y-8 mt-20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-3xl font-black italic text-white uppercase tracking-tighter leading-none">NAVEGAÇÃO</h3>
                  <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Detecção Inteligente de Trajeto</p>
                </div>
                <button onClick={() => setIsSearching(false)} className="p-4 bg-white/5 rounded-2xl text-zinc-500"><X /></button>
              </div>

              <form onSubmit={handleSearchSubmit} className="relative">
                <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-brand-primary" />
                <input 
                  autoFocus
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Destino ou Coordenada..."
                  className="w-full bg-zinc-900 border border-white/5 rounded-3xl py-6 pl-16 pr-6 text-white text-lg focus:border-brand-primary outline-none font-black italic"
                />
              </form>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => { setDestination(null); setSearchInput(''); setIsSearching(false); }}
                  className="p-8 bg-zinc-900 border border-white/5 rounded-[2.5rem] text-left hover:bg-zinc-800 transition-all group"
                >
                  <Navigation className="w-6 h-6 text-zinc-700 mb-4 group-hover:text-cyan-400" />
                  <div className="text-xs font-black text-white uppercase tracking-widest">Scanner Livre</div>
                  <div className="text-[9px] text-zinc-600 font-bold uppercase mt-1">Todas as vias</div>
                </button>
                <div className="p-8 bg-zinc-900/30 border border-white/5 border-dashed rounded-[2.5rem] text-left opacity-30">
                  <DownloadCloud className="w-6 h-6 text-zinc-800 mb-4" />
                  <div className="text-xs font-black text-zinc-800 uppercase tracking-widest">Offline Maps</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
