import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAh7dwRs1j7Vxib7OlB7mVRB-MNthAo5NA",
  authDomain: "peppe-ai-platform.firebaseapp.com",
  projectId: "peppe-ai-platform",
  storageBucket: "peppe-ai-platform.firebasestorage.app",
  messagingSenderId: "214462018633",
  appId: "1:214462018633:web:f224407eba3b107e27fb98",
  measurementId: "G-54RQ3L1EDW"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const logBox = document.getElementById('logBox');
const btnSeed = document.getElementById('btnSeed');

function log(msg, type = '') {
    const span = document.createElement('div');
    if(type) span.className = type;
    span.textContent = `[${new Date().toLocaleTimeString('it-IT')}] ${msg}`;
    logBox.appendChild(span);
    logBox.scrollTop = logBox.scrollHeight;
}

// Funzione ricorsiva per sostituire "SERVER_TIMESTAMP" con serverTimestamp() nativo
function replaceTimestamps(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => replaceTimestamps(item));
    }
    
    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value === "SERVER_TIMESTAMP") {
            newObj[key] = serverTimestamp();
        } else if (typeof value === 'object') {
            newObj[key] = replaceTimestamps(value);
        } else {
            newObj[key] = value;
        }
    }
    return newObj;
}

async function runSeed() {
    if(!confirm("⚠️ Confermi di voler procedere con l'importazione di tutti i seed data su Firestore? I documenti esistenti con questi ID saranno sovrascritti.")) return;
    
    btnSeed.disabled = true;
    log("Inizio processo di importazione del Database V2...", "warn");
    
    try {
        log("Lettura di seed_data.json in corso...", "info");
        const response = await fetch('./seed_data.json');
        if (!response.ok) throw new Error("Impossibile caricare seed_data.json. Assicurati di usare npx serve.");
        
        const rawData = await response.json();
        
        const collections = Object.keys(rawData);
        log(`Trovate ${collections.length} collezioni JSON da elaborare (Es. people, families, etc...).`);
        
        let totalDocs = 0;
        
        for (const colName of collections) {
            const items = rawData[colName];
            if (!Array.isArray(items)) {
                log(`Salto la chiave '${colName}' perché non è un Array.`, "warn");
                continue;
            }
            
            log(`Popolamento collezione '${colName}' in corso (${items.length} documenti)...`, "info");
            
            for (const item of items) {
                if (!item.id) {
                    log(`Un elemento in ${colName} non ha un 'id'. Elemento ignorato.`, "error");
                    continue;
                }
                
                // Parse timestamps
                const processedData = replaceTimestamps(item);
                
                // Call setDoc exactly targeting the requested doc structure
                await setDoc(doc(db, colName, item.id), processedData);
                totalDocs++;
            }
            log(`✅ Collezione '${colName}' completata!`, "success");
        }
        
        log(`\n🎉 IMPORTAZIONE COMPLETATA CON SUCCESSO!`, "success");
        log(`Scrittura garantita: ${totalDocs} documenti creati su ${collections.length} collezioni.`, "success");
        log(`Controlla il tuo database Firestore per validare l'inserimento.`, "info");
        
    } catch (error) {
        log(`[ERRORE FATALE] ${error.message}`, "error");
        console.error(error);
    } finally {
        btnSeed.textContent = "AGGIORNAMENTO COMPLETATO";
    }
}

btnSeed.addEventListener('click', runSeed);
