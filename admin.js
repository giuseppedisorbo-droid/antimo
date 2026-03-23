import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, query, where, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getStorage, ref, uploadString } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

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
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
let isAdminLogged = false;

// DOM Auth
const btnLoginAdmin = document.getElementById('btnLoginAdmin');

// Liste Dinamiche Dropdown
window.antimoDropdownLists = { interventi: [], dispositivi: [] };
window.decodeCodeToLabel = function(codeRaw, type = 'interventi') {
    if(!codeRaw) return "";
    let codes = codeRaw.split(',').map(c => c.trim());
    return codes.map(c => {
        let listStr = type === 'interventi' ? 'interventi' : 'dispositivi';
        let found = window.antimoDropdownLists[listStr].find(item => item.id === c);
        return found ? found.desc : c;
    }).join(', ');
};

async function loadDropdownLists() {
    const defaultTypes = ['Visita', 'Sostituzione', 'Ritiro', 'Consegna', 'Manutenzione', 'Installazione', 'Riparazione'];
    const defaultDevices = ['Concentratore', 'Ventilatore', 'Aspiratore', 'D3', 'Stativo', 'Cpap', 'AutoCpap', 'Saturimetro'];
    
    window.antimoDropdownLists = {
        interventi: defaultTypes.map(t => ({ id: t, desc: t })),
        dispositivi: defaultDevices.map(d => ({ id: d, desc: d }))
    };

    if(db) {
        try {
            const docRef = doc(db, "configurazioni", "liste_dropdown");
            const docSnap = await getDoc(docRef);
            if(docSnap.exists()) {
                window.antimoDropdownLists = docSnap.data();
                localStorage.setItem('antimo_dropdown_lists', JSON.stringify(window.antimoDropdownLists));
            } else {
                await setDoc(docRef, window.antimoDropdownLists);
                localStorage.setItem('antimo_dropdown_lists', JSON.stringify(window.antimoDropdownLists));
            }
        } catch(e) {
            console.error("Errore fetch liste dropdown admin, uso cache", e);
            let cached = localStorage.getItem('antimo_dropdown_lists');
            if(cached) window.antimoDropdownLists = JSON.parse(cached);
        }
    } else {
        let cached = localStorage.getItem('antimo_dropdown_lists');
        if(cached) window.antimoDropdownLists = JSON.parse(cached);
    }
}
loadDropdownLists();

// BACKUP AUTOMATICO SILENZIOSO
async function automaticFirebaseBackup() {
    const todayStr = new Date().toISOString().split('T')[0];
    const lastBackup = localStorage.getItem('antimo_lastCloudBackup');
    
    if (lastBackup === todayStr) {
        console.log("Backup automatico già eseguito oggi.");
        return;
    }
    
    try {
        console.log("Inizio backup automatico silenzioso su Firebase Storage...");
        const storage = getStorage(app);
        const collectionsToExport = ["interventi", "programmati", "messaggi", "anagrafiche"];
        const exportData = {};
        
        for(let collName of collectionsToExport) {
            exportData[collName] = [];
            const snap = await getDocs(collection(db, collName));
            snap.forEach(d => {
                exportData[collName].push({ __firebaseDocId: d.id, ...d.data() });
            });
        }
        
        const jsonStr = JSON.stringify(exportData);
        const backupRef = ref(storage, `backups_giornalieri/backup_antimo_${todayStr}.json`);
        await uploadString(backupRef, jsonStr, 'raw', { contentType: 'application/json' });
        
        console.log("Backup automatico completato con successo!");
        localStorage.setItem('antimo_lastCloudBackup', todayStr);
    } catch (err) {
        console.error("Errore durante il backup automatico silenzioso:", err);
    }
}

onAuthStateChanged(auth, (user) => {
    if (user && user.email === 'giuseppedisorbo@gmail.com') {
        isAdminLogged = true;
        if (btnLoginAdmin) {
            btnLoginAdmin.textContent = "👤 Ciao Giuseppe (Esci)";
            btnLoginAdmin.style.backgroundColor = "var(--red)";
            btnLoginAdmin.style.color = "white";
        }
        const btnOpenAiSettings = document.getElementById('btnOpenAiSettings');
        if (btnOpenAiSettings) btnOpenAiSettings.classList.remove('hidden');

        // Lancia il backup automatico in background
        automaticFirebaseBackup();
    } else {
        isAdminLogged = false;
        if (btnLoginAdmin) {
            btnLoginAdmin.textContent = "👤 Login Admin";
            btnLoginAdmin.style.backgroundColor = "var(--blue-dark)";
            btnLoginAdmin.style.color = "white";
        }
        const btnOpenAiSettings = document.getElementById('btnOpenAiSettings');
        if (btnOpenAiSettings) btnOpenAiSettings.classList.add('hidden');

        if (user) {
            alert(`Accesso negato per: ${user.email}. Solo l'Amministratore (giuseppedisorbo@gmail.com) può accedere a questa pagina. Fai di nuovo Login e scegli l'account Google corretto.`);
            signOut(auth);
        }
    }
    // Rendi visibili o invisibili i tasti:
    renderTable(tuttiGliInterventi);
    // Potrebbe servire renderizzare i non eseguiti, ma lo farà loadData.
});

if (btnLoginAdmin) {
    btnLoginAdmin.addEventListener('click', () => {
        if (isAdminLogged) {
            signOut(auth);
        } else {
            signInWithPopup(auth, provider).catch(err => alert("Errore Login: " + err.message));
        }
    });

}

// ====== AI ADMIN LOGIC ======
const btnOpenAiSettings = document.getElementById('btnOpenAiSettings');
const aiAdminModal = document.getElementById('aiAdminModal');
const btnCloseAiAdmin = document.getElementById('btnCloseAiAdmin');
const adminAiKeyInput = document.getElementById('adminAiKeyInput');
const btnSaveAiKey = document.getElementById('btnSaveAiKey');
const btnTestAiKey = document.getElementById('btnTestAiKey');
const btnRefreshAiLogs = document.getElementById('btnRefreshAiLogs');
const aiLogsTableBody = document.getElementById('aiLogsTableBody');
const aiLogsSummary = document.getElementById('aiLogsSummary');

if(btnOpenAiSettings) {
    btnOpenAiSettings.addEventListener('click', async () => {
        aiAdminModal.classList.remove('hidden');
        
        // Carica la chiave API da Firestore e disabilita modale se non trovata al volo (dovrebbe esistere)
        try {
            const snap = await getDoc(doc(db, "configurazioni", "ai_settings"));
            if (snap.exists() && snap.data().gemini_api_key) {
                adminAiKeyInput.value = snap.data().gemini_api_key;
            } else {
                adminAiKeyInput.value = "";
            }
        } catch (err) { console.error("Errore fetch chiave AI", err); }

        loadAiLogs();
    });
}
if(btnCloseAiAdmin) btnCloseAiAdmin.addEventListener('click', () => aiAdminModal.classList.add('hidden'));

if(btnSaveAiKey) {
    btnSaveAiKey.addEventListener('click', async () => {
        if (!adminAiKeyInput.value.trim()) { alert("Inserire una chiave valida."); return; }
        try {
            await setDoc(doc(db, "configurazioni", "ai_settings"), {
                gemini_api_key: adminAiKeyInput.value.trim(),
                updatedAt: new Date().toISOString()
            });
            alert("Chiave API Google Gemini salvata su Firestore e ora disponibile per tutti i tecnici!");
        } catch (error) { alert("Errore di salvataggio: " + error.message); }
    });
}

async function loadAiLogs() {
    aiLogsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px;">Caricamento in corso...</td></tr>`;
    try {
        const snap = await getDocs(collection(db, "ai_logs"));
        let logs = [];
        let totalCost = 0;
        snap.forEach(d => { 
            let data = d.data();
            logs.push(data); 
            if(data.cost) totalCost += Number(data.cost);
        });
        
        // Ordina dal più recente
        logs.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        aiLogsSummary.innerText = `Costo Totale Stimato: $${totalCost.toFixed(5)}`;
        aiLogsTableBody.innerHTML = '';

        if(logs.length === 0) {
            aiLogsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px;">Nessun log AI presente.</td></tr>`;
            return;
        }

        logs.forEach(lg => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${new Date(lg.timestamp).toLocaleString()}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: var(--blue-dark);">${lg.user || "Sconosciuto"}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${(lg.prompt || '').replace(/"/g, '&quot;')}">${lg.prompt || '-'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${lg.tokens || '0'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${(lg.durationMs ? (lg.durationMs / 1000).toFixed(2) : '0')}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #b45309;">$${lg.cost ? Number(lg.cost).toFixed(5) : '0.00000'}</td>
            `;
            aiLogsTableBody.appendChild(tr);
        });
    } catch(err) {
        console.error("Errore ricaricamento log", err);
        aiLogsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Errore caricamento logs</td></tr>`;
    }
}
if(btnRefreshAiLogs) btnRefreshAiLogs.addEventListener('click', loadAiLogs);
// ==========================

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

const toggleStoricoHeader = document.getElementById('toggleStoricoHeader');
const storicoWrapper = document.getElementById('storicoWrapper');
const storicoToggleIcon = document.getElementById('storicoToggleIcon');
const quickFilters = document.querySelectorAll('.filter-quick');
const btnToggleFilters = document.getElementById('btnToggleFilters');
const filtersWrapper = document.getElementById('filtersWrapper');
const btnFilterMonth = document.getElementById('btnFilterMonth');
const quickSearchStorico = document.getElementById('quickSearchStorico');

if (quickSearchStorico) {
    quickSearchStorico.addEventListener('input', () => {
        applyFilters();
    });
}

let tuttiGliInterventi = [];
let tuttiGliInterventiProgrammati = [];

// Variabili globali per istanze dei Grafici (per distruggerli prima di ridisegnarli)
let chartInstStato = null;
let chartInstTecnici = null;
let chartInstTrend = null;
let chartInstD3 = null;

// Helper
function padZ(num) { return num.toString().padStart(2, '0'); }
function formatDateDMY(date) { return `${padZ(date.getDate())}/${padZ(date.getMonth() + 1)}/${date.getFullYear()}`; }
function formatTime(ms) {
    if (!ms) return '--:--';
    const d = new Date(ms);
    return `${padZ(d.getHours())}:${padZ(d.getMinutes())}`;
}

async function loadData() {
    try {
        // Fetch Operatori Sanitari
        window.operatoriSanitari = [];
        const qOps = query(collection(db, "anagrafiche"), where("qualifica", "==", "Operatore sanitario"));
        const opsSnap = await getDocs(qOps);
        opsSnap.forEach(d => {
            const data = d.data();
            window.operatoriSanitari.push({id: d.id, nome: (data.nome + " " + (data.cognome||"")).trim()});
        });
    } catch(e) { console.error("Errore fetch operatori", e); }

    try {
        const querySnapshot = await getDocs(collection(db, "interventi"));
        const rawData = [];
        querySnapshot.forEach((doc) => {
            rawData.push({ fbId: doc.id, ...doc.data() });
        });

        // Ordina decrescente (più recenti prima)
        tuttiGliInterventi = rawData.sort((a, b) => b.startTime - a.startTime);
        applyFilters();
    } catch (e) {
        console.error("Errore download dati:", e);
        tableBody.innerHTML = `<tr><td colspan="8" style="color:red; text-align:center;">Errore di connessione a Firebase: ${e.message}</td></tr>`;
    }

    // Carica anche la sezione Non Eseguiti
    await loadNonEseguiti();
    
    // Auto trigger Mese in Corso al caricamento
    if (!window.filterAppliedOnce) {
        window.filterAppliedOnce = true;
        if(btnFilterMonth) btnFilterMonth.click();
    }
}

async function loadNonEseguiti() {
    try {
        // Al posto di usare una query() con where() che potrebbe richiedere un Indice Composto su Firestore,
        // scarichiamo semplicemente tutti i 'programmati' e filtriamo in locale per sicurezza e robustezza.
        const snap = await getDocs(collection(db, "programmati"));

        const data = [];
        snap.forEach(d => {
            const val = d.data();
            if (val.status === "justified_not_executed") {
                data.push({ fbId: d.id, ...val });
            }
        });

        tuttiGliInterventiProgrammati = data;
        renderNonEseguitiTable(data);
    } catch (e) {
        console.error("Errore fetch non eseguiti:", e);
        nonEseguitiTableBody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center;">Errore interno caricamento Non Eseguiti: ${e.message}</td></tr>`;
    }
}

function renderTable(dataArray) {
    if (dataArray.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center;">Nessun intervento trovato per i filtri selezionati.</td></tr>`;
        return;
    }

    tableBody.innerHTML = '';

    dataArray.forEach(inv => {
        const tr = document.createElement('tr');

        const dStart = new Date(inv.startTime);
        const dataStr = formatDateDMY(dStart);
        const timeStr = `${formatTime(inv.startTime)} - ${formatTime(inv.endTime)}`;

        let fileHtml = '<span style="color:#aaa;">-</span>';
        if (inv.fileUrl) {
            fileHtml = `<a href="${inv.fileUrl}" target="_blank" class="attachment-link">📎 Apri / Scarica</a>`;
        } else if (inv.fileUrls && inv.fileUrls.length > 0) {
            fileHtml = `<a href="${inv.fileUrls[0]}" target="_blank" class="attachment-link">📎 Apri / Scarica</a>`;
        } else if (inv.haAllegato) {
            fileHtml = `<span class="badge badge-warning">Caricamento fallito</span>`;
        }

        let adminActions = '';
        if (isAdminLogged) {
            adminActions = `
                <br>
                <div style="margin-top: 8px; display: flex; gap: 5px;">
                    <button class="btn btn-primary btn-sm btn-edit" data-fbid="${inv.fbId}" style="padding: 4px 8px; font-size: 0.75rem;"><span class="btn-icon">✏️</span> Edit</button>
                    <button class="btn btn-danger btn-sm btn-delete" data-fbid="${inv.fbId}" style="padding: 4px 8px; font-size: 0.75rem;"><span class="btn-icon">🗑️</span> Del</button>
                </div>
            `;
        }

        const badgeVal = (inv.operatoreValutazione || inv.esito || inv.statoValutazione) 
            ? `<div style="margin-top: 4px; display:inline-block; padding: 2px 6px; background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; border-radius: 4px; font-size: 0.75rem;">
                <strong>Valutazione:</strong> 
                ${inv.operatoreValutazione ? `Op: ${inv.operatoreValutazione}` : ''} 
                ${inv.esito ? `| Esito: ${inv.esito}` : ''}
                ${inv.statoValutazione ? `| Stato: ${inv.statoValutazione}` : ''}
               </div>` : '';

        tr.innerHTML = `
            <td style="text-align: center;"><input type="checkbox" class="int-checkbox" value="${inv.fbId}" style="transform: scale(1.3); cursor: pointer;"></td>
            <td><strong>${dataStr}</strong></td>
            <td>${timeStr}</td>
            <td>${inv.paziente}</td>
            <td>${inv.localita || inv.destinazione || "N/D"}</td>
            <td>${inv.indirizzo || ""} <br><small style="color:gray;">${inv.telefono || ""}</small></td>
            <td><span class="badge badge-success">${window.decodeCodeToLabel(inv.tipo, 'interventi')}</span><br><small style="color:gray;">${inv.note || ''}</small></td>
            <td>${window.decodeCodeToLabel(inv.dispositivi, 'dispositivi')}<br><small style="color:gray;">${inv.matricola ? 'SN: ' + inv.matricola : ''}</small><br>${badgeVal}</td>
            <td>${inv.kmPercorsi ? inv.kmPercorsi + ' km' : '-'}</td>
            <td>${fileHtml} ${adminActions}</td>
        `;

        if (isAdminLogged) {
            let deleteBtn = tr.querySelector('.btn-delete');
            if (deleteBtn) deleteBtn.addEventListener('click', async (e) => {
                if (!confirm(`Sicuro di voler eliminare definitivamente questo intervento?\n\nPaziente: ${inv.paziente}\nData: ${dataStr}\nLocalità: ${inv.localita || inv.destinazione || "N/D"}`)) return;
                const fbId = e.currentTarget.getAttribute('data-fbid');
                try {
                    await deleteDoc(doc(db, "interventi", fbId));
                    alert("Intervento eliminato.");
                    await loadData();
                } catch (err) { alert("Errore eliminazione: " + err.message); }
            });
            let editBtn = tr.querySelector('.btn-edit');
            if (editBtn) editBtn.addEventListener('click', (e) => {
                const fbId = e.currentTarget.getAttribute('data-fbid');
                const invToEdit = tuttiGliInterventi.find(i => i.fbId === fbId);
                if (invToEdit) openEditModal(invToEdit, false);
            });
        }

        tableBody.appendChild(tr);
    });
}

function renderNonEseguitiTable(dataArray) {
    if (dataArray.length === 0) {
        nonEseguitiTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color: #666;">🎉 Nessun intervento pendente da controllare.</td></tr>`;
        return;
    }

    nonEseguitiTableBody.innerHTML = '';

    dataArray.forEach(inv => {
        const tr = document.createElement('tr');

        let dateStr = inv.dataPrevista ? inv.dataPrevista.split('-').reverse().join('/') : 'N/D';

        const badgeVal = (inv.operatoreValutazione || inv.esito || inv.statoValutazione) 
            ? `<div style="margin-top: 4px; display:inline-block; padding: 2px 6px; background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; border-radius: 4px; font-size: 0.75rem;">
                <strong>Valutazione:</strong> 
                ${inv.operatoreValutazione ? `Op: ${inv.operatoreValutazione}` : ''} 
                ${inv.esito ? `| Esito: ${inv.esito}` : ''}
                ${inv.statoValutazione ? `| Stato: ${inv.statoValutazione}` : ''}
               </div>` : '';

        tr.innerHTML = `
            <td style="text-align: center;"><input type="checkbox" class="prog-checkbox" value="${inv.fbId}" style="transform: scale(1.3); cursor: pointer;"></td>
            <td><strong>${dateStr}</strong></td>
            <td style="font-weight: 600;">${inv.paziente}</td>
            <td>${inv.localita || inv.destinazione || "N/D"}</td>
            <td>${inv.indirizzo || ""} <br><small style="color:gray;">${inv.telefono || ""}</small></td>
            <td><span class="badge badge-warning">${window.decodeCodeToLabel(inv.tipo, 'interventi')}</span><br><small style="color:gray;">${window.decodeCodeToLabel(inv.dispositivi, 'dispositivi')} ${inv.matricola ? `(SN: ${inv.matricola})` : ''}</small><br>${badgeVal}</td>
            <td style="color:#b45309; font-weight:600; font-style: italic;">"${inv.motivazione || 'Nessuna'}"</td>
            <td>
                <button class="btn btn-primary btn-sm btn-chiudi" data-fbid="${inv.fbId}" style="background-color: var(--blue-dark); color: white; width: 100%; margin-bottom: 5px;">Archivia (Chiudi)</button>
                ${isAdminLogged ? `<button class="btn btn-danger btn-sm btn-delete-prog" data-fbid="${inv.fbId}" style="color: white; width: 100%;">Elimina</button>` : ''}
            </td>
        `;

        if (isAdminLogged) {
            let deleteProgBtn = tr.querySelector('.btn-delete-prog');
            if (deleteProgBtn) deleteProgBtn.addEventListener('click', async (e) => {
                if (!confirm("Sicuro di eliminare questo non eseguito?")) return;
                try {
                    await deleteDoc(doc(db, "programmati", e.currentTarget.getAttribute('data-fbid')));
                    await loadNonEseguiti();
                } catch (err) { alert(err.message); }
            });
        }

        tr.querySelector('.btn-chiudi').addEventListener('click', async (e) => {
            if (!confirm("Vuoi archiviare definitivamente questo intervento non eseguito? Scomparirà dalla lista dell'ufficio.")) return;
            const fbId = e.currentTarget.getAttribute('data-fbid');
            try {
                e.currentTarget.disabled = true;
                e.currentTarget.textContent = "Chiusura...";
                await updateDoc(doc(db, "programmati", fbId), { status: 'archived' });
                await loadNonEseguiti();
            } catch (err) {
                alert("Errore durante l'archiviazione: " + err.message);
                e.currentTarget.disabled = false;
                e.currentTarget.textContent = "Archivia (Chiudi)";
            }
        });

        nonEseguitiTableBody.appendChild(tr);
    });
}

// Filtri
function applyFilters() {
    let filtrati = [...tuttiGliInterventi];

    // Filtro Ricerca Testo (combinato)
    const searchVal = filterSearch.value.toLowerCase().trim();
    const quickSearchVal = quickSearchStorico ? quickSearchStorico.value.toLowerCase().trim() : "";
    const combinedSearch = searchVal || quickSearchVal;

    if (combinedSearch) {
        filtrati = filtrati.filter(i =>
            i.paziente.toLowerCase().includes(combinedSearch) ||
            (i.destinazione || "").toLowerCase().includes(combinedSearch) ||
            (i.localita || "").toLowerCase().includes(combinedSearch)
        );
    }

    // Filtro Date
    if (filterDateStart.value) {
        // start of that day
        const ds = new Date(filterDateStart.value).setHours(0, 0, 0, 0);
        filtrati = filtrati.filter(i => i.startTime >= ds);
        filtratiProgrammati = filtratiProgrammati.filter(i => {
            const dt = i.dataPrevista ? new Date(i.dataPrevista).setHours(0,0,0,0) : 0;
            return dt >= ds;
        });
    }
    if (filterDateEnd.value) {
        // end of that day
        const de = new Date(filterDateEnd.value).setHours(23, 59, 59, 999);
        filtrati = filtrati.filter(i => i.startTime <= de);
        filtratiProgrammati = filtratiProgrammati.filter(i => {
            const dt = i.dataPrevista ? new Date(i.dataPrevista).setHours(23,59,59,999) : 0;
            return dt <= de;
        });
    }

    renderTable(filtrati);
    renderNonEseguitiTable(filtratiProgrammati);
    
    // Se la sezione statistiche è aperta, renderizziamo i grafici
    if (adminStatsSection && !adminStatsSection.classList.contains('hidden')) {
        renderAdminCharts(filtrati, filtratiProgrammati);
    }
}

// -------------------------------------------------------------
// MOTORE RENDERING GRAFICI (CHART.JS)
// -------------------------------------------------------------
function renderAdminCharts(eseguiti, programmati) {
    if (typeof Chart === 'undefined') return;

    // Distrugge le vecchie istanze per evitare sovrapposizioni
    if (chartInstStato) chartInstStato.destroy();
    if (chartInstTecnici) chartInstTecnici.destroy();
    if (chartInstTrend) chartInstTrend.destroy();
    if (chartInstD3) chartInstD3.destroy();

    // COLORI
    const colors = {
        blue: '#3b82f6', green: '#10b981', orange: '#f59e0b', red: '#ef4444',
        purple: '#8b5cf6', teal: '#14b8a6', pink: '#ec4899'
    };
    const palette = Object.values(colors);

    // 1. STATO INTERVENTI (Pie)
    const ctxStato = document.getElementById('chartStatoInterventi');
    if (ctxStato) {
        chartInstStato = new Chart(ctxStato, {
            type: 'doughnut',
            data: {
                labels: ['Completati', 'Da Chiudere (Non Eseguiti)'],
                datasets: [{
                    data: [eseguiti.length, programmati.length],
                    backgroundColor: [colors.green, colors.orange],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // 2. INTERVENTI PER TECNICO (Bar)
    const ctxTecnici = document.getElementById('chartInterventiTecnici');
    if (ctxTecnici) {
        const counts = {};
        eseguiti.forEach(inv => {
            const t = inv.tecnico || 'Sconosciuto';
            counts[t] = (counts[t] || 0) + 1;
        });
        const labels = Object.keys(counts).sort((a,b) => counts[b] - counts[a]);
        const data = labels.map(l => counts[l]);

        chartInstTecnici = new Chart(ctxTecnici, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Interventi Eseguiti',
                    data: data,
                    backgroundColor: colors.blue,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });
    }

    // 3. TREND TEMPORALE ESEGUITI (Line)
    const ctxTrend = document.getElementById('chartTrendTemporale');
    if (ctxTrend) {
        const trendMap = {};
        eseguiti.forEach(inv => {
            const d = new Date(inv.startTime);
            const dateStr = formatDateDMY(d); // raggruppa giornalmente
            trendMap[dateStr] = (trendMap[dateStr] || 0) + 1;
        });
        // Ordina cronologicamente le date
        const sortedDates = Object.keys(trendMap).sort((a,b) => {
            const [da, ma, ya] = a.split('/');
            const [db, mb, yb] = b.split('/');
            return new Date(ya, ma-1, da) - new Date(yb, mb-1, db);
        });
        const data = sortedDates.map(l => trendMap[l]);

        chartInstTrend = new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: sortedDates,
                datasets: [{
                    label: 'Interventi Eseguiti',
                    data: data,
                    borderColor: colors.purple,
                    backgroundColor: 'rgba(139, 92, 246, 0.2)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // 4. MEDIA VALUTAZIONE D3 PER OPERATORE (Bar)
    const ctxD3 = document.getElementById('chartValutazioniD3');
    if (ctxD3) {
        const d3Map = {}; // { 'Mario': { sum: 10, count: 2 } }
        eseguiti.forEach(inv => {
            if (inv.operatoreValutazione && inv.esito) {
                const punteggio = parseFloat(inv.esito.replace(',','.').replace(/[^\d.-]/g, ''));
                if (!isNaN(punteggio)) {
                    if (!d3Map[inv.operatoreValutazione]) d3Map[inv.operatoreValutazione] = { sum: 0, count: 0 };
                    d3Map[inv.operatoreValutazione].sum += punteggio;
                    d3Map[inv.operatoreValutazione].count += 1;
                }
            }
        });
        
        const labels = Object.keys(d3Map);
        const data = labels.map(l => (d3Map[l].sum / d3Map[l].count).toFixed(2));

        chartInstD3 = new Chart(ctxD3, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Punteggio Medio',
                    data: data,
                    backgroundColor: colors.teal,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }
}

// Export
function esporterCSV() {
    let currentData = [...tuttiGliInterventi]; // idealmente si espostano quelli filtrati, li ricalcoliamo
    // Riapplichiamo la logica di filtering base
    const searchVal = filterSearch.value.toLowerCase().trim();
    if (searchVal) {
        currentData = currentData.filter(i =>
            i.paziente.toLowerCase().includes(searchVal) ||
            i.destinazione.toLowerCase().includes(searchVal)
        );
    }
    if (filterDateStart.value) {
        const ds = new Date(filterDateStart.value).setHours(0, 0, 0, 0);
        currentData = currentData.filter(i => i.startTime >= ds);
    }
    if (filterDateEnd.value) {
        const de = new Date(filterDateEnd.value).setHours(23, 59, 59, 999);
        currentData = currentData.filter(i => i.startTime <= de);
    }

    if (currentData.length === 0) {
        return alert("Nessun dato da esportare con questi filtri.");
    }

    let header = ["Data", "Orario Inizio", "Orario Fine", "Paziente / Ente", "Localita", "Indirizzo", "Telefono", "Tipo Intervento", "Dispositivi", "Matricola", "Km Extra", "Note", "Link Allegato"];
    let csvContent = header.join(";") + "\n";

    currentData.forEach(inv => {
        let loc = inv.localita || inv.destinazione || "";
        let ind = inv.indirizzo || "";

        let rs = [
            `"${formatDateDMY(new Date(inv.startTime))}"`, `"${formatTime(inv.startTime)}"`, `"${formatTime(inv.endTime)}"`,
            `"${inv.paziente.replace(/"/g, '""')}"`, `"${loc.replace(/"/g, '""')}"`, `"${ind.replace(/"/g, '""')}"`, `"${inv.telefono || ""}"`,
            `"${window.decodeCodeToLabel(inv.tipo, 'interventi')}"`, `"${window.decodeCodeToLabel(inv.dispositivi, 'dispositivi').replace(/"/g, '""')}"`, `"${inv.matricola ? inv.matricola.replace(/"/g, '""') : ''}"`, `"${inv.kmPercorsi}"`,
            `"${inv.note ? inv.note.replace(/"/g, '""') : ''}"`, `"${inv.fileUrl || ''}"`
        ];
        csvContent += rs.join(";") + "\n";
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Estrazione_Archivio_Interventi.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// Global modal handlers
const editInterventionModal = document.getElementById('editInterventionModal');
const btnCancelEdit = document.getElementById('btnCancelEdit');
const btnSaveEdit = document.getElementById('btnSaveEdit');

function openEditModal(inv, isProgrammato) {
    document.getElementById('editFbId').value = inv.fbId;
    document.getElementById('editIsProgrammato').value = isProgrammato;
    document.getElementById('editPaziente').value = inv.paziente || "";
    document.getElementById('editLocalita').value = inv.localita || inv.destinazione || "";
    document.getElementById('editIndirizzo').value = inv.indirizzo || "";
    document.getElementById('editTelefono').value = inv.telefono || "";
    document.getElementById('editTipo').value = inv.tipo || "";
    document.getElementById('editDispositivi').value = inv.dispositivi || "";
    document.getElementById('editKm').value = inv.kmPercorsi || "0";
    document.getElementById('editNote').value = inv.note || "";
    
    let opSel = document.getElementById('editOperatoreValutazione');
    if(opSel) {
        opSel.innerHTML = '<option value="">Nessuno</option>' + (window.operatoriSanitari || []).map(o => `<option value="${o.nome}">${o.nome}</option>`).join('');
        opSel.value = inv.operatoreValutazione || "";
    }
    document.getElementById('editEsito').value = inv.esito || "";
    document.getElementById('editStatoValutazione').value = inv.statoValutazione || "";

    if (isProgrammato) document.getElementById('containerKm').style.display = 'none';
    else document.getElementById('containerKm').style.display = 'block';

    editInterventionModal.classList.remove('hidden');
}

if (btnCancelEdit) btnCancelEdit.addEventListener('click', () => editInterventionModal.classList.add('hidden'));

if (btnSaveEdit) btnSaveEdit.addEventListener('click', async () => {
    const fbId = document.getElementById('editFbId').value;
    const isProg = document.getElementById('editIsProgrammato').value === 'true';
    const coll = isProg ? 'programmati' : 'interventi';

    try {
        btnSaveEdit.textContent = "Salvataggio...";
        btnSaveEdit.disabled = true;
        await updateDoc(doc(db, coll, fbId), {
            paziente: document.getElementById('editPaziente').value,
            localita: document.getElementById('editLocalita').value,
            indirizzo: document.getElementById('editIndirizzo').value,
            telefono: document.getElementById('editTelefono').value,
            tipo: document.getElementById('editTipo').value,
            dispositivi: document.getElementById('editDispositivi').value,
            kmPercorsi: document.getElementById('editKm').value,
            operatoreValutazione: document.getElementById('editOperatoreValutazione').value,
            esito: document.getElementById('editEsito').value,
            statoValutazione: document.getElementById('editStatoValutazione').value,
            note: document.getElementById('editNote').value
        });
        editInterventionModal.classList.add('hidden');
        await loadData();
    } catch (err) {
        alert("Errore salvataggio modifiche: " + err.message);
    } finally {
        btnSaveEdit.textContent = "SALVA MODIFICHE";
        btnSaveEdit.disabled = false;
    }
});

btnApplyFilters.addEventListener('click', () => {
    quickFilters.forEach(b => { b.classList.remove('btn-orange'); b.classList.add('btn-secondary'); }); // Reset stile bottoni rapidi se si cerca manuale
    applyFilters();
    if (storicoWrapper && storicoWrapper.classList.contains('hidden')) {
        storicoWrapper.classList.remove('hidden');
        if(storicoToggleIcon) storicoToggleIcon.textContent = "Chiudi Storico ⬆️";
    }
});

btnResetFilters.addEventListener('click', () => {
    filterDateStart.value = '';
    filterDateEnd.value = '';
    filterSearch.value = '';
    quickFilters.forEach(b => { b.classList.remove('btn-orange'); b.classList.add('btn-secondary'); });
    renderTable(tuttiGliInterventi);
    // Auto Collapse quando si fa Reset
    if (storicoWrapper && !storicoWrapper.classList.contains('hidden')) {
        storicoWrapper.classList.add('hidden');
        if(storicoToggleIcon) storicoToggleIcon.textContent = "Apri Storico ⬇️";
    }
});
btnExportExcel.addEventListener('click', esporterCSV);

if (toggleStoricoHeader) {
    toggleStoricoHeader.addEventListener('click', (e) => {
        // Se ho cliccato proprio sul bottone filtri, ignoro l'apertura intera
        if (e.target.closest('#btnToggleFilters')) return;
        
        storicoWrapper.classList.toggle('hidden');
        if (storicoWrapper.classList.contains('hidden')) {
            storicoToggleIcon.textContent = "Apri Storico ⬇️";
        } else {
            storicoToggleIcon.textContent = "Chiudi Storico ⬆️";
        }
    });
}

if (btnToggleFilters) {
    btnToggleFilters.addEventListener('click', (e) => {
        if(filtersWrapper) filtersWrapper.classList.toggle('hidden');
    });
}

quickFilters.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const range = e.currentTarget.getAttribute('data-range');
        const today = new Date();
        const pdZ = n => n.toString().padStart(2, '0');
        const formatD = d => `${d.getFullYear()}-${pdZ(d.getMonth() + 1)}-${pdZ(d.getDate())}`; // "YYYY-MM-DD" per l'input date
        
        let startD, endD;
        endD = formatD(today); // quasi tutti finiscono oggi a parte 'last_month'

        if (range === 'week') {
            let s = new Date(today);
            s.setDate(s.getDate() - 7);
            startD = formatD(s);
        } else if (range === 'month') {
            let s = new Date(today.getFullYear(), today.getMonth(), 1);
            startD = formatD(s);
        } else if (range === 'last_month') {
            let s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            let eD = new Date(today.getFullYear(), today.getMonth(), 0); // last day of prev month
            startD = formatD(s);
            endD = formatD(eD);
        } else if (range === 'trim') {
            let currentMonth = today.getMonth();
            let startMonth = currentMonth - (currentMonth % 3);
            let s = new Date(today.getFullYear(), startMonth, 1);
            startD = formatD(s);
        } else if (range === 'year') {
            let s = new Date(today.getFullYear(), 0, 1);
            startD = formatD(s);
        }
        
        filterDateStart.value = startD;
        filterDateEnd.value = endD;
        
        quickFilters.forEach(b => {
             b.classList.remove('btn-orange'); 
             b.classList.add('btn-secondary'); 
             b.style.color = "";
        });
        e.currentTarget.classList.remove('btn-secondary');
        e.currentTarget.classList.add('btn-orange');
        e.currentTarget.style.color = "white";

        applyFilters();
        
        if (storicoWrapper && storicoWrapper.classList.contains('hidden')) {
            storicoWrapper.classList.remove('hidden');
            if(storicoToggleIcon) storicoToggleIcon.textContent = "Chiudi Storico ⬆️";
        }
    });
});

if (btnManualSync) {
    btnManualSync.addEventListener('click', async () => {
        const oldText = btnManualSync.innerHTML;
        try {
            btnManualSync.innerHTML = "🔄 Sincronizzazione in corso...";
            btnManualSync.disabled = true;
            await loadData();
            alert("Dati sincronizzati con successo dal Cloud!");
        } catch (e) {
            alert("Errore di sincronizzazione: " + e.message);
        } finally {
            btnManualSync.innerHTML = oldText;
            btnManualSync.disabled = false;
        }
    });
}

// Inizializza caricando i dati al boot
loadData();

// ==========================================
// SELEZIONE MULTIPLA E CANCELLAZIONE DI MASSA
// ==========================================
const selectAllStorico = document.getElementById('selectAllStorico');
const selectAllNonEseguiti = document.getElementById('selectAllNonEseguiti');
const btnMassDeleteStorico = document.getElementById('btnMassDeleteStorico');
const btnMassDeleteNonEseguiti = document.getElementById('btnMassDeleteNonEseguiti');
const countStorico = document.getElementById('countStorico');
const countNonEseguiti = document.getElementById('countNonEseguiti');

// Funzione Helper per aggiornare i contatori e pulsanti
function updateMassDeleteUI() {
    const checkedStorico = document.querySelectorAll('.int-checkbox:checked');
    const checkedNonEsg = document.querySelectorAll('.prog-checkbox:checked');
    
    if(checkedStorico.length > 0) {
        btnMassDeleteStorico.classList.remove('hidden');
        countStorico.innerText = checkedStorico.length;
    } else {
        btnMassDeleteStorico.classList.add('hidden');
    }
    
    if(checkedNonEsg.length > 0) {
        btnMassDeleteNonEseguiti.classList.remove('hidden');
        countNonEseguiti.innerText = checkedNonEsg.length;
    } else {
        btnMassDeleteNonEseguiti.classList.add('hidden');
    }
}

// Event Delegation per Checkbox individuali
if(tableBody) {
    tableBody.addEventListener('change', (e) => {
        if(e.target.classList.contains('int-checkbox')) updateMassDeleteUI();
    });
}
if(nonEseguitiTableBody) {
    nonEseguitiTableBody.addEventListener('change', (e) => {
        if(e.target.classList.contains('prog-checkbox')) updateMassDeleteUI();
    });
}

// Master Checkboxes (Seleziona Tutti)
if(selectAllStorico) {
    selectAllStorico.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        document.querySelectorAll('.int-checkbox').forEach(cb => { cb.checked = isChecked; });
        updateMassDeleteUI();
    });
}
if(selectAllNonEseguiti) {
    selectAllNonEseguiti.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        document.querySelectorAll('.prog-checkbox').forEach(cb => { cb.checked = isChecked; });
        updateMassDeleteUI();
    });
}

// Pulsanti Cancellazione Massiva
if(btnMassDeleteStorico) {
    btnMassDeleteStorico.addEventListener('click', async () => {
        const checkedBoxes = Array.from(document.querySelectorAll('.int-checkbox:checked'));
        if(checkedBoxes.length === 0) return;
        
        if(!confirm(`Sei assolutamente sicuro di voler eliminare DEFINITIVAMENTE ${checkedBoxes.length} interventi eseguiti? Questa azione è irreversibile.`)) return;
        
        btnMassDeleteStorico.disabled = true;
        btnMassDeleteStorico.innerText = "Cancellazione in corso...";
        
        try {
            for(let box of checkedBoxes) {
                await deleteDoc(doc(db, "interventi", box.value));
            }
            alert(`Eliminazione di ${checkedBoxes.length} interventi completata.`);
            if(selectAllStorico) selectAllStorico.checked = false;
            btnMassDeleteStorico.classList.add('hidden');
            await loadData();
        } catch(e) {
            alert("Errore durante l'eliminazione multipla: " + e.message);
        } finally {
            btnMassDeleteStorico.disabled = false;
            btnMassDeleteStorico.innerHTML = `🗑️ Elimina Selezionati (<span id="countStorico">0</span>)`;
        }
    });
}

if(btnMassDeleteNonEseguiti) {
    btnMassDeleteNonEseguiti.addEventListener('click', async () => {
        const checkedBoxes = Array.from(document.querySelectorAll('.prog-checkbox:checked'));
        if(checkedBoxes.length === 0) return;
        
        if(!confirm(`Sei sicuro di voler eliminare definitivamente ${checkedBoxes.length} interventi pendenti/non eseguiti?`)) return;
        
        btnMassDeleteNonEseguiti.disabled = true;
        btnMassDeleteNonEseguiti.innerText = "Cancellazione in corso...";
        
        try {
            for(let box of checkedBoxes) {
                await deleteDoc(doc(db, "programmati", box.value));
            }
            alert(`Eliminazione di ${checkedBoxes.length} pianificazioni pendenti completata.`);
            if(selectAllNonEseguiti) selectAllNonEseguiti.checked = false;
            btnMassDeleteNonEseguiti.classList.add('hidden');
            await loadNonEseguiti();
        } catch(e) {
            alert("Errore durante l'eliminazione multipla: " + e.message);
        } finally {
            btnMassDeleteNonEseguiti.disabled = false;
            btnMassDeleteNonEseguiti.innerHTML = `🗑️ Elimina Selezionati (<span id="countNonEseguiti">0</span>)`;
        }
    });
}
