import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CloudDownload, CheckCircle2, ChevronLeft, Map, AlertTriangle } from 'lucide-react';
import { offlineMapService } from '../services/OfflineMapService';
import { CapacitorHttp } from '@capacitor/core';

interface OfflineMapManagerProps {
  onBack: () => void;
}

export function OfflineMapManager({ onBack }: OfflineMapManagerProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('Pronto para baixar');
  const [installed, setInstalled] = useState(false);

  const availablePackages = [
    {
      id: 'sp_interior',
      name: 'Interior de São Paulo',
      size: '22 MB',
      description: 'Cobre a região de Ribeirão Preto, Franca, Jardinópolis, Brodowski e arredores.',
      url: '/maps/sp_interior_pack.json' // Served from public folder or CDN
    }
  ];

  const handleDownload = async (pkg: typeof availablePackages[0]) => {
    setIsDownloading(true);
    setStatusMsg('Baixando pacote otimizado...');
    setDownloadProgress(20);

    try {
      // 1. Download the JSON file
      const response = await fetch(pkg.url);
      if (!response.ok) throw new Error("Falha no download");
      
      setDownloadProgress(50);
      setStatusMsg('Descompactando dados geométricos...');
      
      const data = await response.json();
      
      setDownloadProgress(80);
      setStatusMsg('Instalando no banco offline...');
      
      // 2. Save directly to OfflineMapService
      await offlineMapService.saveRegion(data);
      
      setDownloadProgress(100);
      setStatusMsg('Instalado com sucesso!');
      setInstalled(true);
      
    } catch (e) {
      console.error(e);
      setStatusMsg('Erro ao instalar mapa. Verifique sua conexão.');
    } finally {
      setIsDownloading(false);
      setTimeout(() => {
        if (!installed) setStatusMsg('Pronto para baixar');
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-display p-6 flex flex-col">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-6 h-6 text-zinc-400" />
        </button>
        <div>
          <h1 className="text-2xl font-black italic uppercase tracking-tighter">Mapas Offline</h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Navegação Segura sem Internet</p>
        </div>
      </div>

      <div className="mb-8 p-6 bg-cyan-500/10 border border-cyan-500/20 rounded-3xl flex items-start gap-4">
        <Map className="w-8 h-8 text-cyan-400 shrink-0" />
        <div>
          <h3 className="text-sm font-black text-white uppercase italic tracking-wide mb-1">Por que baixar mapas?</h3>
          <p className="text-xs text-zinc-400 leading-relaxed font-medium">
            Ao baixar pacotes de estados inteiros pelo Wi-Fi, o DragFire não dependerá mais da internet durante a viagem. 
            Todas as curvas, inclinações e distâncias são analisadas localmente a 60fps, garantindo segurança absoluta em áreas rurais.
          </p>
        </div>
      </div>

      <div className="space-y-4 flex-1">
        <h2 className="text-[10px] font-black text-brand-primary uppercase tracking-[0.3em] mb-4">Pacotes Disponíveis</h2>
        
        {availablePackages.map(pkg => (
          <div key={pkg.id} className="p-6 bg-zinc-900 border border-white/5 rounded-3xl relative overflow-hidden">
            <div className="relative z-10 flex flex-col gap-4">
              <div>
                <h3 className="text-xl font-black italic text-white uppercase">{pkg.name}</h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-[80%]">{pkg.description}</p>
              </div>
              
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] font-black text-brand-primary uppercase tracking-widest bg-brand-primary/10 px-3 py-1.5 rounded-lg">
                  Tamanho: {pkg.size}
                </span>
                
                {installed ? (
                  <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 px-4 py-2 rounded-xl">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-xs font-black uppercase tracking-wider">Instalado</span>
                  </div>
                ) : (
                  <button 
                    onClick={() => handleDownload(pkg)}
                    disabled={isDownloading}
                    className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50"
                  >
                    {isDownloading ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                        <CloudDownload className="w-5 h-5" />
                      </motion.div>
                    ) : (
                      <CloudDownload className="w-5 h-5" />
                    )}
                    <span className="text-xs font-black uppercase tracking-wider">
                      {isDownloading ? 'Baixando...' : 'Baixar Agora'}
                    </span>
                  </button>
                )}
              </div>

              {isDownloading && (
                <div className="mt-2 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest">{statusMsg}</span>
                    <span className="text-[9px] font-black text-zinc-500">{downloadProgress}%</span>
                  </div>
                  <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                    <motion.div animate={{ width: `${downloadProgress}%` }} className="h-full bg-cyan-400" />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
