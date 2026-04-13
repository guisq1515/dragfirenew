import fs from 'fs';
import Papa from 'papaparse';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, writeBatch } from 'firebase/firestore';
import config from '../firebase-applet-config.json';

const ANP_FILE_PATH = 'C:/Users/QueirozR7/Downloads/anp.csv';

const app = initializeApp(config);
const db = getFirestore(app);

const PRODUCT_MAP: Record<string, string> = {
  'GASOLINA COMUM': 'gasoline',
  'GASOLINA ADITIVADA': 'gasoline',
  'ETANOL': 'ethanol',
  'ETANOL HIDRATADO': 'ethanol',
  'DIESEL S10': 'dieselS10',
  'OLEO DIESEL S10': 'dieselS10',
  'DIESEL S500': 'dieselS500',
  'OLEO DIESEL S500': 'dieselS500',
  'GNV': 'gnv'
};

async function runImport() {
  console.log('--- ANTIGRAVITY AUTO-IMPORT V3 ---');
  if (!fs.existsSync(ANP_FILE_PATH)) {
    console.error('Arquivo nao encontrado em:', ANP_FILE_PATH);
    return;
  }

  console.log('Lendo arquivo (latin1):', ANP_FILE_PATH);
  const fileContent = fs.readFileSync(ANP_FILE_PATH, 'latin1');

  console.log('Processando CSV...');
  const results = Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true,
    delimiter: ';'
  });

  const rawRows = results.data as any[];
  console.log(`Total de linhas lidas: ${rawRows.length}`);

  const stationsMap = new Map<string, any>();

  rawRows.forEach(row => {
    const cnpj = row['CNPJ']?.trim();
    if (!cnpj) return;

    let station = stationsMap.get(cnpj);
    if (!station) {
      const address = [
        row['ENDEREÇO'],
        row['NÚMERO'],
        row['COMPLEMENTO'],
        row['BAIRRO'],
        row['MUNICÍPIO'],
        row['ESTADO'],
        row['CEP']
      ].filter(p => p && p !== '-' && p !== 'S/N' && p !== 's/n').join(', ');

      station = {
        id: cnpj.replace(/\D/g, ''),
        name: row['FANTASIA']?.trim() || row['RAZÃO']?.trim() || 'Posto ANP',
        brand: row['BANDEIRA']?.trim() || 'Branca',
        address: address,
        municipio: row['MUNICÍPIO']?.trim().toUpperCase(),
        latitude: 0,
        longitude: 0,
        prices: {},
        pricesANP: {},
        lastUpdated: Date.now()
      };
      stationsMap.set(cnpj, station);
    }

    const prod = row['PRODUTO']?.toUpperCase().trim();
    const priceStr = row['PREÇO DE REVENDA'];
    
    if (prod && priceStr) {
      const key = PRODUCT_MAP[prod];
      if (key) {
        const price = parseFloat(priceStr.replace(',', '.'));
        if (!isNaN(price)) {
          station.pricesANP[key] = price;
        }
      }
    }
  });

  const stationsToUpload = Array.from(stationsMap.values());
  console.log(`Postos agrupados para upload: ${stationsToUpload.length}`);

  const BATCH_SIZE = 100;
  for (let i = 0; i < stationsToUpload.length; i += BATCH_SIZE) {
    const chunk = stationsToUpload.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    chunk.forEach(station => {
      const ref = doc(collection(db, 'fuel_stations_anp'), station.id);
      batch.set(ref, station, { merge: true });
    });

    try {
      await batch.commit();
      console.log(`Progresso: ${Math.min(i + BATCH_SIZE, stationsToUpload.length)} / ${stationsToUpload.length}`);
    } catch (err) {
      console.error(`Erro no lote ${i}:`, err);
      // Opcional: retry logic
    }
    
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log('--- IMPORTAÇÃO CONCLUÍDA COM SUCESSO ---');
  process.exit(0);
}

runImport().catch(err => {
  console.error('Erro na importação:', err);
  process.exit(1);
});
