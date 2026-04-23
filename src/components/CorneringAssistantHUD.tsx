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
  smoothLocation
}: CorneringAssistantHUDProps) {
  const [isMirrored, setIsMirrored] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [displayMode, setDisplayMode] = useState<'vector' | 'sign'>('sign');
  const [usingCache, setUsingCache] = useState(false);

  useEffect(() => {
    // Detect if we are using cached geometry
    const cached = localStorage.getItem('dragfire_active_geometry');
    if (cached && upcomingNodes.length > 0) {
      try {
        const { nodes } = JSON.parse(cached);
        if (nodes.length === upcomingNodes.length && nodes[0]?.lat === upcomingNodes[0]?.lat) {
           setUsingCache(true);
        } else {
           setUsingCache(false);
        }
      } catch(e) {}
    }
  }, [upcomingNodes]);

  const getSeverityBaseColor = (severity?: string) => {
    switch (severity) {
      case 'straight': return '#22c55e'; // Green
      case 'soft': return '#22c55e'; // Green
      case 'medium': return '#eab308'; // Yellow
      case 'hard': return '#ef4444'; // Red
      case 'hairpin': return '#7f1d1d'; // Dark Red
      case 's-curve': return '#a855f7'; // Purple (Combo)
      case 'chicane': return '#ec4899'; // Pink (Combo)
      default: return '#3b82f6'; // Blue
    }
  };

  const getSeverityBgClass = (severity?: string) => {
    switch (severity) {
      case 'straight': return 'bg-emerald-950/40 border-emerald-500/30';
      case 'soft': return 'bg-emerald-950/40 border-emerald-500/30';
      case 'medium': return 'bg-yellow-950/40 border-yellow-500/30';
      case 'hard': return 'bg-red-950/40 border-red-500/30';
      case 'hairpin': return 'bg-red-950/60 border-red-600/50';
      default: return 'bg-zinc-900/50 border-white/10';
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setDestination(searchInput);
      setIsSearching(false);
    }
  };

  // --- PREDEFINED PLATE LOGIC ---
  const renderPredefinedPlate = (curve: CurveData, size: 'normal' | 'small' = 'normal') => {
    const color = getSeverityBaseColor(curve.severity);
    const isNormal = size === 'normal';
    const isLeft = curve.direction === 'left';
    const isStraight = curve.severity === 'straight';

    // SVG paths for specific types
    let path = "M 50 80 L 50 20"; // Default Straight
    let arrowHead = "M 40 30 L 50 20 L 60 30";
    
    if (isStraight) {
       path = "M 50 85 L 50 15";
       arrowHead = "M 40 30 L 50 15 L 60 30";
    } else if (curve.severity === 'soft') {
       path = isLeft ? "M 50 85 C 50 50, 45 40, 30 30" : "M 50 85 C 50 50, 55 40, 70 30";
       arrowHead = isLeft ? "M 32 42 L 30 30 L 42 32" : "M 58 32 L 70 30 L 68 42";
    } else if (curve.severity === 'medium') {
       path = isLeft ? "M 50 85 C 50 50, 40 45, 20 40" : "M 50 85 C 50 50, 60 45, 80 40";
       arrowHead = isLeft ? "M 25 50 L 20 40 L 30 35" : "M 70 35 L 80 40 L 75 50";
    } else if (curve.severity === 'hard' || curve.severity === 'hairpin') {
       path = isLeft ? "M 50 85 L 50 40 L 20 40" : "M 50 85 L 50 40 L 80 40";
       arrowHead = isLeft ? "M 28 50 L 20 40 L 28 30" : "M 72 30 L 80 40 L 72 50";
       if (curve.severity === 'hairpin') {
          path = isLeft ? "M 50 85 L 50 30 C 50 15, 20 15, 20 30 L 20 60" : "M 50 85 L 50 30 C 50 15, 80 15, 80 30 L 80 60";
          arrowHead = isLeft ? "M 12 52 L 20 60 L 28 52" : "M 72 52 L 80 60 L 88 52";
       }
    } else if (curve.severity === 's-curve' || curve.severity === 'chicane') {
        // S-Curve drawing (Combo)
        path = isLeft ? "M 50 85 C 50 60, 20 60, 20 45 C 20 30, 80 30, 80 15" : "M 50 85 C 50 60, 80 60, 80 45 C 80 30, 20 30, 20 15";
        arrowHead = isLeft ? "M 70 25 L 80 15 L 90 25" : "M 10 25 L 20 15 L 30 25";
    }

    return (
      <div className={`relative ${isNormal ? 'w-56 h-56' : 'w-24 h-24'} flex items-center justify-center`}>
         <motion.div 
            initial={{ rotate: 45, scale: 0.8 }}
            animate={{ scale: 1, backgroundColor: color }}
            className={`absolute ${isNormal ? 'w-48 h-48 border-4' : 'w-20 h-20 border-2'} border-white/20 rounded-[2.5rem] shadow-2xl`}
         />
         
         <svg viewBox="0 0 100 100" className={`${isNormal ? 'w-32 h-32' : 'w-14 h-14'} relative z-10`}>
            <motion.path 
              d={path}
              fill="none"
              stroke="#fff"
              strokeWidth={isNormal ? "12" : "14"}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5 }}
            />
            <motion.path 
              d={arrowHead}
              fill="none"
              stroke="#fff"
              strokeWidth={isNormal ? "12" : "14"}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            />
         </svg>

         {isNormal && !isStraight && (
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-8">
              <span className="text-3xl font-black italic text-white drop-shadow-lg">{curve.angle}°</span>
           </div>
         )}
         
         {isNormal && isStraight && (
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-8">
              <span className="text-xl font-black italic text-white drop-shadow-lg uppercase tracking-tighter">RETA</span>
           </div>
         )}
      </div>
    );
  };

  return (
    <div className={`fixed inset-0 z-[200] flex flex-col font-display overflow-hidden transition-all duration-700 ${isMirrored ? 'scale-x-[-1]' : ''} ${nextCurve ? getSeverityBgClass(nextCurve.severity).split(' ')[0] : 'bg-zinc-950'}`}>
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

          <div className={`${usingCache ? 'bg-orange-500/10 border-orange-500/20' : 'bg-emerald-500/10 border-emerald-500/20'} px-3 py-1.5 rounded-xl flex items-center gap-2 transition-colors`}>
             <div className={`w-1.5 h-1.5 rounded-full ${usingCache ? 'bg-orange-500' : 'bg-emerald-500'} animate-pulse`} />
             <span className={`text-[8px] font-black ${usingCache ? 'text-orange-400' : 'text-emerald-400'} uppercase tracking-widest`}>
                {usingCache ? 'Modo Offline' : 'Cache Ativo'}
             </span>
          </div>

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

      {/* Distance Progress Bar */}
      <div className="px-6 mt-4">
        <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 backdrop-blur-md relative">
          {nextCurve && (
            <motion.div 
              initial={{ width: '0%' }}
              animate={{ 
                width: `${Math.max(0, Math.min(100, (1 - nextCurve.distance / lookAheadDistance) * 100))}%`,
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
           <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">{Math.round(lookAheadDistance)}m</span>
           <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">Alerta (100m)</span>
           <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">Curva</span>
        </div>
      </div>

      {/* MAIN VISUAL DISPLAY */}
      <motion.div className="flex-1 flex flex-col items-center justify-center relative z-10">
        {/* Posterior Curve Preview (Top Left) - Moved Higher & Cleaner */}
        <AnimatePresence>
          {posteriorCurve && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute -top-10 left-6 z-30 flex flex-col items-center"
            >
              <div className="scale-75 origin-top">
                {renderPredefinedPlate(posteriorCurve, 'small')}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {nextCurve ? (
            <motion.div
              key={nextCurve.direction + nextCurve.severity + displayMode}
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -40, scale: 1.1 }}
              className="flex flex-col items-center"
            >
              {renderPredefinedPlate(nextCurve)}

              {/* Curve Info */}
              <div className="mt-4 text-center space-y-1">
                <div className={`text-2xl font-black uppercase tracking-tight italic ${nextCurve.severity === 'soft' || nextCurve.severity === 'straight' ? 'text-emerald-500' : getSeverityBgClass(nextCurve.severity).split(' ')[1].replace('border-', 'text-')}`}>
                  {getSeverityLabel(nextCurve.severity)}
                </div>
                <div className="flex flex-col items-center">
                  <div className="text-6xl font-black text-white italic tracking-tighter leading-none flex items-baseline">
                    {nextCurve.distance}
                    <span className="text-xl text-zinc-600 ml-1.5 font-black uppercase NOT-italic tracking-widest">m</span>
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
              <Activity className="w-20 h-20 text-zinc-800 animate-pulse" />
              <div className="text-center">
                <div className="text-xs font-black text-zinc-650 uppercase tracking-[0.6em] mb-2 leading-loose">
                  Mapeando Via...
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
              >
                {/* Fixed Rotation Logic: Rotate the PATH around the center, not the SVG container */}
                <g style={{ transform: `rotate(${-(currentHeading || 0)}deg)`, transformOrigin: '50% 50%', transition: 'transform 0.5s ease-out' }}>
                  {(() => {
                    // MapScale adjusted for better visibility (less zoom)
                    const mapScale = 4000; 
                    // Use snapped location for centering if available, fallback to raw GPS
                    const centerLat = smoothLocation?.lat || snappedLocation?.lat || currentLat;
                    const centerLng = smoothLocation?.lng || snappedLocation?.lng || currentLng;

                    return (
                      <motion.polyline
                        points={upcomingNodes.map((n, i) => {
                          const x = 50 + (n.lng - centerLng) * mapScale;
                          const y = 50 - (n.lat - centerLat) * mapScale;
                          return `${x},${y}`;
                        }).join(' ')}
                        fill="none"
                        stroke={isRouteMode ? "#22c55e" : "#ef4444"}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ filter: 'drop-shadow(0 0 5px rgba(0,0,0,0.5))' }}
                      />
                    );
                  })()}
                </g>
                {/* Driver remains fixed in the center, facing "Up" */}
                <circle cx="50" cy="50" r="4" fill="#fff" className="animate-pulse shadow-lg" />
                <path d="M 50 45 L 47 52 L 53 52 Z" fill="#fff" style={{ transform: 'rotate(0deg)', transformOrigin: '50% 50%' }} />
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
