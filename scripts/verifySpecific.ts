import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import config from '../firebase-applet-config.json';

const app = initializeApp(config);
const db = getFirestore(app);

async function verify() {
  const id = '88587589000117'; // Exemplo do head
  console.log(`Verificando posto ${id}...`);
  const snap = await getDoc(doc(db, 'fuel_stations_anp', id));
  
  if (snap.exists()) {
    console.log('Posto encontrado!', snap.data());
  } else {
    console.log('Posto nao encontrado!');
  }
  process.exit(0);
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
