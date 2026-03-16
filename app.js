import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
let currentFileBase64 = null;
let currentFileType = null;
let currentFileName = null;

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
const btnViewActivities = document.getElementById('btnViewActivities');
const activitiesListContainer = document.getElementById('activitiesListContainer');
const activitiesList = document.getElementById('activitiesList');
const btnClearData = document.getElementById('btnClearData');

// Form Inputs
const inputKmIniziali = document.getElementById('kmIniziali');
const inputKmFinali = document.getElementById('kmFinali');
const iTipo = document.getElementById('tipoAttivita');
const iPaziente = document.getElementById('paziente');
const iDestinazione = document.getElementById('destinazione');
const iDispositiviSelect = document.getElementById('dispositiviSelect');
const iNuovoDispositivo = document.getElementById('nuovoDispositivo');
const iNote = document.getElementById('note');
const iKmPercorsi = document.getElementById('kmPercorsi');
const inputFotoMatricola = document.getElementById('fotoMatricola');
const fotoPreviewContainer = document.getElementById('fotoPreviewContainer');
const fotoPreview = document.getElementById('fotoPreview');
const btnRimuoviFoto = document.getElementById('btnRimuoviFoto');

let customDevices = JSON.parse(localStorage.getItem('antimo_customDevices')) || [];

function initApp() {
    customDevices.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d; opt.textContent = d;
        iDispositiviSelect.insertBefore(opt, iDispositiviSelect.lastElementChild);
    });

    updateUI();
    updateInterventiCount();
    if(activeIntervention) startTimerDisplay();
}

function saveState() {
    localStorage.setItem('antimo_dayState', JSON.stringify(dayState));
    localStorage.setItem('antimo_activeIntervention', JSON.stringify(activeIntervention));
    localStorage.setItem('antimo_interventions', JSON.stringify(completedInterventions));
    localStorage.setItem('antimo_customDevices', JSON.stringify(customDevices));
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

inputAllegato.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        currentFileType = file.type;
        currentFileName = file.name;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            currentFileBase64 = event.target.result;
            
            // UI Update basato sul tipo
            filePreviewContainer.classList.remove('hidden');
            if(currentFileType.startsWith('image/')) {
                fotoPreview.src = currentFileBase64;
                fotoPreview.style.display = 'block';
                filePreviewName.style.display = 'none';
            } else {
                fotoPreview.style.display = 'none';
                filePreviewName.textContent = "📎 " + file.name;
                filePreviewName.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    }
});

btnRimuoviFile.addEventListener('click', () => {
    inputAllegato.value = ""; 
    currentFileBase64 = null;
    currentFileType = null;
    currentFileName = null;
    fotoPreview.src = ""; 
    fotoPreview.style.display = 'none';
    filePreviewName.style.display = 'none';
    filePreviewContainer.classList.add('hidden');
});

iDispositiviSelect.addEventListener('change', (e) => {
    if(e.target.value === "_AZI_NUOVO_") {
        iNuovoDispositivo.classList.remove('hidden');
        iNuovoDispositivo.focus();
    } else {
        iNuovoDispositivo.classList.add('hidden');
    }
});

newInterventionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
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
        destinazione: iDestinazione.value,
        dispositivi: dispFinale,
        note: iNote.value,
        fileData: currentFileBase64,
        fileType: currentFileType,
        fileName: currentFileName,
        startTime: new Date().getTime()
    };
    saveState(); updateUI(); startTimerDisplay();
    iKmPercorsi.value = ""; 
    iDispositiviSelect.value = "";
    iNuovoDispositivo.classList.add('hidden');
    iNuovoDispositivo.value = "";
    inputAllegato.value = ""; 
    currentFileBase64 = null;
    currentFileType = null;
    currentFileName = null;
    fotoPreview.src = ""; 
    fotoPreview.style.display = 'none';
    filePreviewName.style.display = 'none';
    filePreviewContainer.classList.add('hidden');
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
        
        let fileCloudUrl = null;
        
        // Salvataggio Firebase
        if(isFirebaseConfigured && activeIntervention.fileData) {
            // Estrapoliamo estensione originale
            let ext = "jpg";
            if(activeIntervention.fileName) {
                ext = activeIntervention.fileName.split('.').pop();
            } else if(activeIntervention.fileType === "application/pdf") {
                ext = "pdf";
            } else if(activeIntervention.fileType && activeIntervention.fileType.startsWith("video/")) {
                ext = "mp4";
            }

            const storageRef = ref(storage, `allegati/${activeIntervention.id}.${ext}`);
            const uploadResult = await uploadString(storageRef, activeIntervention.fileData, 'data_url');
            fileCloudUrl = await getDownloadURL(storageRef);
        }
            
        if(isFirebaseConfigured) {
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
                fileUrl: fileCloudUrl,
                haAllegato: !!activeIntervention.fileData,
                fileType: activeIntervention.fileType || null
            });
        }
        
        // Pulizia base64
        activeIntervention.fileUrl = fileCloudUrl;
        activeIntervention.haAllegato = !!activeIntervention.fileData;
        delete activeIntervention.fileData; 

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

    let header = ["Data", "Partenza", "Destinazione", "Tipo attivita", "Paziente / Ente", "Km A/R", "Dispositivi", "Note", "Ora Inizio", "Ora Fine", "Ha_Allegato", "URL_Allegato_Cloud"];
    let csvContent = header.join(";") + "\n";

    interventiDaEsportare.forEach(inv => {
        let d = new Date(inv.startTime);
        let e = new Date(inv.endTime);
        let dateStr = formatDateDMY(d);
        let startStr = `${padZ(d.getHours())}:${padZ(d.getMinutes())}`;
        let endStr = `${padZ(e.getHours())}:${padZ(e.getMinutes())}`;
        let descStr = `${inv.tipo} ${inv.dispositivi} ${inv.paziente} - ${inv.destinazione}`.trim();
        let fUrl = inv.fileUrl || "";

        let row = [
            `"${dateStr}"`, `"${inv.tipo}"`, `"${inv.destinazione.replace(/"/g, '""')}"`,
            `"${descStr.replace(/"/g, '""')}"`, `"${inv.paziente.replace(/"/g, '""')}"`,
            `"${inv.kmPercorsi}"`, `"${inv.dispositivi.replace(/"/g, '""')}"`,
            `"${inv.note.replace(/"/g, '""')}"`, `"${startStr}"`, `"${endStr}"`,
            `"${inv.haAllegato ? 'SI' : 'NO'}"`, `"${fUrl}"`
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

document.addEventListener('DOMContentLoaded', () => {
    const btnShareCSV = document.getElementById('btnShareCSV');
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
                btnShareCSV.innerHTML = `<span class="btn-icon">📤</span> INVIA / CONDIVIDI`;
                return alert("Nessun intervento da condividere.");
            }

            let header = ["Data", "Partenza", "Destinazione", "Tipo attivita", "Paziente / Ente", "Km A/R", "Dispositivi", "Note", "Ora Inizio", "Ora Fine", "Ha_Allegato", "URL_Allegato_Cloud"];
            let csvContent = header.join(";") + "\n";
            interventiDaEsportare.forEach(inv => {
                let d = new Date(inv.startTime), e = new Date(inv.endTime);
                let row = [
                    `"${formatDateDMY(d)}"`, `"${inv.tipo}"`, `"${inv.destinazione.replace(/"/g, '""')}"`,
                    `"${(inv.tipo + ' ' + inv.dispositivi + ' ' + inv.paziente + ' ' + inv.destinazione).trim().replace(/"/g, '""')}"`,
                    `"${inv.paziente.replace(/"/g, '""')}"`, `"${inv.kmPercorsi}"`, `"${inv.dispositivi.replace(/"/g, '""')}"`,
                    `"${inv.note.replace(/"/g, '""')}"`, `"${padZ(d.getHours())}:${padZ(d.getMinutes())}"`, `"${padZ(e.getHours())}:${padZ(e.getMinutes())}"`,
                    `"${inv.haAllegato ? 'SI' : 'NO'}"`, `"${inv.fileUrl || ""}"`
                ];
                csvContent += row.join(";") + "\n";
            });

            try {
                const blob = new Blob(["\uFEFF"+csvContent], { type: 'text/csv;charset=utf-8;' });
                const fileName = `Attivita_Esterne_${formatDateDMY(new Date())}.csv`;
                const file = new File([blob], fileName, { type: 'text/csv' });
                
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'Attività Giornata',
                        text: 'Ecco le mie attività della giornata.'
                    });
                } else {
                    alert('La condivisione diretta di file non è supportata dal tuo browser attuale. Usa il tasto SCARICA e poi condividilo a mano.');
                }
            } catch(err) {
                 console.error(err);
            } finally {
                btnShareCSV.innerHTML = `<span class="btn-icon">📤</span> INVIA / CONDIVIDI`;
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
            <div style="font-size:0.85rem; color:#666; margin-top:5px;">${inv.destinazione}</div>
        `;
        activitiesList.appendChild(div);
    });
}

btnClearData.addEventListener('click', () => {
    if(confirm("ATTENZIONE: vuoi cancellare la memoria STORICA locale dal dispositivo (I dati su Cloud NON verranno cancellati se già salvati)?")) {
        completedInterventions = []; saveState(); updateInterventiCount();
    }
});

initApp();
