import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
let isAdminLogged = false;

// DOM Auth
const btnLoginAdmin = document.getElementById('btnLoginAdmin');

onAuthStateChanged(auth, (user) => {
    if (user && user.email === 'giuseppedisorbo@gmail.com') {
        isAdminLogged = true;
        if (btnLoginAdmin) {
            btnLoginAdmin.textContent = "👤 Ciao Giuseppe (Esci)";
            btnLoginAdmin.style.backgroundColor = "var(--red)";
            btnLoginAdmin.style.color = "white";
        }
    } else {
        isAdminLogged = false;
        if (btnLoginAdmin) {
            btnLoginAdmin.textContent = "👤 Login Admin";
            btnLoginAdmin.style.backgroundColor = "var(--blue-dark)";
            btnLoginAdmin.style.color = "white";
        }
        if (user) {
            alert("Accesso negato. Solo l'amministratore può modificare lo storico.");
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

let tuttiGliInterventi = [];

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
        const querySnapshot = await getDocs(collection(db, "interventi"));
        const rawData = [];
        querySnapshot.forEach((doc) => {
            rawData.push({ fbId: doc.id, ...doc.data() });
        });

        // Ordina decrescente (più recenti prima)
        tuttiGliInterventi = rawData.sort((a, b) => b.startTime - a.startTime);
        renderTable(tuttiGliInterventi);
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

        renderNonEseguitiTable(data);
    } catch (e) {
        console.error("Errore fetch non eseguiti:", e);
        nonEseguitiTableBody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center;">Errore interno caricamento Non Eseguiti: ${e.message}</td></tr>`;
    }
}

function renderTable(dataArray) {
    if (dataArray.length === 0) {
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

        tr.innerHTML = `
            <td><strong>${dataStr}</strong></td>
            <td>${timeStr}</td>
            <td>${inv.paziente}</td>
            <td>${inv.localita || inv.destinazione || "N/D"}</td>
            <td>${inv.indirizzo || ""} <br><small style="color:gray;">${inv.telefono || ""}</small></td>
            <td><span class="badge badge-success">${inv.tipo}</span><br><small style="color:gray;">${inv.note || ''}</small></td>
            <td>${inv.dispositivi}<br><small style="color:gray;">${inv.matricola ? 'SN: ' + inv.matricola : ''}</small></td>
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
            <td>${inv.localita || inv.destinazione || "N/D"}</td>
            <td>${inv.indirizzo || ""} <br><small style="color:gray;">${inv.telefono || ""}</small></td>
            <td><span class="badge badge-warning">${inv.tipo}</span><br><small style="color:gray;">${inv.dispositivi} ${inv.matricola ? `(SN: ${inv.matricola})` : ''}</small></td>
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

    // Filtro Ricerca Testo
    const searchVal = filterSearch.value.toLowerCase().trim();
    if (searchVal) {
        filtrati = filtrati.filter(i =>
            i.paziente.toLowerCase().includes(searchVal) ||
            (i.destinazione || "").toLowerCase().includes(searchVal) ||
            (i.localita || "").toLowerCase().includes(searchVal)
        );
    }

    // Filtro Date
    if (filterDateStart.value) {
        // start of that day
        const ds = new Date(filterDateStart.value).setHours(0, 0, 0, 0);
        filtrati = filtrati.filter(i => i.startTime >= ds);
    }
    if (filterDateEnd.value) {
        // end of that day
        const de = new Date(filterDateEnd.value).setHours(23, 59, 59, 999);
        filtrati = filtrati.filter(i => i.startTime <= de);
    }

    renderTable(filtrati);
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
            `"${inv.tipo}"`, `"${inv.dispositivi.replace(/"/g, '""')}"`, `"${inv.matricola ? inv.matricola.replace(/"/g, '""') : ''}"`, `"${inv.kmPercorsi}"`,
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
