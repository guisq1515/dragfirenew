
import { db } from '../src/firebase';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';

async function checkLogs() {
  console.log("Fetching latest remote logs...");
  try {
    const q = query(collection(db, 'remote_logs'), orderBy('timestamp', 'desc'), limit(50));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      console.log("No logs found.");
      return;
    }

    snap.forEach(doc => {
      const data = doc.data();
      console.log(`[${data.level.toUpperCase()}] ${new Date(data.timestamp?.seconds * 1000).toLocaleString()}`);
      console.log(`Message: ${data.message}`);
      console.log(`User: ${data.uid}`);
      console.log(`Platform: ${data.platform} | Version: ${data.version}`);
      if (data.details) console.log(`Details:`, JSON.stringify(data.details, null, 2));
      console.log("-----------------------------------");
    });
  } catch (e) {
    console.error("Error fetching logs:", e);
  }
}

checkLogs();
