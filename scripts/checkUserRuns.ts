
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, limit } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkRankings() {
  const uid = "ZQ7ZTpZLHIfHSyC1O73BnaGgmS23"; // From logs
  console.log(`Checking rankings for user ${uid}...`);
  
  const q = query(collection(db, 'rankings'), where('uid', '==', uid), limit(20));
  const snap = await getDocs(q);
  
  const rankings = snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  console.log('Rankings:');
  console.log(JSON.stringify(rankings, null, 2));
  
  console.log("\nChecking general runs...");
  const qRuns = query(collection(db, 'runs'), where('uid', '==', uid), limit(20));
  const snapRuns = await getDocs(qRuns);
  const runs = snapRuns.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  console.log('Runs:');
  console.log(JSON.stringify(runs, null, 2));
  
  process.exit(0);
}

checkRankings().catch(err => {
  console.error(err);
  process.exit(1);
});
