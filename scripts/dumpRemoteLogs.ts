
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function dumpLogs() {
  console.log('Fetching remote logs...');
  const q = query(collection(db, 'remote_logs'), orderBy('timestamp', 'desc'), limit(100));
  const snap = await getDocs(q);
  
  const logs = snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp
  }));
  
  fs.writeFileSync('remote_logs_dump.json', JSON.stringify(logs, null, 2));
  console.log('Logs dumped to remote_logs_dump.json');
  process.exit(0);
}

dumpLogs().catch(err => {
  console.error(err);
  process.exit(1);
});
