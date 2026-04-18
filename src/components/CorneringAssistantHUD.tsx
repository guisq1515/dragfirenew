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
  X
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'hard': return 'text-red-500';
      case 'hairpin': return 'text-purple-500';
      case 'medium': return 'text-yellow-500';
      default: return 'text-cyan-400';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'hard': return 'Curva Fechada';
      case 'hairpin': return 'Grampo 180°';
      case 'medium': return 'Curva Média';
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

  return (
    <div className={`fixed inset-0 bg-zinc-950 z-[100] flex flex-col font-display overflow-hidden transition-all duration-700 ${isMirrored ? 'scale-x-[-1]' : ''}`}>
      {/* Background Stylized Lines */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0 bg-radial-gradient from-brand-primary/20 to-transparent" />
        <div className="grid grid-cols-10 grid-rows-10 h-full w-full">
          {Array.from({ length: 100 }).map((_, i) => (
            <div key={i} className="border-[0.5px] border-white/5" />
          ))}
        </div>
      </div>

      {/* NEW Top Control Bar */}
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
            onClick={() => setIsMirrored(!isMirrored)}
            className={`p-3 rounded-xl border transition-all active:scale-95 ${isMirrored ? 'bg-brand-primary/20 border-brand-primary text-brand-primary' : 'bg-white/5 border-white/10 text-zinc-400'}`}
            title="Modo HUD (Inverter)"
          >
            {isMirrored ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          
          <button 
            onClick={() => setIsOfflineMode(!isOfflineMode)}
            className={`p-3 rounded-xl border transition-all active:scale-95 ${isOfflineMode ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500' : 'bg-white/5 border-white/10 text-zinc-400'}`}
          >
            <DownloadCloud className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* NEW: Road Name Display */}
      <div className="px-6 mb-2">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col"
        >
          <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.5em] mb-1">Via Atual</span>
          <div className="text-sm font-black text-white italic truncate uppercase tracking-tighter max-w-[80vw]">
            {currentRoadName || 'Mapeando Via...'}
          </div>
        </motion.div>
      </div>

      {/* Status Indicators */}
      <div className="px-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isOfflineMode ? 'bg-yellow-500' : 'bg-green-500'} animate-pulse`} />
          <span className="text-[10px] font-black text-white uppercase tracking-widest">
            {isOfflineMode ? 'Modo Offline Ativo' : 'Sincronizado'}
          </span>
        </div>
        <div className="h-3 w-px bg-white/10" />
        <div className="flex items-center gap-2">
          {isRouteMode ? <MapPin className="w-3 h-3 text-brand-primary" /> : <Activity className="w-3 h-3 text-cyan-400" />}
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            {isRouteMode ? 'Rota Ativa (Otimizado)' : 'Varredura Livre'}
          </span>
        </div>
      </div>

      {/* Main Vector Display */}
      <motion.div 
        className="flex-1 flex flex-col items-center justify-center relative z-10"
      >
        <AnimatePresence mode="wait">
          {nextCurve ? (
            <motion.div
              key={nextCurve.direction + nextCurve.severity}
              initial={{ opacity: 0, y: 30, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 1.2 }}
              className="flex flex-col items-center"
            >
              {/* Curve Icon/Vector */}
              <div className="relative w-64 h-64 flex items-center justify-center">
                {/* Outer Glow Effect */}
                <div className={`absolute inset-0 rounded-full opacity-20 blur-3xl ${getSeverityColor(nextCurve.severity)}`} />
                
                <motion.div
                  animate={{ 
                    rotate: nextCurve.direction === 'left' ? -nextCurve.angle/1.5 : nextCurve.angle/1.5 
                  }}
                  className={`relative ${getSeverityColor(nextCurve.severity)}`}
                >
                  <Navigation 
                    className={`w-48 h-48 ${nextCurve.direction === 'left' ? '-scale-x-100' : ''}`} 
                    style={{ filter: 'drop-shadow(0 0 30px currentColor)' }}
                  />
                </motion.div>
                
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-zinc-950/80 backdrop-blur-md px-4 py-1 rounded-full border border-white/10">
                    <span className="text-3xl font-black italic text-white drop-shadow-lg">
                      {nextCurve.angle}°
                    </span>
                  </div>
                </div>
              </div>

              {/* Curve Info */}
              <div className="mt-4 text-center space-y-2">
                <div className={`text-4xl font-black uppercase tracking-tighter italic ${getSeverityColor(nextCurve.severity)}`}>
                  {getSeverityLabel(nextCurve.severity)}
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] mb-1">Distância</span>
                  <div className="text-7xl font-black text-white italic tracking-tighter leading-none">
                    {nextCurve.distance}<span className="text-2xl text-zinc-600 ml-2">M</span>
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
                <div className="text-xs font-black text-zinc-600 uppercase tracking-[0.6em] mb-2">
                  {upcomingNodes.length > 0 ? 'Via Analisada: Aguardando Curva' : 'Escaneando Geometria'}
                </div>
                <div className="h-1 w-48 bg-zinc-900 rounded-full overflow-hidden">
                  <motion.div 
                    animate={upcomingNodes.length > 0 ? { opacity: [0.3, 1, 0.3] } : { x: [-192, 192] }}
                    transition={{ duration: upcomingNodes.length > 0 ? 1 : 2, repeat: Infinity, ease: "linear" }}
                    className={`w-full h-full bg-gradient-to-r ${upcomingNodes.length > 0 ? 'from-green-500 via-green-400 to-green-500' : 'from-transparent via-cyan-500 to-transparent'}`}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Bottom Display (Speed & Mini-map) */}
      <div className="relative z-10 p-6 pb-8 flex items-end justify-between">
        
        {/* Left: Mini Map */}
        <div className="relative group">
          <div className="flex flex-col gap-2 mb-3">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-brand-primary" />
              Trajeto Analisado
            </span>
          </div>
          <div className="glass-panel w-40 h-40 rounded-[2rem] border border-white/10 bg-zinc-900/60 overflow-hidden relative shadow-2xl">
            {/* Minimalist Grid */}
            <div className="absolute inset-0 opacity-10">
              <div className="w-full h-full border-2 border-white/5 rounded-full scale-150" />
              <div className="w-full h-full border-2 border-white/5 rounded-full scale-100" />
              <div className="w-full h-full border-2 border-white/5 rounded-full scale-50" />
            </div>

            {/* Path Drawing */}
            {upcomingNodes.length > 0 && currentLat && currentLng && (
              <svg 
                className="absolute inset-0 w-full h-full transform"
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
                  stroke={isRouteMode ? "#22c55e" : "rgba(239, 68, 68, 0.8)"}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                />
                <circle cx="50" cy="50" r="4" fill="#ffffff" className="animate-pulse" />
              </svg>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />
          </div>
        </div>

        {/* Right: Telemetry Mini Info */}
        <div className="flex flex-col items-end gap-4 text-right">
          <div className="space-y-1">
            <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Janela de Varredura</div>
            <div className="text-2xl font-black text-white italic">
              {Math.round(lookAheadDistance)}<span className="text-base text-zinc-600 ml-1">metros</span>
            </div>
          </div>

          <div className="space-y-0">
            <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center justify-end gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping" />
              Telemetria GPS
            </div>
            <div className="text-6xl font-black text-white italic leading-tight tracking-tighter">
              {Math.round(speedKmh)}
              <span className="text-xl text-zinc-700 ml-2">KM/H</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search Overlay */}
      <AnimatePresence>
        {isSearching && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 bg-zinc-950/90 backdrop-blur-xl z-[200] p-8 flex flex-col items-center ${isMirrored ? 'scale-x-[-1]' : ''}`}
          >
            <div className="w-full max-w-xl space-y-8 mt-20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-display font-black italic text-white uppercase tracking-tighter">DEFINIR DESTINO</h3>
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Otimiza a detecção para sua rota</p>
                </div>
                <button 
                  onClick={() => setIsSearching(false)}
                  className="p-4 bg-zinc-900 rounded-2xl text-zinc-500"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSearchSubmit} className="relative">
                <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-brand-primary" />
                <input 
                  autoFocus
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Ex: Autódromo de Interlagos..."
                  className="w-full bg-zinc-900 border border-white/10 rounded-3xl py-6 pl-16 pr-6 text-white text-lg placeholder:text-zinc-700 focus:outline-none focus:border-brand-primary placeholder:font-black placeholder:italic"
                />
              </form>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    setDestination(null);
                    setSearchInput('');
                    setIsSearching(false);
                  }}
                  className="p-6 bg-zinc-900/50 border border-white/5 rounded-3xl text-left hover:bg-zinc-900 transition-all group"
                >
                  <Navigation className="w-6 h-6 text-zinc-600 mb-3 group-hover:text-cyan-400" />
                  <div className="text-xs font-black text-white uppercase tracking-widest">Modo Varredura</div>
                  <div className="text-[10px] text-zinc-500 font-bold uppercase mt-1">Detectar qualquer via</div>
                </button>
                <div className="p-6 bg-zinc-900/20 border border-white/5 border-dashed rounded-3xl text-left opacity-50">
                  <DownloadCloud className="w-6 h-6 text-zinc-800 mb-3" />
                  <div className="text-xs font-black text-zinc-700 uppercase tracking-widest">Lugares Salvos</div>
                  <div className="text-[10px] text-zinc-800 font-bold uppercase mt-1">Em breve</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
