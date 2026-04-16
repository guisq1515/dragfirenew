import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from 'recharts';
import { RunResult } from '../types';
import { Lock, Zap, Gauge, Activity, Swords } from 'lucide-react';

interface PerformanceChartProps {
  result: RunResult;
  opponentResult?: RunResult | null;
  isPremium?: boolean;
}

export function PerformanceChart({ result, opponentResult, isPremium }: PerformanceChartProps) {
  // Prepare main data
  const startTime = result.path[0]?.timestamp || 0;
  
  // Base data preparation
  const mainData = result.path.map((point) => {
    const t = (point.timestamp - startTime) / 1000;
    return {
      time: parseFloat(t.toFixed(2)),
      speed: Math.round(point.speed * 3.6),
      gLong: point.gLong || 0,
      gLat: point.gLat || 0,
    };
  });

  // Prepare ghost data comparison if available
  let ghostComparisonData: any[] = [];
  if (opponentResult) {
    const oppStartTime = opponentResult.path[0]?.timestamp || 0;
    const oppData = opponentResult.path.map((point) => ({
      time: parseFloat(((point.timestamp - oppStartTime) / 1000).toFixed(2)),
      speedOpp: Math.round(point.speed * 3.6),
    }));

    // Merge by time buckets (0.1s) for alignment
    const maxTime = Math.max(
      mainData[mainData.length - 1]?.time || 0,
      oppData[oppData.length - 1]?.time || 0
    );

    for (let t = 0; t <= maxTime; t += 0.1) {
      const time = parseFloat(t.toFixed(1));
      const myPoint = mainData.find(p => Math.abs(p.time - time) < 0.06);
      const oppPoint = oppData.find(p => Math.abs(p.time - time) < 0.06);
      
      if (myPoint || oppPoint) {
        ghostComparisonData.push({
          time,
          me: myPoint?.speed || 0,
          opponent: oppPoint?.speedOpp || 0
        });
      }
    }
  }

  const ChartZone = ({ title, icon: Icon, children, height = 200 }: any) => (
    <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-4 overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-3 h-3 text-zinc-500" />
        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{title}</h4>
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-4 mt-6 relative">
      {!isPremium && (
        <div className="absolute inset-0 z-30 backdrop-blur-md bg-zinc-950/60 flex flex-col items-center justify-center p-8 text-center rounded-3xl">
          <div className="w-14 h-14 bg-yellow-500/20 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-yellow-500" />
          </div>
          <h4 className="text-base font-black text-white uppercase tracking-tight mb-2">Análise Telemetria Premium</h4>
          <p className="text-xs text-zinc-400 font-medium leading-relaxed max-w-[240px] mb-6">
            Desbloqueie agora para ver Força G lateral, longitudinal e modo fantasma completo.
          </p>
          <button className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-zinc-950 text-xs font-black uppercase tracking-widest rounded-xl active:scale-95 transition-all flex items-center gap-2">
            <Zap className="w-4 h-4" />
            EVOLUIR PARA PREMIUM
          </button>
        </div>
      )}

      {/* ZONE 1: SPEED CURVE */}
      <ChartZone title="Curva de Velocidade" icon={Gauge}>
        <AreaChart data={mainData} margin={{ left: -25, right: 10 }}>
          <defs>
            <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
          <XAxis dataKey="time" hide />
          <YAxis axisLine={false} tickLine={false} tick={{fill: '#52525b', fontSize: 10}} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#09090b', border: '1px solid #ffffff10', borderRadius: '12px' }}
            itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
          />
          <Area 
            type="monotone" 
            dataKey="speed" 
            stroke="#ef4444" 
            strokeWidth={3} 
            fillOpacity={1} 
            fill="url(#colorSpeed)" 
            animationDuration={2000}
          />
        </AreaChart>
      </ChartZone>

      {/* ZONE 2: G-FORCE ANALYSIS */}
      <ChartZone title="Análise de Força G (Longitudinal & Lateral)" icon={Activity}>
        <LineChart data={mainData} margin={{ left: -25, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
          <XAxis dataKey="time" hide />
          <YAxis domain={[-1.5, 1.5]} axisLine={false} tickLine={false} tick={{fill: '#52525b', fontSize: 10}} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#09090b', border: '1px solid #ffffff10', borderRadius: '12px' }}
            itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
          />
          <Line 
            type="monotone" 
            dataKey="gLong" 
            name="G-Aceleração"
            stroke="#10b981" 
            strokeWidth={2} 
            dot={false}
            animationDuration={2500}
          />
          <Line 
            type="monotone" 
            dataKey="gLat" 
            name="G-Lateral"
            stroke="#3b82f6" 
            strokeWidth={2} 
            dot={false}
            animationDuration={2500}
          />
          <Legend wrapperStyle={{ fontSize: '8px', textTransform: 'uppercase', fontWeight: 'black', marginTop: '10px' }} />
        </LineChart>
      </ChartZone>

      {/* ZONE 3: GHOST MODE (DUEL) */}
      {opponentResult && (
        <ChartZone title="Modo Fantasma (Você vs Oponente)" icon={Swords}>
          <LineChart data={ghostComparisonData} margin={{ left: -25, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
            <XAxis dataKey="time" tick={{fill: '#52525b', fontSize: 10}} axisLine={false} tickLine={false} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: '#52525b', fontSize: 10}} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#09090b', border: '1px solid #ffffff10', borderRadius: '12px' }}
              itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
            />
            <Line 
              type="monotone" 
              dataKey="me" 
              name="Sua Velocidade"
              stroke="#ef4444" 
              strokeWidth={3} 
              dot={false}
              animationDuration={3000}
            />
            <Line 
              type="monotone" 
              dataKey="opponent" 
              name={opponentResult.config.mode === 'speed' ? 'Oponente' : 'Fantasma'}
              stroke="#ffffff40" 
              strokeDasharray="5 5"
              strokeWidth={2} 
              dot={false}
              animationDuration={3000}
            />
            <Legend wrapperStyle={{ fontSize: '8px', textTransform: 'uppercase', fontWeight: 'black', marginTop: '10px' }} />
          </LineChart>
        </ChartZone>
      )}
    </div>
  );
}
