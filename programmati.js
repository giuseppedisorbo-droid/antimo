import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, serverTimestamp, query, where, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ====== CONFIGURAZIONE FIREBASE ======
const firebaseConfig = {
    apiKey: "AIzaSyB6CLQZHPG60LqsIKHAlS_Wt5OFXqfwqkw",
    authDomain: "antimo-6a86b.firebaseapp.com",
    projectId: "antimo-6a86b",
    storageBucket: "antimo-6a86b.firebasestorage.app",
    messagingSenderId: "671676764068",
    appId: "1:671676764068:web:95027e0babe3f30042fb31"
};

let app, db;
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("Firebase Inizializzato in Programmati.");
} catch(e) {
    console.error("Errore inizializzazione Firebase", e);
    alert("Errore collegamento al Cloud. Controllare la rete.");
}

// Stato Globale
let plannedInterventions = [];
let waitingInterventions = [];
let calendar;

// DOM
const form = document.querySelector('form');
const iPaziente = document.getElementById('paziente');
const iLocalita = document.getElementById('localita');
const iIndirizzo = document.getElementById('indirizzo');
const iTelefono = document.getElementById('telefono');
const iTipoAttivita = document.getElementById('tipoAttivita');
const iData = document.getElementById('dataProgrammata');
const iDispositivi = document.getElementById('dispositivi');
const tableBody = document.getElementById('programmatiTableBody');
const calendarEl = document.getElementById('calendar');

const btnSaveWaiting = document.getElementById('btnSaveWaiting');
const btnToggleWaiting = document.getElementById('btnToggleWaiting');
const waitingContainer = document.getElementById('waitingContainer');
const waitingTableBody = document.getElementById('waitingTableBody');

// Format
function padZ(num) { return num.toString().padStart(2, '0'); }

async function fetchProgrammati() {
    if(!db) return;
    try {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;"><span class="btn-icon">⏳</span> Sincronizzazione con il Cloud in corso...</td></tr>';
        
        const snap = await getDocs(collection(db, "programmati"));
        const cloudPlanned = [];
        const cloudWaiting = [];
        snap.forEach(doc => {
            const data = doc.data();
            // Consideriamo da mostrare quelli planned o vecchi senza stato
            if (!data.status || data.status === 'planned') {
                if (data.dataPrevista) {
                    cloudPlanned.push({ idFb: doc.id, ...data });
                } else {
                    cloudWaiting.push({ idFb: doc.id, ...data });
                }
            } else if (data.status === 'in_attesa') {
                cloudWaiting.push({ idFb: doc.id, ...data });
            }
        });

        // Ordinamento per data crescente (i più vicini prima)
        cloudPlanned.sort((a,b) => {
            const da = a.dataPrevista ? new Date(a.dataPrevista).getTime() : 0;
            const db = b.dataPrevista ? new Date(b.dataPrevista).getTime() : 0;
            return da - db;
        });

        plannedInterventions = cloudPlanned;
        waitingInterventions = cloudWaiting;
        
        // Salvataggio nel fallback locale che usa app.js
        localStorage.setItem('antimo_plannedInterventions', JSON.stringify(plannedInterventions));
        
        renderTutto();
        
    } catch(e) {
        console.error("Errore fetch", e);
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: red;">Errore nel caricamento dal Cloud.</td></tr>';
    }
}

function renderTutto() {
    renderTable();
    renderWaitingTable();
    renderCalendar();
}

function renderWaitingTable() {
    waitingTableBody.innerHTML = '';
    
    if(waitingInterventions.length === 0) {
        waitingTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px;">Nessun intervento in attesa.</td></tr>';
        return;
    }

    waitingInterventions.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: bold;">${p.paziente}</td>
            <td>${p.localita || p.destinazione || 'N/D'}</td>
            <td>${p.indirizzo || ''} <br><small style="color:gray;">${p.telefono || ''}</small></td>
            <td>
                <div style="display: flex; gap: 5px;">
                    <input type="date" id="date_${p.idFb}" style="padding: 5px; border-radius: 6px; border: 1px solid #ccc;">
                    <button class="btn btn-primary btn-sm" onclick="programmaAttesa('${p.idFb}')" style="padding: 5px 10px; font-size: 0.8rem; width: auto; text-transform: none;">Assegna</button>
                </div>
            </td>
        `;
        waitingTableBody.appendChild(tr);
    });
}

function renderTable() {
    tableBody.innerHTML = '';
    
    if(plannedInterventions.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Nessun intervento programmato.</td></tr>';
        return;
    }

    plannedInterventions.forEach(p => {
        const tr = document.createElement('tr');
        
        const dateStr = p.dataPrevista ? p.dataPrevista.split('-').reverse().join('/') : 'N/D';
        const notes = p.dispositivi || p.note || '';

        tr.innerHTML = `
            <td style="font-weight: 600; color: var(--blue-primary);">${dateStr}</td>
            <td style="font-weight: bold;">${p.paziente}</td>
            <td>${p.localita || p.destinazione || 'N/D'}</td>
            <td>${p.indirizzo || ''} <br><small style="color:gray;">${p.telefono || ''}</small></td>
            <td><span class="status-badge" style="background-color: #f1f5f9; color: var(--text-main); font-size: 0.8rem; padding: 4px 8px;">${p.tipo || 'Non spec.'}</span></td>
            <td style="font-size: 0.85rem; color: #555;">${notes}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="editProgrammato('${p.idFb}')" style="padding: 4px 8px; font-size: 0.8rem; text-transform: none; margin-bottom: 4px; width:100%; border-radius: 6px;">Modifica</button>
                <button class="btn btn-danger btn-sm" onclick="deleteProgrammato('${p.idFb}')" style="padding: 4px 8px; font-size: 0.8rem; text-transform: none; width:100%; border-radius: 6px;">Elimina</button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

function renderCalendar() {
    if(!calendar) {
        // Init FullCalendar
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'it',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listDay'
            },
            buttonText: {
                today: 'Oggi',
                year: 'Anno',
                month: 'Mese',
                week: 'Settimana',
                day: 'Giorno',
                list: 'Lista'
            },
            firstDay: 1, // Lunedì
            navLinks: true, 
            navLinkDayClick: 'listDay',
            events: [],
            dateClick: function(info) {
                calendar.changeView('listDay', info.dateStr);
            },
            eventClick: function(info) {
                // Se si vuole gestire il click sull\'evento in futuro
                alert('Paziente: ' + info.event.title + '\nLocalità: ' + (info.event.extendedProps.localita || info.event.extendedProps.destinazione) + '\nIndirizzo: ' + (info.event.extendedProps.indirizzo || '') + '\nTel: ' + (info.event.extendedProps.telefono || '') + '\nDispositivi: ' + info.event.extendedProps.dispositivi);
            }
        });
        calendar.render();
    }
    
    // Pulisci vecchi eventi
    calendar.removeAllEvents();
    
    // Aggiungi nuovi da plannedInterventions
    plannedInterventions.forEach(p => {
        if(p.dataPrevista) {
            calendar.addEvent({
                title: p.paziente + ' (' + (p.tipo || 'N/D') + ')',
                start: p.dataPrevista,
                allDay: true,
                backgroundColor: '#ea580c',
                borderColor: '#ea580c',
                extendedProps: {
                    destinazione: p.destinazione,
                    localita: p.localita,
                    indirizzo: p.indirizzo,
                    telefono: p.telefono,
                    dispositivi: p.dispositivi || p.note || ''
                }
            });
        }
    });
}

// --- LOGICA BLOCCHI DINAMICI ---
function createInterventionBlockHTML() {
    const types = ['Visita', 'Sostituzione', 'Ritiro', 'Consegna', 'Manutenzione', 'Installazione', 'Riparazione'];
    const devices = ['Concentratore', 'Ventilatore', 'Aspiratore', 'D3', 'Stativo', 'Cpap', 'AutoCpap', 'Saturimetro'];
    
    let typeOptions = types.map(t => `<option value="${t}">${t}</option>`).join('');
    let devOptions = devices.map(d => `<option value="${d}">${d}</option>`).join('');
    
    return `
        <div class="dynamic-intervention-block" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin-bottom: 15px; background: #f8fafc; position: relative;">
            <button type="button" class="btn-remove-block" style="position: absolute; top: -10px; right: -10px; background: #ef4444; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">×</button>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <div class="form-group" style="flex: 1; min-width: 120px; margin-bottom: 8px;">
                    <label style="font-size: 0.8rem; color: #475569;">Tipo Intervento *</label>
                    <select class="block-tipo" required style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.95rem; background: white;">
                        <option value="">Seleziona...</option>
                        ${typeOptions}
                        <option value="Altro">Altro...</option>
                    </select>
                </div>
                <div class="form-group" style="flex: 1; min-width: 120px; margin-bottom: 8px;">
                    <label style="font-size: 0.8rem; color: #475569;">Dispositivo</label>
                    <select class="block-disp" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.95rem; background: white;">
                        <option value="">Nessuno</option>
                        ${devOptions}
                        <option value="Altro">Altro...</option>
                    </select>
                </div>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 0.8rem; color: #475569;">Matricola / Note Extra</label>
                <input type="text" class="block-mat" placeholder="Es. SN123456" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.95rem; background: white;">
            </div>
        </div>
    `;
}

function initDynamicBlocks(containerId, addBtnId) {
    const container = document.getElementById(containerId);
    const btnAdd = document.getElementById(addBtnId);
    
    if(!container || !btnAdd) return;

    const addBlock = (data = null) => {
        const div = document.createElement('div');
        div.innerHTML = createInterventionBlockHTML();
        const block = div.firstElementChild;
        
        block.querySelector('.btn-remove-block').addEventListener('click', () => {
            if(container.children.length > 1) { 
                block.remove();
            } else {
                alert("Devi mantenere almeno un blocco intervento.");
            }
        });

        if(data) {
            block.querySelector('.block-tipo').value = data.tipo || "";
            let dispSelect = block.querySelector('.block-disp');
            let dispMatched = Array.from(dispSelect.options).some(o => o.value === data.disp);
            if(data.disp && !dispMatched) {
                const opt = document.createElement('option');
                opt.value = data.disp;
                opt.textContent = data.disp;
                dispSelect.insertBefore(opt, dispSelect.querySelector('option[value="Altro"]'));
            }
            dispSelect.value = data.disp || "";
            block.querySelector('.block-mat').value = data.mat || "";
        }
        
        container.appendChild(block);
    };

    container.innerHTML = '';
    addBlock();

    btnAdd.addEventListener('click', () => addBlock());
}

setTimeout(() => {
    initDynamicBlocks('dynamicProgInterventionsContainer', 'btnAddProgInterventionBlock');
}, 100);

function extractDynamicBlocksData(containerId) {
    const container = document.getElementById(containerId);
    if(!container) return { array: [], tipoStr: "", dispStr: "", matStr: "" };
    
    let blocks = [];
    container.querySelectorAll('.dynamic-intervention-block').forEach(b => {
        let t = b.querySelector('.block-tipo').value.trim();
        let d = b.querySelector('.block-disp').value.trim();
        let m = b.querySelector('.block-mat').value.trim();
        if(t || d || m) blocks.push({ tipo: t, disp: d, mat: m });
    });
    
    return {
        array: blocks,
        tipoStr: blocks.map(b => b.tipo).filter(x=>x).join(', '),
        dispStr: blocks.map(b => b.disp).filter(x=>x).join(', '),
        matStr: blocks.map(b => b.mat).filter(x=>x).join(', ')
    };
}
// --- FINE LOGICA BLOCCHI DINAMICI ---

// Submit Nuovo Programmazione
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const blocksData = extractDynamicBlocksData('dynamicProgInterventionsContainer');

    if(!blocksData.tipoStr || !iPaziente.value || !iLocalita.value || !iIndirizzo.value || !iData.value) {
        return alert("Compila Tipo Intervento, Paziente, Località, Indirizzo e Data per PROGRAMMARE! Altrimenti salva in attesa.");
    }

    const btn = document.getElementById('btnPlanIntervention');
    const oldHtml = btn.innerHTML;
    btn.innerHTML = `<span class="btn-icon">⏳</span> SALVATAGGIO...`;
    btn.disabled = true;

    const plannedId = "plan_" + Date.now().toString();
    const planned = {
        id: plannedId,
        tipo: blocksData.tipoStr,
        paziente: iPaziente.value,
        localita: iLocalita.value,
        indirizzo: iIndirizzo.value,
        telefono: iTelefono ? iTelefono.value : "",
        dispositivi: blocksData.dispStr,
        matricola: blocksData.matStr,
        interventiList: blocksData.array,
        dataPrevista: iData.value,
        oraPrevista: document.getElementById('oraProgrammata') ? document.getElementById('oraProgrammata').value : "",
        status: 'planned',
        timestamp: new Date().getTime()
    };

    try {
        if (db) {
            await addDoc(collection(db, "programmati"), planned);
            console.log("Programmato salvato su Cloud");
        }
        
        // Pulisci
        form.reset();
        
        // Per riaprire sul mese giusto
        if(calendar) {
            calendar.gotoDate(planned.dataPrevista);
        }

        // Ricarichiamo da Firebase per esser sincroni
        await fetchProgrammati();
        
    } catch(err) {
        console.error("Errore salvataggio programmato in Cloud", err);
        alert("Errore salvataggio nel Cloud.");
    } finally {
        btn.innerHTML = oldHtml;
        btn.disabled = false;
    }
});

// Toggle Waiting Container
btnToggleWaiting.addEventListener('click', () => {
    waitingContainer.classList.toggle('hidden');
});

// Submit Nuovo "In Attesa"
btnSaveWaiting.addEventListener('click', async () => {
    const blocksData = extractDynamicBlocksData('dynamicProgInterventionsContainer');

    if(!iPaziente.value || !iLocalita.value || !iIndirizzo.value) {
        return alert("Compila Paziente, Località e Indirizzo per salvare l'intervento in attesa!");
    }

    const oldHtml = btnSaveWaiting.innerHTML;
    btnSaveWaiting.innerHTML = `<span class="btn-icon">⏳</span> SALVATAGGIO...`;
    btnSaveWaiting.disabled = true;

    const plannedId = "plan_" + Date.now().toString();
    const waitingEvent = {
        id: plannedId,
        tipo: blocksData.tipoStr || "",
        paziente: iPaziente.value,
        localita: iLocalita.value,
        indirizzo: iIndirizzo.value,
        telefono: iTelefono ? iTelefono.value : "",
        dispositivi: blocksData.dispStr || "",
        matricola: blocksData.matStr || "",
        interventiList: blocksData.array,
        dataPrevista: "",
        oraPrevista: "",
        status: 'in_attesa',
        timestamp: new Date().getTime()
    };

    try {
        if (db) {
            await addDoc(collection(db, "programmati"), waitingEvent);
        }
        form.reset();
        await fetchProgrammati();
        waitingContainer.classList.remove('hidden'); // Apriamo per mostrare che è entrato in lista
    } catch(err) {
        console.error("Errore salvataggio in attesa", err);
        alert("Errore salvataggio nel Cloud.");
    } finally {
        btnSaveWaiting.innerHTML = oldHtml;
        btnSaveWaiting.disabled = false;
    }
});

window.programmaAttesa = async function(idFb) {
    const dateInput = document.getElementById('date_' + idFb);
    const newDate = dateInput.value;
    if(!newDate) {
        return alert('Seleziona una data per assegnare l\'intervento!');
    }
    
    try {
        const docRef = doc(db, 'programmati', idFb);
        await updateDoc(docRef, {
            dataPrevista: newDate,
            status: 'planned'
        });
        await fetchProgrammati(); // ricarica tutto e aggiorna calendario / tabella
    } catch(e) {
        console.error("Errore aggiornamento data", e);
        alert('Errore di connessione o permessi aggiornando la data.');
    }
};

window.deleteProgrammato = async function(idFb) {
    const p = plannedInterventions.find(x => x.idFb === idFb);
    if(!p) return;
    if(!confirm(`Sicuro di voler eliminare questa programmazione?\n\nPaziente: ${p.paziente}\nLocalità: ${p.localita||p.destinazione||''}`)) return;
    try {
        await deleteDoc(doc(db, "programmati", idFb));
        await fetchProgrammati();
    } catch(e) { alert(e.message); }
};

window.editProgrammato = function(idFb) {
    const p = plannedInterventions.find(x => x.idFb === idFb);
    if(!p) return;
    
    document.getElementById('editProgFbId').value = idFb;
    document.getElementById('editProgPaziente').value = p.paziente || "";
    document.getElementById('editProgLocalita').value = p.localita || p.destinazione || "";
    document.getElementById('editProgIndirizzo').value = p.indirizzo || "";
    document.getElementById('editProgTelefono').value = p.telefono || "";
    document.getElementById('editProgTipo').value = p.tipo || "";
    document.getElementById('editProgDispositivi').value = p.dispositivi || p.note || "";
    document.getElementById('editProgMatricola').value = p.matricola || "";
    document.getElementById('editProgData').value = p.dataPrevista || "";
    document.getElementById('editProgOra').value = p.oraPrevista || "";
    
    document.getElementById('editProgrammatoModal').classList.remove('hidden');
};

document.addEventListener('DOMContentLoaded', () => {
    // Gestione Modal
    const modal = document.getElementById('editProgrammatoModal');
    const btnCancel = document.getElementById('btnCancelEditProg');
    const btnSave = document.getElementById('btnSaveEditProg');
    
    if (btnCancel) btnCancel.addEventListener('click', () => modal.classList.add('hidden'));
    
    if (btnSave) btnSave.addEventListener('click', async () => {
        const idFb = document.getElementById('editProgFbId').value;
        const newD = document.getElementById('editProgData').value;
        
        try {
            btnSave.textContent = "Salvataggio...";
            btnSave.disabled = true;
            await updateDoc(doc(db, "programmati", idFb), {
                paziente: document.getElementById('editProgPaziente').value,
                localita: document.getElementById('editProgLocalita').value,
                indirizzo: document.getElementById('editProgIndirizzo').value,
                telefono: document.getElementById('editProgTelefono').value,
                tipo: document.getElementById('editProgTipo').value,
                dispositivi: document.getElementById('editProgDispositivi').value,
                matricola: document.getElementById('editProgMatricola').value,
                dataPrevista: newD,
                oraPrevista: document.getElementById('editProgOra').value,
                status: newD ? 'planned' : 'in_attesa' // revaluta status in base a se c'è data o no
            });
            modal.classList.add('hidden');
            await fetchProgrammati();
        } catch(e) {
            alert("Errore salvataggio: " + e.message);
        } finally {
            btnSave.textContent = "SALVA MODIFICHE";
            btnSave.disabled = false;
        }
    });

    // Di default impostiamo la data a domani
    let domani = new Date();
    domani.setDate(domani.getDate() + 1);
    iData.value = domani.toISOString().split('T')[0];

    fetchProgrammati();
});
