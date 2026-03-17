import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, serverTimestamp, enableIndexedDbPersistence, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// ====== CONFIGURAZIONE FIREBASE ======
// INSERISCI QUI I DATI DEL TUO PROGETTO FIREBASE. LI TROVI NELLE IMPOSTAZIONI DI FIREBASE CONSOLE.
const firebaseConfig = {
  apiKey: "AIzaSyB6CLQZHPG60LqsIKHAlS_Wt5OFXqfwqkw",
  authDomain: "antimo-6a86b.firebaseapp.com",
  projectId: "antimo-6a86b",
  storageBucket: "antimo-6a86b.firebasestorage.app",
  messagingSenderId: "671676764068",
  appId: "1:671676764068:web:95027e0babe3f30042fb31",
  measurementId: "G-WTWNH23PLS"
};

let app, db, storage;
let isFirebaseConfigured = firebaseConfig.apiKey !== "INSERISCI_QUI_API_KEY";

if (isFirebaseConfigured) {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        
        // Abilita la persistenza offline (cache locale di Firebase)
        enableIndexedDbPersistence(db).catch((err) => {
            console.warn("Firebase Persistence offline error: ", err.code);
        });

        storage = getStorage(app);
        console.log("Firebase Inizializzato con successo.");
    } catch(e) {
        console.error("Errore inizializzazione Firebase", e);
        isFirebaseConfigured = false;
    }
} else {
    console.warn("Firebase non configurato. I dati verranno salvati solo in locale (localStorage) finché non aggiornerai le chiavi in app.js.");
    // Piccola notifica la prima volta
    if(!sessionStorage.getItem('fb_warned')) {
        alert("Attenzione: Firebase non è configurato. Inserisci le tue chiavi in app.js per abilitare il salvataggio in Cloud. Per ora i dati restano sul dispositivo.");
        sessionStorage.setItem('fb_warned', 'true');
    }
}
// =====================================

// Stato App (Rimosso dayState)
let activeIntervention = JSON.parse(localStorage.getItem('antimo_activeIntervention')) || null;
let completedInterventions = JSON.parse(localStorage.getItem('antimo_interventions')) || [];
let plannedInterventions = JSON.parse(localStorage.getItem('antimo_plannedInterventions')) || [];

let timerInterval;
let currentAttachments = [];
let currentProgAttachments = []; // Novita: Array allegati per la programmazione
let pendingFileUrlsProgrammati = []; // Trasferisce gli allegati dal programmato all'attivo
let requireKm = JSON.parse(localStorage.getItem('antimo_requireKm')); 
if (requireKm === null) requireKm = false; // default


// DOM Elements
const interventionSection = document.getElementById('interventionSection');
const activeInterventionSection = document.getElementById('activeInterventionSection');
const interventiCount = document.getElementById('interventiCount');
const programmatiCount = document.getElementById('programmatiCount');

const newInterventionForm = document.getElementById('newInterventionForm');
const btnStartIntervention = document.getElementById('btnStartIntervention');
const btnPlanIntervention = document.getElementById('btnPlanIntervention');
const btnStopIntervention = document.getElementById('btnStopIntervention');
const btnViewActivities = document.getElementById('btnViewActivities');
const btnShareCSV = document.getElementById('btnShareCSV');
const btnManualSyncMobile = document.getElementById('btnManualSyncMobile');
const activitiesListContainer = document.getElementById('activitiesListContainer');
const activitiesList = document.getElementById('activitiesList');
const plannedInterventionsSection = document.getElementById('plannedInterventionsSection');
const plannedList = document.getElementById('plannedList');
const npInterventionsSection = document.getElementById('npInterventionsSection');
const npList = document.getElementById('npList');
const oggiInterventionsSection = document.getElementById('oggiInterventionsSection');
const oggiList = document.getElementById('oggiList');
const domaniInterventionsSection = document.getElementById('domaniInterventionsSection');
const domaniList = document.getElementById('domaniList');

// Buttons for Toggling Sections
const btnMostraProgrammati = document.getElementById('btnMostraProgrammati');
const btnMostraNP = document.getElementById('btnMostraNP');
const npCount = document.getElementById('npCount');
const btnMostraOggi = document.getElementById('btnMostraOggi');
const btnMostraDomani = document.getElementById('btnMostraDomani');
const oggiCount = document.getElementById('oggiCount');
const domaniCount = document.getElementById('domaniCount');

// Nuovi Toggles Logic
let isPlannedVisible = false;
let isNpVisible = false;
let isOggiVisible = false;
let isDomaniVisible = false;

if(btnMostraOggi) { btnMostraOggi.addEventListener('click', () => { isOggiVisible = !isOggiVisible; updateUI(); }); }
if(btnMostraDomani) { btnMostraDomani.addEventListener('click', () => { isDomaniVisible = !isDomaniVisible; updateUI(); }); }
if(btnMostraProgrammati) { btnMostraProgrammati.addEventListener('click', () => { isPlannedVisible = !isPlannedVisible; updateUI(); }); }
if(btnMostraNP) { btnMostraNP.addEventListener('click', () => { isNpVisible = !isNpVisible; updateUI(); }); }

// Form Inputs
const iTipo = document.getElementById('tipoAttivita');
const iPaziente = document.getElementById('paziente');
const iLocalita = document.getElementById('localita');
const iIndirizzo = document.getElementById('indirizzo');
const iTelefono = document.getElementById('telefono');
const iDispositiviSelect = document.getElementById('dispositiviSelect');
const iNuovoDispositivo = document.getElementById('nuovoDispositivo');
const iNote = document.getElementById('note');
const inputKmPercorsi = document.getElementById('kmPercorsi');
const inputMatricola = document.getElementById('matricola');
const inputAllegato = document.getElementById('allegatoFile');
const filePreviewContainer = document.getElementById('filePreviewContainer');
const inputDataProgrammata = document.getElementById('dataProgrammata');

// Setting e Nuovi
const btnSettings = document.getElementById('btnSettings');
const settingsModal = document.getElementById('settingsModal');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const toggleRequireKm = document.getElementById('toggleRequireKm');
const kmContainer = document.getElementById('kmContainer');
const activeExtraAttachmentsContainer = document.getElementById('activeExtraAttachmentsContainer');
const activeExtraAttachmentsList = document.getElementById('activeExtraAttachmentsList');
const inputAllegatoProgrammazione = document.getElementById('allegatoProgrammazione');
const progPreviewContainer = document.getElementById('progPreviewContainer');


const justifyModal = document.getElementById('justifyModal');
const justifyReason = document.getElementById('justifyReason');
const btnCancelJustify = document.getElementById('btnCancelJustify');
const btnConfirmJustify = document.getElementById('btnConfirmJustify');

let interventionToJustify = null; // Memorizza l'ID in fase di giustificazione

let customDevices = JSON.parse(localStorage.getItem('antimo_customDevices')) || [];

function initApp() {
    customDevices.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d; opt.textContent = d;
        iDispositiviSelect.insertBefore(opt, iDispositiviSelect.lastElementChild);
    });

    updateUI();
    updateInterventiCount();
    
    // Proviamo a sincronizzare i dati locali vecchi/offline non ancora sul cloud
    setTimeout(syncLocalDataToCloud, 2000);
    setTimeout(syncPlannedInterventions, 1000); // Pesca i programmati dal cloud
}

// Nuova funzione per scaricare gli interventi PROGRAMMATI dal Cloud a tutti i dispositivi
async function syncPlannedInterventions() {
    if (!isFirebaseConfigured) return;
    try {
        const { collection, getDocs, query, where } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        
        // Vogliamo solo quelli che sono esplicitamente 'planned' (o senza status, legacy)
        // Non possiamo usare un 'in' facile se non creiamo indice composto, quindi filtriamo dopo averli presi tutti se sono pochi, 
        // oppure facciamo una query se il db lo permette. Per sicurezza prendiamo tutto e filtriamo per evitare indici mancanti.
        const snap = await getDocs(collection(db, "programmati"));
        let cloudPlanned = [];
        snap.forEach(doc => {
            const data = doc.data();
            if (!data.status || data.status === 'planned' || data.status === 'in_attesa') {
                cloudPlanned.push({ id: doc.id, ...data });
            }
        });
        
        // Ordiniamo per data teorica o per come arrivano
        plannedInterventions = cloudPlanned;
        saveState();
        updateInterventiCount();
        updateUI();
        console.log("Interventi programmati sincronizzati dal Cloud (filtrati 'da fare').");
    } catch(e) {
        console.error("Errore fetch programmati da Firebase:", e);
    }
}

// Funzione per sincronizzare i vecchi interventi salvati solo in localStorage verso Firebase
async function syncLocalDataToCloud() {
    if (!isFirebaseConfigured) return;
    
    // Invece di fidarci del flag locale "cloudSynced" (che potrebbe essersi buggato
    // con il vecchio DB errato), guardiamo TUTTO quello che abbiamo in locale.
    let tuttiIFilePath = completedInterventions;
    if (tuttiIFilePath.length === 0) {
        if (typeof console !== 'undefined') console.log("Nessun intervento in locale.");
        return 0; 
    }
    
    // 1. Peschiamo tutti gli ID già presenti sul CLOUD VERO (antimo-6a86b)
    let cloudIds = [];
    try {
        const snap = await getDocs(collection(db, "interventi"));
        snap.forEach(doc => {
            const data = doc.data();
            if(data.id) cloudIds.push(data.id);
        });
    } catch(e) {
        console.error("Impossibile leggere il cloud per il check", e);
        throw new Error("Impossibile leggere dal Cloud per verificare i doppioni. Controlla i permessi o la connessione.");
    }
    
    // 2. Filtriamo solo quelli locali che MANGANo dal cloud
    let daSincronizzare = tuttiIFilePath.filter(inv => !cloudIds.includes(inv.id));
    
    // DEBUG MANUALE POTENTE PER L'UTENTE
    if (typeof window !== 'undefined' && window._antimo_forcing_sync) {
        alert(`DEBUG:\nMemoria Telefono: ${tuttiIFilePath.length} interventi\nTrovati sul Cloud VERO: ${cloudIds.length}\nQuelli che mancano sul Cloud: ${daSincronizzare.length}`);
    }
    
    if (daSincronizzare.length === 0) {
        // Se tutti quelli locali sono già sul cloud VERO:
        // Assicuriamoci che tutti abbiano la spunta cloudSynced per il futuro
        let dbUpdatedFilter = false;
        tuttiIFilePath.forEach(i => {
            if(!i.cloudSynced) { i.cloudSynced = true; dbUpdatedFilter = true; }
        });
        if(dbUpdatedFilter) saveState();
        
        return 0; // Niente di bloccato
    }
    
    console.log(`Trovati ${daSincronizzare.length} interventi locali MANGANTI dal cloud. Li carico forzatamente...`);
    
    let dbUpdated = false;
    
    for (let inv of daSincronizzare) {
        try {
            // Inviamo l'intervento su Firestore in modo sicuro
            let fileCloudUrl = inv.fileUrl || null;
            
            // Se c'è un file base64 non ancora caricato
            if (inv.fileData && !fileCloudUrl) {
                let ext = "jpg";
                if (inv.fileName) {
                    ext = inv.fileName.split('.').pop();
                } else if (inv.fileType === "application/pdf") {
                    ext = "pdf";
                } else if (inv.fileType && inv.fileType.startsWith("video/")) {
                    ext = "mp4";
                }
                
                try {
                    const storageRef = ref(storage, `allegati/${inv.id}_sync.${ext}`);
                    await uploadString(storageRef, inv.fileData, 'data_url');
                    fileCloudUrl = await getDownloadURL(storageRef);
                } catch(uploadErr) {
                    console.error("Errore upload allegato in auto-sync", uploadErr);
                    // Continuiamo comunque
                }
            }
            const payloadToSave = {
                timestamp: serverTimestamp(),
                id: inv.id || Date.now().toString(),
                tipo: inv.tipo || "Non specificato",
                paziente: inv.paziente || "Sconosciuto",
                localita: inv.localita || inv.destinazione || "",
                indirizzo: inv.indirizzo || "",
                telefono: inv.telefono || "",
                dispositivi: inv.dispositivi || "",
                matricola: inv.matricola || "",
                note: inv.note || "",
                startTime: inv.startTime || Date.now(),
                endTime: inv.endTime || Date.now(),
                kmPercorsi: inv.kmPercorsi || "0",
                fileUrl: fileCloudUrl || null,
                haAllegato: !!(inv.fileData || fileCloudUrl),
                fileType: inv.fileType || null
            };

            await addDoc(collection(db, "interventi"), payloadToSave);
            
            console.log("Intervento offline sincronizzato con successo:", inv.paziente);
            inv.fileUrl = fileCloudUrl;
            
            // In ogni caso marchiamolo come sincronizzato
            inv.cloudSynced = true;
            delete inv.fileData; // Puliamo dal pesante base64 se presente
            dbUpdated = true;
            
        } catch (err) {
            console.error("Errore auto-sync in background per " + inv.paziente, err);
            alert(`Impossibile sincronizzare l'intervento di ${inv.paziente}. Errore: ${err.message}`);
        }
    }
    
    if (dbUpdated) {
        saveState();
        updateInterventiCount();
    }
    
    return daSincronizzare.length;
}

function saveState() {
    localStorage.setItem('antimo_activeIntervention', JSON.stringify(activeIntervention));
    localStorage.setItem('antimo_interventions', JSON.stringify(completedInterventions));
    localStorage.setItem('antimo_plannedInterventions', JSON.stringify(plannedInterventions));
    localStorage.setItem('antimo_customDevices', JSON.stringify(customDevices));
}

function updateUI() {
    // Gestione Vista Intervento Attivo vs Nuovi Interventi
    if (activeIntervention) {
        interventionSection.classList.add('hidden');
        activeInterventionSection.classList.remove('hidden');
        document.getElementById('activePaziente').textContent = activeIntervention.paziente;
        document.getElementById('activeLocalita').textContent = activeIntervention.localita || activeIntervention.destinazione || "N/D";
        document.getElementById('activeIndirizzo').textContent = activeIntervention.indirizzo || "-";
        const telContainer = document.getElementById('activeTelefonoContainer');
        if(activeIntervention.telefono) {
            telContainer.classList.remove('hidden');
            document.getElementById('activeTelefono').textContent = activeIntervention.telefono;
        } else {
            telContainer.classList.add('hidden');
        }
        const sTime = new Date(activeIntervention.startTime);
        document.getElementById('activeStartTime').textContent = `${padZ(sTime.getHours())}:${padZ(sTime.getMinutes())}`;
        
        if (activeIntervention.fileUrlsProgrammati && activeIntervention.fileUrlsProgrammati.length > 0) {
            activeExtraAttachmentsContainer.classList.remove('hidden');
            activeExtraAttachmentsList.innerHTML = '';
            activeIntervention.fileUrlsProgrammati.forEach((url, idx) => {
                const a = document.createElement('a');
                a.href = url;
                a.target = '_blank';
                a.textContent = `📎 Apri Allegato Extra ${idx + 1}`;
                a.style.cssText = "background: var(--gray-bg); padding: 5px 10px; border-radius: 8px; text-decoration: none; font-weight: bold; color: var(--blue-dark); font-size: 0.85rem;";
                activeExtraAttachmentsList.appendChild(a);
            });
        } else {
            activeExtraAttachmentsContainer.classList.add('hidden');
        }

        if (requireKm) {
            kmContainer.classList.remove('hidden');
        } else {
            kmContainer.classList.add('hidden');
        }

    } else {
        interventionSection.classList.remove('hidden');
        activeInterventionSection.classList.add('hidden');
    }

    // Le attività programmate
    const visibiliProg = plannedInterventions.filter(p => !p.status || p.status === 'planned');
    
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    if(visibiliProg.length > 0 && isPlannedVisible) plannedInterventionsSection.classList.remove('hidden');
    else plannedInterventionsSection.classList.add('hidden');

    const oggiProg = visibiliProg.filter(p => p.dataPrevista === todayStr);
    if(oggiProg.length > 0 && isOggiVisible) oggiInterventionsSection.classList.remove('hidden');
    else oggiInterventionsSection.classList.add('hidden');

    const domaniProg = visibiliProg.filter(p => p.dataPrevista === tomorrowStr);
    if(domaniProg.length > 0 && isDomaniVisible) domaniInterventionsSection.classList.remove('hidden');
    else domaniInterventionsSection.classList.add('hidden');

    renderPlannedInterventions(visibiliProg, oggiProg, domaniProg);

    // NP (SE isNpVisible è true)
    const visibiliNP = plannedInterventions.filter(p => p.status === 'in_attesa');
    if(visibiliNP.length > 0 && isNpVisible) {
        npInterventionsSection.classList.remove('hidden');
    } else {
        npInterventionsSection.classList.add('hidden');
    }
    renderNpInterventions();
}

function padZ(num) { return num.toString().padStart(2, '0'); }
function formatDateDMY(date) { return `${padZ(date.getDate())}-${padZ(date.getMonth() + 1)}-${date.getFullYear()}`; }
function formatTime(ms) {
    let ts = Math.floor(ms / 1000);
    return `${padZ(Math.floor(ts / 3600))}:${padZ(Math.floor((ts % 3600) / 60))}:${padZ(ts % 60)}`;
}

async function updateInterventiCount() { 
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    // Aggiorna contatori
    const soloPlanned = plannedInterventions.filter(p => !p.status || p.status === 'planned');
    let cOggi = 0, cDomani = 0;
    soloPlanned.forEach(p => {
        if(p.dataPrevista === todayStr) cOggi++;
        else if(p.dataPrevista === tomorrowStr) cDomani++;
    });

    const soloNP = plannedInterventions.filter(p => p.status === 'in_attesa').length;

    if (programmatiCount) programmatiCount.textContent = soloPlanned.length;
    if (oggiCount) oggiCount.textContent = cOggi;
    if (domaniCount) domaniCount.textContent = cDomani;
    if (npCount) npCount.textContent = soloNP;
    
    if (!isFirebaseConfigured) {
        interventiCount.textContent = completedInterventions.length; 
        return;
    }

    try {
        // Calcola l'inizio e la fine di oggi
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        
        const q = query(
            collection(db, "interventi"), 
            where("startTime", ">=", startOfToday.getTime())
        );
        
        const snap = await getDocs(q);
        
        // Contiamo quanti ne sono stati registrati oggi da chiunque
        interventiCount.textContent = snap.size; 
        
    } catch(e) {
        console.error("Errore fetch conteggi oggi", e);
        // Fallback: mostra il numero locale in caso di errore
        interventiCount.textContent = completedInterventions.length; 
    }
}

function renderSpecialPlannedList(container, filteredData) {
    if(!container) return;
    container.innerHTML = '';
    
    filteredData.forEach(p => {
        // Cerchiamo l'indice reale nell'array globale
        const index = plannedInterventions.indexOf(p);
        
        const div = document.createElement('div');
        div.style.cssText = "background:white; padding:12px; border-radius:8px; border:1px solid #ddd; display:flex; flex-direction:column; gap:10px;";
        
        let dateStr = p.dataPrevista ? p.dataPrevista.split('-').reverse().join('/') : 'N/D';

        div.innerHTML = `
            <div>
                <div style="font-weight:bold; color:var(--blue-dark); font-size:1.05rem;">${p.paziente}</div>
                <div style="font-size:0.85rem; color:#555;">📍 ${p.localita || p.destinazione} - ${p.indirizzo || ''} | 🔧 ${p.tipo}</div>
                <div style="font-size:0.80rem; color:#555;">📞 ${p.telefono || '-'}</div>
                <div style="font-size:0.80rem; color:var(--orange); font-weight:600; margin-top:4px;">🗓 Data Prevista: ${dateStr}</div>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn btn-danger btn-sm" style="flex:1; padding:8px; font-size:0.85rem;" data-action="justify" data-index="${index}">✖ Non Eseguito</button>
                <button class="btn btn-primary btn-orange btn-sm" style="flex:1; padding:8px; font-size:0.85rem;" data-action="avvia" data-index="${index}">▶ INVIA</button>
            </div>
        `;
        
        div.querySelector('button[data-action="avvia"]').addEventListener('click', (e) => {
            const idx = e.target.getAttribute('data-index');
            const dataToLoad = plannedInterventions[idx];
            
            // Popoliamo il form
            iTipo.value = dataToLoad.tipo;
            iPaziente.value = dataToLoad.paziente;
            if(iLocalita) iLocalita.value = dataToLoad.localita || dataToLoad.destinazione || "";
            if(iIndirizzo) iIndirizzo.value = dataToLoad.indirizzo || "";
            if(iTelefono) iTelefono.value = dataToLoad.telefono || "";
            if(customDevices.includes(dataToLoad.dispositivi) || Array.from(iDispositiviSelect.options).some(o=>o.value===dataToLoad.dispositivi)) {
                iDispositiviSelect.value = dataToLoad.dispositivi;
                iNuovoDispositivo.classList.add('hidden');
            } else {
                iDispositiviSelect.value = "_AZI_NUOVO_";
                iNuovoDispositivo.classList.remove('hidden');
                iNuovoDispositivo.value = dataToLoad.dispositivi;
            }
            iNote.value = dataToLoad.note;
            pendingFileUrlsProgrammati = dataToLoad.fileUrlsProgrammati || [];

            plannedInterventions.splice(idx, 1);
            saveState();
            
            // Eliminiamo anche dal cloud (se si avvia, sparisce da programmati e diventerà intervento vero)
            if (isFirebaseConfigured && dataToLoad.id) {
                import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js").then(async ({ doc, deleteDoc }) => {
                    try {
                        // Supponendo che il doc id coincida oppure possiamo fare query, 
                        // Ma per sicurezza lo lasciamo pendente, 
                        // Oppure facciamo delete tramite query!
                        const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                        const q = query(collection(db, "programmati"), where("id", "==", dataToLoad.id));
                        const snaps = await getDocs(q);
                        snaps.forEach(async d => await deleteDoc(doc(db, "programmati", d.id)));
                    } catch(err) { console.error("Errore rimozione cloud programmato", err); }
                });
            }

            updateUI();
            interventionSection.scrollIntoView({ behavior: 'smooth' });
        });
        
        div.querySelector('button[data-action="justify"]').addEventListener('click', (e) => {
            const idx = e.target.getAttribute('data-index');
            interventionToJustify = plannedInterventions[idx];
            justifyReason.value = "";
            justifyModal.classList.remove('hidden');
        });

        container.appendChild(div);
    });
}

function renderPlannedInterventions(tuttiProg = [], oggiProg = [], domaniProg = []) {
    if(plannedList) renderSpecialPlannedList(plannedList, tuttiProg);
    if(oggiList) renderSpecialPlannedList(oggiList, oggiProg);
    if(domaniList) renderSpecialPlannedList(domaniList, domaniProg);
}

function renderNpInterventions() {
    if(!npList) return;
    npList.innerHTML = '';
    
    // Filtra solo quelli in attesa
    const visibili = plannedInterventions.filter(p => p.status === 'in_attesa');
    
    visibili.forEach((p, indexOriginalArray) => {
        // Cerchiamo l'indice reale nell'array globale
        const index = plannedInterventions.indexOf(p);
        
        const div = document.createElement('div');
        div.style.cssText = "background:white; padding:12px; border-radius:8px; border:1px solid #ddd; display:flex; flex-direction:column; gap:10px;";
        
        let noteStr = p.note || p.dispositivi || 'Nessuna nota';

        div.innerHTML = `
            <div>
                <div style="font-weight:bold; color:var(--blue-dark); font-size:1.05rem;">${p.paziente}</div>
                <div style="font-size:0.85rem; color:#555;">📍 ${p.localita || p.destinazione} - ${p.indirizzo || ''} | 🔧 ${p.tipo}</div>
                <div style="font-size:0.80rem; color:#555;">📞 ${p.telefono || '-'}</div>
                <div style="font-size:0.80rem; color:#ef4444; font-weight:600; margin-top:4px;">⏳ Da Programmare</div>
                <div style="font-size:0.75rem; color:#777; margin-top:4px;">${noteStr}</div>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn btn-primary btn-orange btn-sm" style="flex:1; padding:8px; font-size:0.85rem;" data-action="avvia" data-index="${index}">▶ INVIA</button>
            </div>
        `;
        
        div.querySelector('button[data-action="avvia"]').addEventListener('click', (e) => {
            const idx = e.target.getAttribute('data-index');
            const dataToLoad = plannedInterventions[idx];
            
            // Popoliamo il form
            iTipo.value = dataToLoad.tipo;
            iPaziente.value = dataToLoad.paziente;
            if(iLocalita) iLocalita.value = dataToLoad.localita || dataToLoad.destinazione || "";
            if(iIndirizzo) iIndirizzo.value = dataToLoad.indirizzo || "";
            if(iTelefono) iTelefono.value = dataToLoad.telefono || "";
            if(customDevices.includes(dataToLoad.dispositivi) || Array.from(iDispositiviSelect.options).some(o=>o.value===dataToLoad.dispositivi)) {
                iDispositiviSelect.value = dataToLoad.dispositivi;
                iNuovoDispositivo.classList.add('hidden');
            } else {
                iDispositiviSelect.value = "_AZI_NUOVO_";
                iNuovoDispositivo.classList.remove('hidden');
                iNuovoDispositivo.value = dataToLoad.dispositivi;
            }
            iNote.value = dataToLoad.note;
            pendingFileUrlsProgrammati = dataToLoad.fileUrlsProgrammati || [];

            plannedInterventions.splice(idx, 1);
            saveState();
            
            // Eliminiamo anche dal cloud (se si avvia, sparisce da programmati e diventerà intervento vero)
            if (isFirebaseConfigured && dataToLoad.id) {
                import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js").then(async ({ doc, deleteDoc }) => {
                    try {
                        const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                        const q = query(collection(db, "programmati"), where("id", "==", dataToLoad.id));
                        const snaps = await getDocs(q);
                        snaps.forEach(async d => await deleteDoc(doc(db, "programmati", d.id)));
                    } catch(err) { console.error("Errore rimozione cloud np", err); }
                });
            }

            updateUI();
            updateInterventiCount();
            interventionSection.scrollIntoView({ behavior: 'smooth' });
        });

        npList.appendChild(div);
    });
}

// LOGICA MODALE GIUSTIFICAZIONE
btnCancelJustify.addEventListener('click', () => {
    justifyModal.classList.add('hidden');
    interventionToJustify = null;
});

btnConfirmJustify.addEventListener('click', async () => {
    const reason = justifyReason.value.trim();
    if(!reason) return alert("Devi inserire una motivazione!");
    
    if(interventionToJustify) {
        interventionToJustify.status = 'justified_not_executed';
        interventionToJustify.motivazione = reason;
        
        if (isFirebaseConfigured && interventionToJustify.id) {
            try {
                const { doc, updateDoc, collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                const q = query(collection(db, "programmati"), where("id", "==", interventionToJustify.id));
                const snaps = await getDocs(q);
                
                let updated = false;
                snaps.forEach(async (d) => {
                    await updateDoc(doc(db, "programmati", d.id), {
                        status: 'justified_not_executed',
                        motivazione: reason
                    });
                    updated = true;
                });
                
                if(!updated && interventionToJustify.id.startsWith('plan_')) {
                     // Fallback se per caso non era ancora salito
                     const { addDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                     await addDoc(collection(db, "programmati"), interventionToJustify);
                }
            } catch(e) {
                console.error("Errore giustificazione", e);
            }
        }
        
        // Rimuoviamolo dalla vista locale
        plannedInterventions = plannedInterventions.filter(p => p.id !== interventionToJustify.id);
        saveState();
    }
    
    justifyModal.classList.add('hidden');
    interventionToJustify = null;
    
    if(isFirebaseConfigured) {
        syncPlannedInterventions(); // resetta Ui e conteggi
    } else {
        updateUI();
        updateInterventiCount();
    }
});

// IMPOSTAZIONI EVENT LISTENERS
if(btnSettings) {
    btnSettings.addEventListener('click', () => {
        toggleRequireKm.checked = requireKm;
        settingsModal.classList.remove('hidden');
    });
}
if(btnCloseSettings) {
    btnCloseSettings.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });
}
if(toggleRequireKm) {
    toggleRequireKm.addEventListener('change', (e) => {
        requireKm = e.target.checked;
        localStorage.setItem('antimo_requireKm', JSON.stringify(requireKm));
        if(activeIntervention) updateUI();
    });
}

function startTimerDisplay() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if(activeIntervention) {
            document.getElementById('activeDuration').textContent = formatTime(new Date().getTime() - activeIntervention.startTime);
        }
    }, 1000);
}
function stopTimerDisplay() { clearInterval(timerInterval); }



function renderAttachmentsPreview() {
    filePreviewContainer.innerHTML = '';
    if(currentAttachments.length === 0) {
        filePreviewContainer.classList.add('hidden');
        return;
    }
    
    filePreviewContainer.classList.remove('hidden');
    currentAttachments.forEach((att, index) => {
        const div = document.createElement('div');
        div.style.cssText = "position: relative; border: 1px solid #ccc; border-radius: 8px; padding: 5px; text-align: center; width: 100px; display: flex; flex-direction: column; align-items: center; background: white;";
        
        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = "&times;";
        removeBtn.style.cssText = "position: absolute; top: -5px; right: -5px; background: red; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-weight: bold;";
        removeBtn.onclick = () => {
            currentAttachments.splice(index, 1);
            renderAttachmentsPreview();
        };
        
        if (att.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = att.data;
            img.style.cssText = "width: 80px; height: 80px; object-fit: cover; border-radius: 4px;";
            div.appendChild(img);
        } else {
            const icon = document.createElement('div');
            icon.style.cssText = "width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; font-size: 2rem; background: #f1f5f9; border-radius: 4px;";
            icon.innerText = "📎";
            div.appendChild(icon);
            const nameObj = document.createElement('div');
            nameObj.style.cssText = "font-size: 0.6rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; margin-top: 4px;";
            nameObj.innerText = att.name;
            div.appendChild(nameObj);
        }
        
        div.appendChild(removeBtn);
        filePreviewContainer.appendChild(div);
    });
}

inputAllegato.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;
    
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(event) {
            currentAttachments.push({
                data: event.target.result,
                type: file.type,
                name: file.name
            });
            renderAttachmentsPreview();
        };
        reader.readAsDataURL(file);
    });
    
    // Non azzeriamo l'input per permettere selezioni successive se desiderato,
    // o lo azzeriamo per forzare il re-trigger a parità di file. È meglio azzerarlo
    // dato che gestiamo l'array in JS.
    inputAllegato.value = "";
});

function renderProgAttachmentsPreview() {
    progPreviewContainer.innerHTML = '';
    if(currentProgAttachments.length === 0) {
        progPreviewContainer.classList.add('hidden');
        return;
    }
    
    progPreviewContainer.classList.remove('hidden');
    currentProgAttachments.forEach((att, index) => {
        const div = document.createElement('div');
        div.style.cssText = "position: relative; border: 1px solid #ea580c; border-radius: 8px; padding: 5px; text-align: center; width: 100px; display: flex; flex-direction: column; align-items: center; background: white;";
        
        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = "&times;";
        removeBtn.style.cssText = "position: absolute; top: -5px; right: -5px; background: red; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-weight: bold;";
        removeBtn.onclick = () => {
            currentProgAttachments.splice(index, 1);
            renderProgAttachmentsPreview();
        };
        
        if (att.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = att.data;
            img.style.cssText = "width: 80px; height: 80px; object-fit: cover; border-radius: 4px;";
            div.appendChild(img);
        } else {
            const icon = document.createElement('div');
            icon.style.cssText = "width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; font-size: 2rem; background: #fff7ed; border-radius: 4px; color: #ea580c;";
            icon.innerText = "📎";
            div.appendChild(icon);
            const nameObj = document.createElement('div');
            nameObj.style.cssText = "font-size: 0.6rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; margin-top: 4px; color: #ea580c;";
            nameObj.innerText = att.name;
            div.appendChild(nameObj);
        }
        
        div.appendChild(removeBtn);
        progPreviewContainer.appendChild(div);
    });
}

inputAllegatoProgrammazione.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;
    
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(event) {
            currentProgAttachments.push({
                data: event.target.result,
                type: file.type,
                name: file.name
            });
            renderProgAttachmentsPreview();
        };
        reader.readAsDataURL(file);
    });
    
    inputAllegatoProgrammazione.value = "";
});

iDispositiviSelect.addEventListener('change', (e) => {
    if(e.target.value === "_AZI_NUOVO_") {
        iNuovoDispositivo.classList.remove('hidden');
        iNuovoDispositivo.focus();
    } else {
        iNuovoDispositivo.classList.add('hidden');
    }
});

btnPlanIntervention.addEventListener('click', async () => {
    if(!iTipo.value || !iPaziente.value || !iLocalita.value || !iIndirizzo.value) {
        return alert("Compila Tipo, Paziente, Località e Indirizzo per salvare l'intervento programmato!");
    }
    
    let dispFinale = iDispositiviSelect.value;
    if(dispFinale === "_AZI_NUOVO_") dispFinale = iNuovoDispositivo.value.trim();
    if(!dispFinale) dispFinale = "Nessuno";

    // Calcola data prevista (default: domani)
    let dProgrammata = inputDataProgrammata.value;
    if (!dProgrammata) {
        let domani = new Date();
        domani.setDate(domani.getDate() + 1);
        dProgrammata = domani.toISOString().split('T')[0];
    }

    const plannedId = "plan_" + Date.now().toString();

    const oldBtnPlanHtml = btnPlanIntervention.innerHTML;
    btnPlanIntervention.innerHTML = `<span class="btn-icon">⏳</span> CARICAMENTO...`;
    btnPlanIntervention.disabled = true;

    // Upload prog attachments on Firebase
    let fileUrlsProgrammati = [];
    if(isFirebaseConfigured && currentProgAttachments.length > 0) {
        try {
            const { ref, uploadString, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js");
            for(let i = 0; i < currentProgAttachments.length; i++) {
                const att = currentProgAttachments[i];
                let ext = "jpg";
                if(att.name) ext = att.name.split('.').pop();
                else if(att.type === "application/pdf") ext = "pdf";
                else if(att.type && att.type.startsWith("video/")) ext = "mp4";

                const storageRef = ref(storage, `allegatiProg/${plannedId}_${i}.${ext}`);
                await uploadString(storageRef, att.data, 'data_url');
                const url = await getDownloadURL(storageRef);
                fileUrlsProgrammati.push(url);
            }
        } catch(err) {
            console.error("Errore upload allegati programmazione", err);
        }
    }

    const planned = {
        id: plannedId,
        tipo: iTipo.value,
        paziente: iPaziente.value,
        localita: iLocalita.value,
        indirizzo: iIndirizzo.value,
        telefono: iTelefono ? iTelefono.value : "",
        dispositivi: dispFinale,
        note: iNote.value,
        dataPrevista: dProgrammata,
        status: 'planned',
        timestamp: new Date().getTime(),
        fileUrlsProgrammati: fileUrlsProgrammati
    };

    // Salvataggio DIRETTO sul cloud VERO (Firestore programmati)
    if (isFirebaseConfigured) {
        try {
            const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            // Usiamo l'id fisso per facilitare cancellazioni future
            await addDoc(collection(db, "programmati"), planned);
            console.log("Programmato salvato su Cloud");
        } catch(e) {
            console.error("Errore salvataggio programmato in Cloud", e);
            alert("Errore salvataggio nel Cloud. Salvo solo in locale.");
            plannedInterventions.push(planned);
            saveState();
        }
    } else {
        plannedInterventions.push(planned);
        saveState();
    }
    
    // Aggiorniamo la lista globale prendendola da Firestore
    if(isFirebaseConfigured) {
        await syncPlannedInterventions();
    } else {
        updateUI();
    }
    
    // Reset form
    newInterventionForm.reset();
    iDispositiviSelect.value = "";
    iNuovoDispositivo.classList.add('hidden');
    inputAllegato.value = ""; 
    currentAttachments = [];
    filePreviewContainer.innerHTML = '';
    filePreviewContainer.classList.add('hidden');
    inputAllegatoProgrammazione.value = "";
    currentProgAttachments = [];
    progPreviewContainer.innerHTML = '';
    progPreviewContainer.classList.add('hidden');
    
    btnPlanIntervention.innerHTML = oldBtnPlanHtml;
    btnPlanIntervention.disabled = false;

    updateUI();
});

newInterventionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    if(activeIntervention) {
        return alert("ATTENZIONE: Hai già un'attività in corso! Devi prima cliccare su 'TERMINA ATTIVITÀ' prima di poterne iniziare una nuova.");
    }
    
    let dispFinale = iDispositiviSelect.value;
    if(dispFinale === "_AZI_NUOVO_") {
        dispFinale = iNuovoDispositivo.value.trim();
        if(!dispFinale) return alert("Scrivi il nome del nuovo dispositivo!");
        if(!customDevices.includes(dispFinale)) {
            customDevices.push(dispFinale);
            const opt = document.createElement('option');
            opt.value = dispFinale; opt.textContent = dispFinale;
            iDispositiviSelect.insertBefore(opt, iDispositiviSelect.lastElementChild);
        }
    } else if(!dispFinale) {
        return alert("Seleziona un dispositivo!");
    }

    activeIntervention = {
        id: Date.now().toString(),
        dataObj: new Date().getTime(),
        tipo: iTipo.value,
        paziente: iPaziente.value,
        localita: iLocalita.value,
        indirizzo: iIndirizzo.value,
        telefono: iTelefono ? iTelefono.value : "",
        dispositivi: dispFinale,
        matricola: inputMatricola.value.trim(),
        note: iNote.value,
        attachments: currentAttachments, // Array of structured attachment objects
        fileUrlsProgrammati: pendingFileUrlsProgrammati, // Trasferisci da programmato se esiste
        startTime: new Date().getTime()
    };
    pendingFileUrlsProgrammati = [];
    
    saveState(); updateUI(); startTimerDisplay();
    inputKmPercorsi.value = ""; 
    iDispositiviSelect.value = "";
    inputMatricola.value = "";
    iNuovoDispositivo.classList.add('hidden');
    iNuovoDispositivo.value = "";
    inputAllegato.value = ""; 
    currentAttachments = [];
    filePreviewContainer.innerHTML = '';
    filePreviewContainer.classList.add('hidden');
});

btnStopIntervention.addEventListener('click', async () => {
    if(!activeIntervention) return;
    
    // UI Loading state indication
    const oldBtnText = btnStopIntervention.innerHTML;
    btnStopIntervention.innerHTML = `<span class="btn-icon">⏳</span> SALVATAGGIO IN CORSO...`;
    btnStopIntervention.disabled = true;

    let fileCloudUrl = null;
    let cloudSaveSuccess = false;
    let uploadedUrls = [];

    // Validazione km obbligatori se abilitati da impostazioni
    if (requireKm && !inputKmPercorsi.value) {
        alert("Inserisci i Km percorsi prima di confermare la chiusura.");
        btnStopIntervention.innerHTML = oldBtnText;
        btnStopIntervention.disabled = false;
        return;
    }

    // Aggiorniamo i dati base per finalizzare
    activeIntervention.endTime = new Date().getTime();
    activeIntervention.kmPercorsi = inputKmPercorsi.value || "0";

    try {
        if(isFirebaseConfigured) {
            // Upload multiplo file
            if(activeIntervention.attachments && activeIntervention.attachments.length > 0) {
                for(let i = 0; i < activeIntervention.attachments.length; i++) {
                    const att = activeIntervention.attachments[i];
                    let ext = "jpg";
                    if(att.name) ext = att.name.split('.').pop();
                    else if(att.type === "application/pdf") ext = "pdf";
                    else if(att.type && att.type.startsWith("video/")) ext = "mp4";

                    const storageRef = ref(storage, `allegati/${activeIntervention.id}_${i}.${ext}`);
                    await uploadString(storageRef, att.data, 'data_url');
                    const url = await getDownloadURL(storageRef);
                    uploadedUrls.push(url);
                }
            }

            // Vecchia gestione salvataggio (se un intervento vecchio era in pending)
            if(activeIntervention.fileData && uploadedUrls.length === 0) {
                let ext = "jpg";
                if(activeIntervention.fileName) ext = activeIntervention.fileName.split('.').pop();
                else if(activeIntervention.fileType === "application/pdf") ext = "pdf";
                
                const storageRef = ref(storage, `allegati/${activeIntervention.id}.` + ext);
                await uploadString(storageRef, activeIntervention.fileData, 'data_url');
                const url = await getDownloadURL(storageRef);
                uploadedUrls.push(url);
            }

            // Upload Firestore
            const payloadToSave = {
                timestamp: serverTimestamp(),
                id: activeIntervention.id,
                tipo: activeIntervention.tipo || "Gen",
                paziente: activeIntervention.paziente || "Sconosciuto",
                localita: activeIntervention.localita || activeIntervention.destinazione || "",
                indirizzo: activeIntervention.indirizzo || "",
                telefono: activeIntervention.telefono || "",
                dispositivi: activeIntervention.dispositivi || "",
                matricola: activeIntervention.matricola || "",
                note: activeIntervention.note || "",
                startTime: activeIntervention.startTime || Date.now(),
                endTime: activeIntervention.endTime || Date.now(),
                kmPercorsi: activeIntervention.kmPercorsi || "0",
                fileUrls: uploadedUrls.length > 0 ? uploadedUrls : null, // Nuovo campo array
                haAllegato: uploadedUrls.length > 0 // Mantenuto per compatibilità
            };

            // Rimuovo chiavi undefined per evitare alert silenziosi
            Object.keys(payloadToSave).forEach(k => payloadToSave[k] === undefined && delete payloadToSave[k]);

            await addDoc(collection(db, "interventi"), payloadToSave);
            
            cloudSaveSuccess = true;
        }
    } catch (error) {
        console.error("Errore salvataggio Cloud, forzo modalità offline:", error);
        alert("Rete instabile o errore Cloud. L'intervento è stato SALVATO IN LOCALE. Clicca poi su 'Sincronizza' appena la rete torna.");
    }

    // Eseguo SEMPRE il passaggio logico locale
    activeIntervention.cloudSynced = cloudSaveSuccess;
    activeIntervention.fileUrls = (uploadedUrls && uploadedUrls.length > 0) ? uploadedUrls : (activeIntervention.fileUrls || null);
    activeIntervention.haAllegato = !!(activeIntervention.attachments?.length > 0 || activeIntervention.fileUrls?.length > 0);
    
    // Pulizia dei pesanti base64 prima di salvare in mem locale
    delete activeIntervention.attachments; 
    delete activeIntervention.fileData; 

    completedInterventions.push(activeIntervention);
    activeIntervention = null;
    
    stopTimerDisplay(); saveState(); updateUI(); updateInterventiCount();
    newInterventionForm.reset();

    btnStopIntervention.innerHTML = oldBtnText;
    btnStopIntervention.disabled = false;
});

if(btnManualSyncMobile) {
    btnManualSyncMobile.addEventListener('click', async () => {
        const oldHtml = btnManualSyncMobile.innerHTML;
        try {
            btnManualSyncMobile.innerHTML = `<span class="btn-icon">⏳</span> RISOLUZIONE...`;
            btnManualSyncMobile.disabled = true;
            
            // Forziamo il controllo della configurazione
            if (!isFirebaseConfigured) {
                alert("Errore: Firebase risulta non configurato in questo momento. Aspetta qualche secondo che si colleghi alla rete.");
                return;
            }
            
            // Forziamo il flag per far scattare l'alert di debug in syncLocalDataToCloud
            window._antimo_forcing_sync = true;
            
            const count = await syncLocalDataToCloud();
            window._antimo_forcing_sync = false;
            
            if (count === 0) {
                alert("Ottimo! Non ci sono dati bloccati sul tuo telefono. Tutto quello che hai registrato risulta già sincronizzato (oppure è stato perso dalla cache precedentemente).");
            } else {
                alert(`Perfetto! ${count} interventi bloccati sono stati salvati forzatamente nel Cloud!`);
            }
            
        } catch(e) {
            alert("ERRORE DI RETE o PERMESSI FIREBASE: " + e.message);
        } finally {
            btnManualSyncMobile.innerHTML = oldHtml;
            btnManualSyncMobile.disabled = false;
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if(btnShareCSV) {
        btnShareCSV.addEventListener('click', async () => {
             // Generiamo CSV come nell'export
            let interventiDaEsportare = completedInterventions;
            if(isFirebaseConfigured) {
                try {
                    btnShareCSV.innerHTML = `<span class="btn-icon">⏳</span> PREPARO...`;
                    const snap = await getDocs(collection(db, "interventi"));
                    const fetched = [];
                    snap.forEach(doc => fetched.push(doc.data()));
                    if(fetched.length > 0) {
                        fetched.sort((a,b) => a.startTime - b.startTime);
                        interventiDaEsportare = fetched;
                    }
                } catch(e) { console.error("Cloud fetch share err", e); }
            }
            
            if(interventiDaEsportare.length === 0) {
                btnShareCSV.innerHTML = `<span class="btn-icon">📤</span> ESTRAI & CONDIVIDI`;
                return alert("Nessun intervento da condividere.");
            }

            let header = ["Data", "Partenza", "Destinazione", "Tipo attivita", "Paziente / Ente", "Km A/R", "Dispositivi", "Matricola", "Note", "Ora Inizio", "Ora Fine", "Ha_Allegato", "URL_Allegato_Cloud"];
            let csvContent = header.join(";") + "\n";
            interventiDaEsportare.forEach(inv => {
                let d = new Date(inv.startTime), e = new Date(inv.endTime);
                let row = [
                    `"${formatDateDMY(d)}"`, `"${inv.tipo}"`, `"${inv.destinazione.replace(/"/g, '""')}"`,
                    `"${(inv.tipo + ' ' + inv.dispositivi + ' ' + inv.paziente + ' ' + inv.destinazione).trim().replace(/"/g, '""')}"`,
                    `"${inv.paziente.replace(/"/g, '""')}"`, `"${inv.kmPercorsi}"`, `"${inv.dispositivi.replace(/"/g, '""')}"`, `"${inv.matricola ? inv.matricola.replace(/"/g, '""') : ''}"`,
                    `"${inv.note.replace(/"/g, '""')}"`, `"${padZ(d.getHours())}:${padZ(d.getMinutes())}"`, `"${padZ(e.getHours())}:${padZ(e.getMinutes())}"`,
                    `"${inv.haAllegato ? 'SI' : 'NO'}"`, `"${inv.fileUrl || ""}"`
                ];
                csvContent += row.join(";") + "\n";
            });

            try {
                // Su Android/PWA a volte i blob CSV generati a runtime vengono bloccati dalle policy di sicurezza.
                // Proviamo a condividere direttamente il testo ben formattato a WhatsApp/Telegram
                let textShare = "📝 *REPORT ATTIVITÀ:*\n\n";
                interventiDaEsportare.forEach(inv => {
                    let d = new Date(inv.startTime), e = new Date(inv.endTime);
                    textShare += `🔹 *${inv.paziente}* (${inv.destinazione})\n` +
                                 `   ⌚ ${padZ(d.getHours())}:${padZ(d.getMinutes())} - ${padZ(e.getHours())}:${padZ(e.getMinutes())} | Km: ${inv.kmPercorsi}\n` +
                                 `   📌 ${inv.tipo} (${inv.dispositivi})\n`;
                    if(inv.fileUrl) textShare += `   📎 Link: ${inv.fileUrl}\n`;
                    if(inv.note) textShare += `   📝 Note: ${inv.note}\n`;
                    textShare += "\n";
                });

                if (navigator.share) {
                    await navigator.share({
                        title: 'Attività Giornata',
                        text: textShare
                    });
                } else {
                    // Fallback
                    const blob = new Blob(["\uFEFF"+csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `Attivita_Esterne_${formatDateDMY(new Date())}.csv`;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                }
            } catch(err) {
                 console.error(err);
            } finally {
                btnShareCSV.innerHTML = `<span class="btn-icon">📤</span> ESTRAI & CONDIVIDI`;
            }
        });
    }
});

if(btnViewActivities) {
    btnViewActivities.addEventListener('click', () => {
        if(activitiesListContainer.classList.contains('hidden')) {
            activitiesListContainer.classList.remove('hidden');
            renderActivitiesList();
            btnViewActivities.innerHTML = `<span class="btn-icon">🙈</span> NASCONDI ATTIVITÀ`;
        } else {
            activitiesListContainer.classList.add('hidden');
            btnViewActivities.innerHTML = `<span class="btn-icon">👁</span> VISUALIZZA ATTIVITÀ`;
        }
    });
}

function renderActivitiesList() {
    activitiesList.innerHTML = '';
    if(completedInterventions.length === 0) {
        activitiesList.innerHTML = '<p style="text-align:center; color:gray; font-size:0.9rem;">Nessuna attività registrata in memoria.</p>';
        return;
    }
    
    // Mostriamo dalla più recente alla più vecchia
    const revList = [...completedInterventions].reverse();
    
    revList.forEach(inv => {
        const d = new Date(inv.startTime);
        const div = document.createElement('div');
        div.style.cssText = "background:white; padding:10px; margin-bottom:10px; border-radius:6px; border-left:4px solid var(--blue-primary); box-shadow:0 1px 3px rgba(0,0,0,0.1);";
        
        let fileBadget = inv.haAllegato ? `<span style="font-size:0.8rem; background:var(--blue-light); padding:2px 5px; border-radius:4px; margin-left:5px;">📎 Allegato</span>` : '';
        
        div.innerHTML = `
            <div style="font-size:0.85rem; color:gray; margin-bottom:4px;">
                ${formatDateDMY(d)} - ${padZ(d.getHours())}:${padZ(d.getMinutes())}
                ${fileBadget}
            </div>
            <div style="font-weight:600; color:#333;">${inv.tipo}</div>
            <div style="font-size:0.95rem; margin:3px 0;"><strong>Paz/Ente:</strong> ${inv.paziente}</div>
            <div style="font-size:0.9rem;"><strong>Disp:</strong> ${inv.dispositivi}</div>
            <div style="font-size:0.85rem; color:#666; margin-top:5px;">📍 ${inv.localita || inv.destinazione} - ${inv.indirizzo || ''}</div>
            <div style="font-size:0.80rem; color:#666;">📞 ${inv.telefono || '-'}</div>
        `;
        activitiesList.appendChild(div);
    });
}

initApp();
