import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// ====== CONFIGURAZIONE FIREBASE ======
// INSERISCI QUI I DATI DEL TUO PROGETTO FIREBASE. LI TROVI NELLE IMPOSTAZIONI DI FIREBASE CONSOLE.
const firebaseConfig = {
  apiKey: "INSERISCI_QUI_API_KEY",
  authDomain: "INSERISCI_QUI_AUTH_DOMAIN",
  projectId: "INSERISCI_QUI_PROJECT_ID",
  storageBucket: "INSERISCI_QUI_STORAGE_BUCKET",
  messagingSenderId: "INSERISCI_QUI_MESSAGING_SENDER_ID",
  appId: "INSERISCI_QUI_APP_ID"
};

let app, db, storage;
let isFirebaseConfigured = firebaseConfig.apiKey !== "INSERISCI_QUI_API_KEY";

if (isFirebaseConfigured) {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
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

// Stato App in locale come fallback / offline cache
let dayState = JSON.parse(localStorage.getItem('antimo_dayState')) || { isActive: false, startTime: null, startKm: null };
let activeIntervention = JSON.parse(localStorage.getItem('antimo_activeIntervention')) || null;
let completedInterventions = JSON.parse(localStorage.getItem('antimo_interventions')) || [];

let timerInterval;
let currentFotoBase64 = null;

// DOM Elements
const dayStatusBadge = document.getElementById('dayStatusBadge');
const startDayForm = document.getElementById('startDayForm');
const endDayForm = document.getElementById('endDayForm');
const giornataInfo = document.getElementById('giornataInfo');
const interventionSection = document.getElementById('interventionSection');
const activeInterventionSection = document.getElementById('activeInterventionSection');
const interventiCount = document.getElementById('interventiCount');

const btnStartDay = document.getElementById('btnStartDay');
const btnEndDay = document.getElementById('btnEndDay');
const newInterventionForm = document.getElementById('newInterventionForm');
const btnStartIntervention = document.getElementById('btnStartIntervention');
const btnStopIntervention = document.getElementById('btnStopIntervention');
const btnExportCSV = document.getElementById('btnExportCSV');
const btnClearData = document.getElementById('btnClearData');

// Form Inputs
const inputKmIniziali = document.getElementById('kmIniziali');
const inputKmFinali = document.getElementById('kmFinali');
const iTipo = document.getElementById('tipoAttivita');
const iPaziente = document.getElementById('paziente');
const iDestinazione = document.getElementById('destinazione');
const iDispositivi = document.getElementById('dispositivi');
const iNote = document.getElementById('note');
const iKmPercorsi = document.getElementById('kmPercorsi');
const inputFotoMatricola = document.getElementById('fotoMatricola');
const fotoPreviewContainer = document.getElementById('fotoPreviewContainer');
const fotoPreview = document.getElementById('fotoPreview');
const btnRimuoviFoto = document.getElementById('btnRimuoviFoto');

function initApp() {
    updateUI();
    updateInterventiCount();
    if(activeIntervention) startTimerDisplay();
}

function saveState() {
    localStorage.setItem('antimo_dayState', JSON.stringify(dayState));
    localStorage.setItem('antimo_activeIntervention', JSON.stringify(activeIntervention));
    localStorage.setItem('antimo_interventions', JSON.stringify(completedInterventions));
}

function updateUI() {
    if (dayState.isActive) {
        dayStatusBadge.textContent = "Giornata Attiva";
        dayStatusBadge.classList.add('active');
        startDayForm.classList.add('hidden');
        endDayForm.classList.remove('hidden');
        
        const d = new Date(dayState.startTime);
        giornataInfo.textContent = `Giornata iniziata alle ${padZ(d.getHours())}:${padZ(d.getMinutes())} (Km: ${dayState.startKm})`;
        
        if (activeIntervention) {
            interventionSection.classList.add('hidden');
            activeInterventionSection.classList.remove('hidden');
            document.getElementById('activePaziente').textContent = activeIntervention.paziente;
            document.getElementById('activeDestinazione').textContent = activeIntervention.destinazione;
            const sTime = new Date(activeIntervention.startTime);
            document.getElementById('activeStartTime').textContent = `${padZ(sTime.getHours())}:${padZ(sTime.getMinutes())}`;
        } else {
            interventionSection.classList.remove('hidden');
            activeInterventionSection.classList.add('hidden');
        }
    } else {
        dayStatusBadge.textContent = "Giornata NON Iniziata";
        dayStatusBadge.classList.remove('active');
        startDayForm.classList.remove('hidden');
        endDayForm.classList.add('hidden');
        interventionSection.classList.add('hidden');
        activeInterventionSection.classList.add('hidden');
    }
}

function padZ(num) { return num.toString().padStart(2, '0'); }
function formatDateDMY(date) { return `${padZ(date.getDate())}-${padZ(date.getMonth() + 1)}-${date.getFullYear()}`; }
function formatTime(ms) {
    let ts = Math.floor(ms / 1000);
    return `${padZ(Math.floor(ts / 3600))}:${padZ(Math.floor((ts % 3600) / 60))}:${padZ(ts % 60)}`;
}

function updateInterventiCount() { interventiCount.textContent = completedInterventions.length; }

function startTimerDisplay() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if(activeIntervention) {
            document.getElementById('activeDuration').textContent = formatTime(new Date().getTime() - activeIntervention.startTime);
        }
    }, 1000);
}
function stopTimerDisplay() { clearInterval(timerInterval); }

btnStartDay.addEventListener('click', () => {
    let km = inputKmIniziali.value;
    if(!km) return alert("Inserisci i Km iniziali!");
    dayState = { isActive: true, startTime: new Date().getTime(), startKm: km };
    saveState(); updateUI();
});

btnEndDay.addEventListener('click', () => {
    if(activeIntervention) return alert("Termina l'intervento in corso prima di chiudere la giornata!");
    if(!confirm("Sei sicuro di voler terminare la giornata lavorativa?")) return;
    dayState = { isActive: false, startTime: null, startKm: null };
    inputKmIniziali.value = ""; inputKmFinali.value = "";
    saveState(); updateUI();
});

inputFotoMatricola.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            currentFotoBase64 = event.target.result;
            fotoPreview.src = currentFotoBase64;
            fotoPreviewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
});

btnRimuoviFoto.addEventListener('click', () => {
    inputFotoMatricola.value = ""; currentFotoBase64 = null;
    fotoPreview.src = ""; fotoPreviewContainer.classList.add('hidden');
});

newInterventionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    activeIntervention = {
        id: Date.now().toString(),
        dataObj: new Date().getTime(),
        tipo: iTipo.value,
        paziente: iPaziente.value,
        destinazione: iDestinazione.value,
        dispositivi: iDispositivi.value,
        note: iNote.value,
        fotoMatricola: currentFotoBase64,
        startTime: new Date().getTime()
    };
    saveState(); updateUI(); startTimerDisplay();
    iKmPercorsi.value = ""; 
    inputFotoMatricola.value = ""; currentFotoBase64 = null;
    fotoPreview.src = ""; fotoPreviewContainer.classList.add('hidden');
});

btnStopIntervention.addEventListener('click', async () => {
    if(!activeIntervention) return;
    
    // UI Loading state indication
    const oldBtnText = btnStopIntervention.innerHTML;
    btnStopIntervention.innerHTML = `<span class="btn-icon">⏳</span> SALVATAGGIO IN CORSO...`;
    btnStopIntervention.disabled = true;

    try {
        activeIntervention.endTime = new Date().getTime();
        activeIntervention.kmPercorsi = iKmPercorsi.value || "0";
        
        let photoCloudUrl = null;
        
        // Salvataggio Firebase
        if(isFirebaseConfigured) {
            // Upload Storage
            if(activeIntervention.fotoMatricola) {
                const storageRef = ref(storage, 'matricole/' + activeIntervention.id + '.jpg');
                const uploadResult = await uploadString(storageRef, activeIntervention.fotoMatricola, 'data_url');
                photoCloudUrl = await getDownloadURL(storageRef);
            }
            
            // Upload Firestore
            await addDoc(collection(db, "interventi"), {
                timestamp: serverTimestamp(),
                id: activeIntervention.id,
                tipo: activeIntervention.tipo,
                paziente: activeIntervention.paziente,
                destinazione: activeIntervention.destinazione,
                dispositivi: activeIntervention.dispositivi,
                note: activeIntervention.note,
                startTime: activeIntervention.startTime,
                endTime: activeIntervention.endTime,
                kmPercorsi: activeIntervention.kmPercorsi,
                fotoUrl: photoCloudUrl,
                haFoto: !!activeIntervention.fotoMatricola
            });
        }
        
        // Pulizia base64 locale pesante per non intasare l'excel export e lo storage locale 
        // L'app offline sà solo se c'è o non c'è una foto ("SI"/"NO")
        activeIntervention.fotoUrl = photoCloudUrl;
        activeIntervention.haFoto = !!activeIntervention.fotoMatricola;
        delete activeIntervention.fotoMatricola; 

        completedInterventions.push(activeIntervention);
        activeIntervention = null;
        
        stopTimerDisplay(); saveState(); updateUI(); updateInterventiCount();
        newInterventionForm.reset();

    } catch (error) {
        alert("Errore durante il salvataggio su Cloud: " + error.message + ". Riprovare.");
        console.error(error);
    } finally {
        btnStopIntervention.innerHTML = oldBtnText;
        btnStopIntervention.disabled = false;
    }
});

btnExportCSV.addEventListener('click', async () => {
    // Se Firebase è configurato diamo priorità al cloud, altrimenti prendiamo dal locale
    let interventiDaEsportare = completedInterventions;
    
    if(isFirebaseConfigured) {
        try {
            const btnOld = btnExportCSV.innerHTML;
            btnExportCSV.innerHTML = `<span class="btn-icon">⏳</span> RECUPERO CLOUD...`;
            
            const querySnapshot = await getDocs(collection(db, "interventi"));
            const fetched = [];
            querySnapshot.forEach((doc) => fetched.push(doc.data()));
            
            if(fetched.length > 0) {
                // Ordiniamo in base al tempo
                fetched.sort((a,b) => a.startTime - b.startTime);
                interventiDaEsportare = fetched;
            }
            btnExportCSV.innerHTML = btnOld;
        } catch(e) {
            console.error("Errore recupero da Cloud per CSV, uso i dat locali", e);
            alert("Non è stato possibile caricare i dati dal Cloud, verrà esportata la copia locale.");
        }
    }

    if(interventiDaEsportare.length === 0) return alert("Nessun intervento registrato da esportare.");

    let header = ["Data", "Partenza", "Destinazione", "Tipo attivita", "Paziente / Ente", "Km A/R", "Dispositivi", "Note", "Ora Inizio", "Ora Fine", "HaFoto", "URL_Foto_Cloud"];
    let csvContent = header.join(";") + "\n";

    interventiDaEsportare.forEach(inv => {
        let d = new Date(inv.startTime);
        let e = new Date(inv.endTime);
        let dateStr = formatDateDMY(d);
        let startStr = `${padZ(d.getHours())}:${padZ(d.getMinutes())}`;
        let endStr = `${padZ(e.getHours())}:${padZ(e.getMinutes())}`;
        let descStr = `${inv.tipo} ${inv.dispositivi} ${inv.paziente} - ${inv.destinazione}`.trim();
        let fUrl = inv.fotoUrl || "";

        let row = [
            `"${dateStr}"`, `"${inv.tipo}"`, `"${inv.destinazione.replace(/"/g, '""')}"`,
            `"${descStr.replace(/"/g, '""')}"`, `"${inv.paziente.replace(/"/g, '""')}"`,
            `"${inv.kmPercorsi}"`, `"${inv.dispositivi.replace(/"/g, '""')}"`,
            `"${inv.note.replace(/"/g, '""')}"`, `"${startStr}"`, `"${endStr}"`,
            `"${inv.haFoto ? 'SI' : 'NO'}"`, `"${fUrl}"`
        ];
        csvContent += row.join(";") + "\n";
    });

    try {
        const blob = new Blob(["\uFEFF"+csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Attivita_Esterne_Cloud_${formatDateDMY(new Date())}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch(err) { alert("Errore export."); console.error(err); }
});

btnClearData.addEventListener('click', () => {
    if(confirm("ATTENZIONE: vuoi cancellare la memoria STORICA locale dal dispositivo (I dati su Cloud NON verranno cancellati se già salvati)?")) {
        completedInterventions = []; saveState(); updateInterventiCount();
    }
});

initApp();
