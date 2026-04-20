import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { APP_VERSION } from '../versions';
import { Capacitor } from '@capacitor/core';
import { RemoteLog } from '../types';

/**
 * Logs a message or error to the remote Firestore 'remote_logs' collection.
 * This is used for cross-device diagnostics.
 */
export const logRemote = async (params: {
  uid: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: any;
}) => {
  try {
    const logEntry: Omit<RemoteLog, 'timestamp'> & { timestamp: any } = {
      uid: params.uid,
      level: params.level,
      message: params.message,
      details: params.details || null,
      timestamp: serverTimestamp(),
      platform: Capacitor.getPlatform(),
      version: APP_VERSION
    };

    await addDoc(collection(db, 'remote_logs'), logEntry);
  } catch (e) {
    // Fail silently to avoid interrupting user flow with logging errors
    console.error("Remote logging failed:", e);
  }
};
