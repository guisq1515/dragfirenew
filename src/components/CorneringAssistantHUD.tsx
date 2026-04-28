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
import { CurveData, RoadNode, WayData, TopologicalRegion, TelemetryConfig } from '../types';
import { IMUData } from '../services/SensorFusionService';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { offlineMapService } from '../services/OfflineMapService';
import { Download, CloudDownload, CheckCircle2 } from 'lucide-react';

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
  trailNodes?: RoadNode[];
  minimapZoomMultiplier?: number;
  telemetryConfig?: TelemetryConfig;
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
  trailNodes = [],
  telemetryConfig,
  minimapZoomMultiplier = 30000
}: CorneringAssistantHUDProps) {
  const [isMirrored, setIsMirrored] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [isMuted, setIsMuted] = useState(true);
  const [displayMode, setDisplayMode] = useState<'vector' | 'sign'>('sign');
  const [hasNetwork, setHasNetwork] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);
  
  // Offline Map Download State
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadMessage, setDownloadMessage] = useState('');
  const [showDownloadDone, setShowDownloadDone] = useState(false);
  
  // Boot & Sync State to prevent blocking the screen during usage
  const [hasEverSynced, setHasEverSynced] = useState(false);
  const [bootTimeout, setBootTimeout] = useState(false);

  useEffect(() => {
    if (upcomingNodes.length > 0) {
      setHasEverSynced(true);
    }
  }, [upcomingNodes]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setBootTimeout(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const updateStatus = () => setHasNetwork(navigator.onLine);
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  const handleDownloadOfflineMap = async () => {
    if (!currentLat || !currentLng || isDownloading) return;
    
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadMessage('Iniciando download...');
    
    try {
      // 20km radius download (Reduced from 50km as requested)
      await offlineMapService.preDownloadArea(currentLat, currentLng, telemetryConfig?.manualDownloadRadius || 20, (progress, message) => {
        setDownloadProgress(progress);
        setDownloadMessage(message);
      });
      
      setShowDownloadDone(true);
      setTimeout(() => setShowDownloadDone(false), 3000);
    } catch (e) {
      setDownloadMessage('Erro no download. Tente novamente.');
    } finally {
      setIsDownloading(false);
    }
  };

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
    
    // Dynamic Path Generation based on actual points
    const generateRealisticPath = () => {
      const fallback = { path: "M 50 85 L 50 15", arrowHead: "M 35 35 L 50 15 L 65 35" };
      if (!curve.points || curve.points.length < 2) return fallback;
      
      let pts = curve.points;
      
      // Local lightweight distance approximation
      const getApproxDistance = (p1: RoadNode, p2: RoadNode) => {
        const dx = (p2.lng - p1.lng) * Math.cos(p1.lat * Math.PI / 180);
        const dy = p2.lat - p1.lat;
        return Math.sqrt(dx * dx + dy * dy) * 111320;
      };

      // Find curve context in upcomingNodes
      if (upcomingNodes && upcomingNodes.length > 0) {
        const firstPt = curve.points[0];
        const lastPt = curve.points[curve.points.length - 1];
        
        let startIndex = -1;
        for (let i = 0; i < upcomingNodes.length; i++) {
          if (Math.abs(upcomingNodes[i].lat - firstPt.lat) < 0.0001 && Math.abs(upcomingNodes[i].lng - firstPt.lng) < 0.0001) {
            startIndex = i;
            break;
          }
        }
        
        let endIndex = -1;
        if (startIndex !== -1) {
          for (let i = startIndex; i < upcomingNodes.length; i++) {
            if (Math.abs(upcomingNodes[i].lat - lastPt.lat) < 0.0001 && Math.abs(upcomingNodes[i].lng - lastPt.lng) < 0.0001) {
              endIndex = i;
              break;
            }
          }
        }
        
        if (startIndex !== -1 && endIndex !== -1) {
          // Include up to 120 meters of context before the curve
          let expandedStart = startIndex;
          let distStart = 0;
          while (expandedStart > 0 && distStart < 120) {
            expandedStart--;
            distStart += getApproxDistance(upcomingNodes[expandedStart], upcomingNodes[expandedStart + 1]);
          }
          
          // Include up to 80 meters of context after the curve
          let expandedEnd = endIndex;
          let distEnd = 0;
          while (expandedEnd < upcomingNodes.length - 1 && distEnd < 80) {
            expandedEnd++;
            distEnd += getApproxDistance(upcomingNodes[expandedEnd - 1], upcomingNodes[expandedEnd]);
          }
          
          pts = upcomingNodes.slice(expandedStart, expandedEnd + 1);
        }
      }

      const p0 = pts[0];
      const p1 = pts[1];
      
      const entryAngle = Math.atan2(p1.lat - p0.lat, p1.lng - p0.lng);
      const rotation = -entryAngle + Math.PI / 2;
      
      const projected = pts.map(p => {
        const dx = p.lng - p0.lng;
        const dy = p.lat - p0.lat;
        const rx = dx * Math.cos(rotation) - dy * Math.sin(rotation);
        const ry = dx * Math.sin(rotation) + dy * Math.cos(rotation);
        return { x: rx, y: -ry };
      });

      let maxL1 = 0.000001;
      projected.forEach(p => {
        const l1 = Math.abs(p.x) + Math.abs(p.y);
        if (l1 > maxL1) maxL1 = l1;
      });

      const scale = 75 / maxL1;

      const finalPts = projected.map(p => ({
        x: 50 + p.x * scale,
        y: 85 + p.y * scale
      }));

      let minX = 50, maxX = 50, minY = 85, maxY = 85;
      finalPts.forEach(p => {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      });

      const offsetX = 50 - (minX + maxX) / 2;
      const offsetY = 50 - (minY + maxY) / 2;
      
      const centeredPts = finalPts.map(p => ({
        x: p.x + offsetX,
        y: p.y + offsetY
      }));

      let pathStr = `M ${centeredPts[0].x} ${centeredPts[0].y}`;
      for (let i = 1; i < centeredPts.length; i++) {
        pathStr += ` L ${centeredPts[i].x} ${centeredPts[i].y}`;
      }

      const last = centeredPts[centeredPts.length - 1];
      const prev = centeredPts[Math.max(0, centeredPts.length - 2)];
      const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
      const headLen = isNormal ? 24 : 14;
      const h1x = last.x - headLen * Math.cos(angle - 0.7);
      const h1y = last.y - headLen * Math.sin(angle - 0.7);
      const h2x = last.x - headLen * Math.cos(angle + 0.7);
      const h2y = last.y - headLen * Math.sin(angle + 0.7);
      const arrowHeadStr = `M ${h1x} ${h1y} L ${last.x} ${last.y} L ${h2x} ${h2y}`;

      return { path: pathStr, arrowHead: arrowHeadStr };
    };

    const { path, arrowHead } = generateRealisticPath();
    
    return (
      <div className={`relative ${isNormal ? 'w-64 h-64' : 'w-24 h-24'} flex items-center justify-center`}>
         <motion.div animate={{ backgroundColor: color }} className={`absolute ${isNormal ? 'w-56 h-56 border-[6px]' : 'w-20 h-20 border-2'} border-white/20 rounded-[3rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] rotate-45`} />
         <svg viewBox="0 0 100 100" className={`${isNormal ? 'w-44 h-44' : 'w-16 h-16'} relative z-10`}>
            <path d={path} fill="none" stroke="#fff" strokeWidth={isNormal ? "12" : "8"} strokeLinecap="round" strokeLinejoin="round" />
            <path d={arrowHead} fill="none" stroke="#fff" strokeWidth={isNormal ? "12" : "8"} strokeLinecap="round" strokeLinejoin="round" />
         </svg>
         
         {/* Angle Badge Integrated into the Plate */}
         <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`absolute ${isNormal ? '-bottom-2 -right-2 px-4 py-2.5 rounded-2xl border-2' : '-bottom-1.5 -right-1.5 px-2 py-0.5 rounded-lg border'} bg-zinc-900 border-brand-primary shadow-xl z-20 flex flex-col items-center justify-center backdrop-blur-md`}
         >
            {isNormal && <span className="text-[7px] font-black text-brand-primary uppercase tracking-[0.2em] leading-none mb-1">Ângulo</span>}
            <span className={`${isNormal ? 'text-2xl' : 'text-[11px]'} font-display font-black text-white italic leading-none tracking-tighter`}>
               {curve.angle}<span className={`${isNormal ? 'text-sm' : 'text-[8px]'} ml-0.5 NOT-italic uppercase`}>º</span>
            </span>
         </motion.div>

         {isNormal && curve.slope !== undefined && Math.abs(curve.slope) > 1 && (
            <div className="absolute top-4 right-4 flex items-center gap-1 bg-black/60 px-3 py-1.5 rounded-full border border-white/10">
               {curve.isUphill ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> : <ArrowDownRight className="w-4 h-4 text-red-400" />}
               <span className="text-xs font-black text-white">{Math.abs(curve.slope)}%</span>
            </div>
         )}
      </div>
    );
  };

  return (
    <div className={`fixed inset-0 z-[200] flex flex-col font-display overflow-hidden transition-all duration-700 ${isMirrored ? 'scale-x-[-1]' : ''} bg-zinc-950`}>
      
      {/* Safety Lock Overlay */}
      <AnimatePresence>
        {!hasEverSynced && !bootTimeout && upcomingNodes.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-zinc-950 flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="relative mb-12">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="w-32 h-32 border-t-2 border-r-2 border-brand-primary rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap className="w-10 h-10 text-brand-primary animate-pulse" />
              </div>
            </div>
            
            <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter mb-4">
              Calibrando Segurança
            </h2>
            
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] max-w-xs leading-relaxed">
              {hasNetwork 
                ? "Sincronizando geometria da via e dados de altitude para garantir precisão absoluta..."
                : "Aguardando conexão com a internet para baixar os dados da região."}
            </p>

            {!hasNetwork && (
              <div className="mt-8 flex items-center gap-3 bg-red-500/10 border border-red-500/20 px-6 py-3 rounded-2xl text-red-500">
                <CloudOff className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase">Modo Offline sem Cache</span>
              </div>
            )}

            <div className="mt-12 flex flex-col items-center gap-6 w-full max-w-xs">
               {isDownloading ? (
                 <div className="w-full space-y-3">
                   <div className="flex justify-between items-center">
                     <span className="text-[10px] font-black text-brand-primary uppercase tracking-widest">{downloadMessage}</span>
                     <span className="text-[10px] font-black text-white">{downloadProgress}%</span>
                   </div>
                   <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                     <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${downloadProgress}%` }}
                        className="h-full bg-brand-primary"
                     />
                   </div>
                 </div>
               ) : (
                 <button 
                   onClick={handleDownloadOfflineMap}
                   className="w-full py-4 bg-brand-primary/10 border border-brand-primary/30 rounded-2xl flex items-center justify-center gap-3 hover:bg-brand-primary/20 transition-all"
                 >
                   <CloudDownload className="w-5 h-5 text-brand-primary" />
                   <span className="text-[10px] font-black text-white uppercase tracking-widest">Baixar Região Offline (20km)</span>
                 </button>
               )}
               
               <button onClick={onBack} className="text-zinc-600 text-[10px] font-black uppercase underline tracking-widest">Cancelar e Voltar</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Download Overlay */}
      <AnimatePresence>
        {isDownloading && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-x-0 top-0 z-[500] p-4 flex flex-col items-center pointer-events-none"
          >
            <div className="w-full max-w-sm bg-zinc-900/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl space-y-3 pointer-events-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CloudDownload className="w-5 h-5 text-cyan-400 animate-pulse" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">{downloadMessage}</span>
                </div>
                <span className="text-xs font-black text-cyan-400 italic">{downloadProgress}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                <motion.div animate={{ width: `${downloadProgress}%` }} className="h-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
              </div>
            </div>
          </motion.div>
        )}
        {showDownloadDone && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="fixed inset-x-0 top-10 flex justify-center z-[500] pointer-events-none">
            <div className="bg-emerald-500 text-white px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl border border-white/20">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-widest">Mapas Offline Carregados!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mini Plate (Next-Next Curve) */}
      <AnimatePresence>
        {posteriorCurve && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute left-6 top-28 z-[60] flex flex-col items-center gap-1"
          >
            <div className="text-[8px] font-black text-white/40 uppercase tracking-[0.3em] mb-1">PRÓXIMA</div>
            <div className="relative">
              {renderPredefinedPlate(posteriorCurve, 'small')}
            </div>
            <div className="flex flex-col items-center mt-1">
              <span className="text-[10px] font-black text-brand-primary italic leading-none">{posteriorCurve.distance}m</span>
              <span className="text-[6px] font-bold text-zinc-600 uppercase tracking-widest mt-1">Distância</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Bar */}
      <div className="relative z-50 p-3 flex items-center justify-between gap-3">
        <button onClick={onBack} className="bg-white/5 border border-white/10 p-3 rounded-xl"><ChevronLeft className="w-5 h-5 text-zinc-400" /></button>
        <div className="flex-1"><button onClick={() => setIsSearching(true)} className="w-full bg-zinc-900/50 border border-white/10 rounded-xl py-2.5 px-3 flex items-center gap-2"><SearchIcon className="w-3.5 h-3.5 text-zinc-600" /><span className="text-[9px] font-black uppercase text-zinc-500">{destination || 'Definir Destino...'}</span></button></div>
        <div className="flex items-center gap-2">
        <span className="text-white font-black italic text-base tracking-tighter uppercase">Drag<span className="text-brand-primary">Fire</span></span>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFeedback(true)} className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400"><AlertTriangle className="w-5 h-5" /></button>
          <button onClick={() => setIsMuted(!isMuted)} className={`p-3 rounded-xl border ${isMuted ? 'bg-zinc-900 border-white/5 text-zinc-600' : 'bg-cyan-500/20 border-cyan-500 text-cyan-400'}`}>{isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}</button>
          
          <div className="flex items-center">
            {hasNetwork && (
              <button 
                onClick={handleDownloadOfflineMap} 
                className="p-3 mr-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                title="Pré-baixar Mapas"
              >
                <Download className="w-5 h-5" />
              </button>
            )}
            <div className={`${hasNetwork ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'} px-3 py-1.5 rounded-xl flex items-center gap-2`}><SignalHigh className={`w-3 h-3 ${hasNetwork ? 'text-emerald-500' : 'text-red-500'}`} /><span className={`text-[8px] font-black ${hasNetwork ? 'text-emerald-400' : 'text-red-400'} uppercase`}>{hasNetwork ? 'DADOS ATIVOS' : 'MODO OFFLINE'}</span></div>
          </div>
          
          <button onClick={() => setIsMirrored(!isMirrored)} className={`p-3 rounded-xl border ${isMirrored ? 'bg-brand-primary/20 border-brand-primary text-brand-primary' : 'bg-white/5 border-white/10 text-zinc-400'}`}>{isMirrored ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}</button>
        </div>
      </div>
    </div>


      <div className="px-6 mb-2 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.5em] mb-1">Via Atual</span>
          <div className="text-sm font-black text-white italic truncate uppercase max-w-[60vw]">
            {currentRoadName || (isLoading ? 'Localizando...' : 'Via Mapeada')}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-6 mt-4">
        <div className="h-2 bg-white/5 rounded-full overflow-hidden relative border border-white/5 backdrop-blur-md">
          {nextCurve && <motion.div animate={{ width: `${Math.max(0, Math.min(100, (1 - nextCurve.distance / lookAheadDistance) * 100))}%`, backgroundColor: getSeverityBaseColor(nextCurve.severity) }} className="h-full rounded-full" />}
          <div className="absolute left-[80%] top-0 bottom-0 w-0.5 bg-white/20" />
        </div>
      </div>

      {/* Main Display */}
      <motion.div className="flex-1 flex flex-col items-center justify-center relative z-10">
        <AnimatePresence mode="wait">
          {nextCurve ? (
            <motion.div key={nextCurve.direction + nextCurve.severity} className="flex flex-col items-center">
              <div className="relative">
                {renderPredefinedPlate(nextCurve)}
              </div>
              <div className="mt-4 text-center space-y-1">
                <div className={`text-2xl font-black uppercase italic ${nextCurve.severity === 'soft' || nextCurve.severity === 'straight' ? 'text-emerald-500' : 'text-red-500'}`}>
                  {getSeverityLabel(nextCurve.severity)}
                </div>
                <div className="text-6xl font-black text-white italic tracking-tighter leading-none">
                  {nextCurve.distance}
                  <span className="text-xl text-zinc-600 ml-1.5 font-black NOT-italic tracking-widest uppercase">m</span>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div className="flex flex-col items-center">
              {renderPredefinedPlate({ severity: 'straight', direction: 'straight', distance: 0, angle: 0, points: [] })}
              <div className="mt-4 text-center space-y-1">
                <div className="text-2xl font-black uppercase italic text-emerald-500">Pista Livre / Reta</div>
                <div className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em] pt-2">Aferição em Tempo Real</div>
              </div>
            </motion.div>
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
                    // Dynamic zoom based on speed: Higher speed = Zoom OUT (Smaller multiplier)
                    // baseMultiplier at 0kmh, reduce as speed increases
                    const speedZoomFactor = Math.max(0.3, 1 - (speedKmh / 250));
                    const mapScale = minimapZoomMultiplier * speedZoomFactor; 
                    const cLat = smoothLocation?.lat || currentLat; 
                    const cLng = smoothLocation?.lng || currentLng;
                    return (
                      <>
                        {allRegionalWays.map((way, idx) => (
                           <polyline key={idx} points={way.map(n => `${50 + (n.lng - cLng) * mapScale},${50 - (n.lat - cLat) * mapScale}`).join(' ')} fill="none" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.08" strokeLinecap="round" />
                        ))}
                        {trailNodes.length > 0 && (
                           <polyline points={trailNodes.map(n => `${50 + (n.lng - cLng) * mapScale},${50 - (n.lat - cLat) * mapScale}`).join(' ')} fill="none" stroke="#ef4444" strokeWidth="8" strokeOpacity="1.0" strokeLinecap="round" strokeLinejoin="round" />
                        )}
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
            <div className="w-full max-w-xl space-y-8 mt-20"><div className="flex items-center justify-between"><div><h3 className="text-3xl font-black italic text-white uppercase italic tracking-tighter">NAVEGAÇÃO</h3><p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Detecção Inteligente de Trajeto</p></div><button onClick={() => setIsSearching(false)} className="p-4 bg-white/5 rounded-2xl text-zinc-500"><X /></button></div><form onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (searchInput.trim()) { setDestination(searchInput); setIsSearching(false); } }} className="relative"><MapPin className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-brand-primary" /><input autoFocus type="text" value={searchInput} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchInput(e.target.value)} placeholder="Destino ou Coordenada..." className="w-full bg-zinc-900 border border-white/5 rounded-3xl py-6 pl-16 pr-6 text-white text-lg focus:border-brand-primary outline-none font-black italic" /></form></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
