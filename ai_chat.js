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

// DOM Elements
const btnOpenTrueAiChat = document.getElementById('btnOpenTrueAiChat');
const btnLaunchAiChatDirectly = document.getElementById('btnLaunchAiChatDirectly');
const btnCloseAiChat = document.getElementById('btnCloseAiChat');
const aiChatModal = document.getElementById('aiChatModal');
const btnSendAiChat = document.getElementById('btnSendAiChat');
const aiChatInput = document.getElementById('aiChatInput');
const aiChatMessages = document.getElementById('aiChatMessages');

let geminiApiKey = null;
let chatHistory = [];

const SYSTEM_PROMPT = `Sei l'Assistente virtuale dell'App Antimo. Questa app serve per la Gestione Interventi Tecnici e Sanitari (Home Care).
L'utente che ti scrive è tendenzialmente un Tecnico, l'Amministratore o un Operatore Sanitario che lavora per Eubios / Antimo.

CARATTERISTICHE DELL'APP:
1. Registrazione Intervento in un click: Cliccando su "Avvia" parte il timer. Compilando il nome, descrizione, chilometri e allegati, poi si clicca Termina e viene salvato nei database Firestore "interventi".
2. Attività Programmate: Vengono salvate anticipatamente nella home sotto "Programmati", divise tra Oggi e Domani. Si possono evadere cliccando "Esegui" e diventano Interventi reali.
3. Anagrafiche: Gestisce Clienti, Pazienti, e Fornitori. Di recente abbiamo aggiunto il campo "Qualifica" (Paziente, Operatore Sanitario, ecc). L'elenco anagrafiche salva in Firestore e può essere ricercato globalmente dall'App.
4. Valutazione Pazienti DPAD / D3: Quando compili un intervento o un programmato, ci sono campi opzionali per la Valutazione Sanitaria (Scegli Operatore Sanitario, scrivi Esito/Punteggio, e seleziona lo Stato Valutazione come "Svolta - A buon fine"). Queste vengono tracciate colorate di blu in Admin.
5. Chat Interna / Bacheca: Serve per lasciare post visibili a tutti, si possono caricare allegati e "fissare" (pin) come notifiche. C'è la funzionalità globale per incollare immagini col tasto CTRL+V (Paste) in ovunque nell'app, le allegherà al post o all'intervento.
6. Admin Dashboard: L'amministratore (Giuseppe) vi accede cliccando l'ingranaggio e poi Dashboard, loggandosi con la sua email Firebase Google. Ha tabelle, esportazioni CSV e filtri di data. E può consultare i Log AI.
7. Funzionamento Offline: L'app salva tutto su 'localStorage' e prova la sincronizzazione se c'è internet.
8. Versioni: L'app legge la sua versione corrente e mostra vecchi changelog per comodità dal riepilogo versioni.

Rispondi sempre in ITALIANO (a meno che non ti scrivano diversamente), sii conciso, cortese e tecnico.
MOLTO IMPORTANTE: Formatta SEMPRE la tua risposta in modo **altamente strutturato**, seguendo queste regole:
- Usa gli **elenchi numerati** (1., 2., 3.) per spiegare le procedure passo-passo.
- Usa il **grassetto** per indicare il nome esatto dei pulsanti, dei menu o dei campi da cliccare/compilare (es. clicca su **Nuovo Intervento**).
- Evita lunghi muri di testo. Vai dritto al punto con elenchi puntati.
- Non inventare funzionalità che non esistono nella lista precedente.
- GESTIONE NUOVE FUNZIONALITÀ (PRODUCT MANAGER): Se l'utente chiede una funzione che attualmente non esiste in Antimo, comportati da Product Manager. Informalo che la funzione non è presente e offriti di preparare un documento di "Richiesta Sviluppo" per Giuseppe (lo sviluppatore). Fai da 1 a 5 domande mirate all'utente per capire i requisiti di business, l'aspetto visivo e la logica desiderata.
- CREAZIONE DEL PROMPT DI SVILUPPO: Quando l'utente ha risposto alle tue domande e hai un'idea chiara della feature, scrivi un Prompt ingegneristico destinato all'Assistente AI Sviluppatore ("Google Antigravity"). Devi scrivere il prompt ESATTAMENTE in mezzo a questi due tag speciali: 
[AUTO_PROMPT]
(Scrivi qui il prompt per lo sviluppatore spiegando chiaramente i requisiti)
[/AUTO_PROMPT]`;

// 1. Fetch Key All'Avvio Modal
async function initAiAssistant() {
    try {
        const snap = await getDoc(doc(db, "configurazioni", "ai_settings"));
        if (snap.exists() && snap.data().gemini_api_key) {
            geminiApiKey = snap.data().gemini_api_key;
        } else {
            console.warn("AI Assistant: API Key Gemini non trovata. L'utente non potrà chattare.");
        }
    } catch(err) {
        console.error("AI Assistant Error:", err);
    }
}
initAiAssistant();

// 2. Apri Modal e inizializza chat
function openChatModal() {
    aiChatModal.classList.remove('hidden');
    if(!geminiApiKey) initAiAssistant();
}

if (btnOpenTrueAiChat) {
    btnOpenTrueAiChat.addEventListener('click', openChatModal);
}
if (btnLaunchAiChatDirectly) {
    btnLaunchAiChatDirectly.addEventListener('click', openChatModal);
}
if (btnCloseAiChat) {
    btnCloseAiChat.addEventListener('click', () => aiChatModal.classList.add('hidden'));
}

// 3. UI Helper
function appendMessage(role, text) {
    const isUser = role === 'user';
    const alignLabel = isUser ? 'flex-end' : 'flex-start';
    const bg = isUser ? '#6366f1' : 'white';
    const color = isUser ? 'white' : '#334155';
    const borderRadius = isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px';
    const border = isUser ? 'none' : '1px solid #e2e8f0';
    const shadow = isUser ? '0 2px 4px rgba(99, 102, 241, 0.3)' : '0 1px 2px rgba(0,0,0,0.05)';

    // Parse simple markdown robustly
    let formattedText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    formattedText = formattedText.replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>')
                                 .replace(/\*([\s\S]*?)\*/g, '<em>$1</em>')
                                 .replace(/`([^`]*?)`/g, '<code style="background: rgba(0,0,0,0.1); padding: 2px 4px; border-radius: 4px;">$1</code>');

    let shareHtml = '';
    if (!isUser) {
        const rawTextEncoded = encodeURIComponent(text);
        shareHtml = `
            <div style="display: flex; gap: 8px; margin-top: 8px; border-top: 1px dotted #cbd5e1; padding-top: 8px;">
                <button onclick="shareAiToBacheca(this)" data-text="${rawTextEncoded}" style="background:none; border:none; cursor:pointer; color:#6366f1; font-size: 0.8rem; font-weight:bold; display: flex; align-items:center; gap: 4px;"><span class="btn-icon">📢</span> Bacheca</button>
                <button onclick="shareAiToWhatsapp(this)" data-text="${rawTextEncoded}" style="background:none; border:none; cursor:pointer; color:#16a34a; font-size: 0.8rem; font-weight:bold; display: flex; align-items:center; gap: 4px;"><span class="btn-icon">💬</span> WhatsApp</button>
                <button onclick="shareAiToEmail(this)" data-text="${rawTextEncoded}" style="background:none; border:none; cursor:pointer; color:#d97706; font-size: 0.8rem; font-weight:bold; display: flex; align-items:center; gap: 4px;"><span class="btn-icon">📧</span> Email</button>
            </div>
        `;
    }

    const msgHtml = `
        <div style="display: flex; gap: 10px; align-items: flex-start; justify-content: ${isUser ? 'flex-end' : 'flex-start'};">
            ${isUser ? '' : '<div style="font-size: 1.5rem; margin-top: -5px;">🤖</div>'}
            <div style="background: ${bg}; color: ${color}; border: ${border}; padding: 12px 15px; border-radius: ${borderRadius}; max-width: 85%; font-size: 0.9rem; line-height: 1.4; box-shadow: ${shadow}; white-space: pre-wrap;">
                ${formattedText}
                ${shareHtml}
            </div>
        </div>
    `;
    
    // Rimuove il loader se esiste
    const loader = document.getElementById('aiChatLoader');
    if(loader) loader.remove();

    aiChatMessages.insertAdjacentHTML('beforeend', msgHtml);
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
}

function showLoader() {
    const msgHtml = `
        <div id="aiChatLoader" style="display: flex; gap: 10px; align-items: flex-start;">
            <div style="font-size: 1.5rem; margin-top: -5px;">🤖</div>
            <div style="background: white; border: 1px solid #e2e8f0; padding: 12px 15px; border-radius: 12px 12px 12px 2px; font-size: 0.9rem; color: #94a3b8; display: flex; gap: 5px; align-items: center;">
                <span class="dot-pulse"><i></i><i></i><i></i></span> Elaborazione in corso...
            </div>
        </div>
    `;
    aiChatMessages.insertAdjacentHTML('beforeend', msgHtml);
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
}

// 4. Gemini Call
async function callGemini(promptText, fileObj = null) {
    if (!geminiApiKey) {
        appendMessage('assistant', "L'Amministratore non ha ancora configurato la Chiave API di Gemini. Accedi al pannello Admin -> Configurazione AI per salvarla.");
        return;
    }

    // Show User Message immediately
    let displayUserHtml = promptText;
    if (fileObj) {
        displayUserHtml += `<br><img src="${fileObj.data}" style="max-height: 120px; border-radius: 8px; margin-top: 10px; border: 1px solid #ccc;">`;
    }
    appendMessage('user', displayUserHtml);
    showLoader();

    const aiResponseStyleElement = document.getElementById('aiResponseStyle');
    let dynamicPrompt = promptText;
    if (aiResponseStyleElement) {
        if (aiResponseStyleElement.value === 'breve') {
            dynamicPrompt += "\n\n(Istruzione Speciale dell'Utente: COMPORTATI COME UN RIASSUNTO. Dai una risposta ESTREMAMENTE BREVE, SINTETICA ED ESSENZIALE, MASSIMO 2 FRASI.)";
        } else if (aiResponseStyleElement.value === 'lunga') {
            dynamicPrompt += "\n\n(Istruzione Speciale dell'Utente: COMPORTATI COME UN'ANALISI COMPLETA. Dai una risposta ESTREMAMENTE DETTAGLIATA, ANALITICA ED ESAUSTIVA in ogni minimo aspetto.)";
        }
    }

    let userParts = [{ text: dynamicPrompt }];
    if (fileObj) {
        const base64Data = fileObj.data.split(',')[1];
        userParts.push({
            inlineData: {
                data: base64Data,
                mimeType: fileObj.mimeType
            }
        });
    }

    // Prepare message structure matching Gemini v61beta
    const promptObj = { role: "user", parts: userParts };
    let reqBodyContents = [];

    // Always inject System Context first manually as a user prompt (since Flash sometimes balks at systemInstruction depending on version)
    if (chatHistory.length === 0) {
        reqBodyContents.push({ role: "user", parts: [{ text: "SYSTEM PROMPT: " + SYSTEM_PROMPT + "\\n\\nAGGIUNTA: L'utente che ti parla si chiama: " + (localStorage.getItem('antimo_filter_tecnico') || "Anonimo") }]});
        reqBodyContents.push({ role: "model", parts: [{ text: "Understood. I will follow the instructions and answer the user's questions about the Antimo app." }]});
    }

    reqBodyContents = reqBodyContents.concat(chatHistory);
    reqBodyContents.push(promptObj);

    const dataPayload = {
        contents: reqBodyContents
    };

    const startTime = Date.now();
    try {
        const fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataPayload)
        };

        let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, fetchOptions);
        let data = await response.json();

        if (data.error && data.error.message && data.error.message.includes("is not found")) {
            console.warn("Static model not found. Attempting dynamic discovery via ListModels...");
            try {
                const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`);
                const listData = await listResp.json();
                
                if (listData.models && listData.models.length > 0) {
                    let bestModel = listData.models.find(m => m.name.includes("flash") && m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"));
                    if (!bestModel) bestModel = listData.models.find(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"));
                    
                    if (bestModel) {
                        const actualModelName = bestModel.name.replace('models/', '');
                        console.log("Dynamically resolved to model:", actualModelName);
                        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${actualModelName}:generateContent?key=${geminiApiKey}`, fetchOptions);
                        data = await response.json();
                    } else {
                        throw new Error("Nessun modello compatibile con 'generateContent' trovato per questa API Key.");
                    }
                }
            } catch(dynErr) {
                console.error("Dynamic discovery failed", dynErr);
            }
        }
        
        const duration = Date.now() - startTime;
        
        if (data.error) throw new Error(data.error.message);

        const loader = document.getElementById('aiChatLoader');
        if(loader) loader.remove();

        let reply = data.candidates[0].content.parts[0].text;
        chatHistory.push({ role: "user", parts: [{ text: promptText }] }); // Store only text in history to avoid huge image contexts
        chatHistory.push({ role: "model", parts: [{ text: reply }] });

        // Intercettazione AUTO_PROMPT
        const autoPromptMatch = reply.match(/\[AUTO_PROMPT\]([\s\S]*?)\[\/AUTO_PROMPT\]/);
        if (autoPromptMatch) {
            const extractedPrompt = autoPromptMatch[1].trim();
            // Rimuove la parte tecnica dalla risposta mostrata all'utente
            reply = reply.replace(/\[AUTO_PROMPT\][\s\S]*?\[\/AUTO_PROMPT\]/, "\n\n✅ **Richiesta Sviluppata con Successo!** Ho generato il progetto tecnico e l'ho appena postato sulla Bacheca Notifiche di Giuseppe.");
            
            // Invia silenziosamente in Bacheca Firestore
            try {
                const userName = localStorage.getItem('antimo_filter_tecnico') || "Anonimo";
                await addDoc(collection(db, "messaggi"), {
                    text: `🤖 **[AI FEATURE REQUEST da ${userName}]**\n\nAttenzione Giuseppe, l'utente ha richiesto di sviluppare con Antigravity la seguente implementazione:\n\n${extractedPrompt}`,
                    user: "Antimo Assistant",
                    timestamp: serverTimestamp(),
                    isNotification: true,
                    letto: false,
                    eliminato: false,
                    presoInCarico: false
                });
            } catch(e) {
                console.error("Errore salvataggio ticket AI:", e);
            }
        }

        appendMessage('assistant', reply);

        // Usage Logging telemetry computation
        const totalTokens = (data.usageMetadata?.totalTokenCount) || 0;
        // Costo stimato Gemini 1.5 Flash: ~ $0.075 per 1M input, $0.3 per 1M output. Approx $0.15/1M globally.
        const costApprox = (totalTokens / 1000000) * 0.15;
        
        // Asynchronously log to Firestore
        logInteractionToAdmin(promptText, totalTokens, duration, costApprox);

    } catch(err) {
        console.error("Gemini Api exception:", err);
        const l = document.getElementById('aiChatLoader');
        if(l) l.remove();
        appendMessage('assistant', `**Errore Gemini API:** ${err.message} \n\nVerifica che la chiave sia corretta dal pannello Admin e che abbia i permessi abilitati.`);
    }
}

// 5. Telemetry log to Firestore
async function logInteractionToAdmin(promptTxt, tokens, durationMs, cost) {
    try {
        const userName = localStorage.getItem('antimo_filter_tecnico') || "Anonimo";
        // Create a short snippet for the table 
        const promptSnippet = promptTxt.length > 50 ? promptTxt.substring(0, 50) + '...' : promptTxt;
        
        await addDoc(collection(db, "ai_logs"), {
            user: userName,
            prompt: promptSnippet,
            tokens: tokens || 0,
            durationMs: durationMs || 0,
            cost: cost || 0,
            timestamp: serverTimestamp()
        });
    } catch (e) {
        console.error("Impossibile salvare il log in ai_logs:", e);
    }
}

// 6. Events Handler & Multi-modal File Upload
let currentAiFile = null;
const btnBrowseAiFile = document.getElementById('btnBrowseAiFile');
const aiChatFile = document.getElementById('aiChatFile');
const aiChatPreviewContainer = document.getElementById('aiChatPreviewContainer');

if (btnBrowseAiFile) {
    btnBrowseAiFile.addEventListener('click', () => {
        if (aiChatFile) aiChatFile.click();
    });
}

if (aiChatFile) {
    aiChatFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (ev) => {
            currentAiFile = {
                data: ev.target.result,
                mimeType: file.type
            };
            
            if (aiChatPreviewContainer) {
                aiChatPreviewContainer.innerHTML = `
                    <div style="position: relative; width: 60px; height: 60px; border-radius: 8px; border: 1px solid #ccc; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <img src="${ev.target.result}" style="width:100%; height:100%; object-fit:cover;">
                        <button id="btnRemoveAiFile" style="position:absolute; top: -5px; right: -5px; background: #ef4444; color: white; border: none; border-radius: 50%; font-size: 10px; width: 18px; height: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
                    </div>
                `;
                aiChatPreviewContainer.classList.remove('hidden');
                
                document.getElementById('btnRemoveAiFile').addEventListener('click', () => {
                    currentAiFile = null;
                    aiChatPreviewContainer.classList.add('hidden');
                    aiChatPreviewContainer.innerHTML = '';
                    aiChatFile.value = '';
                });
            }
        };
        reader.readAsDataURL(file);
    });
}

if (btnSendAiChat) {
    btnSendAiChat.addEventListener('click', () => {
        const text = aiChatInput.value.trim();
        if(!text && !currentAiFile) return;
        aiChatInput.value = '';
        
        const fileToPass = currentAiFile;
        // Reset immediately to allow next inputs
        currentAiFile = null;
        if (aiChatPreviewContainer) {
            aiChatPreviewContainer.classList.add('hidden');
            aiChatPreviewContainer.innerHTML = '';
        }
        if (aiChatFile) aiChatFile.value = '';
        
        callGemini(text, fileToPass);
    });
}
if (aiChatInput) {
    aiChatInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            btnSendAiChat.click();
        }
    });

    // Supporta l'incollare di immagini
    aiChatInput.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") === 0) {
                const blob = items[i].getAsFile();
                
                const reader = new FileReader();
                reader.onload = (ev) => {
                    currentAiFile = {
                        data: ev.target.result,
                        mimeType: blob.type
                    };
                    if (aiChatPreviewContainer) {
                        aiChatPreviewContainer.innerHTML = `
                            <div style="position: relative; width: 60px; height: 60px; border-radius: 8px; border: 1px solid #ccc; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                <img src="${ev.target.result}" style="width:100%; height:100%; object-fit:cover;">
                                <button id="btnRemoveAiFile" style="position:absolute; top: -5px; right: -5px; background: #ef4444; color: white; border: none; border-radius: 50%; font-size: 10px; width: 18px; height: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
                            </div>
                        `;
                        aiChatPreviewContainer.classList.remove('hidden');
                        document.getElementById('btnRemoveAiFile').addEventListener('click', () => {
                            currentAiFile = null;
                            aiChatPreviewContainer.classList.add('hidden');
                            aiChatPreviewContainer.innerHTML = '';
                            if (aiChatFile) aiChatFile.value = '';
                        });
                    }
                };
                reader.readAsDataURL(blob);
                break;
            }
        }
    });
}

// Add CSS pulse logic
const style = document.createElement('style');
style.innerHTML = `
.dot-pulse { display: inline-flex; align-items: center; gap: 3px; }
.dot-pulse i { width: 5px; height: 5px; background: #64748b; border-radius: 50%; display: inline-block; animation: dotPulse 1.4s infinite ease-in-out both; }
.dot-pulse i:nth-child(1) { animation-delay: -0.32s; }
.dot-pulse i:nth-child(2) { animation-delay: -0.16s; }
@keyframes dotPulse { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
`;
document.head.appendChild(style);

// 7. Funzioni Globali Condivisione
window.shareAiToBacheca = function(btn) {
    const text = decodeURIComponent(btn.getAttribute('data-text'));
    // Chiudi modale chat AI
    const aiChatModal = document.getElementById('aiChatModal');
    if(aiChatModal) aiChatModal.classList.add('hidden');
    
    // Apri bacheca
    const btnToggleMessages = document.getElementById('btnToggleMessages');
    if(btnToggleMessages && btnToggleMessages.textContent.includes('Mostra')) {
        btnToggleMessages.click();
    }
    
    // Scrolla alla bacheca e popola il form
    const msgText = document.getElementById('msgText');
    if(msgText) {
        document.getElementById('messagesSection').scrollIntoView({behavior: 'smooth'});
        msgText.value = text;
        msgText.focus();
    }
};

window.shareAiToEmail = function(btn) {
    const text = decodeURIComponent(btn.getAttribute('data-text'));
    window.open('mailto:?subject=Risultato%20Assistente%20In%20App&body=' + encodeURIComponent(text));
};

// ==========================================
// ====== GENERATORE AI (AUDIO & DOCS) ======
// ==========================================

const btnOpenAiGenerator = document.getElementById('btnOpenAiGenerator');
const aiGeneratorModal = document.getElementById('aiGeneratorModal');
const btnCloseAiGenerator = document.getElementById('btnCloseAiGenerator');

// Audio Elements
const btnAiRecordAudio = document.getElementById('btnAiRecordAudio');
const aiRecordingIndicator = document.getElementById('aiRecordingIndicator');
const aiRecordingTime = document.getElementById('aiRecordingTime');
const aiAudioStatusLabel = document.getElementById('aiAudioStatusLabel');
const aiAudioPreviewContainer = document.getElementById('aiAudioPreviewContainer');
const aiAudioPlayer = document.getElementById('aiAudioPlayer');
const btnAiDeleteAudio = document.getElementById('btnAiDeleteAudio');

// Files Elements
const aiGeneratorFileInput = document.getElementById('aiGeneratorFileInput');
const btnAiBrowseFiles = document.getElementById('btnAiBrowseFiles');
const aiFilesPreviewGrid = document.getElementById('aiFilesPreviewGrid');

// Action Elements
const btnAiGenerateFinal = document.getElementById('btnAiGenerateFinal');
const aiGeneratorLoaderOverlay = document.getElementById('aiGeneratorLoaderOverlay');

// Archivio Elements
const btnOpenAiDrafts = document.getElementById('btnOpenAiDrafts');
const aiDraftsContainer = document.getElementById('aiDraftsContainer');
const aiDraftsCount = document.getElementById('aiDraftsCount');
const aiDraftsModal = document.getElementById('aiDraftsModal');
const btnCloseAiDrafts = document.getElementById('btnCloseAiDrafts');
const aiDraftsCardsContainer = document.getElementById('aiDraftsCardsContainer');

// Generator State
let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;
let audioBase64 = null;
let audioMimeType = null;
let isRecording = false;
let recordInterval = null;
let recordSeconds = 0;
let attachedFilesBase64 = [];

// Audio Logic
async function toggleRecording() {
    if (!isRecording) {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("I moderni browser bloccano l'accesso al Microfono se apri la pagina come file locale sul PC (ossia con indirizzo che inizia per file:///...). Per usare questa funzione, Antimo deve essere prima pubblicato online (su Netlify o Firebase) o aperto con un simulatore server locale.");
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };
            
            mediaRecorder.onstop = () => {
                audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                if (!audioBlob || audioBlob.size === 0) {
                    audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/mp4' });
                }
                audioMimeType = audioBlob.type;
                
                const audioUrl = URL.createObjectURL(audioBlob);
                if(aiAudioPlayer) aiAudioPlayer.src = audioUrl;
                if(aiAudioPreviewContainer) aiAudioPreviewContainer.classList.remove('hidden');
                if(btnAiRecordAudio) btnAiRecordAudio.style.display = 'none';
                if(aiAudioStatusLabel) aiAudioStatusLabel.innerText = "Audio acquisito!";
                
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    const fullBase64 = reader.result;
                    audioBase64 = fullBase64.split(',')[1];
                };
            };

            mediaRecorder.start();
            isRecording = true;
            
            if(btnAiRecordAudio) {
                btnAiRecordAudio.innerHTML = '⏹️';
                btnAiRecordAudio.style.transform = 'scale(1.1)';
            }
            if(aiRecordingIndicator) aiRecordingIndicator.classList.remove('hidden');
            if(aiAudioStatusLabel) aiAudioStatusLabel.innerText = "Parla ora...";
            
            recordSeconds = 0;
            if(aiRecordingTime) aiRecordingTime.innerText = "00:00";
            recordInterval = setInterval(() => {
                recordSeconds++;
                const m = String(Math.floor(recordSeconds / 60)).padStart(2, '0');
                const s = String(recordSeconds % 60).padStart(2, '0');
                if(aiRecordingTime) aiRecordingTime.innerText = `${m}:${s}`;
            }, 1000);

        } catch(err) {
            alert("Errore accesso al microfono: " + err.message);
        }
    } else {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        isRecording = false;
        clearInterval(recordInterval);
        
        if(btnAiRecordAudio) {
            btnAiRecordAudio.innerHTML = '🎤';
            btnAiRecordAudio.style.transform = 'scale(1)';
        }
        if(aiRecordingIndicator) aiRecordingIndicator.classList.add('hidden');
    }
}

if(btnAiRecordAudio) {
    btnAiRecordAudio.addEventListener('click', toggleRecording);
}
if(btnAiDeleteAudio) {
    btnAiDeleteAudio.addEventListener('click', () => {
        audioBlob = null;
        audioBase64 = null;
        if(aiAudioPlayer) aiAudioPlayer.src = "";
        if(aiAudioPreviewContainer) aiAudioPreviewContainer.classList.add('hidden');
        if(btnAiRecordAudio) btnAiRecordAudio.style.display = 'flex';
        if(aiAudioStatusLabel) aiAudioStatusLabel.innerText = "Pronto per registrare";
    });
}

// Files Logic
function handleGeneratorFiles(files) {
    for (let file of files) {
        if (!file.type.startsWith('image/') && file.type !== 'application/pdf' && !file.type.startsWith('audio/')) {
            alert("Formato non supportato: " + file.name + " (Solo Immagini, Audio o PDF)");
            continue;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            attachedFilesBase64.push({
                data: e.target.result.split(',')[1],
                mimeType: file.type,
                name: file.name
            });
            renderGeneratorFilesPreview();
        };
        reader.readAsDataURL(file);
    }
}

function renderGeneratorFilesPreview() {
    if(!aiFilesPreviewGrid) return;
    aiFilesPreviewGrid.innerHTML = '';
    attachedFilesBase64.forEach((f, idx) => {
        const div = document.createElement('div');
        div.style.cssText = "position: relative; width: 60px; height: 60px; border-radius: 8px; border: 1px solid #ccc; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); background: #f8fafc; display:flex; align-items:center; justify-content:center; font-size: 0.7rem; font-weight:bold; color: #475569;";
        
        if (f.mimeType.startsWith('image/')) {
            div.innerHTML = `<img src="data:${f.mimeType};base64,${f.data}" style="width:100%; height:100%; object-fit:cover;">`;
        } else if (f.mimeType === 'application/pdf') {
            div.innerHTML = `PDF<br>Doc`;
        } else if (f.mimeType.startsWith('audio/')) {
            div.innerHTML = `🎵<br>Audio`;
        }
        
        div.innerHTML += `<button onclick="window.removeAiGeneratorFile(${idx})" style="position:absolute; top: -5px; right: -5px; background: #ef4444; color: white; border: none; border-radius: 50%; font-size: 10px; width: 18px; height: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>`;
        aiFilesPreviewGrid.appendChild(div);
    });
}

window.removeAiGeneratorFile = function(idx) {
    attachedFilesBase64.splice(idx, 1);
    renderGeneratorFilesPreview();
};

if(btnAiBrowseFiles) {
    btnAiBrowseFiles.addEventListener('click', () => {
        if(aiGeneratorFileInput) aiGeneratorFileInput.click();
    });
}
if(aiGeneratorFileInput) {
    aiGeneratorFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleGeneratorFiles(e.target.files);
        aiGeneratorFileInput.value = '';
    });
}
window.addEventListener('paste', (e) => {
    if (aiGeneratorModal && !aiGeneratorModal.classList.contains('hidden')) {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        let files = [];
        for (let item of items) {
            if (item.type.indexOf("image") === 0 || item.type === "application/pdf") {
                files.push(item.getAsFile());
            }
        }
        if (files.length > 0) handleGeneratorFiles(files);
    }
});

// Elaborazione AI
if(btnAiGenerateFinal) {
    btnAiGenerateFinal.addEventListener('click', async () => {
        if (!audioBase64 && attachedFilesBase64.length === 0) {
            return alert("Devi registrare un audio, o allegare un documento (PDF/Foto)!");
        }
        if (!geminiApiKey) {
            return alert("Errore: Chiave Gemini non trovata (vedi Pannello Admin).");
        }

        if(aiGeneratorLoaderOverlay) aiGeneratorLoaderOverlay.classList.remove('hidden');

        try {
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
- "note": altre direttive, urgenze, e raccomandazioni extra.
- "dataPrevista": una data *APPROSSIMATIVA O PRECISA* citata, possibilmente in formato YYYY-MM-DD. Metti "" se omessa.

!!! ATTENZIONE: DEVI RISPONDERE SOLO ED ESCLUSIVAMENTE CON UN FILE JSON VALIDO !!! Nessun markdown, nessun \`\`\`json. Solo parentesi graffe. Se un campo manca usa "".`;

            let contentsList = [{ text: promptSpeciale }];
            
            if (audioBase64) {
                contentsList.push({
                    inlineData: { mimeType: audioMimeType || "audio/webm", data: audioBase64 }
                });
            }
            
            attachedFilesBase64.forEach(f => {
                contentsList.push({
                    inlineData: { mimeType: f.mimeType, data: f.data }
                });
            });

            const dataPayload = { contents: [{ role: "user", parts: contentsList }] };

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataPayload)
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);

            let rawResponse = data.candidates[0].content.parts[0].text;
            rawResponse = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            
            let parsedObj = {};
            try {
                parsedObj = JSON.parse(rawResponse);
            } catch(e) {
                throw new Error("Gemini ha prodotto un JSON invalido. Riprova.");
            }

            parsedObj.inviatoDa = localStorage.getItem('antimo_user_name') || "Utente";
            parsedObj.registrazioneBase64 = !!audioBase64;
            parsedObj.hasAllegati = attachedFilesBase64.length > 0;
            parsedObj.creatoIl = serverTimestamp();
            parsedObj.status = "da_valutare";

            await addDoc(collection(db, "proposte_ai"), parsedObj);

            // Cleanup success
            audioBlob = null;
            audioBase64 = null;
            if(aiAudioPlayer) aiAudioPlayer.src = "";
            if(aiAudioPreviewContainer) aiAudioPreviewContainer.classList.add('hidden');
            if(btnAiRecordAudio) btnAiRecordAudio.style.display = 'flex';
            if(aiAudioStatusLabel) aiAudioStatusLabel.innerText = "Pronto per registrare";
            attachedFilesBase64 = [];
            renderGeneratorFilesPreview();
            
            if(aiGeneratorModal) aiGeneratorModal.classList.add('hidden');
            if(aiGeneratorLoaderOverlay) aiGeneratorLoaderOverlay.classList.add('hidden');
            if(aiDraftsModal) aiDraftsModal.classList.remove('hidden');

        } catch(err) {
            console.error("Generazione Fallita", err);
            alert("Errore AI: " + err.message);
            if(aiGeneratorLoaderOverlay) aiGeneratorLoaderOverlay.classList.add('hidden');
        }
    });
}

// Archivio Drafts Logic
let draftsDataList = [];
const qDrafts = query(collection(db, "proposte_ai"), orderBy("creatoIl", "desc"));

onSnapshot(qDrafts, (snapshot) => {
    draftsDataList = [];
    snapshot.forEach(docSnap => {
        draftsDataList.push({ idFb: docSnap.id, ...docSnap.data() });
    });
    
    if(aiDraftsCount) aiDraftsCount.innerText = draftsDataList.length;
    if(aiDraftsContainer) {
        aiDraftsContainer.style.display = draftsDataList.length > 0 ? 'block' : 'none';
    }
    renderDraftsList();
});

function renderDraftsList() {
    if(!aiDraftsCardsContainer) return;
    
    if (draftsDataList.length === 0) {
        aiDraftsCardsContainer.innerHTML = "<div style='text-align: center; color: #94a3b8; padding: 30px; font-weight:bold;'>Nessuna bozza da valutare. Le proposte dell'AI appariranno qui!</div>";
        return;
    }
    
    aiDraftsCardsContainer.innerHTML = '';
    draftsDataList.forEach(draft => {
        const div = document.createElement('div');
        div.style.cssText = "background: white; border-radius: 12px; border: 1px solid #cbd5e1; box-shadow: 0 4px 6px rgba(0,0,0,0.05); padding: 20px; position: relative;";
        
        div.innerHTML = `
            <div style="font-size: 0.7rem; color: #64748b; margin-bottom: 5px; text-transform:uppercase; font-weight:bold;">✨ Proposta Generata da: ${draft.inviatoDa}</div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div><label style="font-size:0.8rem; font-weight:bold;">Paziente/Ente</label><input type="text" id="draft_paz_${draft.idFb}" value="${draft.paziente || ''}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; font-weight:bold;"></div>
                <div><label style="font-size:0.8rem; font-weight:bold;">Tipo Intervento</label><input type="text" id="draft_tipo_${draft.idFb}" value="${draft.tipo || ''}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;"></div>
                <div><label style="font-size:0.8rem; font-weight:bold;">Località</label><input type="text" id="draft_loc_${draft.idFb}" value="${draft.localita || ''}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;"></div>
                <div><label style="font-size:0.8rem; font-weight:bold;">Indirizzo</label><input type="text" id="draft_ind_${draft.idFb}" value="${draft.indirizzo || ''}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;"></div>
                <div><label style="font-size:0.8rem; font-weight:bold;">Telefono</label><input type="text" id="draft_tel_${draft.idFb}" value="${draft.telefono || ''}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;"></div>
                <div><label style="font-size:0.8rem; font-weight:bold;">Data (YYYY-MM-DD)</label><input type="text" id="draft_data_${draft.idFb}" value="${draft.dataPrevista || ''}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; background:#fef08a;"></div>
                <div style="grid-column: span 2;"><label style="font-size:0.8rem; font-weight:bold;">Dispositivi</label><input type="text" id="draft_disp_${draft.idFb}" value="${draft.dispositivi || ''}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;"></div>
                <div style="grid-column: span 2;"><label style="font-size:0.8rem; font-weight:bold;">Accessori/Matricola</label><input type="text" id="draft_acc_${draft.idFb}" value="${draft.accessoriStr || ''} MATRICOLA: ${draft.matricola || 'N/D'}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;"></div>
                <div style="grid-column: span 2;"><label style="font-size:0.8rem; font-weight:bold;">Note</label><textarea id="draft_note_${draft.idFb}" rows="2" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;">${draft.note || ''}</textarea></div>
            </div>

            <div style="display: flex; gap: 10px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
                <button onclick="window.approvaDraftAi('${draft.idFb}')" class="btn btn-primary" style="flex:1; background: #22c55e; border:none; margin:0; font-weight:bold;">✔️ APPROVA E SALVA IN PROGRAMMATI</button>
                <button onclick="window.eliminaDraftAi('${draft.idFb}')" class="btn btn-danger" style="background: #ef4444; border:none; margin:0; font-weight:bold;">🗑 Elimina Boz</button>
            </div>
        `;
        aiDraftsCardsContainer.appendChild(div);
    });
}

window.approvaDraftAi = async function(idFb) {
    if(!confirm("Salvare in Programmati DEFINITIVI?")) return;
    
    const updatedData = {
        paziente: document.getElementById(`draft_paz_${idFb}`).value,
        tipo: document.getElementById(`draft_tipo_${idFb}`).value,
        localita: document.getElementById(`draft_loc_${idFb}`).value,
        indirizzo: document.getElementById(`draft_ind_${idFb}`).value,
        telefono: document.getElementById(`draft_tel_${idFb}`).value,
        dataPrevista: document.getElementById(`draft_data_${idFb}`).value,
        dispositivi: document.getElementById(`draft_disp_${idFb}`).value,
        accessoriStr: document.getElementById(`draft_acc_${idFb}`).value,
        note: document.getElementById(`draft_note_${idFb}`).value,
        status: "in_attesa",
        programmatoDa: localStorage.getItem('antimo_user_name') || "Utente (via AI)",
        tecnicoAssegnato: "Da Assegnare"
    };
    
    try {
        await addDoc(collection(db, "programmati"), updatedData);
        await deleteDoc(doc(db, "proposte_ai", idFb));
        alert("Perfetto! L'attività è in Programmati!");
    } catch(err) {
        alert("Errore salva bozza: " + err.message);
    }
};

window.eliminaDraftAi = async function(idFb) {
    if(!confirm("Eliminare definitivamente la bozza?")) return;
    try {
        await deleteDoc(doc(db, "proposte_ai", idFb));
    } catch(err) {
        alert("Errore: " + err.message);
    }
};

