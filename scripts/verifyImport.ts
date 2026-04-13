import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';
import config from '../firebase-applet-config.json';

const app = initializeApp(config);
const db = getFirestore(app);

async function verify() {
  console.log('Verificando colecao fuel_stations_anp...');
  const q = query(collection(db, 'fuel_stations_anp'), limit(5));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    console.log('Nao foram encontrados documentos!');
  } else {
    console.log(`Encontrados ${snapshot.size} documentos de teste:`);
    snapshot.forEach(doc => {
      console.log(`- ID: ${doc.id}, Nome: ${doc.data().name}, Preços:`, doc.data().pricesANP);
    });
  }
  process.exit(0);
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
