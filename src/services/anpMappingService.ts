import { GasStation } from '../types';
import { normalizeText } from '../lib/utils';

export interface ANPRow {
  CNPJ: string;
  RAZÃO: string;
  FANTASIA: string;
  ENDEREÇO: string;
  NÚMERO: string;
  COMPLEMENTO: string;
  BAIRRO: string;
  CEP: string;
  MUNICÍPIO: string;
  ESTADO: string;
  BANDEIRA: string;
  PRODUTO: string;
  'UNIDADE DE MEDIDA'?: string;
  'PREÇO DE REVENDA'?: string;
  'DATA DA COLETA'?: string;
}

const PRODUCT_MAP: Record<string, keyof NonNullable<GasStation['pricesANP']>> = {
  'GASOLINA': 'gasoline',
  'GASOLINA ADITIVADA': 'gasoline',
  'ETANOL': 'ethanol',
  'ETANOL HIDRATADO': 'ethanol',
  'DIESEL S10': 'dieselS10',
  'DIESEL S500': 'dieselS500',
  'OLEO DIESEL S10': 'dieselS10',
  'OLEO DIESEL S500': 'dieselS500',
  'GNV': 'gnv'
};

/**
 * Agrupa as linhas da planilha ANP pelo CNPJ e mapeia para o formato GasStation.
 * Como cada linha da planilha representa um produto, agrupamos os preços no mesmo posto.
 */
export function mapANPRowsToStations(
  rows: ANPRow[], 
  filters?: { estado?: string; municipio?: string }
): GasStation[] {
  const stationsMap = new Map<string, GasStation>();

  rows.forEach(row => {
    // Acessar propriedades de forma robusta para o filtro inicial
    const rowUF = normalizeText(row.ESTADO || (row as any).UF || '');
    const rowMun = normalizeText(row.MUNICÍPIO || (row as any).MUNICIPIO || '');

    // Filtros de Região (Otimização para evitar limites do Firebase)
    if (filters) {
      if (filters.estado && filters.estado !== '' && rowUF !== normalizeText(filters.estado)) return;
      if (filters.municipio && filters.municipio !== '' && rowMun !== normalizeText(filters.municipio)) return;
    }

    // Limpeza básica do CNPJ (remover caracteres não numéricos)
    const cnpj = row.CNPJ ? row.CNPJ.trim() : '';
    if (!cnpj) return;

    let station = stationsMap.get(cnpj);

    if (!station) {
      // Acessar propriedades de forma robusta (com e sem acento, maiúsculas/minúsculas)
      const getVal = (row: any, ...keys: string[]) => {
        for (const key of keys) {
          if (row[key] !== undefined && row[key] !== null) return String(row[key]).trim();
        }
        return '';
      };

      const fantasia = getVal(row, 'FANTASIA', 'FANTASIA');
      const razao = getVal(row, 'RAZÃO', 'RAZAO', 'RAZÃO SOCIAL');
      const municipio = getVal(row, 'MUNICÍPIO', 'MUNICIPIO');
      const estado = getVal(row, 'ESTADO', 'UF');
      const endereco = getVal(row, 'ENDEREÇO', 'ENDERECO', 'LOGRADOURO');
      const numero = getVal(row, 'NÚMERO', 'NUMERO');
      const complemento = getVal(row, 'COMPLEMENTO');
      const bairro = getVal(row, 'BAIRRO');
      const cep = getVal(row, 'CEP');
      const bandeira = getVal(row, 'BANDEIRA');

      // Montar endereço formatado
      const addressParts = [
        endereco,
        numero,
        complemento,
        bairro,
        municipio,
        estado,
        cep
      ].filter(part => part && part !== '-' && part !== 'S/N' && part !== 's/n');

      const address = addressParts.join(', ');

      station = {
        id: cnpj.replace(/\D/g, ''),
        name: fantasia || razao || 'Posto sem Nome',
        brand: bandeira || 'Branca',
        address: address,
        latitude: 0, 
        longitude: 0,
        prices: {},
        pricesANP: {},
        municipio: normalizeText(municipio),
        rating: 0,
        reviewsCount: 0,
        lastUpdated: Date.now(),
      };
      stationsMap.set(cnpj, station);
    }

    // Mapear o preço do produto específico
    const rawProduct = row.PRODUTO?.toUpperCase().trim() || '';
    const rawPrice = row['PREÇO DE REVENDA'];

    if (rawProduct && rawPrice) {
      const productKey = PRODUCT_MAP[rawProduct];
      if (productKey && station.pricesANP) {
        // Converter preço de "5,89" para 5.89
        const price = typeof rawPrice === 'string' 
          ? parseFloat(rawPrice.replace(',', '.')) 
          : parseFloat(String(rawPrice));

        if (!isNaN(price)) {
          // Mantemos o maior preço se houver duplicidade na mesma importação (raro)
          station.pricesANP[productKey] = Math.max(station.pricesANP[productKey] || 0, price);
        }
      }
    }
  });

  return Array.from(stationsMap.values());
}
