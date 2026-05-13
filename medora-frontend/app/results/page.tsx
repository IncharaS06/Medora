"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, limit, query } from "firebase/firestore";

export default function ResultsPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      addLog(`Auth state changed: ${firebaseUser ? `UID ${firebaseUser.uid}` : "No user"}`);
      if (!firebaseUser) {
        addLog("No user, cannot fetch");
        return;
      }
      setUser(firebaseUser);
      
      // Test Firestore connection
      addLog("Attempting to fetch from 'cases' collection...");
      try {
        const casesRef = collection(db, "cases");
        const q = query(casesRef, limit(5)); // Get up to 5 docs without any orderBy
        const snapshot = await getDocs(q);
        addLog(`Query returned ${snapshot.size} documents`);
        if (snapshot.empty) {
          addLog("No documents found in 'cases' collection. Check collection name and security rules.");
        } else {
          snapshot.forEach(doc => {
            addLog(`Document ID: ${doc.id}, data keys: ${Object.keys(doc.data()).join(", ")}`);
          });
        }
      } catch (err: any) {
        addLog(`ERROR: ${err.message || err.code}`);
      }
    });
    return () => unsub();
  }, []);

  const addLog = (msg: string) => {
    console.log(msg);
    setLogs(prev => [...prev, msg]);
  };

  return (
    <div className="p-8 font-mono text-sm">
      <h1 className="text-xl font-bold mb-4">Firestore Diagnostic</h1>
      <div className="bg-gray-900 text-green-400 p-4 rounded-lg whitespace-pre-wrap">
        {logs.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
      </div>
    </div>
  );
}
