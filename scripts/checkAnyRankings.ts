
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, getDocs, limit } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkAnyRankings() {
  console.log(`Checking any rankings...`);
  
  const q = query(collection(db, 'rankings'), limit(5));
  const snap = await getDocs(q);
  
  const rankings = snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  console.log(JSON.stringify(rankings, null, 2));
  process.exit(0);
}

checkAnyRankings().catch(err => {
  console.error(err);
  process.exit(1);
});
