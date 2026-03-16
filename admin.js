import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ====== CONFIGURAZIONE FIREBASE ======
// Riusiamo le chiavi fornite dall'utente in app.js
const firebaseConfig = {
  apiKey: "AIzaSyC9XTi3OxsBd1ZgLlpMRm9nymrkRCfuLgY",
  authDomain: "antimo-app.firebaseapp.com",
  projectId: "antimo-app",
  storageBucket: "antimo-app.firebasestorage.app",
  messagingSenderId: "535167949374",
  appId: "1:535167949374:web:01b4487c8abbdf82aacf6f",
  measurementId: "G-494F166FDJ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements
const tableBody = document.getElementById('tableBody');
const btnExportExcel = document.getElementById('btnExportExcel');
const btnApplyFilters = document.getElementById('btnApplyFilters');
const btnResetFilters = document.getElementById('btnResetFilters');

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
            <td>${inv.dispositivi}</td>
            <td>${inv.kmPercorsi ? inv.kmPercorsi + ' km' : '-'}</td>
            <td>${fileHtml}</td>
        `;
        tableBody.appendChild(tr);
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

    let header = ["Data", "Orario Inizio", "Orario Fine", "Paziente / Ente", "Citta / Destinazione", "Tipo Intervento", "Dispositivi", "Km Extra", "Note", "Link Allegato"];
    let csvContent = header.join(";") + "\n";
    
    currentData.forEach(inv => {
        let rs = [
            `"${formatDateDMY(new Date(inv.startTime))}"`, `"${formatTime(inv.startTime)}"`, `"${formatTime(inv.endTime)}"`,
            `"${inv.paziente.replace(/"/g, '""')}"`, `"${inv.destinazione.replace(/"/g, '""')}"`,
            `"${inv.tipo}"`, `"${inv.dispositivi.replace(/"/g, '""')}"`, `"${inv.kmPercorsi}"`,
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

// Inizializza caricando i dati al boot
loadData();
