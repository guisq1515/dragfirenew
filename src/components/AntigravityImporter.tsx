import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileUp, 
  ChevronLeft, 
  CheckCircle2, 
  AlertCircle, 
  Zap, 
  Loader2,
  Database,
  CloudUpload,
  Layers,
  Check,
  X,
  FileSpreadsheet,
  Filter
} from 'lucide-react';
import Papa from 'papaparse';
import { db } from '../firebase';
import { collection, writeBatch, doc, query, where, limit } from 'firebase/firestore';
import { ANPRow, mapANPRowsToStations } from '../services/anpMappingService';
import { GasStation } from '../types';
import { normalizeText } from '../lib/utils';

interface AntigravityImporterProps {
  onBack: () => void;
}

export function AntigravityImporter({ onBack }: AntigravityImporterProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ rows: number, stations: number, uploaded: number } | null>(null);
  const [availableUFs, setAvailableUFs] = useState<string[]>([]);
  const [availableMunicipios, setAvailableMunicipios] = useState<string[]>([]);
  const [selectedUF, setSelectedUF] = useState<string>('SP'); // Default to SP as requested
  const [selectedMunicipio, setSelectedMunicipio] = useState<string>('');
  const [step, setStep] = useState<'upload' | 'filter' | 'processing'>('upload');
  const [allRows, setAllRows] = useState<ANPRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setSummary(null);
    setStep('processing');
    setProgress(0);
    setStatus('Iniciando leitura do arquivo para escaneamento de regiões...');

    const rows: ANPRow[] = [];
    const ufs = new Set<string>();

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      step: (results) => {
        const row = results.data as any;
        rows.push(row);
        const uf = normalizeText(row.ESTADO || row.UF || '');
        if (uf) ufs.add(uf.toUpperCase());
        
        if (rows.length % 5000 === 0) {
          setStatus(`Escaneando arquivo: ${rows.length} linhas lidas...`);
        }
      },
      complete: () => {
        setAllRows(rows);
        setAvailableUFs(Array.from(ufs).sort());
        setStep('filter');
        setIsProcessing(false);
        setStatus('Escaneamento concluído. Selecione a região para importar.');
      },
      error: (err) => {
        setError(`Erro ao ler arquivo CSV: ${err.message}`);
        setIsProcessing(false);
        setStep('upload');
      }
    });
  };

  const handleStartImport = async () => {
    setIsProcessing(true);
    setStep('processing');
    setProgress(0);
    setStatus('Mapeando postos e filtrando região...');

    try {
      // Filtrar e mapear
      const stations = mapANPRowsToStations(allRows, {
        estado: selectedUF,
        municipio: selectedMunicipio ? normalizeText(selectedMunicipio) : ''
      });
      
      setSummary({
        rows: allRows.length,
        stations: stations.length,
        uploaded: 0
      });

      if (stations.length === 0) {
        throw new Error('Nenhum posto encontrado para a região selecionada.');
      }

      setStatus(`Filtrado: ${stations.length} postos em ${selectedMunicipio || selectedUF}. Iniciando upload...`);
      
      await uploadStationsInBatches(stations);
      
      setStatus('Importação concluída com sucesso!');
    } catch (err: any) {
      console.error('Erro na importação:', err);
      setError(`Erro ao processar dados: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Atualizar municípios quando o estado muda
  React.useEffect(() => {
    if (allRows.length > 0 && selectedUF) {
      const municipios = new Set<string>();
      allRows.forEach((row: any) => {
        const uf = normalizeText(row.ESTADO || row.UF || '');
        const mun = normalizeText(row.MUNICÍPIO || row.MUNICIPIO || '');
        if (uf === normalizeText(selectedUF) && mun) {
          municipios.add(mun.toUpperCase());
        }
      });
      setAvailableMunicipios(Array.from(municipios).sort());
      setSelectedMunicipio(''); // Reset city when state changes
    }
  }, [allRows, selectedUF]);

  const uploadStationsInBatches = async (stations: GasStation[]) => {
    const BATCH_SIZE = 400; // Limite do Firestore é 500, usamos 400 por segurança
    const total = stations.length;
    let uploadedCount = 0;

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const currentBatch = stations.slice(i, i + BATCH_SIZE);

      currentBatch.forEach(station => {
        const stationRef = doc(collection(db, 'fuel_stations_anp'), station.id);
        // Usar merge: true para não sobrescrever avaliações ou fotos se já existir dados locais
        batch.set(stationRef, {
          ...station,
          municipio: normalizeText(station.municipio)
        }, { merge: true });
        uploadedCount++;
      });

      await batch.commit();
      
      const currentProgress = Math.round((uploadedCount / total) * 100);
      setProgress(currentProgress);
      setSummary(prev => prev ? { ...prev, uploaded: uploadedCount } : null);
      setStatus(`Enviando para o banco de dados: ${uploadedCount} de ${total} postos...`);
      
      // Pequeno delay para não sobrecarregar
      await new Promise(r => setTimeout(r, 100));
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
      <header className="p-4 flex items-center gap-4 border-b border-white/5 bg-zinc-900/50 backdrop-blur-md">
        <button 
          onClick={onBack} 
          className="p-2 bg-zinc-900 rounded-lg text-zinc-400 hover:text-white transition-colors"
          disabled={isProcessing}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-display font-black italic text-white leading-none uppercase tracking-tighter">
            ANTIGRAVITY <span className="text-brand-primary">DATA</span>
          </h2>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
            Importador de Planilhas ANP v2.0
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center space-y-8">
        {step === 'upload' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm space-y-8 text-center"
          >
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-brand-primary to-brand-accent rounded-[40px] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative bg-zinc-900 border border-white/5 rounded-[32px] p-12 flex flex-col items-center gap-6 cursor-pointer hover:border-brand-primary/20 transition-all active:scale-95"
              >
                <div className="w-20 h-20 bg-brand-primary/10 rounded-3xl flex items-center justify-center text-brand-primary group-hover:scale-110 transition-transform">
                  <FileSpreadsheet className="w-10 h-10" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white">Upload de Planilha</h3>
                  <p className="text-xs text-zinc-500 max-w-[200px] mx-auto">
                    Selecione o arquivo CSV baixado da ANP para atualizar os preços.
                  </p>
                </div>
                <div className="px-6 py-3 bg-brand-primary text-zinc-950 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-brand-primary/20">
                  Selecionar Arquivo
                </div>
              </div>
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".csv" 
              className="hidden" 
            />
          </motion.div>
        )}

        {step === 'filter' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-zinc-900 border border-white/5 rounded-[32px] p-8 space-y-8 shadow-2xl"
          >
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary mx-auto">
                <Filter className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white">Filtro de Região</h3>
              <p className="text-xs text-zinc-500">Selecione o local para evitar o limite do Firebase.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Estado (UF)</label>
                <select 
                  value={selectedUF}
                  onChange={(e) => setSelectedUF(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/5 rounded-2xl p-4 text-xs text-white focus:border-brand-primary outline-none"
                >
                  <option value="">Selecione o Estado</option>
                  {availableUFs.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Município (Opcional)</label>
                <select 
                  value={selectedMunicipio}
                  onChange={(e) => setSelectedMunicipio(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/5 rounded-2xl p-4 text-xs text-white focus:border-brand-primary outline-none"
                >
                  <option value="">Todos os Municípios</option>
                  {availableMunicipios.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              
              <div className="p-4 bg-brand-primary/5 border border-brand-primary/10 rounded-2xl flex items-start gap-3">
                 <Zap className="w-4 h-4 text-brand-primary mt-0.5" />
                 <p className="text-[10px] text-zinc-400 leading-relaxed">
                   Dica: Importar um município por vez é o mais seguro para não estourar a cota de 20k/dia.
                 </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setStep('upload')}
                className="flex-1 py-4 bg-zinc-800 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all"
              >
                Trocar Arquivo
              </button>
              <button 
                onClick={handleStartImport}
                className="flex-[2] py-4 bg-brand-primary text-zinc-950 rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all shadow-xl shadow-brand-primary/20"
              >
                Iniciar Importação
              </button>
            </div>
          </motion.div>
        )}

        {step === 'processing' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-zinc-900/50 border border-white/5 rounded-[32px] p-8 shadow-2xl space-y-6"
          >
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-2xl border ${error ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary'}`}>
                {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : (error ? <AlertCircle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />)}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white leading-tight">
                  {isProcessing ? 'Processando Dados' : (error ? 'Ops! Algo deu errado' : 'Importação Finalizada')}
                </h3>
                <p className="text-xs text-zinc-500 font-medium">{status}</p>
              </div>
            </div>

            {isProcessing && (
              <div className="space-y-3">
                <div className="h-3 w-full bg-zinc-950 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-gradient-to-r from-brand-primary to-brand-accent shadow-[0_0_15px_rgba(255,41,41,0.5)]"
                  />
                </div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  <span>Progresso</span>
                  <span className="text-brand-primary">{progress}%</span>
                </div>
              </div>
            )}

            {summary && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-950 border border-white/5 p-4 rounded-2xl space-y-1">
                  <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest block">Postos Encontrados</span>
                  <span className="text-2xl font-display font-black italic text-white">{summary.stations}</span>
                </div>
                <div className="bg-zinc-950 border border-white/5 p-4 rounded-2xl space-y-1">
                  <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest block">Sucesso Upload</span>
                  <span className="text-2xl font-display font-black italic text-brand-primary">{summary.uploaded}</span>
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-500 font-medium">
                {error}
              </div>
            )}

            {!isProcessing && (
              <button 
                onClick={onBack}
                className="w-full py-4 bg-zinc-800 text-white rounded-2xl font-black uppercase tracking-widest text-xs active:scale-95 transition-all shadow-xl"
              >
                Voltar
              </button>
            )}
          </motion.div>
        )}
      </main>

      <footer className="p-6 border-t border-white/5 bg-zinc-900/20">
        <div className="flex items-center gap-3 opacity-40 grayscale group hover:opacity-100 hover:grayscale-0 transition-all duration-700">
          <Database className="w-4 h-4 text-brand-primary" />
          <p className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.3em]">
            Cloud Processing Engine v2.4.0
          </p>
        </div>
      </footer>
    </div>
  );
}
