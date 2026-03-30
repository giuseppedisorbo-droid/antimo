import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ====== CONFIGURAZIONE FIREBASE ======
const firebaseConfig = {
    apiKey: "AIzaSyB6CLQZHPG60LqsIKHAlS_Wt5OFXqfwqkw",
    authDomain: "antimo-6a86b.firebaseapp.com",
    projectId: "antimo-6a86b",
    storageBucket: "antimo-6a86b.firebasestorage.app",
    messagingSenderId: "671676764068",
    appId: "1:671676764068:web:95027e0babe3f30042fb31",
    measurementId: "G-WTWNH23PLS"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// ====== GLOBAL VARS & GEMINI ======
let geminiApiKey = null;

async function initAiGenerator() {
    try {
        const snap = await getDoc(doc(db, "configurazioni", "ai_settings"));
        if (snap.exists() && snap.data().gemini_api_key) {
            geminiApiKey = snap.data().gemini_api_key;
        }
    } catch(err) {
        console.error("AI Generator Init Error:", err);
    }
}
initAiGenerator();

// ====== DOM ELEMENTS ======
const btnOpenAiGenerator = document.getElementById('btnOpenAiGenerator');
const aiGeneratorModal = document.getElementById('aiGeneratorModal');
const btnCloseAiGenerator = document.getElementById('btnCloseAiGenerator');

// Audio
const btnAiRecordAudio = document.getElementById('btnAiRecordAudio');
const aiRecordingIndicator = document.getElementById('aiRecordingIndicator');
const aiRecordingTime = document.getElementById('aiRecordingTime');
const aiAudioStatusLabel = document.getElementById('aiAudioStatusLabel');
const aiAudioPreviewContainer = document.getElementById('aiAudioPreviewContainer');
const aiAudioPlayer = document.getElementById('aiAudioPlayer');
const btnAiDeleteAudio = document.getElementById('btnAiDeleteAudio');

// Files
const aiGeneratorFileInput = document.getElementById('aiGeneratorFileInput');
const btnAiBrowseFiles = document.getElementById('btnAiBrowseFiles');
const aiFilesPreviewGrid = document.getElementById('aiFilesPreviewGrid');

// Action
const btnAiGenerateFinal = document.getElementById('btnAiGenerateFinal');
const aiGeneratorLoaderOverlay = document.getElementById('aiGeneratorLoaderOverlay');

// Archivio
const btnOpenAiDrafts = document.getElementById('btnOpenAiDrafts');
const aiDraftsContainer = document.getElementById('aiDraftsContainer');
const aiDraftsCount = document.getElementById('aiDraftsCount');
const aiDraftsModal = document.getElementById('aiDraftsModal');
const btnCloseAiDrafts = document.getElementById('btnCloseAiDrafts');
const aiDraftsCardsContainer = document.getElementById('aiDraftsCardsContainer');


// ====== STATE ======
let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;
let audioBase64 = null;
let audioMimeType = null;
let isRecording = false;
let recordInterval = null;
let recordSeconds = 0;

let attachedFilesBase64 = []; // { data: base64Raw, mimeType: type, name: name }


// ====== MODALS EVENT LISTENERS ======
if(btnOpenAiGenerator) {
    btnOpenAiGenerator.addEventListener('click', () => {
        aiGeneratorModal.classList.remove('hidden');
    });
}
if(btnCloseAiGenerator) {
    btnCloseAiGenerator.addEventListener('click', () => {
        aiGeneratorModal.classList.add('hidden');
    });
}
if(btnOpenAiDrafts) {
    btnOpenAiDrafts.addEventListener('click', () => {
        aiDraftsModal.classList.remove('hidden');
    });
}
if(btnCloseAiDrafts) {
    btnCloseAiDrafts.addEventListener('click', () => {
        aiDraftsModal.classList.add('hidden');
    });
}


// ====== AUDIO RECORDING ======
async function toggleRecording() {
    if (!isRecording) {
        // Avvia registrazione
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };
            
            mediaRecorder.onstop = () => {
                audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                if (!audioBlob || audioBlob.size === 0) {
                    // Fallback to mp4/ipod logic for iOS if needed
                    audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/mp4' });
                }
                audioMimeType = audioBlob.type;
                
                const audioUrl = URL.createObjectURL(audioBlob);
                aiAudioPlayer.src = audioUrl;
                aiAudioPreviewContainer.classList.remove('hidden');
                btnAiRecordAudio.style.display = 'none';
                aiAudioStatusLabel.innerText = "Audio acquisito!";
                
                // Genera Base64
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    const fullBase64 = reader.result;
                    audioBase64 = fullBase64.split(',')[1];
                };
            };

            mediaRecorder.start();
            isRecording = true;
            
            // UI Aggiornata
            btnAiRecordAudio.innerHTML = '⏹️';
            btnAiRecordAudio.style.transform = 'scale(1.1)';
            aiRecordingIndicator.classList.remove('hidden');
            aiAudioStatusLabel.innerText = "Parla ora...";
            
            recordSeconds = 0;
            aiRecordingTime.innerText = "00:00";
            recordInterval = setInterval(() => {
                recordSeconds++;
                const m = String(Math.floor(recordSeconds / 60)).padStart(2, '0');
                const s = String(recordSeconds % 60).padStart(2, '0');
                aiRecordingTime.innerText = `${m}:${s}`;
            }, 1000);

        } catch(err) {
            alert("Errore accesso al microfono: " + err.message);
        }
    } else {
        // Ferma registrazione
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        isRecording = false;
        clearInterval(recordInterval);
        
        btnAiRecordAudio.innerHTML = '🎤';
        btnAiRecordAudio.style.transform = 'scale(1)';
        aiRecordingIndicator.classList.add('hidden');
    }
}

if(btnAiRecordAudio) {
    btnAiRecordAudio.addEventListener('click', toggleRecording);
}
if(btnAiDeleteAudio) {
    btnAiDeleteAudio.addEventListener('click', () => {
        audioBlob = null;
        audioBase64 = null;
        aiAudioPlayer.src = "";
        aiAudioPreviewContainer.classList.add('hidden');
        btnAiRecordAudio.style.display = 'flex';
        aiAudioStatusLabel.innerText = "Pronto per registrare";
    });
}


// ====== FILES ATTACHMENTS ======
function handleFiles(files) {
    for (let file of files) {
        if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
            alert("Formato non supportato: " + file.name + "\nSolo Immagini o PDF.");
            continue;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target.result;
            const base64Raw = result.split(',')[1];
            
            attachedFilesBase64.push({
                data: base64Raw,
                mimeType: file.type,
                name: file.name
            });
            renderFilesPreview();
        };
        reader.readAsDataURL(file);
    }
}

function renderFilesPreview() {
    aiFilesPreviewGrid.innerHTML = '';
    attachedFilesBase64.forEach((f, idx) => {
        const div = document.createElement('div');
        div.style.cssText = "position: relative; width: 60px; height: 60px; border-radius: 8px; border: 1px solid #ccc; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); background: #f8fafc; display:flex; align-items:center; justify-content:center; font-size: 0.7rem; font-weight:bold; color: #475569;";
        
        if (f.mimeType.startsWith('image/')) {
            div.innerHTML = `<img src="data:${f.mimeType};base64,${f.data}" style="width:100%; height:100%; object-fit:cover;">`;
        } else if (f.mimeType === 'application/pdf') {
            div.innerHTML = `PDF<br>Doc`;
        }
        
        div.innerHTML += `<button onclick="window.removeAiFile(${idx})" style="position:absolute; top: -5px; right: -5px; background: #ef4444; color: white; border: none; border-radius: 50%; font-size: 10px; width: 18px; height: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>`;
        aiFilesPreviewGrid.appendChild(div);
    });
}

window.removeAiFile = function(idx) {
    attachedFilesBase64.splice(idx, 1);
    renderFilesPreview();
};

if(btnAiBrowseFiles) {
    btnAiBrowseFiles.addEventListener('click', () => {
        aiGeneratorFileInput.click();
    });
}
if(aiGeneratorFileInput) {
    aiGeneratorFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFiles(e.target.files);
        aiGeneratorFileInput.value = '';
    });
}
window.addEventListener('paste', (e) => {
    // Intercetta incolla solo se il modale generator è aperto e visualizzato
    if (!aiGeneratorModal.classList.contains('hidden')) {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        let files = [];
        for (let item of items) {
            if (item.type.indexOf("image") === 0 || item.type === "application/pdf") {
                files.push(item.getAsFile());
            }
        }
        if (files.length > 0) handleFiles(files);
    }
});


// ====== GEMINI API PROCESSING ======
if(btnAiGenerateFinal) {
    btnAiGenerateFinal.addEventListener('click', async () => {
        if (!audioBase64 && attachedFilesBase64.length === 0) {
            return alert("Devi registrare un audio, o allegare almeno un documento prima di elaborare!");
        }
        if (!geminiApiKey) {
            return alert("Errore: manca la chiave API di Gemini nelle Configurazioni.");
        }

        aiGeneratorLoaderOverlay.classList.remove('hidden');

        try {
            // Prepara Payload Gemini
            const promptSpeciale = `In base all'audio trascritto e/o all'immagine fornita del documento (prescrizione medica, richiesta d'intervento ecc.), estrai i dati necessari per creare una scheda di intervento tecnico o sanitario di Home Care. 
            
I campi richiesti sono:
- "paziente": nome/cognome.
- "indirizzo": via e numero.
- "localita": città o provincia.
- "telefono": recapito telefonico.
- "tipo": la tipologia di intervento. Usare una parola chiave se capisci l'intento logico, altrimenti scrivi quello che capisci.
- "dispositivi": l'apparecchio principale di cui si parla (es. Concentratore, Ventilatore, Ecografo...).
- "accessoriStr": accessori o maschere aggiuntive menzionate.
- "matricola": eventuali numeri di serie o matricole.
- "note": altre direttive, urgenze, e raccomandazioni extra in formato descrittivo.
- "dataPrevista": una data *APPROSSIMATIVA O PRECISA* citata, possibilmente in formato YYYY-MM-DD. Se non è indicata, restituisci "".

!!! ATTENZIONE: DEVI RISPONDERE SOLO ED ESCLUSIVAMENTE CON UN FILE JSON VALIDO !!! Nessun markdown, nessun backtick \`\`\`. Solo le parentesi graffe iniziali e finali. Restituisci "" in caso di dato non pervenuto.`;

            let contentsList = [{ text: promptSpeciale }];
            
            if (audioBase64) {
                contentsList.push({
                    inlineData: {
                        mimeType: audioMimeType || "audio/webm",
                        data: audioBase64
                    }
                });
            }
            
            attachedFilesBase64.forEach(f => {
                contentsList.push({
                    inlineData: {
                        mimeType: f.mimeType,
                        data: f.data
                    }
                });
            });

            const dataPayload = {
                contents: [{
                    role: "user",
                    parts: contentsList
                }]
            };

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataPayload)
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);

            let rawResponse = data.candidates[0].content.parts[0].text;
            
            // Pulisci eventuale formattazione markdown
            rawResponse = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            
            let parsedObj = {};
            try {
                parsedObj = JSON.parse(rawResponse);
            } catch(e) {
                console.error("Non è stato possibile decifrare il JSON. Testo crudo:", rawResponse);
                throw new Error("Gemini ha prodotto un JSON non valido. Ripeti l'estrazione.");
            }

            // Aggiungi meta-informazioni e salva come bozza in DB
            parsedObj.inviatoDa = localStorage.getItem('antimo_user_name') || "Utente";
            parsedObj.registrazioneBase64 = audioBase64 ? true : false;
            parsedObj.hasAllegati = attachedFilesBase64.length > 0;
            parsedObj.creatoIl = serverTimestamp();
            parsedObj.status = "da_valutare";

            await addDoc(collection(db, "proposte_ai"), parsedObj);

            // Resetta Finestra e Successo
            audioBlob = null;
            audioBase64 = null;
            aiAudioPlayer.src = "";
            aiAudioPreviewContainer.classList.add('hidden');
            btnAiRecordAudio.style.display = 'flex';
            aiAudioStatusLabel.innerText = "Pronto per registrare";
            attachedFilesBase64 = [];
            renderFilesPreview();
            
            aiGeneratorModal.classList.add('hidden');
            aiGeneratorLoaderOverlay.classList.add('hidden');
            
            // Apri in automatico le bozze
            aiDraftsModal.classList.remove('hidden');

        } catch(err) {
            console.error("Generazione Fallita", err);
            alert("Errore AI: " + err.message);
            aiGeneratorLoaderOverlay.classList.add('hidden');
        }
    });
}


// ====== ARCHIVIO BOZZE AI ======
let draftsDataList = [];

const qDrafts = query(collection(db, "proposte_ai"), orderBy("creatoIl", "desc"));
onSnapshot(qDrafts, (snapshot) => {
    draftsDataList = [];
    snapshot.forEach(docSnap => {
        draftsDataList.push({ idFb: docSnap.id, ...docSnap.data() });
    });
    
    // Aggiorna Badge
    if(aiDraftsCount) aiDraftsCount.innerText = draftsDataList.length;
    if(aiDraftsContainer) {
        if(draftsDataList.length > 0) {
            aiDraftsContainer.style.display = 'block';
        } else {
            aiDraftsContainer.style.display = 'none';
        }
    }
    
    renderDraftsList();
});

function renderDraftsList() {
    if(!aiDraftsCardsContainer) return;
    
    if (draftsDataList.length === 0) {
        aiDraftsCardsContainer.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 30px; font-weight:bold;">Nessuna bozza da valutare. Le bozze registrate dall\\'AI appariranno qui!</div>';
        return;
    }
    
    aiDraftsCardsContainer.innerHTML = '';
    
    draftsDataList.forEach(draft => {
        const div = document.createElement('div');
        div.style.cssText = "background: white; border-radius: 12px; border: 1px solid #cbd5e1; box-shadow: 0 4px 6px rgba(0,0,0,0.05); padding: 20px; position: relative;";
        
        div.innerHTML = `
            <div style="font-size: 0.7rem; color: #64748b; margin-bottom: 5px; text-transform:uppercase; font-weight:bold;">✨ Proposta Generata da: ${draft.inviatoDa}</div>
            
            <!-- FORM RAPIDO DI REVISIONE BOZZA -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div><label style="font-size:0.8rem; color:#475569; font-weight:bold;">Paziente/Ente</label><br><input type="text" id="draft_paziente_${draft.idFb}" value="${draft.paziente || ''}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; font-weight:bold;"></div>
                <div><label style="font-size:0.8rem; color:#475569; font-weight:bold;">Tipo Intervento</label><br><input type="text" id="draft_tipo_${draft.idFb}" value="${draft.tipo || ''}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;"></div>
                <div><label style="font-size:0.8rem; color:#475569; font-weight:bold;">Località</label><br><input type="text" id="draft_localita_${draft.idFb}" value="${draft.localita || ''}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;"></div>
                <div><label style="font-size:0.8rem; color:#475569; font-weight:bold;">Indirizzo</label><br><input type="text" id="draft_indirizzo_${draft.idFb}" value="${draft.indirizzo || ''}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;"></div>
                <div><label style="font-size:0.8rem; color:#475569; font-weight:bold;">Telefono</label><br><input type="text" id="draft_telefono_${draft.idFb}" value="${draft.telefono || ''}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;"></div>
                <div><label style="font-size:0.8rem; color:#475569; font-weight:bold;">Data Prevista (YYYY-MM-DD)</label><br><input type="text" id="draft_dataPrevista_${draft.idFb}" value="${draft.dataPrevista || ''}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; background:#fef08a;"></div>
                <div style="grid-column: span 2;"><label style="font-size:0.8rem; color:#475569; font-weight:bold;">Dispositivi / Macchinari</label><br><input type="text" id="draft_dispositivi_${draft.idFb}" value="${draft.dispositivi || ''}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;"></div>
                <div style="grid-column: span 2;"><label style="font-size:0.8rem; color:#475569; font-weight:bold;">Accessori e Matricole Extra</label><br><input type="text" id="draft_accessoriStr_${draft.idFb}" value="${draft.accessoriStr || ''} MATRICOLA: ${draft.matricola || 'N/D'}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;"></div>
                <div style="grid-column: span 2;"><label style="font-size:0.8rem; color:#475569; font-weight:bold;">Note Esigenze Logistiche</label><br><textarea id="draft_note_${draft.idFb}" rows="2" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;">${draft.note || ''}</textarea></div>
            </div>

            <div style="display: flex; gap: 10px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
                <button onclick="window.approvaDraftAi('${draft.idFb}')" class="btn btn-primary" style="flex:1; background: #22c55e; border:none; margin:0; font-weight:bold;">✔️ APPROVA E SALVA IN PROGRAMMATI</button>
                <button onclick="window.eliminaDraftAi('${draft.idFb}')" class="btn btn-danger" style="background: #ef4444; border:none; margin:0; font-weight:bold;">🗑 Elimina Boz</button>
            </div>
        `;
        
        aiDraftsCardsContainer.appendChild(div);
    });
}

// Global functions for inline HTML
window.approvaDraftAi = async function(idFb) {
    if(!confirm("Sicuro di voler spostare questa bozza in Programmati DEFINITIVI?")) return;
    
    // Raccoglie i dati dallo schermino ed elimina eventuali undef
    const updatedData = {
        paziente: document.getElementById(`draft_paziente_${idFb}`).value,
        tipo: document.getElementById(`draft_tipo_${idFb}`).value,
        localita: document.getElementById(`draft_localita_${idFb}`).value,
        indirizzo: document.getElementById(`draft_indirizzo_${idFb}`).value,
        telefono: document.getElementById(`draft_telefono_${idFb}`).value,
        dataPrevista: document.getElementById(`draft_dataPrevista_${idFb}`).value,
        dispositivi: document.getElementById(`draft_dispositivi_${idFb}`).value,
        accessoriStr: document.getElementById(`draft_accessoriStr_${idFb}`).value,
        note: document.getElementById(`draft_note_${idFb}`).value,
        status: "in_attesa",
        programmatoDa: localStorage.getItem('antimo_user_name') || "Utente (via AI)",
        tecnicoAssegnato: "Da Assegnare"
    };
    
    try {
        await addDoc(collection(db, "programmati"), updatedData);
        await deleteDoc(doc(db, "proposte_ai", idFb));
        alert("Perfetto! L'attività è ora visibile nel database Programmati.");
    } catch(err) {
        alert("Errore salva bozza: " + err.message);
    }
};

window.eliminaDraftAi = async function(idFb) {
    if(!confirm("Eliminare definitivamente la bozza? L'operazione non può essere annullata.")) return;
    try {
        await deleteDoc(doc(db, "proposte_ai", idFb));
    } catch(err) {
        alert("Errore eliminazione: " + err.message);
    }
};
