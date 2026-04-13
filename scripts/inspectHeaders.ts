import fs from 'fs';
import Papa from 'papaparse';

const ANP_FILE_PATH = 'C:/Users/QueirozR7/Downloads/anp.csv';

function inspect() {
  const fileContent = fs.readFileSync(ANP_FILE_PATH, 'latin1'); // Tentar latin1 para ver os caracteres reais
  const results = Papa.parse(fileContent, {
    header: true,
    preview: 1,
    delimiter: ';'
  });
  
  console.log('Chaves reais encontradas:', Object.keys(results.data[0] as any));
  process.exit(0);
}

inspect();
