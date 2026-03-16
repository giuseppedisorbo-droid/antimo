import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, serverTimestamp, enableIndexedDbPersistence, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// ====== CONFIGURAZIONE FIREBASE ======
// INSERISCI QUI I DATI DEL TUO PROGETTO FIREBASE. LI TROVI NELLE IMPOSTAZIONI DI FIREBASE CONSOLE.
const firebaseConfig = {
  apiKey: "AIzaSyC9XTi3OxsBd1ZgLlpMRm9nymrkRCfuLgY",
  authDomain: "antimo-app.firebaseapp.com",
  projectId: "antimo-app",
  storageBucket: "antimo-app.firebasestorage.app",
  messagingSenderId: "535167949374",
  appId: "1:535167949374:web:01b4487c8abbdf82aacf6f",
  measurementId: "G-494F166FDJ"
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

// Stato App in locale come fallback / offline cache
let dayState = JSON.parse(localStorage.getItem('antimo_dayState')) || { isActive: false, startTime: null, startKm: null };
let activeIntervention = JSON.parse(localStorage.getItem('antimo_activeIntervention')) || null;
let completedInterventions = JSON.parse(localStorage.getItem('antimo_interventions')) || [];
let plannedInterventions = JSON.parse(localStorage.getItem('antimo_plannedInterventions')) || [];

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
const btnPlanIntervention = document.getElementById('btnPlanIntervention');
const btnStopIntervention = document.getElementById('btnStopIntervention');
const btnViewActivities = document.getElementById('btnViewActivities');
const btnShareCSV = document.getElementById('btnShareCSV');
const btnManualSyncMobile = document.getElementById('btnManualSyncMobile');
const activitiesListContainer = document.getElementById('activitiesListContainer');
const activitiesList = document.getElementById('activitiesList');
const plannedInterventionsSection = document.getElementById('plannedInterventionsSection');
const plannedList = document.getElementById('plannedList');

// Form Inputs
const inputKmIniziali = document.getElementById('kmIniziali');
const inputKmFinali = document.getElementById('kmFinali');
const iTipo = document.getElementById('tipoAttivita');
const iPaziente = document.getElementById('paziente');
const iDestinazione = document.getElementById('destinazione');
const iDispositiviSelect = document.getElementById('dispositiviSelect');
const iNuovoDispositivo = document.getElementById('nuovoDispositivo');
const iNote = document.getElementById('note');
const inputKmPercorsi = document.getElementById('kmPercorsi');
const inputAllegato = document.getElementById('allegatoFile');
const filePreviewContainer = document.getElementById('filePreviewContainer');
const fotoPreview = document.getElementById('fotoPreview');
const filePreviewName = document.getElementById('filePreviewName');
const btnRimuoviFile = document.getElementById('btnRimuoviFile');

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
    
    // Proviamo a sincronizzare i dati locali vecchi/offline non ancora sul cloud
    setTimeout(syncLocalDataToCloud, 2000);
}

// Funzione per sincronizzare i vecchi interventi salvati solo in localStorage verso Firebase
async function syncLocalDataToCloud() {
    if (!isFirebaseConfigured) return;
    
    // Cerchiamo gli interventi locali senza flag cloudSynced
    let daSincronizzare = completedInterventions.filter(inv => !inv.cloudSynced);
    if (daSincronizzare.length === 0) return;
    
    console.log(`Trovati ${daSincronizzare.length} interventi locali non sincronizzati. Avvio sincronizzazione in background...`);
    
    let dbUpdated = false;
    
    for (let inv of daSincronizzare) {
        try {
            // Verifica se esiste già su Firestore col suo ID
            const q = query(collection(db, "interventi"), where("id", "==", inv.id));
            const snap = await getDocs(q);
            
            if (snap.empty) {
                // Non c'è su Firestore, dobbiamo inviarlo
                let fileCloudUrl = inv.fileUrl || null;
                
                // Se c'è un file base64 non ancora caricato
                if (inv.fileData && !fileCloudUrl) {
                    let ext = "jpg";
                    if (inv.fileName) ext = inv.fileName.split('.').pop();
                    else if (inv.fileType === "application/pdf") ext = "pdf";
                    else if (inv.fileType && inv.fileType.startsWith("video/")) ext = "mp4";
                    
                    const storageRef = ref(storage, `allegati/${inv.id}_sync.${ext}`);
                    await uploadString(storageRef, inv.fileData, 'data_url');
                    fileCloudUrl = await getDownloadURL(storageRef);
                }
                
                await addDoc(collection(db, "interventi"), {
                    timestamp: serverTimestamp(),
                    id: inv.id,
                    tipo: inv.tipo,
                    paziente: inv.paziente,
                    destinazione: inv.destinazione,
                    dispositivi: inv.dispositivi,
                    note: inv.note,
                    startTime: inv.startTime,
                    endTime: inv.endTime,
                    kmPercorsi: inv.kmPercorsi || "0",
                    fileUrl: fileCloudUrl,
                    haAllegato: !!(inv.fileData || fileCloudUrl),
                    fileType: inv.fileType || null
                });
                
                console.log("Intervento offline sincronizzato con successo:", inv.paziente);
                inv.fileUrl = fileCloudUrl;
            } else {
                console.log("Intervento già presente su Firestore, aggiorno lo stato locale:", inv.paziente);
            }
            
            // In ogni caso marchiamolo come sincronizzato
            inv.cloudSynced = true;
            delete inv.fileData; // Puliamo dal pesante base64 se presente
            dbUpdated = true;
            
        } catch (err) {
            console.error("Errore auto-sync in background per " + inv.paziente, err);
            // La prossima volta ci riproverà in caso di errore di rete
        }
    }
    
    if (dbUpdated) saveState();
}

function saveState() {
    localStorage.setItem('antimo_dayState', JSON.stringify(dayState));
    localStorage.setItem('antimo_activeIntervention', JSON.stringify(activeIntervention));
    localStorage.setItem('antimo_interventions', JSON.stringify(completedInterventions));
    localStorage.setItem('antimo_plannedInterventions', JSON.stringify(plannedInterventions));
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
            plannedInterventionsSection.classList.add('hidden');
            activeInterventionSection.classList.remove('hidden');
            document.getElementById('activePaziente').textContent = activeIntervention.paziente;
            document.getElementById('activeDestinazione').textContent = activeIntervention.destinazione;
            const sTime = new Date(activeIntervention.startTime);
            document.getElementById('activeStartTime').textContent = `${padZ(sTime.getHours())}:${padZ(sTime.getMinutes())}`;
        } else {
            interventionSection.classList.remove('hidden');
            activeInterventionSection.classList.add('hidden');
            if(plannedInterventions.length > 0) {
                plannedInterventionsSection.classList.remove('hidden');
                renderPlannedInterventions();
            } else {
                plannedInterventionsSection.classList.add('hidden');
            }
        }
    } else {
        dayStatusBadge.textContent = "Giornata NON Iniziata";
        dayStatusBadge.classList.remove('active');
        startDayForm.classList.remove('hidden');
        endDayForm.classList.add('hidden');
        interventionSection.classList.add('hidden');
        plannedInterventionsSection.classList.add('hidden');
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

function renderPlannedInterventions() {
    plannedList.innerHTML = '';
    plannedInterventions.forEach((p, index) => {
        const div = document.createElement('div');
        div.style.cssText = "background:white; padding:12px; border-radius:8px; border:1px solid #ddd; display:flex; justify-content:space-between; align-items:center;";
        div.innerHTML = `
            <div>
                <div style="font-weight:bold; color:var(--blue-dark); font-size:1.05rem;">${p.paziente}</div>
                <div style="font-size:0.85rem; color:#555;">📍 ${p.destinazione} | 🔧 ${p.tipo}</div>
            </div>
            <button class="btn btn-primary btn-orange btn-sm" style="padding:8px 12px; font-size:0.85rem;" data-index="${index}">▶ Avvia</button>
        `;
        div.querySelector('button').addEventListener('click', (e) => {
            const idx = e.target.getAttribute('data-index');
            const dataToLoad = plannedInterventions[idx];
            
            // Popoliamo il form
            iTipo.value = dataToLoad.tipo;
            iPaziente.value = dataToLoad.paziente;
            iDestinazione.value = dataToLoad.destinazione;
            if(customDevices.includes(dataToLoad.dispositivi) || Array.from(iDispositiviSelect.options).some(o=>o.value===dataToLoad.dispositivi)) {
                iDispositiviSelect.value = dataToLoad.dispositivi;
                iNuovoDispositivo.classList.add('hidden');
            } else {
                iDispositiviSelect.value = "_AZI_NUOVO_";
                iNuovoDispositivo.classList.remove('hidden');
                iNuovoDispositivo.value = dataToLoad.dispositivi;
            }
            iNote.value = dataToLoad.note;

            // Rimuoviamo dalla lista programmati
            plannedInterventions.splice(idx, 1);
            saveState();
            updateUI();
            
            interventionSection.scrollIntoView({ behavior: 'smooth' });
        });
        plannedList.appendChild(div);
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

btnPlanIntervention.addEventListener('click', () => {
    if(!iTipo.value || !iPaziente.value || !iDestinazione.value) {
        return alert("Compila almeno Tipo, Paziente e Destinazione per salvare l'intervento programmato!");
    }
    
    let dispFinale = iDispositiviSelect.value;
    if(dispFinale === "_AZI_NUOVO_") dispFinale = iNuovoDispositivo.value.trim();
    if(!dispFinale) dispFinale = "Nessuno";

    const planned = {
        id: "plan_" + Date.now().toString(),
        tipo: iTipo.value,
        paziente: iPaziente.value,
        destinazione: iDestinazione.value,
        dispositivi: dispFinale,
        note: iNote.value
    };

    plannedInterventions.push(planned);
    saveState();
    
    // Reset form
    newInterventionForm.reset();
    iDispositiviSelect.value = "";
    iNuovoDispositivo.classList.add('hidden');
    inputAllegato.value = ""; 
    currentFileBase64 = null; currentFileType = null; currentFileName = null;
    fotoPreview.style.display = 'none'; filePreviewName.style.display = 'none'; filePreviewContainer.classList.add('hidden');
    
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
        destinazione: iDestinazione.value,
        dispositivi: dispFinale,
        note: iNote.value,
        fileData: currentFileBase64,
        fileType: currentFileType,
        fileName: currentFileName,
        startTime: new Date().getTime()
    };
    saveState(); updateUI(); startTimerDisplay();
    inputKmPercorsi.value = ""; 
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
        activeIntervention.kmPercorsi = inputKmPercorsi.value || "0";
        
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
            activeIntervention.cloudSynced = true;
        } else {
            activeIntervention.cloudSynced = false;
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
        alert("Errore durante il salvataggio su Cloud: " + error.message + ". Riprovare (l'app riproverà in automatico o puoi premere Sincronizza).");
        console.error(error);
    } finally {
        btnStopIntervention.innerHTML = oldBtnText;
        btnStopIntervention.disabled = false;
    }
});

if(btnManualSyncMobile) {
    btnManualSyncMobile.addEventListener('click', async () => {
        const oldHtml = btnManualSyncMobile.innerHTML;
        try {
            btnManualSyncMobile.innerHTML = `<span class="btn-icon">⏳</span> SINCRONIZZANDO...`;
            btnManualSyncMobile.disabled = true;
            await syncLocalDataToCloud();
            alert("Sincronizzazione completata dal dispositivo al Cloud!");
            // Refresh counts/list maybe not needed if it just pushes, but doesn't hurt.
        } catch(e) {
            alert("Errore durante la sincronizzazione: " + e.message);
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
            <div style="font-size:0.85rem; color:#666; margin-top:5px;">${inv.destinazione}</div>
        `;
        activitiesList.appendChild(div);
    });
}

initApp();
