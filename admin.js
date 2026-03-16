import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ====== CONFIGURAZIONE FIREBASE ======
// Riusiamo le chiavi fornite dall'utente in app.js
const firebaseConfig = {
  apiKey: "AIzaSyB6CLQZHPG60LqsIKHAlS_Wt5OFXqfwqkw",
  authDomain: "antimo-6a86b.firebaseapp.com",
  projectId: "antimo-6a86b",
  storageBucket: "antimo-6a86b.firebasestorage.app",
  messagingSenderId: "671676764068",
  appId: "1:671676764068:web:95027e0babe3f30042fb31",
  measurementId: "G-WTWNH23PLS"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements
const tableBody = document.getElementById('tableBody');
const nonEseguitiTableBody = document.getElementById('nonEseguitiTableBody');
const btnExportExcel = document.getElementById('btnExportExcel');
const btnApplyFilters = document.getElementById('btnApplyFilters');
const btnResetFilters = document.getElementById('btnResetFilters');
const btnManualSync = document.getElementById('btnManualSync');

const filterDateStart = document.getElementById('filterDateStart');
const filterDateEnd = document.getElementById('filterDateEnd');
const filterSearch = document.getElementById('filterSearch');

let tuttiGliInterventi = [];

// Helper
function padZ(num) { return num.toString().padStart(2, '0'); }
function formatDateDMY(date) { return `${padZ(date.getDate())}/${padZ(date.getMonth() + 1)}/${date.getFullYear()}`; }
function formatTime(ms) { 
    if(!ms) return '--:--';
    const d = new Date(ms); 
    return `${padZ(d.getHours())}:${padZ(d.getMinutes())}`; 
}

async function loadData() {
    try {
        const querySnapshot = await getDocs(collection(db, "interventi"));
        const rawData = [];
        querySnapshot.forEach((doc) => {
            rawData.push({ fbId: doc.id, ...doc.data() });
        });
        
        // Ordina decrescente (più recenti prima)
        tuttiGliInterventi = rawData.sort((a,b) => b.startTime - a.startTime);
        renderTable(tuttiGliInterventi);
    } catch (e) {
        console.error("Errore download dati:", e);
        tableBody.innerHTML = `<tr><td colspan="8" style="color:red; text-align:center;">Errore di connessione a Firebase: ${e.message}</td></tr>`;
    }
    
    // Carica anche la sezione Non Eseguiti
    await loadNonEseguiti();
}

async function loadNonEseguiti() {
    try {
        // Al posto di usare una query() con where() che potrebbe richiedere un Indice Composto su Firestore,
        // scarichiamo semplicemente tutti i 'programmati' e filtriamo in locale per sicurezza e robustezza.
        const snap = await getDocs(collection(db, "programmati"));
        
        const data = [];
        snap.forEach(d => {
            const val = d.data();
            if(val.status === "justified_not_executed") {
                data.push({ fbId: d.id, ...val });
            }
        });
        
        renderNonEseguitiTable(data);
    } catch(e) {
        console.error("Errore fetch non eseguiti:", e);
        nonEseguitiTableBody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center;">Errore interno caricamento Non Eseguiti: ${e.message}</td></tr>`;
    }
}

function renderTable(dataArray) {
    if(dataArray.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Nessun intervento trovato per i filtri selezionati.</td></tr>`;
        return;
    }

    tableBody.innerHTML = '';
    
    dataArray.forEach(inv => {
        const tr = document.createElement('tr');
        
        const dStart = new Date(inv.startTime);
        const dataStr = formatDateDMY(dStart);
        const timeStr = `${formatTime(inv.startTime)} - ${formatTime(inv.endTime)}`;
        
        let fileHtml = '<span style="color:#aaa;">-</span>';
        if(inv.fileUrl) {
            fileHtml = `<a href="${inv.fileUrl}" target="_blank" class="attachment-link">📎 Apri / Scarica</a>`;
        } else if(inv.haAllegato) {
            fileHtml = `<span class="badge badge-warning">Caricamento fallito</span>`;
        }

        tr.innerHTML = `
            <td><strong>${dataStr}</strong></td>
            <td>${timeStr}</td>
            <td>${inv.paziente}</td>
            <td>${inv.destinazione}</td>
            <td><span class="badge badge-success">${inv.tipo}</span><br><small style="color:gray;">${inv.note || ''}</small></td>
            <td>${inv.dispositivi}<br><small style="color:gray;">${inv.matricola ? 'SN: ' + inv.matricola : ''}</small></td>
            <td>${inv.kmPercorsi ? inv.kmPercorsi + ' km' : '-'}</td>
            <td>${fileHtml}</td>
        `;
        tableBody.appendChild(tr);
    });
}

function renderNonEseguitiTable(dataArray) {
    if(dataArray.length === 0) {
        nonEseguitiTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: #666;">🎉 Nessun intervento pendente da controllare.</td></tr>`;
        return;
    }
    
    nonEseguitiTableBody.innerHTML = '';
    
    dataArray.forEach(inv => {
        const tr = document.createElement('tr');
        
        let dateStr = inv.dataPrevista ? inv.dataPrevista.split('-').reverse().join('/') : 'N/D';
        
        tr.innerHTML = `
            <td><strong>${dateStr}</strong></td>
            <td style="font-weight: 600;">${inv.paziente}</td>
            <td>${inv.destinazione}</td>
            <td><span class="badge badge-warning">${inv.tipo}</span><br><small style="color:gray;">${inv.dispositivi} ${inv.matricola ? `(SN: ${inv.matricola})` : ''}</small></td>
            <td style="color:#b45309; font-weight:600; font-style: italic;">"${inv.motivazione || 'Nessuna'}"</td>
            <td><button class="btn btn-primary btn-sm btn-chiudi" data-fbid="${inv.fbId}" style="background-color: var(--blue-dark);">Archivia (Chiudi)</button></td>
        `;
        
        tr.querySelector('.btn-chiudi').addEventListener('click', async (e) => {
            if(!confirm("Vuoi archiviare definitivamente questo intervento non eseguito? Scomparirà dalla lista dell'ufficio.")) return;
            const fbId = e.target.getAttribute('data-fbid');
            try {
                e.target.disabled = true;
                e.target.textContent = "Chiusura...";
                await updateDoc(doc(db, "programmati", fbId), { status: 'archived' });
                await loadNonEseguiti();
            } catch(err) {
                alert("Errore durante l'archiviazione: " + err.message);
                e.target.disabled = false;
                e.target.textContent = "Archivia (Chiudi)";
            }
        });
        
        nonEseguitiTableBody.appendChild(tr);
    });
}

// Filtri
function applyFilters() {
    let filtrati = [...tuttiGliInterventi];
    
    // Filtro Ricerca Testo
    const searchVal = filterSearch.value.toLowerCase().trim();
    if(searchVal) {
        filtrati = filtrati.filter(i => 
            i.paziente.toLowerCase().includes(searchVal) || 
            i.destinazione.toLowerCase().includes(searchVal)
        );
    }
    
    // Filtro Date
    if(filterDateStart.value) {
        // start of that day
        const ds = new Date(filterDateStart.value).setHours(0,0,0,0);
        filtrati = filtrati.filter(i => i.startTime >= ds);
    }
    if(filterDateEnd.value) {
        // end of that day
        const de = new Date(filterDateEnd.value).setHours(23,59,59,999);
        filtrati = filtrati.filter(i => i.startTime <= de);
    }

    renderTable(filtrati);
}

// Export
function esporterCSV() {
    let currentData = [...tuttiGliInterventi]; // idealmente si espostano quelli filtrati, li ricalcoliamo
    // Riapplichiamo la logica di filtering base
     const searchVal = filterSearch.value.toLowerCase().trim();
    if(searchVal) {
        currentData = currentData.filter(i => 
            i.paziente.toLowerCase().includes(searchVal) || 
            i.destinazione.toLowerCase().includes(searchVal)
        );
    }
    if(filterDateStart.value) {
        const ds = new Date(filterDateStart.value).setHours(0,0,0,0);
        currentData = currentData.filter(i => i.startTime >= ds);
    }
    if(filterDateEnd.value) {
        const de = new Date(filterDateEnd.value).setHours(23,59,59,999);
        currentData = currentData.filter(i => i.startTime <= de);
    }

    if(currentData.length === 0) {
        return alert("Nessun dato da esportare con questi filtri.");
    }

    let header = ["Data", "Orario Inizio", "Orario Fine", "Paziente / Ente", "Citta / Destinazione", "Tipo Intervento", "Dispositivi", "Matricola", "Km Extra", "Note", "Link Allegato"];
    let csvContent = header.join(";") + "\n";
    
    currentData.forEach(inv => {
        let rs = [
            `"${formatDateDMY(new Date(inv.startTime))}"`, `"${formatTime(inv.startTime)}"`, `"${formatTime(inv.endTime)}"`,
            `"${inv.paziente.replace(/"/g, '""')}"`, `"${inv.destinazione.replace(/"/g, '""')}"`,
            `"${inv.tipo}"`, `"${inv.dispositivi.replace(/"/g, '""')}"`, `"${inv.matricola ? inv.matricola.replace(/"/g, '""') : ''}"`, `"${inv.kmPercorsi}"`,
            `"${inv.note ? inv.note.replace(/"/g, '""') : ''}"`, `"${inv.fileUrl || ''}"`
        ];
        csvContent += rs.join(";") + "\n";
    });

    const blob = new Blob(["\uFEFF"+csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Estrazione_Archivio_Interventi.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

btnApplyFilters.addEventListener('click', applyFilters);
btnResetFilters.addEventListener('click', () => {
    filterDateStart.value = '';
    filterDateEnd.value = '';
    filterSearch.value = '';
    renderTable(tuttiGliInterventi);
});
btnExportExcel.addEventListener('click', esporterCSV);

if(btnManualSync) {
    btnManualSync.addEventListener('click', async () => {
        const oldText = btnManualSync.innerHTML;
        try {
            btnManualSync.innerHTML = "🔄 Sincronizzazione in corso...";
            btnManualSync.disabled = true;
            await loadData();
            alert("Dati sincronizzati con successo dal Cloud!");
        } catch(e) {
            alert("Errore di sincronizzazione: " + e.message);
        } finally {
            btnManualSync.innerHTML = oldText;
            btnManualSync.disabled = false;
        }
    });
}

// Inizializza caricando i dati al boot
loadData();
