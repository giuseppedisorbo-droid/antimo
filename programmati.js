import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, serverTimestamp, query, where, deleteDoc, doc, updateDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    console.log("Firebase Inizializzato (Shared) in Programmati.");
} catch(e) {
    console.error("Errore inizializzazione Firebase", e);
    alert("Errore collegamento al Cloud. Controllare la rete.");
}

// Stato Globale
let plannedInterventions = [];
let waitingInterventions = [];
let calendar;

// Liste Dinamiche Dropdown
window.antimoDropdownLists = { interventi: [], dispositivi: [], ruoli: [] };
window.decodeCodeToLabel = function(codeRaw, type = 'interventi') {
    if(!codeRaw) return "";
    let codes = codeRaw.split(',').map(c => c.trim());
    return codes.map(c => {
        let listStr = type === 'interventi' ? 'interventi' : (type === 'ruoli' ? 'ruoli' : 'dispositivi');
        let found = window.antimoDropdownLists[listStr].find(item => item.id === c);
        return found ? found.desc : c;
    }).join(', ');
};



async function loadDropdownLists() {
    const defaultTypes = ['Visita', 'Sostituzione', 'Ritiro', 'Consegna', 'Manutenzione', 'Installazione', 'Riparazione'];
    const defaultDevices = ['Concentratore', 'Ventilatore', 'Aspiratore', 'D3', 'Stativo', 'Cpap', 'AutoCpap', 'Saturimetro'];
    const defaultRoles = ["TECNICO", "TRASPORTATORE", "AMMINISTRATIVO", "MAGAZZINO", "LOGISTICA", "DIREZIONE", "PRODUZIONE O2", "CONSULENTE E", "CONSULENTE D", "CONSULENTE M"];
    
    let baseDropdownLists = {
        interventi: defaultTypes.map(t => ({ id: t, desc: t })),
        dispositivi: defaultDevices.map(d => ({ id: d, desc: d })),
        ruoli: defaultRoles.map(r => ({ id: r, desc: r }))
    };
    
    window.antimoDropdownLists = baseDropdownLists;

    if(db) {
        try {
            const docRef = doc(db, "configurazioni", "liste_dropdown");
            const docSnap = await getDoc(docRef);
            if(docSnap.exists()) {
                const cloudData = docSnap.data();
                let needsUpdate = false;
                if(!cloudData.interventi) { cloudData.interventi = baseDropdownLists.interventi; needsUpdate = true; }
                if(!cloudData.dispositivi) { cloudData.dispositivi = baseDropdownLists.dispositivi; needsUpdate = true; }
                if(!cloudData.ruoli) { cloudData.ruoli = baseDropdownLists.ruoli; needsUpdate = true; }
                
                window.antimoDropdownLists = cloudData;
                
                if(needsUpdate) {
                    await setDoc(docRef, window.antimoDropdownLists);
                }
                
                localStorage.setItem('antimo_dropdown_lists', JSON.stringify(window.antimoDropdownLists));
            } else {
                await setDoc(docRef, window.antimoDropdownLists);
                localStorage.setItem('antimo_dropdown_lists', JSON.stringify(window.antimoDropdownLists));
            }
            
            // Fetch Operatori Sanitari
            window.operatoriSanitari = [];
            const { getDocs, query, collection, where } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            const qOps = query(collection(db, "anagrafiche"), where("qualifica", "==", "Operatore sanitario"));
            const opsSnap = await getDocs(qOps);
            opsSnap.forEach(d => {
                const data = d.data();
                window.operatoriSanitari.push({id: d.id, nome: (data.nome + " " + (data.cognome||"")).trim()});
            });
            
            // Popoliamo tecnicoAssegnato
            window.tecniciAssegnati = [];
            const qTecnici = query(collection(db, "anagrafiche"), where("localita", "==", "App (Dipendente)"));
            const tecniciSnap = await getDocs(qTecnici);
            tecniciSnap.forEach(d => {
                const data = d.data();
                window.tecniciAssegnati.push({id: d.id, nome: (data.ragioneSociale || (data.nome + " " + (data.cognome||""))).trim()});
            });
            
            const dropdownsAss = [document.getElementById('progTecnicoAssegnato'), document.getElementById('editProgTecnicoAssegnato')];
            dropdownsAss.forEach(dd => {
                if(dd && dd.options.length <= 1) {
                    window.tecniciAssegnati.forEach(t => {
                        const opt = document.createElement('option');
                        opt.value = t.nome;
                        opt.textContent = t.nome;
                        dd.appendChild(opt);
                    });
                    if(localStorage.getItem('antimo_user_name')) {
                        const myName = localStorage.getItem('antimo_user_name');
                        if(Array.from(dd.options).some(o => o.value === myName)) {
                            dd.value = myName; // DEFAULT a me
                        }
                    }
                }
            });
            
        } catch(e) {
            console.error("Errore fetch liste dropdown in programmati, uso cache", e);
            let cached = localStorage.getItem('antimo_dropdown_lists');
            if(cached) {
                window.antimoDropdownLists = JSON.parse(cached);
                if(!window.antimoDropdownLists.ruoli) window.antimoDropdownLists.ruoli = baseDropdownLists.ruoli;
            }
        }
    } else {
        let cached = localStorage.getItem('antimo_dropdown_lists');
        if(cached) {
            window.antimoDropdownLists = JSON.parse(cached);
            if(!window.antimoDropdownLists.ruoli) window.antimoDropdownLists.ruoli = baseDropdownLists.ruoli;
        }
    }
}
loadDropdownLists().then(() => {
    initDynamicBlocks('dynamicProgInterventionsContainer', 'btnAddProgInterventionBlock');
});

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

const btnProgStartIntervention = document.getElementById('btnProgStartIntervention');
const progAllegatoFile = document.getElementById('progAllegatoFile');
const progFilePreviewContainer = document.getElementById('progFilePreviewContainer');

const btnSaveWaiting = document.getElementById('btnSaveWaiting');
const btnToggleWaiting = document.getElementById('btnToggleWaiting');
const waitingContainer = document.getElementById('waitingContainer');
const waitingTableBody = document.getElementById('waitingTableBody');

// Note Elementi
const progNoteInput = document.getElementById('progNoteInput');
const btnExpandNote = document.getElementById('btnExpandNote');
const progNoteFileInput = document.getElementById('progNoteFileInput');
const progNotePreviewContainer = document.getElementById('progNotePreviewContainer');

let currentProgAttachments = [];
let currentProgNoteAttachments = [];

// Gestione Anteprime Note
function renderNotePreviews() {
    progNotePreviewContainer.innerHTML = '';
    if (currentProgNoteAttachments.length > 0) {
        progNotePreviewContainer.classList.remove('hidden');
    } else {
        progNotePreviewContainer.classList.add('hidden');
        return;
    }

    currentProgNoteAttachments.forEach((att, idx) => {
        const wrapper = document.createElement('div');
        wrapper.style.width = '70px';
        wrapper.style.height = '70px';
        wrapper.style.border = '1px solid #ccc';
        wrapper.style.borderRadius = '6px';
        wrapper.style.overflow = 'hidden';
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.justifyContent = 'center';
        wrapper.style.backgroundColor = '#fff';
        wrapper.style.position = 'relative';

        // Tasto rimuovi allegato
        const btnRemove = document.createElement('button');
        btnRemove.innerHTML = '&times;';
        btnRemove.style.cssText = 'position:absolute; top:2px; right:2px; background:red; color:white; border:none; border-radius:50%; width:16px; height:16px; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0;';
        btnRemove.onclick = (e) => {
            e.preventDefault();
            currentProgNoteAttachments.splice(idx, 1);
            renderNotePreviews();
        };

        if (att.type.startsWith('image/')) {
            wrapper.innerHTML = `<img src="${att.data}" style="max-width:100%; max-height:100%; object-fit:cover;">`;
        } else if (att.type === 'application/pdf') {
            wrapper.innerHTML = `<span style="font-size:1.5rem; color:#e11d48;">📄</span>`;
        } else if (att.type.startsWith('video/')) {
            wrapper.innerHTML = `<span style="font-size:1.5rem; color:#3b82f6;">🎥</span>`;
        } else if (att.type.startsWith('audio/')) {
            wrapper.innerHTML = `<span style="font-size:1.5rem; color:#f59e0b;">🎵</span>`;
        } else {
            wrapper.innerHTML = `<span style="font-size:1.5rem;">📎</span>`;
        }
        
        wrapper.appendChild(btnRemove);
        progNotePreviewContainer.appendChild(wrapper);
    });
}

// Lettore file generico (Cattura Paste + Upload Cliccato)
function readFilesAndAddNoteAttachments(filesArr) {
    if (!filesArr || filesArr.length === 0) return;
    Array.from(filesArr).forEach(f => {
        const reader = new FileReader();
        reader.onload = function(evt) {
            currentProgNoteAttachments.push({ name: f.name || `Pasted_Image_${Date.now()}.png`, type: f.type, data: evt.target.result });
            renderNotePreviews();
        };
        reader.readAsDataURL(f);
    });
}

if (progNoteFileInput) {
    progNoteFileInput.addEventListener('change', function(e) {
        readFilesAndAddNoteAttachments(this.files);
        this.value = ''; // reseta l'input
    });
}

if (progNoteInput) {
    // Incolla da Clipboard (Immagini)
    progNoteInput.addEventListener('paste', (e) => {
        if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
            readFilesAndAddNoteAttachments(e.clipboardData.files);
        }
    });
}

if (btnExpandNote) {
    let isExpanded = false;
    btnExpandNote.addEventListener('click', () => {
        isExpanded = !isExpanded;
        if (isExpanded) {
            progNoteInput.rows = 10;
            btnExpandNote.innerHTML = 'Riduci ↕';
            btnExpandNote.style.background = '#cbd5e1';
        } else {
            progNoteInput.rows = 3;
            btnExpandNote.innerHTML = 'Espandi ↕';
            btnExpandNote.style.background = '#e2e8f0';
        }
    });
}

// Gestione Anteprima Allegati "TERMINA ATTIVITA'"
if (progAllegatoFile) {
    progAllegatoFile.addEventListener('change', function(e) {
        progFilePreviewContainer.innerHTML = '';
        currentProgAttachments = [];
        
        if (this.files.length > 0) {
            progFilePreviewContainer.classList.remove('hidden');
        } else {
            progFilePreviewContainer.classList.add('hidden');
            return;
        }

        Array.from(this.files).forEach(f => {
            const reader = new FileReader();
            reader.onload = function(evt) {
                const dataUrl = evt.target.result;
                currentProgAttachments.push({ name: f.name, type: f.type, data: dataUrl });
                
                const wrapper = document.createElement('div');
                wrapper.style.width = '70px';
                wrapper.style.height = '70px';
                wrapper.style.border = '1px solid #ccc';
                wrapper.style.borderRadius = '6px';
                wrapper.style.overflow = 'hidden';
                wrapper.style.display = 'flex';
                wrapper.style.alignItems = 'center';
                wrapper.style.justifyContent = 'center';
                wrapper.style.backgroundColor = '#fff';

                if (f.type.startsWith('image/')) {
                    wrapper.innerHTML = `<img src="${dataUrl}" style="max-width:100%; max-height:100%; object-fit:cover;">`;
                } else if (f.type === 'application/pdf') {
                    wrapper.innerHTML = `<span style="font-size:1.5rem; color:#e11d48;">📄</span>`;
                } else if (f.type.startsWith('video/')) {
                    wrapper.innerHTML = `<span style="font-size:1.5rem; color:#3b82f6;">🎥</span>`;
                } else {
                    wrapper.innerHTML = `<span style="font-size:1.5rem;">📎</span>`;
                }
                progFilePreviewContainer.appendChild(wrapper);
            };
            reader.readAsDataURL(f);
        });
    });
}


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

function passesIncarichiFilter(inv, selectedArr) {
    if (!selectedArr || selectedArr.length === 0 || selectedArr.includes("TUTTI")) return true;
    let roleName = inv.tecnicoAssegnato || inv.operatore;
    if (!roleName) roleName = (inv.programmatoDa || "Sconosciuto") + " (Assegnante)";
    return selectedArr.includes(roleName);
}

function renderTutto() {
    renderTable();
    renderWaitingTable();
    renderCalendar();
}

function renderWaitingTable() {
    waitingTableBody.innerHTML = '';
    
    const selectedIncarichi = JSON.parse(localStorage.getItem('antimo_incarichi_filter')) || ["TUTTI"];
    const filteredWaiting = waitingInterventions.filter(p => passesIncarichiFilter(p, selectedIncarichi));

    if(filteredWaiting.length === 0) {
        waitingTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px;">Nessun intervento in attesa.</td></tr>';
        return;
    }

    filteredWaiting.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: bold;">${p.paziente} <br><div style="color:#64748b; font-size:0.8rem; margin-top:4px;">Prog. da: <strong>${p.programmatoDa || 'N/D'}</strong><br>Tecnico: <strong>${p.tecnicoAssegnato || 'Da Assegnare'}</strong></div></td>
            <td>${p.localita || p.destinazione || 'N/D'}</td>
            <td>${p.indirizzo || ''} <br><small style="color:gray;">${p.telefono || ''}</small></td>
            <td>
                <div style="display: flex; gap: 5px; flex-wrap: wrap; align-items: center;">
                    <input type="date" id="date_${p.idFb}" style="padding: 5px; border-radius: 6px; border: 1px solid #ccc;">
                    <input type="time" id="time_${p.idFb}" style="padding: 5px; border-radius: 6px; border: 1px solid #ccc; width: 100px;" title="Ora (Opzionale)">
                    <button class="btn btn-primary btn-sm" onclick="programmaAttesa('${p.idFb}')" style="padding: 5px 10px; font-size: 0.8rem; width: auto; text-transform: none;">Assegna</button>
                    <button class="btn btn-secondary btn-sm" onclick="editProgrammato('${p.idFb}')" style="padding: 5px 10px; font-size: 0.8rem; width: auto; text-transform: none;">Modifica</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteProgrammato('${p.idFb}')" style="padding: 5px 10px; font-size: 0.8rem; width: auto; text-transform: none;">Elimina</button>
                    <button class="btn btn-sm" onclick="window.stampaModuloMagazzinoPDF('${p.idFb}')" style="padding: 5px 10px; font-size: 0.8rem; width: auto; text-transform: none; background: #6366f1; color: white; border: none; border-radius: 4px;">🖨️ Bolla Magazzino</button>
                </div>
            </td>
        `;
        waitingTableBody.appendChild(tr);
    });
}

function renderTable() {
    tableBody.innerHTML = '';
    
    const selectedIncarichi = JSON.parse(localStorage.getItem('antimo_incarichi_filter')) || ["TUTTI"];
    const filteredPlanned = plannedInterventions.filter(p => passesIncarichiFilter(p, selectedIncarichi));

    if(filteredPlanned.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Nessun intervento programmato.</td></tr>';
        return;
    }

    filteredPlanned.forEach(p => {
        const tr = document.createElement('tr');
        
        const dateStr = p.dataPrevista ? p.dataPrevista.split('-').reverse().join('/') : 'N/D';
        const notes = p.dispositivi || p.note || '';

        const badgeVal = (p.operatoreValutazione || p.esito || p.statoValutazione) 
            ? `<div style="margin-top: 4px; display:inline-block; padding: 2px 6px; background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; border-radius: 4px; font-size: 0.75rem;">
                <strong>Valutazione:</strong> 
                ${p.operatoreValutazione ? `Op: ${p.operatoreValutazione}` : ''} 
                ${p.esito ? `| Esito: ${p.esito}` : ''}
                ${p.statoValutazione ? `| Stato: ${p.statoValutazione}` : ''}
               </div>` : '';

        tr.innerHTML = `
            <td style="font-weight: 600; color: var(--blue-primary);">${dateStr}</td>
            <td style="font-weight: bold;">${p.paziente} <br><div style="color:#64748b; font-size:0.8rem; margin-top:4px;">Prog. da: <strong>${p.programmatoDa || 'N/D'}</strong><br>Tecnico: <strong>${p.tecnicoAssegnato || 'Da Assegnare'}</strong></div></td>
            <td>${p.localita || p.destinazione || 'N/D'}</td>
            <td>${p.indirizzo || ''} <br><small style="color:gray;">${p.telefono || ''}</small></td>
            <td><span class="status-badge" style="background-color: #f1f5f9; color: var(--text-main); font-size: 0.8rem; padding: 4px 8px;">${window.decodeCodeToLabel(p.tipo, 'interventi') || 'Non spec.'}</span><br>${badgeVal}</td>
            <td style="font-size: 0.85rem; color: #555;">
                <strong>Disp:</strong> ${window.decodeCodeToLabel(p.dispositivi, 'dispositivi') || 'Nessuno'} <br />
                <strong>Matricola:</strong> ${p.matricola || 'N/D'} <br />
                <strong>Accessori:</strong> ${p.accessoriStr || 'Nessuno'} <br />
                <strong>Note:</strong> ${p.note || ''}
            </td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="editProgrammato('${p.idFb}')" style="padding: 4px 8px; font-size: 0.8rem; text-transform: none; margin-bottom: 4px; width:100%; border-radius: 6px;">Modifica</button>
                <button class="btn btn-danger btn-sm" onclick="deleteProgrammato('${p.idFb}')" style="padding: 4px 8px; font-size: 0.8rem; text-transform: none; width:100%; border-radius: 6px; margin-bottom: 4px;">Elimina</button>
                <button class="btn btn-sm" onclick="window.stampaModuloMagazzinoPDF('${p.idFb}')" style="padding: 4px 8px; font-size: 0.8rem; text-transform: none; width:100%; border-radius: 6px; background: #6366f1; color: white; border: none;">🖨️ Bolla Magazzino</button>
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
    
    const selectedIncarichi = JSON.parse(localStorage.getItem('antimo_incarichi_filter')) || ["TUTTI"];
    const filteredPlanned = plannedInterventions.filter(p => passesIncarichiFilter(p, selectedIncarichi));

    // Aggiungi nuovi da plannedInterventions filtrati
    filteredPlanned.forEach(p => {
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
    let typeOptions = window.antimoDropdownLists.interventi.map(t => `<option value="${t.id}">${t.desc}</option>`).join('');
    let devOptions = window.antimoDropdownLists.dispositivi.map(d => `<option value="${d.id}">${d.desc}</option>`).join('');
    let operatori = window.operatoriSanitari || [];
    let opOptions = operatori.map(o => `<option value="${o.nome}">${o.nome}</option>`).join('');
    
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
            
            <div class="accessori-container form-group" style="margin-bottom: 10px; display: none;">
                <label style="font-size: 0.8rem; color: #ea580c; font-weight: bold;">Accessori Modello (Multiselezionabili):</label>
                <div class="accessori-list" style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 5px;"></div>
            </div>

            <div class="seqex-container form-group" style="margin-bottom: 10px; display: none; background: #e0e7ff; padding: 10px; border-radius: 8px; border: 1px dashed #6366f1;">
                <label style="font-size: 0.85rem; color: #4338ca; font-weight: bold; width: 100%; display: block; margin-bottom: 8px;">Dettagli Terapia SEQEX</label>
                <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 8px;">
                    <div style="flex: 1; min-width: 120px;">
                        <label style="font-size: 0.75rem; color: #3730a3;">Volte al giorno</label>
                        <input type="number" class="seqex-volte" placeholder="Es. 2" style="width: 100%; padding: 6px; border-radius: 6px; border: 1px solid #a5b4fc; font-size: 0.85rem;">
                    </div>
                    <div style="flex: 1; min-width: 120px;">
                        <label style="font-size: 0.75rem; color: #3730a3;">Minuti al giorno</label>
                        <input type="number" class="seqex-minuti" placeholder="Es. 30" style="width: 100%; padding: 6px; border-radius: 6px; border: 1px solid #a5b4fc; font-size: 0.85rem;">
                    </div>
                </div>
                <label style="font-size: 0.75rem; color: #3730a3; margin-top: 5px; display:block;">Programmi SEQEX (Multiselezionabili):</label>
                <div class="seqex-programmi-list" style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 5px;"></div>
            </div>

            <div class="form-group" style="margin-bottom: 10px;">
                <label style="font-size: 0.8rem; color: #475569;">Matricola / Note Extra</label>
                <div style="display: flex; gap: 8px;">
                    <input type="text" class="block-mat" placeholder="Es. SN123456" style="flex: 1; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.95rem; background: white;">
                    <button type="button" class="btn-scan-barcode" style="background: #1e293b; color: white; border: none; border-radius: 6px; padding: 0 15px; font-size: 1.2rem; cursor: pointer;" title="Scansiona Codice a Barre / QR">📷</button>
                </div>
            </div>
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 10px; display: flex; gap: 10px; flex-wrap: wrap;">
                <div class="form-group" style="flex: 1; min-width: 120px; margin-bottom: 0;">
                    <label style="font-size: 0.75rem; color: #0284c7; font-weight: bold;">Operatore Sanitario (Opzionale)</label>
                    <select class="block-operatore" style="width: 100%; padding: 6px; border-radius: 6px; border: 1px solid #bae6fd; font-size: 0.85rem; background: #f0f9ff;">
                        <option value="">Nessuno</option>
                        ${opOptions}
                    </select>
                </div>
                <div class="form-group" style="flex: 1; min-width: 80px; margin-bottom: 0;">
                    <label style="font-size: 0.75rem; color: #0284c7; font-weight: bold;">Esito / Punteggio</label>
                    <input type="text" class="block-esito" placeholder="Es. Positivo, 95..." style="width: 100%; padding: 6px; border-radius: 6px; border: 1px solid #bae6fd; font-size: 0.85rem; background: #f0f9ff;">
                </div>
                <div class="form-group" style="flex: 1; min-width: 120px; margin-bottom: 0;">
                    <label style="font-size: 0.75rem; color: #0284c7; font-weight: bold;">Stato Valutazione</label>
                    <select class="block-stato-valutazione" style="width: 100%; padding: 6px; border-radius: 6px; border: 1px solid #bae6fd; font-size: 0.85rem; background: #f0f9ff;">
                        <option value="">Nessuno</option>
                        <option value="Svolta - A buon fine">✅ Svolta - A buon fine</option>
                        <option value="Svolta - Da ripetere">🔄 Svolta - Da ripetere</option>
                    </select>
                </div>
            </div>
        </div>
    `;
}

function initDynamicBlocks(containerId, addBtnId) {
    const container = document.getElementById(containerId);
    const btnAdd = document.getElementById(addBtnId);
    
    if(!container || !btnAdd) return;

    window.addDynamicProgBlock = (data = null) => {
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
                opt.textContent = window.decodeCodeToLabel(data.disp, 'dispositivi') || data.disp;
                dispSelect.insertBefore(opt, dispSelect.querySelector('option[value="Altro"]'));
            }
            dispSelect.value = data.disp || "";
            block.querySelector('.block-mat').value = data.mat || "";
        }
        
        // Logica Accessori Dinamici
        const dispSelectNode = block.querySelector('.block-disp');
        const accContainer = block.querySelector('.accessori-container');
        const accList = block.querySelector('.accessori-list');
        const seqexContainer = block.querySelector('.seqex-container');
        const seqexProgList = block.querySelector('.seqex-programmi-list');
        const seqexVolte = block.querySelector('.seqex-volte');
        const seqexMinuti = block.querySelector('.seqex-minuti');
        
        const renderAccessoriForDisp = (selectedDispId, preselectedAccArray = []) => {
            accList.innerHTML = '';
            const listDispositivi = window.antimoDropdownLists?.dispositivi || [];
            const dev = listDispositivi.find(d => d.id === selectedDispId);
            
            if (dev && dev.accessori && dev.accessori.length > 0) {
                accContainer.style.display = 'block';
                dev.accessori.forEach(a => {
                    const isChecked = preselectedAccArray.includes(a.desc) ? 'checked' : '';
                    accList.innerHTML += `
                        <label style="display:flex; align-items:center; gap:5px; font-size:0.85rem; background:white; border:1px solid #cbd5e1; padding:4px 8px; border-radius:6px; cursor:pointer;">
                            <input type="checkbox" class="acc-chkbox" value="${a.desc.replace(/"/g, '&quot;')}" ${isChecked}>
                            ${a.desc}
                        </label>
                    `;
                });
            } else {
                accContainer.style.display = 'none';
            }
        };

        const renderSeqexForDisp = (selectedDispId, savedData = null) => {
            const listDispositivi = window.antimoDropdownLists?.dispositivi || [];
            const dev = listDispositivi.find(d => d.id === selectedDispId);
            const devDesc = dev ? dev.desc : selectedDispId;
            const isSeqex = devDesc && devDesc.toUpperCase().includes('SEQEX');
            
            if (isSeqex) {
                seqexContainer.style.display = 'block';
                seqexProgList.innerHTML = '';
                const listProg = window.antimoDropdownLists?.programmi_seqex || [];
                const preselectedProg = savedData && savedData.seqex_programmiStr ? savedData.seqex_programmiStr.split(',').map(s=>s.trim()) : [];
                
                listProg.forEach(p => {
                    const isChecked = preselectedProg.includes(p.desc) ? 'checked' : '';
                    seqexProgList.innerHTML += `
                        <label style="display:flex; align-items:center; gap:5px; font-size:0.85rem; background:white; border:1px solid #a5b4fc; padding:4px 8px; border-radius:6px; cursor:pointer;">
                            <input type="checkbox" class="seqex-chkbox" value="${p.desc.replace(/"/g, '&quot;')}" ${isChecked}>
                            ${p.desc}
                        </label>
                    `;
                });
                
                if (savedData) {
                    seqexVolte.value = savedData.seqex_volte || '';
                    seqexMinuti.value = savedData.seqex_minuti || '';
                }
            } else {
                seqexContainer.style.display = 'none';
            }
        };

        dispSelectNode.addEventListener('change', (e) => {
            renderAccessoriForDisp(e.target.value, []);
            renderSeqexForDisp(e.target.value, null);
        });

        if (data && data.disp) {
            renderAccessoriForDisp(data.disp, data.accessori || []);
            renderSeqexForDisp(data.disp, data);
        }
        
        // Logica Barcode Scanner
        const scanBtn = block.querySelector('.btn-scan-barcode');
        const matInput = block.querySelector('.block-mat');
        scanBtn.addEventListener('click', () => {
            if(window.openBarcodeScanner) window.openBarcodeScanner(matInput);
            else alert('Scanner initialization pending.');
        });
        
        container.appendChild(block);
    };

    container.innerHTML = '';
    window.addDynamicProgBlock();

    btnAdd.addEventListener('click', () => window.addDynamicProgBlock());
}

function extractDynamicBlocksData(containerId) {
    const container = document.getElementById(containerId);
    if(!container) return { array: [], tipoStr: "", dispStr: "", matStr: "", operatoreValutazioneStr: "", esitoStr: "", statoValutazioneStr: "", accStr: "" };
    
    let blocks = [];
    container.querySelectorAll('.dynamic-intervention-block').forEach(b => {
        let t = b.querySelector('.block-tipo').value.trim();
        let d = b.querySelector('.block-disp').value.trim();
        let m = b.querySelector('.block-mat').value.trim();
        let accCheckboxes = b.querySelectorAll('.acc-chkbox:checked');
        let acc = Array.from(accCheckboxes).map(c => c.value);
        let accJoin = acc.join(' + ');

        let op = b.querySelector('.block-operatore') ? b.querySelector('.block-operatore').value.trim() : "";
        let es = b.querySelector('.block-esito') ? b.querySelector('.block-esito').value.trim() : "";
        let st = b.querySelector('.block-stato-valutazione') ? b.querySelector('.block-stato-valutazione').value.trim() : "";
        
        let seqexCheckboxes = b.querySelectorAll('.seqex-chkbox:checked');
        let seqexProgStr = Array.from(seqexCheckboxes).map(c => c.value).join(', ');
        let seqexVolteVal = b.querySelector('.seqex-volte') ? b.querySelector('.seqex-volte').value.trim() : "";
        let seqexMinutiVal = b.querySelector('.seqex-minuti') ? b.querySelector('.seqex-minuti').value.trim() : "";
        
        if(t || d || m || op || es || st || acc.length > 0 || seqexProgStr || seqexVolteVal || seqexMinutiVal) {
            blocks.push({ 
                tipo: t, disp: d, mat: m, accessori: acc, accessoriStr: accJoin, 
                seqex_programmiStr: seqexProgStr, seqex_volte: seqexVolteVal, seqex_minuti: seqexMinutiVal,
                operatoreValutazione: op, esito: es, statoValutazione: st 
            });
        }
    });
    
    return {
        array: blocks,
        tipoStr: blocks.map(b => b.tipo).filter(x=>x).join(', '),
        dispStr: blocks.map(b => b.disp).filter(x=>x).join(', '),
        matStr: blocks.map(b => b.mat).filter(x=>x).join('; '),
        accStr: blocks.map(b => b.accessoriStr).filter(x=>x).join('; '),
        seqexProgrammiStr: blocks.map(b => b.seqex_programmiStr).filter(x=>x).join('; '),
        operatoreValutazioneStr: blocks.map(b => b.operatoreValutazione).filter(x=>x).join(', '),
        esitoStr: blocks.map(b => b.esito).filter(x=>x).join('; '),
        statoValutazioneStr: blocks.map(b => b.statoValutazione).filter(x=>x).join(', ')
    };
}
// Helper function to upload attachments
async function uploadAttachmentsToStorage(attachmentsArray, docId, pathPrefix) {
    if (!attachmentsArray || attachmentsArray.length === 0) return [];
    const urls = [];
    const { getStorage, ref, uploadString, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js");
    const storage = getStorage(app);
    
    for (let i = 0; i < attachmentsArray.length; i++) {
        const att = attachmentsArray[i];
        let ext = "jpg";
        if (att.name) ext = att.name.split('.').pop();
        else if (att.type === "application/pdf") ext = "pdf";
        else if (att.type && att.type.startsWith("video/")) ext = "mp4";
        else if (att.type && att.type.startsWith("audio/")) ext = "webm";

        const storageRef = ref(storage, `${pathPrefix}/${docId}_${Date.now()}_${i}.${ext}`);
        await uploadString(storageRef, att.data, 'data_url');
        const url = await getDownloadURL(storageRef);
        urls.push(url);
    }
    return urls;
}

// === NUOVA LOGICA: TERMINA ATTIVITA' DIRETTAMENTE DAL CALENDARIO ===
if (btnProgStartIntervention) {
    btnProgStartIntervention.addEventListener('click', async (e) => {
        e.preventDefault();

        const blocksData = extractDynamicBlocksData('dynamicProgInterventionsContainer');
        if (blocksData.array.length === 0 || !blocksData.tipoStr) {
            return alert("Devi inserire almeno un intervento compilando la tipologia.");
        }
        if (!iPaziente.value || !iLocalita.value || !iIndirizzo.value) {
            return alert("Compila Paziente, Località e Indirizzo per terminare l'attività.");
        }

        const oldHtml = btnProgStartIntervention.innerHTML;
        btnProgStartIntervention.innerHTML = `<span class="btn-icon">⏳</span> SALVATAGGIO IN CORSO...`;
        btnProgStartIntervention.disabled = true;

        // Uniamo gli allegati normali con quelli delle note (se presenti)
        const allAttachments = [...(currentProgAttachments || []), ...(currentProgNoteAttachments || [])];
        const noteText = progNoteInput && progNoteInput.value.trim() ? progNoteInput.value.trim() : "Completato da Calendario";

        const invToSave = {
            id: Date.now().toString(),
            dataObj: new Date().getTime(),
            tipo: blocksData.tipoStr,
            paziente: iPaziente.value,
            localita: iLocalita.value,
            indirizzo: iIndirizzo.value,
            telefono: iTelefono ? iTelefono.value : "",
            dispositivi: blocksData.dispStr || "Nessuno",
            matricola: blocksData.matStr,
            accessoriStr: blocksData.accStr || "",
            operatoreValutazione: blocksData.operatoreValutazioneStr,
            esito: blocksData.esitoStr,
            statoValutazione: blocksData.statoValutazioneStr,
            tecnicoAssegnato: document.getElementById('progTecnicoAssegnato') ? document.getElementById('progTecnicoAssegnato').value : (localStorage.getItem('antimo_user_name') || "Sconosciuto"),
            interventiList: blocksData.array,
            note: noteText,
            operatore: localStorage.getItem('antimo_user_name') || "Sconosciuto",
            attachments: allAttachments,
            startTime: new Date().getTime(),
            endTime: new Date().getTime(),
            kmPercorsi: "0"
        };

        let uploadedUrls = [];

        try {
            if (db) {
                // 1. Upload Attachments to Storage
                uploadedUrls = await uploadAttachmentsToStorage(invToSave.attachments, invToSave.id, "allegati");
                
                // 2. Save directly to `interventi` completely skipping `programmati`
                const { serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                
                const payloadToSave = {
                    timestamp: serverTimestamp(),
                    id: invToSave.id,
                    tipo: invToSave.tipo || "Gen",
                    paziente: invToSave.paziente || "Sconosciuto",
                    localita: invToSave.localita || "",
                    indirizzo: invToSave.indirizzo || "",
                    telefono: invToSave.telefono || "",
                    dispositivi: invToSave.dispositivi || "",
                    matricola: invToSave.matricola || "",
                    accessoriStr: invToSave.accessoriStr || "",
                    interventiList: invToSave.interventiList || [], 
                    note: invToSave.note || "",
                    operatore: invToSave.operatore || "Sconosciuto",
                    startTime: invToSave.startTime,
                    endTime: invToSave.endTime,
                    kmPercorsi: invToSave.kmPercorsi,
                    fileUrls: uploadedUrls.length > 0 ? uploadedUrls : null,
                    haAllegato: uploadedUrls.length > 0
                };

                Object.keys(payloadToSave).forEach(k => payloadToSave[k] === undefined && delete payloadToSave[k]);
                await addDoc(collection(db, "interventi"), payloadToSave);

                // Nuova logica: Se eravamo in modifica di un programmato, ELIMINIAMOLO
                if (window.currentEditFbId) {
                    try {
                        const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                        await deleteDoc(doc(db, "programmati", window.currentEditFbId));
                        console.log("Programmato originario eliminato con successo post esecuzione.");
                    } catch(e) { console.error("Errore rimozione programmato", e); }
                }

                // Nuova logica: se salvo un intervento per un paziente, chiudo in automatico i suoi vecchi N.ESEG e IN ATTESA.
                try {
                    // 1. Chiudi vecchi N.ESEG
                    const qNeseg = query(
                        collection(db, "programmati"), 
                        where("paziente", "==", invToSave.paziente),
                        where("status", "==", "justified_not_executed")
                    );
                    const snapsNeseg = await getDocs(qNeseg);
                    snapsNeseg.forEach(async (d) => {
                        await updateDoc(doc(db, "programmati", d.id), { status: "completed" });
                    });

                    // 2. Elimina vecchi In Attesa
                    const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                    const qInAttesa = query(
                        collection(db, "programmati"), 
                        where("paziente", "==", invToSave.paziente),
                        where("status", "==", "in_attesa")
                    );
                    const snapsInAttesa = await getDocs(qInAttesa);
                    snapsInAttesa.forEach(async (d) => {
                        await deleteDoc(doc(db, "programmati", d.id));
                    });
                } catch(e) { console.error("Errore pulizia vecchi N.ESEG o IN ATTESA", e); }

                form.reset();
                if (progFilePreviewContainer) {
                    progFilePreviewContainer.innerHTML = '';
                    progFilePreviewContainer.classList.add('hidden');
                }
                if (progNotePreviewContainer) {
                    progNotePreviewContainer.innerHTML = '';
                    progNotePreviewContainer.classList.add('hidden');
                }
                if (progNoteInput) {
                    progNoteInput.rows = 3;
                    if (btnExpandNote) {
                        btnExpandNote.innerHTML = 'Espandi ↕';
                        btnExpandNote.style.background = '#e2e8f0';
                    }
                }
                currentProgAttachments = [];
                currentProgNoteAttachments = [];

                alert("✅ ATTIVITA' TERMINATA CORRETTAMENTE!");
                window.location.href = "index.html"; // Ritorniamo alla dashboard
            }
        } catch (err) {
            console.error("Errore Termina Attivita in Programmati", err);
            alert("Errore salvataggio attività nel Cloud.");
        } finally {
            btnProgStartIntervention.innerHTML = oldHtml;
            btnProgStartIntervention.disabled = false;
        }
    });
}


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
    
    // Upload allegati note se presenti
    let uploadedUrls = [];
    try {
        uploadedUrls = await uploadAttachmentsToStorage(currentProgNoteAttachments, plannedId, "allegati_programmati");
    } catch(e) {
        console.error("Errore upload allegati note", e);
    }
    
    const planned = {
        id: plannedId,
        tipo: blocksData.tipoStr,
        paziente: iPaziente.value,
        localita: iLocalita.value,
        indirizzo: iIndirizzo.value,
        telefono: iTelefono ? iTelefono.value : "",
        dispositivi: blocksData.dispStr,
        matricola: blocksData.matStr,
        accessoriStr: blocksData.accStr || "",
        operatoreValutazione: blocksData.operatoreValutazioneStr,
        esito: blocksData.esitoStr,
        statoValutazione: blocksData.statoValutazioneStr,
        interventiList: blocksData.array,
        dataPrevista: iData.value,
        oraPrevista: document.getElementById('oraProgrammata') ? document.getElementById('oraProgrammata').value : "",
        note: progNoteInput ? progNoteInput.value.trim() : "",
        fileUrlsProgrammati: uploadedUrls.length > 0 ? uploadedUrls : null,
        tecnicoAssegnato: document.getElementById('progTecnicoAssegnato') ? document.getElementById('progTecnicoAssegnato').value : "",
        programmatoDa: localStorage.getItem('antimo_user_name') || "Sconosciuto",
        status: 'planned',
        timestamp: new Date().getTime()
    };

    try {
        if (db) {
            if (window.currentEditFbId) {
                const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                await updateDoc(doc(db, "programmati", window.currentEditFbId), planned);
                console.log("Programmato aggiornato su Cloud");
                alert("Aggiornamento completato!");
                window.location.href = "programmati.html"; // Rimuove param e resetta
                return;
            } else {
                await addDoc(collection(db, "programmati"), planned);
                console.log("Programmato salvato su Cloud");
            }
        }
        
        // Pulisci
        form.reset();
        currentProgNoteAttachments = [];
        if (progNotePreviewContainer) {
            progNotePreviewContainer.innerHTML = '';
            progNotePreviewContainer.classList.add('hidden');
        }
        if (progNoteInput) {
            progNoteInput.rows = 3;
            if (btnExpandNote) {
                btnExpandNote.innerHTML = 'Espandi ↕';
                btnExpandNote.style.background = '#e2e8f0';
            }
        }
        
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
    
    // Upload allegati note se presenti
    let uploadedUrls = [];
    try {
        uploadedUrls = await uploadAttachmentsToStorage(currentProgNoteAttachments, plannedId, "allegati_programmati");
    } catch(e) {
        console.error("Errore upload allegati note", e);
    }

    const waitingEvent = {
        id: plannedId,
        tipo: blocksData.tipoStr,
        paziente: iPaziente.value,
        localita: iLocalita.value,
        indirizzo: iIndirizzo.value,
        telefono: iTelefono ? iTelefono.value : "",
        dispositivi: blocksData.dispStr,
        matricola: blocksData.matStr,
        accessoriStr: blocksData.accStr || "",
        operatoreValutazione: blocksData.operatoreValutazioneStr,
        esito: blocksData.esitoStr,
        statoValutazione: blocksData.statoValutazioneStr,
        interventiList: blocksData.array,
        note: progNoteInput ? progNoteInput.value.trim() : "",
        fileUrlsProgrammati: uploadedUrls.length > 0 ? uploadedUrls : null,
        tecnicoAssegnato: document.getElementById('progTecnicoAssegnato') ? document.getElementById('progTecnicoAssegnato').value : "",
        programmatoDa: localStorage.getItem('antimo_user_name') || "Sconosciuto",
        status: 'in_attesa',
        timestamp: new Date().getTime()
    };

    try {
        if (db) {
            if (window.currentEditFbId) {
                const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                await updateDoc(doc(db, "programmati", window.currentEditFbId), waitingEvent);
                alert("Aggiornamento In Attesa completato!");
                window.location.href = "programmati.html";
                return;
            } else {
                await addDoc(collection(db, "programmati"), waitingEvent);
            }
        }
        form.reset();
        currentProgNoteAttachments = [];
        if (progNotePreviewContainer) {
            progNotePreviewContainer.innerHTML = '';
            progNotePreviewContainer.classList.add('hidden');
        }
        if (progNoteInput) {
            progNoteInput.rows = 3;
            if (btnExpandNote) {
                btnExpandNote.innerHTML = 'Espandi ↕';
                btnExpandNote.style.background = '#e2e8f0';
            }
        }
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
    const timeInput = document.getElementById('time_' + idFb);
    const newDate = dateInput.value;
    const newTime = timeInput ? timeInput.value : "";
    if(!newDate) {
        return alert('Seleziona una data per assegnare l\'intervento!');
    }
    
    try {
        const docRef = doc(db, 'programmati', idFb);
        await updateDoc(docRef, {
            dataPrevista: newDate,
            oraPrevista: newTime,
            status: 'planned'
        });
        await fetchProgrammati(); // ricarica tutto e aggiorna calendario / tabella
    } catch(e) {
        console.error("Errore aggiornamento data", e);
        alert('Errore di connessione o permessi aggiornando la data.');
    }
};
window.deleteProgrammato = async function(idFb) {
    let p = plannedInterventions.find(x => x.idFb === idFb);
    if(!p) {
        p = waitingInterventions.find(x => x.idFb === idFb);
    }
    if(!p) return;
    if(!confirm(`Sicuro di voler eliminare questa programmazione?\n\nPaziente: ${p.paziente}\nLocalità: ${p.localita||p.destinazione||''}`)) return;
    try {
        await deleteDoc(doc(db, "programmati", idFb));
        await fetchProgrammati();
    } catch(e) { alert(e.message); }
};

window.editProgrammato = function(idFb) {
    window.location.href = `programmati.html?editId=${idFb}`;
};

document.addEventListener('DOMContentLoaded', () => {
    // BOOTSTRAP EDIT MODE
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('editId');
    if (editId) {
        document.querySelector('h2').innerHTML = '<span class="btn-icon">✏️</span> Modifica Programmazione';
        const btnPlan = document.getElementById('btnPlanIntervention');
        if(btnPlan) btnPlan.innerHTML = '<span class="btn-icon">💾</span> AGGIORNA PROGRAMMAZIONE';
        const btnWait = document.getElementById('btnSaveWaiting');
        if(btnWait) btnWait.innerHTML = '<span class="btn-icon">⏳</span> AGGIORNA IN ATTESA';
        
        setTimeout(async () => {
            if(!db) return;
            try {
                const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                const docSnap = await getDoc(doc(db, "programmati", editId));
                if (docSnap.exists()) {
                    const p = docSnap.data();
                    window.currentEditFbId = editId;
                    
                    document.getElementById('paziente').value = p.paziente || "";
                    if (document.getElementById('progTecnicoAssegnato')) document.getElementById('progTecnicoAssegnato').value = p.tecnicoAssegnato || "";
                    document.getElementById('localita').value = p.localita || p.destinazione || "";
                    document.getElementById('indirizzo').value = p.indirizzo || "";
                    if(document.getElementById('telefono')) document.getElementById('telefono').value = p.telefono || "";
                    
                    document.getElementById('dataProgrammata').value = p.dataPrevista || "";
                    if(document.getElementById('oraProgrammata')) document.getElementById('oraProgrammata').value = p.oraPrevista || "";
                    
                    if(document.getElementById('progNoteInput')) document.getElementById('progNoteInput').value = p.note || "";
                    
                    if(p.interventiList && p.interventiList.length > 0) {
                        const container = document.getElementById('dynamicProgInterventionsContainer');
                        if (container) container.innerHTML = '';
                        p.interventiList.forEach(inv => {
                            if(window.addDynamicProgBlock) window.addDynamicProgBlock(inv);
                        });
                    } else if (p.tipo) {
                        // Legacy support per interventi salvati prima della patch dei blocchi multipli
                        const container = document.getElementById('dynamicProgInterventionsContainer');
                        if (container) container.innerHTML = '';
                        if(window.addDynamicProgBlock) window.addDynamicProgBlock({tipo: p.tipo, disp: p.dispositivi, mat: p.matricola, operatoreValutazione: p.operatoreValutazione, esito: p.esito, statoValutazione: p.statoValutazione});
                    }
                }
            } catch(e) { console.error("Errore fetch edit doc", e); }
        }, 1500);
    }

    // Di default impostiamo la data a domani
    let domani = new Date();
    domani.setDate(domani.getDate() + 1);
    if(iData && !iData.value) iData.value = domani.toISOString().split('T')[0];

    fetchProgrammati();
});


// === LOGICA IMPORT ASSISTITI XLSX/CSV ===
document.addEventListener('DOMContentLoaded', () => {
    const btnImpA = document.getElementById('btnImportAssistiti');
    const uploA = document.getElementById('uploadAssistitiExcel');
    const modA = document.getElementById('assistitiMappingModal');
    const btnCA = document.getElementById('btnCancelAssistitiMapping');
    const btnSA = document.getElementById('btnSaveAssistitiMapping');

    const cPaz = document.getElementById('colPaziente');
    const cDisp = document.getElementById('colDispositivi');
    const cLoc = document.getElementById('colLocalita');
    const cInd = document.getElementById('colIndirizzo');

    let parsedExcelRows = []; // Temporaneo per tenere le righe prima del mapping

    if (btnImpA && uploA) {
        btnImpA.addEventListener('click', () => {
            uploA.value = "";
            uploA.click();
        });

        uploA.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(evt) {
                const data = evt.target.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Converte in array di array per avere le righe grezze e isolare l'header
                const jsonSheet = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                if (jsonSheet.length === 0) {
                    alert("Il file selezionato è vuoto.");
                    return;
                }

                // Primo row = header
                const headers = jsonSheet[0];
                parsedExcelRows = XLSX.utils.sheet_to_json(worksheet); // Array of Objects keys based on header

                if (!headers || headers.length === 0) {
                    alert("Impossibile rilevare le colonne dal file.");
                    return;
                }

                // Popola i vari select del modale
                [cPaz, cDisp, cLoc, cInd].forEach(sel => {
                    sel.innerHTML = '<option value="">-- Ignora / Lascia Vuoto --</option>';
                    headers.forEach(h => {
                        const opt = document.createElement('option');
                        opt.value = h;
                        opt.textContent = h;
                        sel.appendChild(opt);
                    });
                });

                // Tentiamo di pre-selezionare in base ai nomi più probabili
                headers.forEach(h => {
                    const hl = h.toLowerCase();
                    if (hl.includes('paziente') || hl.includes('assistito') || hl.includes('nome')) cPaz.value = h;
                    if (hl.includes('apparecchiatura') || hl.includes('dispositiv') || hl.includes('accessori') || hl.includes('strument')) cDisp.value = h;
                    if (hl.includes('localit') || hl.includes('citt') || hl.includes('comune')) cLoc.value = h;
                    if (hl.includes('indirizzo') || hl.includes('via')) cInd.value = h;
                });

                modA.classList.remove('hidden');
            };
            reader.onerror = function() {
                alert("Errore nella lettura del file.");
            };
            reader.readAsBinaryString(file);
        });

        btnCA.addEventListener('click', () => {
            modA.classList.add('hidden');
            parsedExcelRows = [];
        });

        btnSA.addEventListener('click', async () => {
            const valPaziente = cPaz.value;
            const valDispositivi = cDisp.value;
            const valLocalita = cLoc.value;
            const valIndirizzo = cInd.value;

            if (!valPaziente) {
                alert("Devi obbligatoriamente indicare almeno la colonna per il Nome Paziente/Ente!");
                cPaz.focus();
                return;
            }

            const mappedData = [];
            parsedExcelRows.forEach(row => {
                const pName = row[valPaziente];
                if (!pName || String(pName).trim() === '') return; // Skip vuoti

                mappedData.push({
                    paziente: String(pName).trim(),
                    dispositivi: valDispositivi && row[valDispositivi] ? String(row[valDispositivi]).trim() : "",
                    localita: valLocalita && row[valLocalita] ? String(row[valLocalita]).trim() : "",
                    indirizzo: valIndirizzo && row[valIndirizzo] ? String(row[valIndirizzo]).trim() : ""
                });
            });

            // Salvataggio Locale
            localStorage.setItem('antimo_assistiti', JSON.stringify(mappedData));
            
            // Salvataggio Cloud
            try {
                const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                await setDoc(doc(db, "shared_data", "assistiti"), { list: mappedData });
                console.log("Assistiti sincronizzati in Cloud!");
            } catch(e) {
                console.error("Errore salvataggio Cloud Assistiti", e);
            }

            // Forza update datalist sulla stessa pagina
            if(typeof window.renderAssistitiDatalist === 'function') {
                window.renderAssistitiDatalist();
            }

            modA.classList.add('hidden');
            alert(`Importazione completata: ${mappedData.length} assistiti inseriti e memorizzati con successo!`);
        });
    }
});

// ==========================================
// AUTO-COMPLETAMENTO ASSISTITI E DATALIST
// ==========================================
window.renderAssistitiDatalist = function() {
    const dlist = document.getElementById('assistitiDatalist');
    if(!dlist) return;
    const assistiti = JSON.parse(localStorage.getItem('antimo_assistiti') || '[]');
    dlist.innerHTML = '';
    assistiti.forEach(a => {
        let opt = document.createElement('option');
        opt.value = a.paziente;
        dlist.appendChild(opt);
    });
};

document.addEventListener('DOMContentLoaded', () => {
    window.renderAssistitiDatalist(); // Run at startup
});

// Event Delegation for Autofill
document.addEventListener('input', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.getAttribute('list') === 'assistitiDatalist') {
        const assistiti = JSON.parse(localStorage.getItem('antimo_assistiti') || '[]');
        const val = e.target.value.trim();
        const found = assistiti.find(a => a.paziente === val);
        
        if (found) {
            let prefix = "";
            if (e.target.id.startsWith("editProg")) prefix = "editProg";
            else if (e.target.id.startsWith("edit")) prefix = "edit";
            else prefix = "";

            const disEl = document.getElementById(prefix ? prefix + "Dispositivi" : "dispositivi");
            const locEl = document.getElementById(prefix ? prefix + "Localita" : "localita");
            const indEl = document.getElementById(prefix ? prefix + "Indirizzo" : "indirizzo");

            // Solo auto-fill se sono vuoti
            if(disEl && found.dispositivi && !disEl.value) disEl.value = found.dispositivi;
            if(locEl && found.localita && !locEl.value) locEl.value = found.localita;
            if(indEl && found.indirizzo && !indEl.value) indEl.value = found.indirizzo;
        }
    }
});

// ==========================================
// FUNZIONE GLOBALE GENERAZIONE PDF NATIVO (BYPASS POPUP BLOCKER / PWA)
// ==========================================
window.downloadPdfFromHtml = async function(htmlContent, filename) {
    if (!window.html2pdf) {
        try {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        } catch(e) {
            console.error("Errore caricamento html2pdf", e);
            alert("Errore connessione: Impossibile caricare il generatore PDF.");
            return;
        }
    }
    
    const container = document.createElement('div');
    container.innerHTML = htmlContent;
    container.style.padding = '20px';
    container.style.width = '800px'; 
    container.style.background = '#fff';
    container.style.color = '#333';
    
    // Nasconde bottoni stampa inutili nel PDF finale
    const btns = container.querySelectorAll('.print-btn');
    btns.forEach(b => b.style.display = 'none');
    
    document.body.appendChild(container);
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    
    // Mostra Toast di caricamento
    const toastInfo = document.createElement('div');
    toastInfo.innerText = "⏳ Generazione PDF in corso, attendere...";
    toastInfo.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#3b82f6; color:white; padding:10px 20px; border-radius:8px; z-index:999999; font-weight:bold; box-shadow:0 4px 6px rgba(0,0,0,0.1);";
    document.body.appendChild(toastInfo);
    
    try {
        const opt = {
            margin:       10,
            filename:     filename + '.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        // Genera Blob
        const pdfBlob = await html2pdf().set(opt).from(container).output('blob');
        
        // Condivisione Web Mobile (iOS PWA Safe)
        if (navigator.share && navigator.canShare) {
            const file = new File([pdfBlob], filename + '.pdf', { type: 'application/pdf' });
            if (navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: filename,
                        text: 'Ecco il documento PDF del Magazzino.'
                    });
                    return; // Condivisione riuscita / menu aperto
                } catch (shareErr) {
                    console.log("Condivisione Web annullata o fallita, passo al download diretto:", shareErr);
                }
            }
        }
        
        // Download Diretto (PC o Fallback)
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename + '.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        
    } catch(e) {
        console.error("PDF generation err", e);
        alert("Errore salvataggio PDF nativo.");
    } finally {
        if(document.body.contains(container)) document.body.removeChild(container);
        if(document.body.contains(toastInfo)) document.body.removeChild(toastInfo);
    }
};

// ==========================================
// STAMPA MODULO MAGAZZINO / PDF (SEQEX & GLOBAL)
// ==========================================
window.stampaModuloMagazzinoPDF = async function(id, collectionName = 'programmati') {
    try {
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const docSnap = await getDoc(doc(db, collectionName, id));
        if (!docSnap.exists()) {
            alert("Documento non trovato nel database.");
            return;
        }
        const task = docSnap.data();
        
        let htmlStr = `
            <!DOCTYPE html>
            <html><head><title>Preparazione Magazzino - ${task.paziente}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; margin: 0; padding: 20px; font-size: 14px; }
                h1 { color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; font-size: 24px; text-align: center; margin-top: 0; }
                .section { margin-bottom: 20px; }
                .section-title { font-weight: bold; background: #f1f5f9; padding: 8px; border-left: 4px solid #3b82f6; margin-bottom: 10px; font-size: 16px; page-break-after: avoid; }
                .grid { display: flex; flex-wrap: wrap; gap: 10px; }
                .grid-item { flex: 1; min-width: 200px; background: #fff; border: 1px solid #e2e8f0; padding: 10px; border-radius: 4px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th { background: #e2e8f0; text-align: left; padding: 8px; font-size: 14px; border: 1px solid #cbd5e1; }
                td { padding: 8px; border: 1px solid #cbd5e1; font-size: 13px; }
                .print-btn { display: block; width: 100%; padding: 15px; background: #16a34a; color: white; text-align: center; text-decoration: none; font-size: 18px; font-weight: bold; margin-bottom: 20px; cursor: pointer; border: none; border-radius: 8px; }
                @media print { .print-btn { display: none; } body { padding: 0; } }
            </style>
            </head><body>
                <button class="print-btn" onclick="window.print()">🖨️ STAMPA DOCUMENTO FOGLIO PREPARAZIONE</button>
                <h1>Bolla di Preparazione Interna</h1>
                
                <div class="section">
                    <div class="section-title">👤 Dati Paziente & Intervento</div>
                    <div class="grid">
                        <div class="grid-item"><strong>Paziente / Ente:</strong><br>${task.paziente || 'N/D'}</div>
                        <div class="grid-item"><strong>Indirizzo:</strong><br>${task.localita || ''} ${task.indirizzo ? '- '+task.indirizzo : ''}</div>
                        <div class="grid-item"><strong>Telefono:</strong><br>${task.telefono || 'N/D'}</div>
                    </div>
                </div>
        `;
        
        if (task.interventiList && task.interventiList.length > 0) {
            htmlStr += `
                <div class="section">
                    <div class="section-title">📦 Dispositivi, Matricole e Accessori</div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 20%;">Tipo Intervento</th>
                                <th style="width: 30%;">Dispositivo</th>
                                <th style="width: 25%;">Accessori a Corredo</th>
                                <th style="width: 25%;">Matricola Letta</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            task.interventiList.forEach(inv => {
                const tipoInt = window.decodeCodeToLabel ? window.decodeCodeToLabel(inv.tipo, 'interventi') : inv.tipo;
                const disp = window.decodeCodeToLabel ? window.decodeCodeToLabel(inv.disp, 'dispositivi') : inv.disp;
                
                let seqexHtml = '';
                if (disp && disp.toUpperCase().includes('SEQEX')) {
                    seqexHtml = `<div style="margin-top:8px; padding:6px; background:#e0e7ff; border:1px solid #a5b4fc; border-radius:4px;">
                                    <strong>⚙️ SETUP TERAPIA SEQEX:</strong><br>
                                    - Frequenza: ${inv.seqex_volte || '?'} volte al dì per ${inv.seqex_minuti || '?'} min.<br>
                                    - Programmi Selezionati: <strong>${inv.seqex_programmiStr || 'Nessuno'}</strong>
                                 </div>`;
                }

                htmlStr += `
                    <tr>
                        <td><strong>${tipoInt || ''}</strong></td>
                        <td>
                            <strong style="color: #1d4ed8; font-size: 1.1em;">${disp || 'Nessuno'}</strong>
                            ${seqexHtml}
                        </td>
                        <td>${inv.accessoriStr || '-'}</td>
                        <td style="font-family: monospace; font-size: 1.1em;"><strong>${inv.mat || '___________'}</strong></td>
                    </tr>
                `;
            });
            htmlStr += `</tbody></table></div>`;
        } else {
            // Logica Retrocompatibile
            const tipoInt = window.decodeCodeToLabel ? window.decodeCodeToLabel(task.tipo, 'interventi') : task.tipo;
            const disp = window.decodeCodeToLabel ? window.decodeCodeToLabel(task.dispositivi, 'dispositivi') : task.dispositivi;
            htmlStr += `
                <div class="section">
                    <div class="section-title">📦 Dispositivi</div>
                    <div style="padding: 10px; border: 1px solid #cbd5e1;">
                        <strong>Intervento:</strong> ${tipoInt || ''} <br>
                        <strong>Dispositivo:</strong> ${disp || ''} <br>
                        <strong>Accessori:</strong> ${task.accessoriStr || ''} <br>
                        <strong>Matricola:</strong> ${task.matricola || ''}
                    </div>
                </div>
            `;
        }

        if (task.note) {
            htmlStr += `
                <div class="section">
                    <div class="section-title">📝 Note e Indicazioni</div>
                    <div style="border: 1px solid #cbd5e1; padding: 10px; background: #f8fafc; border-radius: 4px; white-space: pre-wrap;">${task.note}</div>
                </div>
            `;
        }
        
        let headerTe = task.tecnicoAssegnato || '';
        if(headerTe === "MAGAZZINO") headerTe = "________________";
        htmlStr += `
                <div style="margin-top: 50px; display: flex; justify-content: space-around;">
                    <div style="text-align: center; border-top: 1px solid #333; width: 35%; padding-top: 5px;">Firma Magazziniere</div>
                    <div style="text-align: center; border-top: 1px solid #333; width: 35%; padding-top: 5px;">Tecnico: ${headerTe}</div>
                </div>
            </body></html>
        `;

        if (window.downloadPdfFromHtml) {
            await window.downloadPdfFromHtml(htmlStr, "Preparazione_" + (task.paziente || 'Documento').replace(/ /g, '_'));
        } else {
            console.error("Funzione generazione PDF mancante");
        }

    } catch (e) {
        console.error("Print Error", e);
        alert("Errore durante la generazione del PDF.");
    }
};

window.stampaListoneMagazzinoPDF = async function() {
    // Controlliamo db anziché isFirebaseConfigured perché in programmati.js Firebase è inizializzato e l'istanza db è globale
    if(!db) return alert("Firebase non configurato.");
    
    try {
        const clBtn = document.getElementById('btnStampaListone');
        if(clBtn) clBtn.innerHTML = "⏳ Generazione in corso...";
        
        const { collection, getDocs, query, where } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        
        const q1 = query(collection(db, "programmati"), where("status", "==", "in_attesa"));
        const q2 = query(collection(db, "programmati"), where("status", "==", "programmato"));
        
        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        let allTasks = [];
        snap1.forEach(d => allTasks.push({id: d.id, ...d.data()}));
        snap2.forEach(d => allTasks.push({id: d.id, ...d.data()}));
        
        if (typeof window.passesIncarichiFilter === 'function') {
            allTasks = allTasks.filter(inv => window.passesIncarichiFilter(inv));
        }

        if(allTasks.length === 0) {
            if(clBtn) clBtn.innerHTML = "🖨️ Stampa Riepilogo Interventi";
            return alert("Non ci sono attività da stampare con i filtri attuali.");
        }

        allTasks.sort((a,b) => {
            let tA = a.dataPrevista ? new Date(a.dataPrevista).getTime() : (a.timestamp ? (a.timestamp.seconds ? a.timestamp.seconds*1000 : a.timestamp) : 0);
            let tB = b.dataPrevista ? new Date(b.dataPrevista).getTime() : (b.timestamp ? (b.timestamp.seconds ? b.timestamp.seconds*1000 : b.timestamp) : 0);
            return tA - tB;
        });

        let htmlStr = `
            <!DOCTYPE html>
            <html><head><title>Riepilogo Attività Magazzino</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; margin: 0; padding: 20px; font-size: 12px; }
                h1 { color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 5px; font-size: 20px; text-align: center; margin-top: 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th { background: #e2e8f0; text-align: left; padding: 6px; font-size: 12px; border: 1px solid #cbd5e1; }
                td { padding: 6px; border: 1px solid #cbd5e1; font-size: 11px; vertical-align: top; }
                .print-btn { display: block; width: 100%; padding: 15px; background: #ea580c; color: white; text-align: center; text-decoration: none; font-size: 18px; font-weight: bold; margin-bottom: 20px; cursor: pointer; border: none; border-radius: 8px; }
                @media print { .print-btn { display: none; } body { padding: 0; } }
            </style>
            </head><body>
                <button class="print-btn" onclick="window.print()">🖨️ PROCEDI ALLA STAMPA DELLA LISTA</button>
                <h1>Elenco Massivo Attività da Evadere / Preparare</h1>
                <p>Data Stampa: ${new Date().toLocaleString('it-IT')}</p>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 15%;">Paziente / Ente</th>
                            <th style="width: 15%;">Indirizzo</th>
                            <th style="width: 35%;">Dispositivi & Accessori & SEQEX</th>
                            <th style="width: 15%;">Matricole</th>
                            <th style="width: 10%;">Stato / Asseg.</th>
                            <th style="width: 10%;">Spunta</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        allTasks.forEach(task => {
            let dispListBlock = "";
            let matListBlock = "";
            
            if (task.interventiList && task.interventiList.length > 0) {
                dispListBlock = task.interventiList.map(i => {
                    const dispLabel = window.decodeCodeToLabel ? window.decodeCodeToLabel(i.disp, 'dispositivi') : i.disp;
                    const typeLabel = window.decodeCodeToLabel ? window.decodeCodeToLabel(i.tipo, 'interventi') : i.tipo;
                    let line = `<div style="margin-bottom: 4px;"><strong>${typeLabel}: ${dispLabel}</strong>`;
                    if(i.accessoriStr) line += ` <br><span style="color:#666; font-size:10px;">Acc: ${i.accessoriStr}</span>`;
                    if(dispLabel && dispLabel.toUpperCase().includes('SEQEX')) {
                         line += ` <br><span style="color:#4338ca; font-size:10px;">SEQEX: ${i.seqex_volte||'?'}x${i.seqex_minuti||'?'}min (${i.seqex_programmiStr||'Setup vuoto'})</span>`;
                    }
                    line += `</div>`;
                    return line;
                }).join('');
                
                matListBlock = task.interventiList.map(i => `<div style="margin-bottom: 4px;">${i.mat || '___'}</div>`).join('');
            } else {
                dispListBlock = `<strong>${window.decodeCodeToLabel ? window.decodeCodeToLabel(task.tipo, 'interventi') : task.tipo}: ${window.decodeCodeToLabel ? window.decodeCodeToLabel(task.dispositivi, 'dispositivi') : task.dispositivi}</strong>`;
                if(task.accessoriStr) dispListBlock += `<br><span style="color:#666; font-size:10px;">Acc: ${task.accessoriStr}</span>`;
                matListBlock = task.matricola || '___';
            }

            let asse = task.tecnicoAssegnato || (task.programmatoDa ? `Da: ${task.programmatoDa}` : '-');

            htmlStr += `
                <tr>
                    <td><strong>${task.paziente}</strong><br><span style="font-size:10px; color:#666;">${task.telefono || ''}</span></td>
                    <td>${task.localita || ''}<br><span style="font-size:10px; color:#666;">${task.indirizzo || ''}</span></td>
                    <td>${dispListBlock}</td>
                    <td style="font-family: monospace;"><strong>${matListBlock}</strong></td>
                    <td>${task.status==='in_attesa' ? '⏳ ATTESA' : '📅 PROG.'}<br><span style="color:#ea580c; font-weight:bold; font-size:10px;">${asse}</span></td>
                    <td style="text-align: center;"><div style="width:20px; height:20px; border:2px solid #333; display:inline-block; border-radius:3px;"></div></td>
                </tr>
            `;
        });

        htmlStr += `</tbody></table></body></html>`;

        if (window.downloadPdfFromHtml) {
            await window.downloadPdfFromHtml(htmlStr, "Elenco_Magazzino_" + Date.now());
        } else {
            console.error("Funzione generazione PDF mancante");
        }
        
        if(clBtn) clBtn.innerHTML = "🖨️ Stampa Riepilogo Magazzino";

    } catch (e) {
        console.error("Print List Error", e);
        alert("Errore durante l'estrazione combinata.");
        const clBtn = document.getElementById('btnStampaListone');
        if(clBtn) clBtn.innerHTML = "🖨️ Stampa Riepilogo Interventi";
    }
};

