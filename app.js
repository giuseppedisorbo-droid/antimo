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

// Stato App
let completedInterventions = JSON.parse(localStorage.getItem('antimo_interventions')) || [];
let plannedInterventions = JSON.parse(localStorage.getItem('antimo_plannedInterventions')) || [];

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
const btnToggleNuovoIntervento = document.getElementById('btnToggleNuovoIntervento');
const btnCloseInterventionSection = document.getElementById('btnCloseInterventionSection');
const btnStartIntervention = document.getElementById('btnStartIntervention');
const btnPlanIntervention = document.getElementById('btnPlanIntervention');
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
const btnMostraP = document.getElementById('btnMostraP');
const btnCalendar = document.getElementById('btnCalendarLink'); // changed to Link!
const btnMostraEseguiti = document.getElementById('btnMostraEseguiti');
const btnMostraNP = document.getElementById('btnMostraNP');
const npCount = document.getElementById('npCount');
const btnMostraOggi = document.getElementById('btnMostraOggi');
const btnMostraDomani = document.getElementById('btnMostraDomani');
const oggiCount = document.getElementById('oggiCount');
const domaniCount = document.getElementById('domaniCount');

// Messaggistica
const messagesSection = document.getElementById('messagesSection');
const btnToggleMessages = document.getElementById('btnToggleMessages');
const messagesContainer = document.getElementById('messagesContainer');
const messagesList = document.getElementById('messagesList');
const newMessageForm = document.getElementById('newMessageForm');
const msgText = document.getElementById('msgText');
const msgIsNotification = document.getElementById('msgIsNotification');
const btnTopNotification = document.getElementById('btnTopNotification');
const topNotificationText = document.getElementById('topNotificationText');

// Nuovi Toggles Logic
let isPlannedVisible = false;
let isNpVisible = false;
let isOggiVisible = false;
let isDomaniVisible = false;
let isEseguitiVisible = false;
let selectedCalendarDate = null;
let allExpanded = false;

const globalToggleCardContainer = document.getElementById('globalToggleCardContainer');
const btnToggleAllCollapse = document.getElementById('btnToggleAllCollapse');

if(btnToggleAllCollapse) {
    btnToggleAllCollapse.addEventListener('click', () => {
        allExpanded = !allExpanded;
        const expandedViews = document.querySelectorAll('.card-expanded-view');
        const icons = document.querySelectorAll('.expand-icon');
        expandedViews.forEach(el => {
            if (allExpanded) el.classList.remove('hidden');
            else el.classList.add('hidden');
        });
        icons.forEach(el => {
            if (allExpanded) el.classList.add('rotate-icon');
            else el.classList.remove('rotate-icon');
        });
        btnToggleAllCollapse.innerHTML = allExpanded ? `<span class="btn-icon">⏫</span> CHIUDI TUTTE LE SCHEDE` : `<span class="btn-icon">⏬</span> APRI TUTTE LE SCHEDE`;
    });
}

function setupAccordionCard(cardContainer) {
    const compactView = cardContainer.querySelector('.card-compact-view');
    const expandedView = cardContainer.querySelector('.card-expanded-view');
    const icon = cardContainer.querySelector('.expand-icon');
    
    if (allExpanded && expandedView) {
        expandedView.classList.remove('hidden');
        if (icon) icon.classList.add('rotate-icon');
    }
    
    if (compactView && expandedView) {
        compactView.addEventListener('click', (e) => {
            if (e.target.tagName.toLowerCase() === 'button' || e.target.closest('button')) return;
            const isHidden = expandedView.classList.contains('hidden');
            if (isHidden && !allExpanded) {
                document.querySelectorAll('.card-expanded-view').forEach(el => el.classList.add('hidden'));
                document.querySelectorAll('.expand-icon').forEach(el => el.classList.remove('rotate-icon'));
            }
            if (isHidden) {
                expandedView.classList.remove('hidden');
                if (icon) icon.classList.add('rotate-icon');
            } else {
                expandedView.classList.add('hidden');
                if (icon) icon.classList.remove('rotate-icon');
            }
        });
    }
}

function updateHeaderFiltersUI() {
    const list = [
        { btn: btnMostraOggi, active: isOggiVisible },
        { btn: btnMostraDomani, active: isDomaniVisible },
        { btn: btnMostraProgrammati, active: isPlannedVisible && !selectedCalendarDate },
        { btn: btnMostraP, active: isPlannedVisible && !selectedCalendarDate },
        { btn: btnMostraNP, active: isNpVisible },
        { btn: btnMostraEseguiti, active: isEseguitiVisible },
        { btn: btnCalendar, active: !!selectedCalendarDate }
    ];
    list.forEach(item => {
        if (item.btn) {
            if (item.active) item.btn.classList.add('active-filter');
            else item.btn.classList.remove('active-filter');
        }
    });
    
    const anyListVisible = isOggiVisible || isDomaniVisible || isPlannedVisible || isNpVisible || isEseguitiVisible;
    if (anyListVisible && globalToggleCardContainer) globalToggleCardContainer.classList.remove('hidden');
    else if (globalToggleCardContainer) globalToggleCardContainer.classList.add('hidden');
}

function toggleTarget(target) {
    if (target === 'oggi') { isOggiVisible = !isOggiVisible; selectedCalendarDate = null; }
    if (target === 'domani') { isDomaniVisible = !isDomaniVisible; selectedCalendarDate = null; }
    if (target === 'planned') { isPlannedVisible = !isPlannedVisible; selectedCalendarDate = null; }
    if (target === 'np') { isNpVisible = !isNpVisible; selectedCalendarDate = null; }
    if (target === 'eseguiti') {
        isEseguitiVisible = !isEseguitiVisible;
        selectedCalendarDate = null;
        if (isEseguitiVisible) {
            activitiesListContainer.classList.remove('hidden');
            if(btnViewActivities) btnViewActivities.innerHTML = `<span class="btn-icon">🙈</span> NASCONDI ATTIVITÀ`;
            renderActivitiesList();
        } else {
            activitiesListContainer.classList.add('hidden');
            if(btnViewActivities) btnViewActivities.innerHTML = `<span class="btn-icon">👁</span> VISUALIZZA ATTIVITÀ`;
        }
    }
    updateHeaderFiltersUI();
    updateUI();
}

if(btnMostraOggi) btnMostraOggi.addEventListener('click', () => toggleTarget('oggi'));
if(btnMostraDomani) btnMostraDomani.addEventListener('click', () => toggleTarget('domani'));
if(btnMostraProgrammati) btnMostraProgrammati.addEventListener('click', () => toggleTarget('planned'));
if(btnMostraP) btnMostraP.addEventListener('click', () => toggleTarget('planned'));
if(btnMostraNP) btnMostraNP.addEventListener('click', () => toggleTarget('np'));
if(btnMostraEseguiti) btnMostraEseguiti.addEventListener('click', () => toggleTarget('eseguiti'));

if(btnToggleMessages) {
    btnToggleMessages.addEventListener('click', () => {
        messagesContainer.classList.toggle('hidden');
        let badgeSpan = btnToggleMessages.querySelector('span');
        let noteBadge = badgeSpan ? ' ' + badgeSpan.outerHTML : '';
        btnToggleMessages.innerHTML = (messagesContainer.classList.contains('hidden') ? 'Mostra' : 'Nascondi') + noteBadge;
    });
}

if(btnTopNotification) {
    btnTopNotification.addEventListener('click', () => {
        if(messagesContainer.classList.contains('hidden')) {
            messagesContainer.classList.remove('hidden');
            btnToggleMessages.textContent = 'Nascondi';
        }
        messagesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

if(btnToggleNuovoIntervento) {
    btnToggleNuovoIntervento.addEventListener('click', () => {
        interventionSection.classList.toggle('hidden');
        if(!interventionSection.classList.contains('hidden')) {
            interventionSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
}

if(btnCloseInterventionSection) {
    btnCloseInterventionSection.addEventListener('click', () => {
        interventionSection.classList.add('hidden');
    });
}

// LOGICA MESSAGGISTICA E NOTIFICHE
async function loadMessages() {
    if (!isFirebaseConfigured) {
        if(messagesList) messagesList.innerHTML = '<div style="color:red; font-size:0.85rem; text-align:center;">Sincronizzazione Cloud non configurata per i messaggi.</div>';
        return;
    }
    try {
        const { query, collection, onSnapshot, orderBy } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const q = query(collection(db, "messaggi"), orderBy("timestamp", "desc"));
        
        onSnapshot(q, (snapshot) => {
            if(!messagesList) return;
            messagesList.innerHTML = '';
            let count = 0;
            let activeNotes = [];
            
            snapshot.forEach((docSnap) => {
                count++;
                const data = docSnap.data();
                if(data.isNotification) activeNotes.push(data.text);
                
                const div = document.createElement('div');
                div.setAttribute('data-id', docSnap.id);
                div.style.padding = "10px";
                div.style.borderRadius = "8px";
                div.style.backgroundColor = data.isNotification ? "#fffbeb" : (data.letto ? "#f8fafc" : "#f1f5f9");
                div.style.borderLeft = data.isNotification ? "4px solid #f59e0b" : "4px solid #cbd5e1";
                div.style.fontSize = "0.9rem";
                div.style.display = "flex";
                div.style.flexDirection = "column";
                div.style.gap = "5px";
                div.style.transition = "background-color 1s ease";
                if(data.letto && !data.isNotification) div.style.opacity = "0.6";

                let timeStr = "--/--/---- --:--";
                if(data.timestamp) {
                    const d = new Date(data.timestamp.toMillis());
                    timeStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
                }

                let sN = data.sender || "Sconosciuto";
                let rN = data.recipients || "Bacheca (Tutti)";

                div.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <span style="font-size: 0.75rem; color: #666; font-weight: 600;">⏰ ${timeStr} </span>
                        <div>
                            ${data.presoInCarico ? '<span style="font-size:0.75rem; background:#3b82f6; color:white; padding:2px 6px; border-radius:12px; font-weight:bold; margin-right:4px;">👷 Preso in Carico</span>' : ''}
                            ${data.isNotification ? '<span style="font-size:0.75rem; background:#f59e0b; color:white; padding:2px 6px; border-radius:12px; font-weight:bold;">📌 NOTIFICA</span>' : ''}
                        </div>
                    </div>
                    <div style="margin-top:5px; border-bottom: 1px dotted #ccc; padding-bottom: 5px; font-size: 0.8rem; color: var(--blue-dark);">
                        <strong>Da:</strong> ${sN} &nbsp;|&nbsp; <strong>A:</strong> ${rN}
                    </div>
                    <div style="color: #333; line-height: 1.4; white-space: pre-wrap; margin-top:5px; ${data.letto ? 'text-decoration: line-through; color: #777;' : ''}">${data.text}</div>
                `;
                
                const actionDiv = document.createElement('div');
                actionDiv.style.display = "flex";
                actionDiv.style.gap = "8px";
                actionDiv.style.marginTop = "8px";
                actionDiv.style.flexWrap = "wrap";

                const toggleBtn = document.createElement('button');
                toggleBtn.innerHTML = data.isNotification ? "🔕 Annulla Notifica" : "🔔 Setta Promemoria";
                toggleBtn.style.cssText = "background: none; border: 1px solid #b8b8b8; font-size: 0.75rem; padding: 4px 8px; border-radius: 4px; cursor: pointer; color: #555; background-color: rgba(255,255,255,0.5);";
                toggleBtn.onclick = async () => {
                    try {
                        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                        await updateDoc(doc(db, "messaggi", docSnap.id), { isNotification: !data.isNotification });
                    } catch(err) { console.error("Errore toggle", err); }
                };
                actionDiv.appendChild(toggleBtn);

                const toggleReadBtn = document.createElement('button');
                toggleReadBtn.innerHTML = data.letto ? "📖 Da Leggere" : "✔️ Letto";
                toggleReadBtn.style.cssText = "background: none; border: 1px solid #b8b8b8; font-size: 0.75rem; padding: 4px 8px; border-radius: 4px; cursor: pointer; color: #555; background-color: rgba(255,255,255,0.5);";
                toggleReadBtn.onclick = async () => {
                    try {
                        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                        await updateDoc(doc(db, "messaggi", docSnap.id), { letto: !data.letto });
                    } catch(err) { console.error("Errore letto", err); }
                };
                actionDiv.appendChild(toggleReadBtn);
                
                const toggleCaricoBtn = document.createElement('button');
                toggleCaricoBtn.innerHTML = data.presoInCarico ? "❌ Annulla Incarico" : "👷 Prendi in Carico";
                toggleCaricoBtn.style.cssText = "background: none; border: 1px solid #3b82f6; font-size: 0.75rem; padding: 4px 8px; border-radius: 4px; cursor: pointer; color: #1d4ed8; background-color: rgba(59,130,246,0.1);";
                toggleCaricoBtn.onclick = async () => {
                    try {
                        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                        await updateDoc(doc(db, "messaggi", docSnap.id), { presoInCarico: !data.presoInCarico });
                    } catch(err) { console.error("Errore carico", err); }
                };
                actionDiv.appendChild(toggleCaricoBtn);

                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = "🗑️ Elimina";
                deleteBtn.style.cssText = "background: none; border: 1px solid #ffcccc; font-size: 0.75rem; padding: 3px 8px; border-radius: 4px; cursor: pointer; color: #d32f2f; background-color: rgba(255,255,255,0.5);";
                deleteBtn.onclick = async () => {
                    if(!confirm("Eliminare definitivamente questo messaggio?")) return;
                    try {
                        const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                        await deleteDoc(doc(db, "messaggi", docSnap.id));
                    } catch(err) { console.error("Errore elim msg", err); }
                };
                actionDiv.appendChild(deleteBtn);

                div.appendChild(actionDiv);
                
                messagesList.appendChild(div);
            });
            
            // Aggiorna Pulsante Globale Notifiche e Testo "Mostra/Nascondi"
            if(activeNotes.length > 0 && btnTopNotification) {
                btnTopNotification.classList.remove('hidden');
                topNotificationText.textContent = `${activeNotes.length > 1 ? `(${activeNotes.length}) ` : ''}${activeNotes[0]}`;
            } else if(btnTopNotification) {
                btnTopNotification.classList.add('hidden');
            }
            
            if(btnToggleMessages) {
                const isHidden = messagesContainer.classList.contains('hidden');
                let noteBadge = activeNotes.length > 0 ? ` <span style="background:var(--orange);color:white;padding:2px 6px;border-radius:12px;font-size:0.7rem;">${activeNotes.length}</span>` : '';
                btnToggleMessages.innerHTML = (isHidden ? 'Mostra' : 'Nascondi') + noteBadge;
            }

            if(count === 0) {
                messagesList.innerHTML = '<div style="text-align: center; font-size: 0.9rem; color: #666; padding: 10px;">Nessun messaggio in bacheca.</div>';
            }
            
            // In caso di link WhatsApp con msgId
            const urlParams = new URLSearchParams(window.location.search);
            const msgId = urlParams.get('msgId');
            if(msgId) {
                const targetMsg = messagesList.querySelector(`div[data-id="${msgId}"]`);
                if(targetMsg) {
                    messagesContainer.classList.remove('hidden');
                    if(btnToggleMessages) btnToggleMessages.textContent = 'Nascondi';
                    setTimeout(() => {
                        targetMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        const originalBg = targetMsg.style.backgroundColor;
                        targetMsg.style.backgroundColor = '#dbeafe';
                        setTimeout(() => { targetMsg.style.backgroundColor = originalBg; }, 3000);
                    }, 500);
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            }
        }, (error) => {
            console.error("Errore snapshot messaggi", error);
            if(messagesList) messagesList.innerHTML = '<div style="color:red; font-size:0.85rem; text-align:center;">Errore caricamento messaggi.</div>';
        });
    } catch(e) { console.error(e); }
}

let pendingMessageText = "";
let pendingMessageIsNotification = false;

const waSelectModal = document.getElementById('waSelectModal');
const waContactsList = document.getElementById('waContactsList');
const waSelectAll = document.getElementById('waSelectAll');
const btnWaSkip = document.getElementById('btnWaSkip');
const btnWaSend = document.getElementById('btnWaSend');

const waQueueModal = document.getElementById('waQueueModal');
const waQueueList = document.getElementById('waQueueList');
const btnCloseWaQueue = document.getElementById('btnCloseWaQueue');

async function processMessageSave(text, isNotif, recipients = "Bacheca (Tutti)") {
    if(!isFirebaseConfigured) return null;
    try {
        const senderName = localStorage.getItem('antimo_user_name') || "Sconosciuto";
        const { collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const docRef = await addDoc(collection(db, "messaggi"), {
            text: text,
            isNotification: isNotif,
            sender: senderName,
            recipients: recipients,
            timestamp: serverTimestamp()
        });
        return docRef.id;
    } catch(err) {
        console.error("Errore invio msg", err);
        alert("Errore invio messaggio.");
        return null;
    }
}

if(newMessageForm) {
    newMessageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const testoS = document.getElementById('msgText').value.trim();
        const isNotif = document.getElementById('msgIsNotification') ? document.getElementById('msgIsNotification').checked : true;
        
        if(!testoS || !isFirebaseConfigured) return;
        
        pendingMessageText = testoS;
        pendingMessageIsNotification = isNotif;
        
        if (localeRubrica.length > 0) {
            waContactsList.innerHTML = '';
            localeRubrica.forEach((c, i) => {
                const div = document.createElement('label');
                div.style.cssText = "display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 10px; background: #f9f9f9; border-radius: 6px; border: 1px solid #eee;";
                div.innerHTML = `<input type="checkbox" class="wa-contact-cb" value="${i}" data-name="${c.nome}" style="transform: scale(1.2);"> <span style="font-weight:bold; color:var(--blue-dark);">${c.nome}</span> <span style="color:#666; font-size:0.85rem;">(${c.numero})</span>`;
                waContactsList.appendChild(div);
            });
            waSelectAll.checked = false;
            waSelectModal.classList.remove('hidden');
        } else {
            const btn = newMessageForm.querySelector('button[type="submit"]');
            const oldHtml = btn.innerHTML;
            btn.innerHTML = '...'; btn.disabled = true;
            
            await processMessageSave(pendingMessageText, pendingMessageIsNotification, "Bacheca (Tutti)");
            
            document.getElementById('msgText').value = '';
            if(document.getElementById('msgIsNotification')) document.getElementById('msgIsNotification').checked = true;
            btn.innerHTML = oldHtml; btn.disabled = false;
        }
    });
}

if(waSelectAll) {
    waSelectAll.addEventListener('change', (e) => {
        document.querySelectorAll('.wa-contact-cb').forEach(cb => cb.checked = e.target.checked);
    });
}

if(btnWaSkip) {
    btnWaSkip.addEventListener('click', async () => {
        btnWaSkip.disabled = true; btnWaSkip.innerHTML = '...';
        await processMessageSave(pendingMessageText, pendingMessageIsNotification, "Bacheca (Tutti)");
        document.getElementById('msgText').value = '';
        if(document.getElementById('msgIsNotification')) document.getElementById('msgIsNotification').checked = true;
        
        waSelectModal.classList.add('hidden');
        btnWaSkip.disabled = false; btnWaSkip.innerHTML = 'Solo Bacheca';
    });
}

if(btnWaSend) {
    btnWaSend.addEventListener('click', async () => {
        const checkedBoxes = Array.from(document.querySelectorAll('.wa-contact-cb:checked'));
        const selectedIndexes = checkedBoxes.map(cb => parseInt(cb.value));
        
        let recNames = checkedBoxes.map(cb => cb.getAttribute('data-name')).join(', ');
        if(!recNames) recNames = "Bacheca (Tutti)";
        
        btnWaSend.disabled = true; btnWaSend.innerHTML = '...';
        const msgId = await processMessageSave(pendingMessageText, pendingMessageIsNotification, recNames);
        document.getElementById('msgText').value = '';
        if(document.getElementById('msgIsNotification')) document.getElementById('msgIsNotification').checked = true;
        
        waSelectModal.classList.add('hidden');
        btnWaSend.disabled = false; btnWaSend.innerHTML = 'Procedi su WA';
        
        if(selectedIndexes.length > 0 && msgId) {
            waQueueList.innerHTML = '';
            selectedIndexes.forEach(idx => {
                const c = localeRubrica[idx];
                const btn = document.createElement('a');
                btn.className = "btn btn-primary";
                btn.style.cssText = "background: #25D366; border: none; padding: 12px; text-decoration: none; color: white; display: flex; justify-content: center; align-items: center; gap: 8px; font-weight: bold; border-radius: 8px;";
                btn.target = "_blank";
                
                let cleanNum = c.numero.replace(/\s+/g, '');
                if(!cleanNum.startsWith('+') && cleanNum.length <= 10) cleanNum = "39" + cleanNum;
                else cleanNum = cleanNum.replace('+', '');
                
                let appLink = window.location.origin + window.location.pathname + '?msgId=' + msgId;
                let textWithLink = pendingMessageText + "\n\nApri nell'App: " + appLink;
                
                btn.href = `https://wa.me/${cleanNum}?text=${encodeURIComponent(textWithLink)}`;
                btn.innerHTML = `<span style="font-size:1.2rem;">💬</span> WhatsApp per ${c.nome}`;
                btn.onclick = () => { 
                    btn.style.opacity = '0.5'; 
                    btn.innerHTML = `<span style="font-size:1.2rem;">✅</span> Inviato a ${c.nome}`;
                };
                waQueueList.appendChild(btn);
            });
            waQueueModal.classList.remove('hidden');
        }
    });
}

if(btnCloseWaQueue) {
    btnCloseWaQueue.addEventListener('click', () => {
        waQueueModal.classList.add('hidden');
    });
}

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

// Backup & Versioni
const btnOpenBackup = document.getElementById('btnOpenBackup');
const backupModal = document.getElementById('backupModal');
const btnCloseBackup = document.getElementById('btnCloseBackup');
const versionDescModal = document.getElementById('versionDescModal');
const btnCloseVersionDesc = document.getElementById('btnCloseVersionDesc');
const btnAiSearch = document.getElementById('btnAiSearch');
const aiSearchInput = document.getElementById('aiSearchInput');
const aiSearchResult = document.getElementById('aiSearchResult');
const verTitleDesc = document.getElementById('verTitleDesc');
const versionDescContent = document.getElementById('versionDescContent');

// Backup Dates
const backupManualeDate = document.getElementById('backupManualeDate');
const backupOggiDate = document.getElementById('backupOggiDate');
const backup2giorniDate = document.getElementById('backup2giorniDate');
const backup7giorniDate = document.getElementById('backup7giorniDate');

const btnSaveManualBackup = document.getElementById('btnSaveManualBackup');
const btnAllVersions = document.getElementById('btnAllVersions');

const justifyModal = document.getElementById('justifyModal');
const justifyReason = document.getElementById('justifyReason');
const btnCancelJustify = document.getElementById('btnCancelJustify');
const btnConfirmJustify = document.getElementById('btnConfirmJustify');

let interventionToJustify = null; // Memorizza l'ID in fase di giustificazione

let customDevices = JSON.parse(localStorage.getItem('antimo_customDevices')) || [];

const editInterventionModal = document.getElementById('editInterventionModal');
const btnCancelEdit = document.getElementById('btnCancelEdit');
const btnSaveEdit = document.getElementById('btnSaveEdit');

async function deleteProgrammatoAppJs(index) {
    const p = plannedInterventions[index];
    if(!p) return;
    if(!confirm(`Sicuro di voler eliminare l'intervento programmato per ${p.paziente}?`)) return;
    
    plannedInterventions.splice(index, 1);
    saveState();
    
    if (isFirebaseConfigured && (p.idFb || p.id)) {
        try {
            const { doc, deleteDoc, collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            if (p.idFb) {
                await deleteDoc(doc(db, "programmati", p.idFb));
            } else {
                const q = query(collection(db, "programmati"), where("id", "==", p.id));
                const snaps = await getDocs(q);
                snaps.forEach(async d => await deleteDoc(doc(db, "programmati", d.id)));
            }
        } catch(e) { console.error("Errore rimozione cloud", e); }
    }
    updateUI();
    updateInterventiCount();
}

let currentEditProgIndex = null;
function editProgrammatoAppJs(index) {
    const p = plannedInterventions[index];
    if(!p) return;
    currentEditProgIndex = index;
    
    document.getElementById('editItemIndex').value = index;
    document.getElementById('editPaziente').value = p.paziente || "";
    document.getElementById('editLocalita').value = p.localita || p.destinazione || "";
    document.getElementById('editIndirizzo').value = p.indirizzo || "";
    document.getElementById('editTelefono').value = p.telefono || "";
    document.getElementById('editTipo').value = p.tipo || "";
    document.getElementById('editDispositivi').value = p.dispositivi || "";
    document.getElementById('editMatricola').value = p.matricola || "";
    document.getElementById('editDataPrevista').value = p.dataPrevista || "";
    document.getElementById('editOraPrevista').value = p.oraPrevista || "";
    document.getElementById('editNote').value = p.note || "";
    
    editInterventionModal.classList.remove('hidden');
}

if(btnCancelEdit) btnCancelEdit.addEventListener('click', () => editInterventionModal.classList.add('hidden'));

if(btnSaveEdit) {
    btnSaveEdit.addEventListener('click', async () => {
        if(currentEditProgIndex === null) return;
        const p = plannedInterventions[currentEditProgIndex];
        
        btnSaveEdit.textContent = "Salvataggio...";
        btnSaveEdit.disabled = true;
        
        p.paziente = document.getElementById('editPaziente').value;
        p.localita = document.getElementById('editLocalita').value;
        p.indirizzo = document.getElementById('editIndirizzo').value;
        p.telefono = document.getElementById('editTelefono').value;
        p.tipo = document.getElementById('editTipo').value;
        p.dispositivi = document.getElementById('editDispositivi').value;
        p.matricola = document.getElementById('editMatricola').value;
        p.dataPrevista = document.getElementById('editDataPrevista').value;
        p.oraPrevista = document.getElementById('editOraPrevista').value;
        p.note = document.getElementById('editNote').value;
        p.status = p.dataPrevista ? 'planned' : 'in_attesa';
        
        saveState();
        
        if (isFirebaseConfigured && (p.idFb || p.id)) {
            try {
                const { doc, updateDoc, collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                const payload = { ...p };
                delete payload.idFb; // non salviamo la chiave fb se presente
                
                if (p.idFb) {
                    await updateDoc(doc(db, "programmati", p.idFb), payload);
                } else {
                    const q = query(collection(db, "programmati"), where("id", "==", p.id));
                    const snaps = await getDocs(q);
                    snaps.forEach(async d => await updateDoc(doc(db, "programmati", d.id), payload));
                }
            } catch(e) { console.error("Errore aggiornamento cloud", e); }
        }
        
        editInterventionModal.classList.add('hidden');
        btnSaveEdit.textContent = "SALVA MODIFICHE";
        btnSaveEdit.disabled = false;
        
        updateUI();
        updateInterventiCount();
    });
}

function initApp() {
    customDevices.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d; opt.textContent = d;
        iDispositiviSelect.insertBefore(opt, iDispositiviSelect.lastElementChild);
    });

    updateUI();
    updateInterventiCount();
    
    // Inizializza Listeners Real-time e sync
    loadMessages();
    
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
    localStorage.setItem('antimo_interventions', JSON.stringify(completedInterventions));
    localStorage.setItem('antimo_plannedInterventions', JSON.stringify(plannedInterventions));
    localStorage.setItem('antimo_customDevices', JSON.stringify(customDevices));
}

function updateUI() {
    // Gestione KM visibilità dal Setting
    if (requireKm) {
        kmContainer.classList.remove('hidden');
    } else {
        kmContainer.classList.add('hidden');
    }

    // Le attività programmate
    const visibiliProg = plannedInterventions.filter(p => !p.status || p.status === 'planned');
    updateHeaderFiltersUI();
    
    if (selectedCalendarDate) {
        oggiInterventionsSection.classList.add('hidden');
        domaniInterventionsSection.classList.add('hidden');
        npInterventionsSection.classList.add('hidden');
        
        if (isPlannedVisible) {
            plannedInterventionsSection.classList.remove('hidden');
            const titolo = plannedInterventionsSection.querySelector('h2');
            if(titolo) titolo.innerHTML = `<span class="btn-icon">📅</span> Interventi del ${selectedCalendarDate.split('-').reverse().join('/')}`;
            const filteredByDate = visibiliProg.filter(p => p.dataPrevista === selectedCalendarDate);
            renderPlannedInterventions(filteredByDate, [], []);
        } else {
            plannedInterventionsSection.classList.add('hidden');
        }
        return;
    }
    
    const titoloProg = plannedInterventionsSection.querySelector('h2');
    if(titoloProg) titoloProg.innerHTML = `<span class="btn-icon">📅</span> Tutti i Programmati`;
    
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
        div.className = "card-item-container";
        
        let dateStr = p.dataPrevista ? p.dataPrevista.split('-').reverse().join('/') : 'N/D';
        let attachBadge = (p.fileUrlsProgrammati && p.fileUrlsProgrammati.length > 0) ? `<span style="font-size:0.8rem; background:var(--orange-light); color:white; padding:2px 5px; border-radius:4px; margin-left:5px;">📎</span>` : '';

        let attachHtml = '';
        if (p.fileUrlsProgrammati && p.fileUrlsProgrammati.length > 0) {
            attachHtml = `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px dotted #ccc;">
                <strong>📎 Allegati Sede:</strong><br>
                ${p.fileUrlsProgrammati.map((url, i) => `<a href="${url}" target="_blank" style="color: var(--blue-primary); font-size: 0.85rem; text-decoration: underline;">Allegato ${i+1}</a>`).join('<br>')}
            </div>`;
        }

        div.innerHTML = `
            <div class="card-compact-view">
                <div style="flex:1;">
                    <div style="font-weight:bold; color:var(--blue-dark); font-size:1.05rem;">${p.paziente} ${attachBadge}</div>
                    <div style="font-size:0.85rem; color:#555;">📍 ${p.localita || p.destinazione} | 🔧 ${p.tipo}</div>
                    <div style="font-size:0.80rem; color:var(--orange); font-weight:600; margin-top:4px;">🗓 Data Prevista: ${dateStr}</div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; padding-left: 10px;">
                    <button class="btn btn-primary btn-orange btn-sm" style="padding:6px 10px; font-size:0.8rem; line-height:1; min-width:auto;" data-action="avvia" data-index="${index}">▶ AVVIA</button>
                    <span class="expand-icon" style="font-size:1.2rem; color:var(--blue-light); padding:10px;">▼</span>
                </div>
            </div>
            
            <div class="card-expanded-view hidden">
                <div style="font-size:0.85rem; color:#666;"><strong>📍 Indirizzo:</strong> ${p.indirizzo || ''}</div>
                <div style="font-size:0.80rem; color:#555; margin-top:4px;">📞 ${p.telefono || '-'}</div>
                <div style="font-size:0.85rem; color:#333; margin-top:5px;"><strong>Disp:</strong> ${p.dispositivi || 'Nessuno'}</div>
                <div style="font-size:0.85rem; color:#333; margin-top:5px; padding-bottom:10px;"><strong>Note:</strong> ${p.note || 'Nessuna'}</div>
                ${attachHtml}
                <div style="display:flex; gap:10px; margin-top: 15px;">
                    <button class="btn btn-primary btn-sm" style="flex:1; padding:8px; font-size:0.85rem;" data-action="edit" data-index="${index}">✏ Modifica</button>
                    <button class="btn btn-danger btn-sm" style="flex:1; padding:8px; font-size:0.85rem;" data-action="delete" data-index="${index}">🗑 Elimina</button>
                    <button class="btn btn-danger btn-sm" style="flex:1; padding:8px; font-size:0.85rem; background:#b45309;" data-action="justify" data-index="${index}">✖ Non Eseg</button>
                </div>
            </div>
        `;
        
        setupAccordionCard(div);
        
        div.querySelector('button[data-action="edit"]')?.addEventListener('click', (e) => editProgrammatoAppJs(e.target.getAttribute('data-index')));
        div.querySelector('button[data-action="delete"]')?.addEventListener('click', (e) => deleteProgrammatoAppJs(e.target.getAttribute('data-index')));
        
        div.querySelector('button[data-action="avvia"]').addEventListener('click', (e) => {
            const idx = e.target.getAttribute('data-index');
            const dataToLoad = plannedInterventions[idx];
            
            // Popoliamo il form
            function setSelectMultipleValues(selectEl, strValues) {
                Array.from(selectEl.options).forEach(opt => opt.selected = false);
                if(!strValues) return;
                const vals = strValues.split(',').map(s => s.trim());
                Array.from(selectEl.options).forEach(opt => {
                    if(vals.includes(opt.value)) opt.selected = true;
                });
            }
            
            setSelectMultipleValues(iTipo, dataToLoad.tipo);
            iPaziente.value = dataToLoad.paziente;
            if(iLocalita) iLocalita.value = dataToLoad.localita || dataToLoad.destinazione || "";
            if(iIndirizzo) iIndirizzo.value = dataToLoad.indirizzo || "";
            if(iTelefono) iTelefono.value = dataToLoad.telefono || "";
            
            setSelectMultipleValues(iDispositiviSelect, dataToLoad.dispositivi);
            
            // Gestione custom devices se non trovati
            if(dataToLoad.dispositivi) {
                const devs = dataToLoad.dispositivi.split(',').map(s=>s.trim());
                if(devs.some(d => !Array.from(iDispositiviSelect.options).some(o=>o.value===d))) {
                    iNuovoDispositivo.classList.remove('hidden');
                    iNuovoDispositivo.value = devs.filter(d => !Array.from(iDispositiviSelect.options).some(o=>o.value===d)).join(', ');
                } else {
                    iNuovoDispositivo.classList.add('hidden');
                }
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
            interventionSection.classList.remove('hidden');
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
        div.className = "card-item-container";
        div.style.borderLeft = "4px solid #ef4444";
        
        let noteStr = p.note || p.dispositivi || 'Nessuna nota';
        let attachBadge = (p.fileUrlsProgrammati && p.fileUrlsProgrammati.length > 0) ? `<span style="font-size:0.8rem; background:var(--orange-light); color:white; padding:2px 5px; border-radius:4px; margin-left:5px;">📎</span>` : '';

        let attachHtml = '';
        if (p.fileUrlsProgrammati && p.fileUrlsProgrammati.length > 0) {
            attachHtml = `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px dotted #ccc;">
                <strong>📎 Allegati Sede:</strong><br>
                ${p.fileUrlsProgrammati.map((url, i) => `<a href="${url}" target="_blank" style="color: var(--blue-primary); font-size: 0.85rem; text-decoration: underline;">Allegato ${i+1}</a>`).join('<br>')}
            </div>`;
        }

        div.innerHTML = `
            <div class="card-compact-view">
                <div style="flex:1;">
                    <div style="font-weight:bold; color:var(--blue-dark); font-size:1.05rem;">${p.paziente} ${attachBadge}</div>
                    <div style="font-size:0.85rem; color:#555;">📍 ${p.localita || p.destinazione} | 🔧 ${p.tipo}</div>
                    <div style="font-size:0.80rem; color:#ef4444; font-weight:600; margin-top:4px;">⏳ Da Programmare</div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; padding-left: 10px;">
                    <button class="btn btn-primary btn-orange btn-sm" style="padding:6px 10px; font-size:0.8rem; line-height:1; min-width:auto;" data-action="avvia" data-index="${index}">▶ AVVIA</button>
                    <span class="expand-icon" style="font-size:1.2rem; color:var(--blue-light); padding:10px;">▼</span>
                </div>
            </div>
            
            <div class="card-expanded-view hidden">
                <div style="font-size:0.85rem; color:#666;"><strong>📍 Indirizzo:</strong> ${p.indirizzo || ''}</div>
                <div style="font-size:0.80rem; color:#555; margin-top:4px;">📞 ${p.telefono || '-'}</div>
                <div style="font-size:0.85rem; color:#333; margin-top:5px;"><strong>Disp:</strong> ${p.dispositivi || 'Nessuno'}</div>
                <div style="font-size:0.85rem; color:#333; margin-top:5px; padding-bottom:10px;"><strong>Note:</strong> ${noteStr}</div>
                <div style="display:flex; gap:10px; margin-top: 15px;">
                    <button class="btn btn-primary btn-sm" style="flex:1; padding:8px; font-size:0.85rem;" data-action="edit" data-index="${index}">✏ Modifica</button>
                    <button class="btn btn-danger btn-sm" style="flex:1; padding:8px; font-size:0.85rem; background:#b45309;" data-action="delete" data-index="${index}">🗑 Elimina</button>
                </div>
            </div>
        `;
        
        setupAccordionCard(div);
        
        div.querySelector('button[data-action="edit"]')?.addEventListener('click', (e) => editProgrammatoAppJs(e.target.getAttribute('data-index')));
        div.querySelector('button[data-action="delete"]')?.addEventListener('click', (e) => deleteProgrammatoAppJs(e.target.getAttribute('data-index')));
        
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
            interventionSection.classList.remove('hidden');
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
        updateUI();
    });
}

// BACKUP E VERISONI EVENT LISTENERS
if(btnOpenBackup) {
    btnOpenBackup.addEventListener('click', () => {
        settingsModal.classList.add('hidden'); // Chiude impostazioni
        
        // Calcola le date da mostrare
        const today = new Date();
        
        if(backupManualeDate) {
            let savedTime = localStorage.getItem('antimo_manualBackupTime');
            backupManualeDate.innerHTML = `Oggi (Manuale) - ${savedTime ? savedTime : '--:--'}`;
        }

        if(backupOggiDate) backupOggiDate.innerText = formatDateDMY(today) + " (Automatica)";
        const d2 = new Date(); d2.setDate(today.getDate() - 2);
        if(backup2giorniDate) backup2giorniDate.innerText = formatDateDMY(d2);
        const d7 = new Date(); d7.setDate(today.getDate() - 7);
        if(backup7giorniDate) backup7giorniDate.innerText = formatDateDMY(d7);
        
        backupModal.classList.remove('hidden');
    });
}

if(btnSaveManualBackup) {
    btnSaveManualBackup.addEventListener('click', () => {
        const now = new Date();
        const timeStr = padZ(now.getHours()) + ":" + padZ(now.getMinutes());
        localStorage.setItem('antimo_manualBackupTime', timeStr);
        if(backupManualeDate) backupManualeDate.innerHTML = `Oggi (Manuale) - ${timeStr}`;
        alert("Versione manuale della giornata salvata con successo!");
    });
}

if(btnCloseBackup) {
    btnCloseBackup.addEventListener('click', () => {
        backupModal.classList.add('hidden');
    });
}

// Apertura modale singola versione
document.querySelectorAll('.btn-desc-version').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const version = e.target.getAttribute('data-version');
        let contentHtml = "";
        
        // Genera il changelog hardcoded
        if(version === "v24.3") {
            contentHtml = `
                <h4 style="color: var(--blue-primary); border-bottom: 1px solid #ddd; padding-bottom: 5px;">🌟 Novità Principali</h4>
                <ul style="padding-left: 20px; list-style-type: square; margin-bottom: 15px;">
                    <li><strong>Backup Versioni e AI:</strong> Integrata la nuova tabella per visualizzare lo storico delle versioni.</li>
                    <li><strong>Ricerca Intelligente:</strong> Nuova funzionalità per chiedere all'AI i dettagli sulle caratteristiche dell'app.</li>
                    <li><strong>Layout Unificato PC/Mobile:</strong> Interfaccia utente ottimizzata dinamicamente per entrambi i dispositivi.</li>
                </ul>
                <h4 style="color: #166534; border-bottom: 1px solid #ddd; padding-bottom: 5px;">🔧 Dettagli Tecnici</h4>
                <ul style="padding-left: 20px; margin-bottom: 15px;">
                    <li>Modali separati per settings, backup e note versione.</li>
                    <li>Implementazione Event Listeners asincroni protetti.</li>
                </ul>
            `;
        } else if(version === "v24.2") {
            contentHtml = `
                <h4 style="color: var(--blue-primary); border-bottom: 1px solid #ddd; padding-bottom: 5px;">🌟 Novità Principali</h4>
                <ul style="padding-left: 20px; list-style-type: square; margin-bottom: 15px;">
                    <li><strong>Modulo Interventi Rapido:</strong> Fusione di 'in corso' e 'nuovo', con singola schermata e modulo chilometri incluso sin da subito.</li>
                    <li><strong>Statistiche Superiori:</strong> Icone statistiche divise per Oggi, Domani e Programmati con evidenza di 'non eseguiti' (NP).</li>
                </ul>
                <h4 style="color: #ea580c; border-bottom: 1px solid #ddd; padding-bottom: 5px;">⚠️ Bug Fixes</h4>
                <ul style="padding-left: 20px; margin-bottom: 15px;">
                    <li>Riparato lo scorrimento e il caricamento dei modali da mobile iOS/Android.</li>
                </ul>
            `;
        } else if(version === "v24.0") {
            contentHtml = `
                <h4 style="color: var(--blue-primary); border-bottom: 1px solid #ddd; padding-bottom: 5px;">🚀 Lancio Major Update</h4>
                <ul style="padding-left: 20px; list-style-type: square; margin-bottom: 15px;">
                    <li><strong>Architettura Firebase Firestore:</strong> I dati passano da Google Sheets a sistema real-time in Cloud Firebase.</li>
                    <li><strong>Funzione Offline-First:</strong> Se manca internet, tutto si salva in IndexedDB e si auto-sincronizza al ritorno della rete.</li>
                    <li><strong>Gestione Anagrafiche:</strong> Sezione esterna integrata e dinamica per clienti e fornitori.</li>
                </ul>
            `;
        }
        
        verTitleDesc.innerText = version;
        versionDescContent.innerHTML = contentHtml;
        versionDescModal.classList.remove('hidden');
    });
});

// Logica Reinstalla Versione
document.querySelectorAll('.btn-reinstall-version').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const version = e.target.getAttribute('data-version');
        if (confirm(`Sei sicuro di voler reinstallare la versione ${version}?\nQuesta operazione ripristinerà l'app a quello stato.`)) {
            alert(`Sincronizzazione completata: Versione ${version} pronta. L'app verrà riavviata.`);
            window.location.reload(true);
        }
    });
});

if(btnAllVersions) {
    btnAllVersions.addEventListener('click', () => {
        let contentHtml = "";
        const now = new Date();
        const d2 = new Date(); d2.setDate(now.getDate() - 2);
        const d7 = new Date(); d7.setDate(now.getDate() - 7);
        
        let savedTime = localStorage.getItem('antimo_manualBackupTime');
        
        // 1. Manuale
        if(savedTime) {
            contentHtml += `<div style="background: #f0fdf4; padding: 10px; border-radius: 8px; border: 1px solid #bbf7d0; margin-bottom: 20px;">
                                <h3 style="margin:0; color:#15803d; font-size: 1.1rem;">Oggi - ${savedTime} (Salvataggio Manuale)</h3>
                                <p style="margin: 5px 0 0; font-size: 0.9rem; color: #166534; font-weight: 500;">Ultima versione dell'app salvata direttamente dall'utente in locale.</p>
                            </div>`;
        }
        
        // 2. Oggi
        contentHtml += `<div style="margin-bottom: 25px; padding-bottom: 15px; border-bottom: 2px dashed #eee;">
                            <h3 style="margin:0 0 10px; color:#ea580c; font-size: 1.1rem;">📅 Oggi (${formatDateDMY(now)} - Mattina) - v24.3</h3>
                            <h4 style="color: var(--blue-primary); border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-top:5px;">🌟 Novità Principali</h4>
                            <ul style="padding-left: 20px; list-style-type: square; margin-bottom: 10px;">
                                <li><strong>Backup Versioni e AI:</strong> Integrata la nuova tabella per visualizzare lo storico delle versioni e i salvataggi personalizzati.</li>
                                <li><strong>Ricerca Intelligente:</strong> Nuova funzionalità per chiedere all'AI i dettagli sulle caratteristiche dell'app.</li>
                                <li><strong>Layout Unificato PC/Mobile:</strong> Interfaccia utente ottimizzata dinamicamente per entrambi i dispositivi.</li>
                            </ul>
                        </div>`;
                        
        // 3. 2 Giorni fa
        contentHtml += `<div style="margin-bottom: 25px; padding-bottom: 15px; border-bottom: 2px dashed #eee;">
                            <h3 style="margin:0 0 10px; color:#ea580c; font-size: 1.1rem;">📅 ${formatDateDMY(d2)} - v24.2</h3>
                            <h4 style="color: var(--blue-primary); border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-top:5px;">🌟 Novità Principali</h4>
                            <ul style="padding-left: 20px; list-style-type: square; margin-bottom: 10px;">
                                <li><strong>Modulo Interventi Rapido:</strong> Fusione di 'in corso' e 'nuovo', con modulo chilometri incluso sin da subito.</li>
                                <li><strong>Statistiche Superiori:</strong> Icone statistiche divise per Oggi, Domani e Programmati con evidenza di 'NP'.</li>
                            </ul>
                        </div>`;
                        
        // 4. 1 Settimana fa
        contentHtml += `<div>
                            <h3 style="margin:0 0 10px; color:#ea580c; font-size: 1.1rem;">📅 ${formatDateDMY(d7)} - v24.0</h3>
                            <h4 style="color: var(--blue-primary); border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-top:5px;">🚀 Lancio Major Update</h4>
                            <ul style="padding-left: 20px; list-style-type: square; margin-bottom: 10px;">
                                <li><strong>Architettura Firebase Firestore:</strong> Passaggio da Google Sheets a sistema real-time in Cloud Firebase.</li>
                                <li><strong>Funzione Offline-First:</strong> Auto-sincronizzazione al ritorno della rete tramite IndexedDB.</li>
                                <li><strong>Gestione Anagrafiche:</strong> Sezione esterna integrata e dinamica per clienti e fornitori.</li>
                            </ul>
                        </div>`;

        verTitleDesc.innerText = "Tutte le Versioni (Cronologia)";
        versionDescContent.innerHTML = contentHtml;
        versionDescModal.classList.remove('hidden');
    });
}

if(btnCloseVersionDesc) {
    btnCloseVersionDesc.addEventListener('click', () => {
        versionDescModal.classList.add('hidden');
    });
}

// Motore ricerca AI mock
if(btnAiSearch) {
    btnAiSearch.addEventListener('click', () => {
        const query = aiSearchInput.value.trim().toLowerCase();
        if(!query) return;
        
        aiSearchResult.classList.remove('hidden');
        aiSearchResult.innerHTML = "<em>L'AI sta analizzando la tua richiesta... 🤖</em>";
        
        setTimeout(() => {
            let response = "";
            if(query.includes("km") || query.includes("chilometri") || query.includes("rimborso") || query.includes("distanza")) {
                response = "<strong>🚗 Gestione Chilometri:</strong> L'app prevede l'opzione (attivabile in Impostazioni) di richiedere obbligatoriamente i km percorsi per ogni intervento, utile per i rimborsi spese di trasferta. Sono registrati a fine attività.";
            } else if (query.includes("allegat") || query.includes("foto") || query.includes("pdf") || query.includes("scatta")) {
                response = "<strong>📎 Gestione Allegati:</strong> L'app supporta il caricamento di immagini dirette da fotocamera mobile o file multimediali per ogni attività sia in avvio (Programmazione) che a fine intervento (Operatore Campo), inviati direttamente nello Storage Firebase.";
            } else if (query.includes("sincro") || query.includes("cloud") || query.includes("internet") || query.includes("offline") || query.includes("connessione")) {
                 response = "<strong>☁️ Offline-First & Sync:</strong> Se non c'è connessione, i tuoi interventi vengono salvati prima sul dispositivo locale (IndexedDB). Non appena l'app rileva una connessione o premi 'Sincronizza Dati', verranno sparati in Firebase.";
            } else if (query.includes("anagrafich") || query.includes("pazient") || query.includes("utent")) {
                 response = "<strong>📇 Anagrafiche:</strong> Tramite il portale dedicato (raggiungibile cliccando 'GESTIONE ANAGRAFICHE'), puoi inserire Clienti, Pazienti ed Enti. Essi si autocompleteranno nei moduli di creazione intervento.";
            } else {
                 response = "<strong>🧠 AI-Assistant:</strong> Attualmente la versione 24.3 dell'app permette registrazione interventi in un click, gestione anagrafiche, salvataggi allegati in cloud offline-ready, e organizzazione programmati Ognuno categorizzato per giorno. Prova a chiedermi di 'allegati', 'sincronizzazione', 'chilometri' o 'anagrafiche'!";
            }
            aiSearchResult.innerHTML = response;
        }, 1200);
    });
}



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
    let tipiSelezionati = iTipo.value.trim();
    if(!tipiSelezionati || !iPaziente.value || !iLocalita.value || !iIndirizzo.value) {
        return alert("Compila Tipo, Paziente, Località e Indirizzo per salvare l'intervento programmato!");
    }
    
    let dispFinale = iDispositiviSelect.value.trim();
    if(!dispFinale) dispFinale = "Nessuno";

    // Calcola data prevista (default: domani)
    let dProgrammata = inputDataProgrammata.value;
    if (!dProgrammata) {
        let domani = new Date();
        domani.setDate(domani.getDate() + 1);
        dProgrammata = domani.toISOString().split('T')[0];
    }
    const inputOraProgrammata = document.getElementById('oraProgrammata');
    let oProgrammata = inputOraProgrammata ? inputOraProgrammata.value : "";
    
    const inputMatricolaP = document.getElementById('inputMatricola');
    let matricolaText = inputMatricolaP ? inputMatricolaP.value.trim() : "";

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
        tipo: tipiSelezionati,
        paziente: iPaziente.value,
        localita: iLocalita.value,
        indirizzo: iIndirizzo.value,
        telefono: iTelefono ? iTelefono.value : "",
        dispositivi: dispFinale,
        matricola: matricolaText,
        note: iNote.value,
        dataPrevista: dProgrammata,
        oraPrevista: oProgrammata,
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

    interventionSection.classList.add('hidden'); // Chiude la scheda dopo il salvataggio
    
    updateUI();
});

newInterventionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validazione KM (Obbligatori se impostato su ON nelle Impostazioni)
    if (requireKm && !inputKmPercorsi.value) {
        return alert("Inserisci i Km percorsi prima di salvare l'attività (Obbligatorio dalle Impostazioni).");
    }
    
    let tipiSelezionati = iTipo.value.trim();
    if(!tipiSelezionati) return alert("Inserisci almeno un Tipo di Intervento!");

    let dispFinale = iDispositiviSelect.value.trim();
    if(!dispFinale) {
        return alert("Inserisci i dispositivi o la dicitura 'Nessuno'!");
    }

    // UI Loading state indication
    const oldBtnText = btnStartIntervention.innerHTML;
    btnStartIntervention.innerHTML = `<span class="btn-icon">⏳</span> SALVATAGGIO IN CORSO...`;
    btnStartIntervention.disabled = true;

    // Creazione Oggetto Intervento (Ora inizia e finisce nello stesso momento base)
    let invToSave = {
        id: Date.now().toString(),
        dataObj: new Date().getTime(),
        tipo: tipiSelezionati,
        paziente: iPaziente.value,
        localita: iLocalita.value,
        indirizzo: iIndirizzo.value,
        telefono: iTelefono ? iTelefono.value : "",
        dispositivi: dispFinale,
        matricola: inputMatricola.value.trim(),
        note: iNote.value,
        attachments: currentAttachments, // Base64 Array se offline
        fileUrlsProgrammati: pendingFileUrlsProgrammati, 
        startTime: new Date().getTime(),
        endTime: new Date().getTime(), // Immediato in modalità 1-Step
        kmPercorsi: inputKmPercorsi.value || "0"
    };
    
    pendingFileUrlsProgrammati = [];
    
    let cloudSaveSuccess = false;
    let uploadedUrls = [];

    try {
        if(isFirebaseConfigured) {
            // Upload multiplo file dal Tecnico
            if(invToSave.attachments && invToSave.attachments.length > 0) {
                const { ref: storageRefCall, uploadString, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js");
                for(let i = 0; i < invToSave.attachments.length; i++) {
                    const att = invToSave.attachments[i];
                    let ext = "jpg";
                    if(att.name) ext = att.name.split('.').pop();
                    else if(att.type === "application/pdf") ext = "pdf";
                    else if(att.type && att.type.startsWith("video/")) ext = "mp4";

                    const storageRef = storageRefCall(storage, `allegati/${invToSave.id}_${i}.${ext}`);
                    await uploadString(storageRef, att.data, 'data_url');
                    const url = await getDownloadURL(storageRef);
                    uploadedUrls.push(url);
                }
            }
            
            // Fonde eventuali allegati di programmazione se erano link esistenti
            if(invToSave.fileUrlsProgrammati && invToSave.fileUrlsProgrammati.length > 0) {
                uploadedUrls = [...uploadedUrls, ...invToSave.fileUrlsProgrammati];
            }

            // Upload Firestore
            const { collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
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
                note: invToSave.note || "",
                startTime: invToSave.startTime,
                endTime: invToSave.endTime,
                kmPercorsi: invToSave.kmPercorsi,
                fileUrls: uploadedUrls.length > 0 ? uploadedUrls : null,
                haAllegato: uploadedUrls.length > 0
            };

            Object.keys(payloadToSave).forEach(k => payloadToSave[k] === undefined && delete payloadToSave[k]);
            await addDoc(collection(db, "interventi"), payloadToSave);
            
            cloudSaveSuccess = true;
        }
    } catch (error) {
        console.error("Errore salvataggio Cloud, forzo modalità offline:", error);
        alert("Rete instabile o errore Cloud. L'intervento è stato SALVATO IN LOCALE offline. Clicca poi su 'Sincronizza' appena la rete torna.");
    }

    // Passaggio logico locale completato
    invToSave.cloudSynced = cloudSaveSuccess;
    invToSave.fileUrls = (uploadedUrls && uploadedUrls.length > 0) ? uploadedUrls : (invToSave.fileUrlsProgrammati || null);
    invToSave.haAllegato = !!(invToSave.attachments?.length > 0 || invToSave.fileUrls?.length > 0);
    
    // Pulizia dei pesanti base64 prima di salvare in mem locale
    delete invToSave.attachments; 
    delete invToSave.fileData; 
    delete invToSave.fileUrlsProgrammati;

    completedInterventions.push(invToSave);
    
    saveState(); 
    updateUI(); 
    updateInterventiCount();
    
    // Reset Globale della Form e Componenti
    newInterventionForm.reset();
    inputKmPercorsi.value = ""; 
    iDispositiviSelect.value = "";
    inputMatricola.value = "";
    iNuovoDispositivo.classList.add('hidden');
    iNuovoDispositivo.value = "";
    inputAllegato.value = ""; 
    currentAttachments = [];
    filePreviewContainer.innerHTML = '';
    filePreviewContainer.classList.add('hidden');
    inputAllegatoProgrammazione.value = "";
    currentProgAttachments = [];
    progPreviewContainer.innerHTML = '';
    progPreviewContainer.classList.add('hidden');

    btnStartIntervention.innerHTML = oldBtnText;
    btnStartIntervention.disabled = false;
    
    interventionSection.classList.add('hidden'); // Chiude la scheda
    
    alert("Intervento salvato correttamente! ✅");
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
    
    // Filtrare per data odierna (Mezzanotte)
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;

    // 1. Interventi Programmati (Da fare oggi) - Rossi
    const toDO = plannedInterventions.filter(inv => {
        if (inv.status !== 'planned') return false;
        if (inv.dataPrevista) {
            const dp = new Date(inv.dataPrevista).getTime();
            return (dp >= startOfToday && dp <= endOfToday);
        }
        return false;
    });

    // 2. Interventi Completati (Eseguiti oggi) - Verdi
    const done = completedInterventions.filter(inv => {
        const d = new Date(inv.startTime).getTime();
        return (d >= startOfToday && d <= endOfToday);
    });

    if(toDO.length === 0 && done.length === 0) {
        activitiesList.innerHTML = '<p style="text-align:center; color:gray; font-size:0.9rem;">Nessuna attività programmata o eseguita per oggi.</p>';
        return;
    }

    // Rendering DA FARE (Rossi)
    if(toDO.length > 0) {
        const title1 = document.createElement('h4');
        title1.style.cssText = "color: #ef4444; margin-bottom: 8px;";
        title1.innerText = "🔴 DA FARE OGGI";
        activitiesList.appendChild(title1);

        toDO.forEach((inv, index) => {
            const origIndex = plannedInterventions.findIndex(p => p.id === inv.id);
            const div = document.createElement('div');
            div.className = "card-item-container";
            div.style.borderLeft = "4px solid #ef4444";
            
            let fileBadget = (inv.fileUrlsProgrammati && inv.fileUrlsProgrammati.length > 0) ? `<span style="font-size:0.8rem; background:var(--orange-light); color:white; padding:2px 5px; border-radius:4px; margin-left:5px;">📎</span>` : '';
            
            let attachHtml = '';
            if (inv.fileUrlsProgrammati && inv.fileUrlsProgrammati.length > 0) {
                attachHtml = `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px dotted #ccc;">
                    <strong>📎 Allegati Sede:</strong><br>
                    ${inv.fileUrlsProgrammati.map((url, i) => `<a href="${url}" target="_blank" style="color: var(--blue-primary); font-size: 0.85rem; text-decoration: underline;">Allegato ${i+1}</a>`).join('<br>')}
                </div>`;
            }

            const showOra = inv.oraPrevista ? ` ore ${inv.oraPrevista}` : '';
            div.innerHTML = `
                <div class="card-compact-view">
                    <div style="flex:1;">
                        <div style="font-size:0.80rem; color:red; margin-bottom:4px;"><strong>⏳ PROGRAMMATO${showOra}</strong></div>
                        <div style="font-weight:bold; color:var(--blue-dark); font-size:1.05rem;">${inv.paziente} ${fileBadget}</div>
                        <div style="font-size:0.85rem; color:#555;">📍 ${inv.localita || inv.destinazione} | 🔧 ${inv.tipo}</div>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center; padding-left: 10px;">
                        <button class="btn btn-primary btn-orange btn-sm" style="padding:6px 10px; font-size:0.8rem; line-height:1; min-width:auto;" data-action="avvia" data-index="${origIndex}">▶ AVVIA</button>
                        <span class="expand-icon" style="font-size:1.2rem; color:var(--blue-light); padding:10px;">▼</span>
                    </div>
                </div>
                
                <div class="card-expanded-view hidden">
                    <div style="font-size:0.85rem; color:#666;"><strong>📍 Indirizzo:</strong> ${inv.indirizzo || ''}</div>
                    <div style="font-size:0.80rem; color:#555; margin-top:4px;">📞 ${inv.telefono || '-'}</div>
                    <div style="font-size:0.85rem; color:#333; margin-top:5px;"><strong>Disp:</strong> ${inv.dispositivi || 'Nessuno'}</div>
                    <div style="font-size:0.85rem; color:#333; margin-top:5px;"><strong>Matricola:</strong> ${inv.matricola || 'N/D'}</div>
                    <div style="font-size:0.85rem; color:#333; margin-top:5px; padding-bottom:10px;"><strong>Note:</strong> ${inv.note || 'Nessuna'}</div>
                    ${attachHtml}
                </div>
            `;
            
            setupAccordionCard(div);
            
            div.querySelector('button[data-action="avvia"]').addEventListener('click', () => {
                const dataToLoad = plannedInterventions[origIndex];
            
            iTipo.value = dataToLoad.tipo || "";
            iPaziente.value = dataToLoad.paziente || "";
            if(iLocalita) iLocalita.value = dataToLoad.localita || dataToLoad.destinazione || "";
            if(iIndirizzo) iIndirizzo.value = dataToLoad.indirizzo || "";
            if(iTelefono) iTelefono.value = dataToLoad.telefono || "";
            
            iDispositiviSelect.value = dataToLoad.dispositivi || "";
            
            // iNuovoDispositivo non è più necessario ma la eliminiamo visualmente se esiste
            if(iNuovoDispositivo) iNuovoDispositivo.classList.add('hidden');
            
            if(iNote) iNote.value = dataToLoad.note || "";
            if(inputMatricola) inputMatricola.value = dataToLoad.matricola || "";
                pendingFileUrlsProgrammati = dataToLoad.fileUrlsProgrammati || [];

                plannedInterventions.splice(origIndex, 1);
                saveState();
                updateUI();
                activitiesListContainer.classList.add('hidden');
                btnViewActivities.innerHTML = `<span class="btn-icon">📅</span> INTERVENTI DELLA GIORNATA`;
                interventionSection.classList.remove('hidden');
                interventionSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                alert("Dati caricati nel form! Adesso clicca su 'TERMINA ATTIVITA'' quando finisci il lavoro.");
            });
            
            activitiesList.appendChild(div);
        });
    }

    // Rendering ESEGUITI (Verdi)
    if(done.length > 0) {
        const title2 = document.createElement('h4');
        title2.style.cssText = "color: #22c55e; margin-bottom: 8px; margin-top: 15px;";
        title2.innerText = "✅ ESEGUITI OGGI";
        activitiesList.appendChild(title2);

        // Mostriamo dalla più recente alla più vecchia
        const revList = [...done].reverse();
        revList.forEach(inv => {
            const d = new Date(inv.startTime);
            const e = new Date(inv.endTime);
            const div = document.createElement('div');
            div.className = "card-item-container";
            div.style.borderLeft = "4px solid #22c55e";
            
            let fileBadget = inv.haAllegato ? `<span style="font-size:0.8rem; background:var(--blue-light); color:white; padding:2px 5px; border-radius:4px; margin-left:5px;">📎</span>` : '';
            
            let attachHtml = '';
            if (inv.fileUrls && inv.fileUrls.length > 0) {
                attachHtml = `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px dotted #ccc;">
                    <strong>📎 Allegati:</strong><br>
                    ${inv.fileUrls.map((url, i) => `<a href="${url}" target="_blank" style="color: var(--blue-primary); font-size: 0.85rem; text-decoration: underline;">Allegato ${i+1}</a>`).join('<br>')}
                </div>`;
            }

            div.innerHTML = `
                <div class="card-compact-view">
                    <div style="flex:1;">
                        <div style="font-size:0.80rem; color:#22c55e; margin-bottom:4px;"><strong>✅ Dalle ${padZ(d.getHours())}:${padZ(d.getMinutes())} alle ${padZ(e.getHours())}:${padZ(e.getMinutes())}</strong></div>
                        <div style="font-weight:bold; color:var(--blue-dark); font-size:1.05rem;">${inv.paziente} ${fileBadget}</div>
                        <div style="font-size:0.85rem; color:#555;">📍 ${inv.localita || inv.destinazione} | 🔧 ${inv.tipo}</div>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center; padding-left: 10px;">
                        <span class="expand-icon" style="font-size:1.2rem; color:var(--blue-light); padding:10px;">▼</span>
                    </div>
                </div>
                
                <div class="card-expanded-view hidden">
                    <div style="font-size:0.85rem; color:#666;"><strong>📍 Indirizzo:</strong> ${inv.indirizzo || ''}</div>
                    <div style="font-size:0.80rem; color:#555; margin-top:4px;">📞 ${inv.telefono || '-'}</div>
                    <div style="font-size:0.85rem; color:#333; margin-top:5px;"><strong>Disp:</strong> ${inv.dispositivi || 'Nessuno'}</div>
                    <div style="font-size:0.85rem; color:#333; margin-top:5px;"><strong>Matricola:</strong> ${inv.matricola || 'N/D'}</div>
                    <div style="font-size:0.85rem; color:#333; margin-top:5px; padding-bottom:10px;"><strong>Note:</strong> ${inv.note || 'Nessuna'}</div>
                    <div style="font-size:0.85rem; color:#15803d; margin-top:5px;"><strong>Km A/R:</strong> ${inv.kmPercorsi || '0'}</div>
                    ${attachHtml}
                </div>
            `;
            
            setupAccordionCard(div);
            activitiesList.appendChild(div);
        });
    }
}

// --- RUBRICA SMS IPHONE / ANDROID ---
const btnOpenRubrica = document.getElementById('btnOpenRubrica');
const rubricaModal = document.getElementById('rubricaModal');
const btnCloseRubrica = document.getElementById('btnCloseRubrica');
const newRubricaForm = document.getElementById('newRubricaForm');
const rubricaNome = document.getElementById('rubricaNome');
const rubricaTelefono = document.getElementById('rubricaTelefono');
const rubricaList = document.getElementById('rubricaList');

let localeRubrica = JSON.parse(localStorage.getItem('antimo_rubrica')) || [];

function renderRubrica() {
    if(!rubricaList) return;
    rubricaList.innerHTML = '';
    if(localeRubrica.length === 0) {
        rubricaList.innerHTML = '<div style="text-align: center; color: #666; font-size: 0.9rem; padding: 10px;">Nessun contatto salvato in rubrica. Aggiungine uno qui sopra!</div>';
        return;
    }
    
    localeRubrica.forEach((contatto, i) => {
        const div = document.createElement('div');
        div.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee; background: #f9fafb; border-radius: 6px;";
        div.innerHTML = `
            <div style="flex: 1;">
                <strong style="color: var(--blue-dark); font-size: 1rem;">${contatto.nome}</strong><br>
                <a href="tel:${contatto.numero}" style="font-size: 0.85rem; color: #555; text-decoration: none;">📞 ${contatto.numero}</a>
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn btn-primary btn-sm btn-invia-sms" style="background:var(--orange); border:none; padding:8px 12px; font-weight: bold;" data-tel="${contatto.numero}">InvSMS</button>
                <button class="btn btn-danger btn-sm btn-elimina-rubrica" style="padding:8px 12px; font-weight: bold;" data-index="${i}">✖</button>
            </div>
        `;
        rubricaList.appendChild(div);
    });
    
    document.querySelectorAll('.btn-elimina-rubrica').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.target.getAttribute('data-index');
            if(confirm('Eliminare questo contatto dalla rubrica?')) {
                localeRubrica.splice(idx, 1);
                localStorage.setItem('antimo_rubrica', JSON.stringify(localeRubrica));
                renderRubrica();
            }
        });
    });
    
    document.querySelectorAll('.btn-invia-sms').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tel = e.target.getAttribute('data-tel');
            const msgT = document.getElementById('msgText');
            let bodyText = encodeURIComponent(msgT && msgT.value.trim() ? msgT.value.trim() : "Notifica dall'app.");
            
            const os = navigator.userAgent.toLowerCase();
            if(os.includes("iphone") || os.includes("ipad")) {
                 window.location.href = `sms:${tel}&body=${bodyText}`;
            } else {
                 window.location.href = `sms:${tel}?body=${bodyText}`;
            }
        });
    });
}

if(btnOpenRubrica) {
    btnOpenRubrica.addEventListener('click', () => {
        renderRubrica();
        rubricaModal.classList.remove('hidden');
    });
}
if(btnCloseRubrica) {
    btnCloseRubrica.addEventListener('click', () => {
        rubricaModal.classList.add('hidden');
    });
}

const btnOpenUsersList = document.getElementById('btnOpenUsersList');
const appUsersModal = document.getElementById('appUsersModal');
const btnCloseUsersList = document.getElementById('btnCloseUsersList');
const appUsersList = document.getElementById('appUsersList');

async function renderAppUsersList() {
    if (!appUsersList) return;
    appUsersList.innerHTML = '<div style="text-align: center; color: #666; font-size: 0.9rem;">Caricamento dipendenti in corso...</div>';
    try {
        if (!isFirebaseConfigured) {
            appUsersList.innerHTML = '<div style="text-align: center; color: red; font-size: 0.9rem;">Firebase non configurato.</div>';
            return;
        }
        const { collection, getDocs, query, where } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const q = query(collection(db, "anagrafiche"), where("localita", "==", "App (Dipendente)"));
        const snap = await getDocs(q);
        
        let usersHtml = '';
        snap.forEach(doc => {
            const data = doc.data();
            usersHtml += `
            <div style="padding: 10px; border-bottom: 1px solid #eee; background: #f9fafb; border-radius: 6px; display:flex; flex-direction:column; gap:4px;">
                <strong style="color: var(--blue-dark); font-size: 1rem;">${data.nome} ${data.cognome}</strong>
                <a href="mailto:${data.email}" style="font-size: 0.85rem; color: var(--blue-primary); text-decoration: none;">📧 ${data.email}</a>
                <a href="tel:${data.telefono1 || ''}" style="font-size: 0.85rem; color: #555; text-decoration: none;">📞 ${data.telefono1 || 'Nessun Telefono'}</a>
            </div>
            `;
        });
        
        if (!usersHtml) {
            appUsersList.innerHTML = '<div style="text-align: center; color: #666; font-size: 0.9rem;">Nessun dipendente registrato.</div>';
        } else {
            appUsersList.innerHTML = usersHtml;
        }
    } catch(err) {
        console.error("Errore caricamento utenti", err);
        appUsersList.innerHTML = '<div style="text-align: center; color: red; font-size: 0.9rem;">Errore caricamento.</div>';
    }
}

if(btnOpenUsersList) {
    btnOpenUsersList.addEventListener('click', () => {
        appUsersModal.classList.remove('hidden');
        renderAppUsersList();
    });
}
if(btnCloseUsersList) {
    btnCloseUsersList.addEventListener('click', () => {
        appUsersModal.classList.add('hidden');
    });
}

if(newRubricaForm) {
    newRubricaForm.addEventListener('submit', (e) => {
        e.preventDefault();
        localeRubrica.push({
            nome: rubricaNome.value.trim(),
            numero: rubricaTelefono.value.trim()
        });
        localStorage.setItem('antimo_rubrica', JSON.stringify(localeRubrica));
        rubricaNome.value = '';
        rubricaTelefono.value = '';
        renderRubrica();
    });
}

// Auth Check e Login Aziendale
async function checkLoginStatus() {
    const userEmail = localStorage.getItem('antimo_user_email');
    if (!userEmail) {
        document.getElementById('loginModal').classList.remove('hidden');
    } else {
        let userName = localStorage.getItem('antimo_user_name');
        
        // MIGRATION: Retroactively assign antimo_user_name for users logged in before the update
        if (!userName && userEmail.includes('@eubios.it')) {
            try {
                const parts = userEmail.split('@')[0].split('.');
                let nome = parts[0] || '';
                let cognome = parts.length > 1 ? parts[1] : '';
                nome = nome ? nome.charAt(0).toUpperCase() + nome.slice(1) : '';
                cognome = cognome ? cognome.charAt(0).toUpperCase() + cognome.slice(1) : '';
                userName = (nome + ' ' + cognome).trim();
                if(userName) localStorage.setItem('antimo_user_name', userName);
            } catch(e) {
                console.error("Migration error user name", e);
            }
        }
        
        if (!userName) userName = userEmail;

        const userNameDisp = document.getElementById('loggedInUserDisplay');
        if (userNameDisp) {
            userNameDisp.innerText = `👤 ${userName}`;
        }
    }
}

const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim().toLowerCase();
        const phone = document.getElementById('loginPhone').value.trim();
        const errDiv = document.getElementById('loginError');
        const btnLoginSubmit = document.getElementById('btnLoginSubmit');
        
        const emailRegex = /^[a-z]+\.[a-z]+@eubios\.it$/;
        
        if (!emailRegex.test(email)) {
            errDiv.textContent = "Accesso negato. Usa formato valido: nome.cognome@eubios.it";
            errDiv.style.display = "block";
            return;
        }
        
        errDiv.style.display = "none";
        btnLoginSubmit.disabled = true;
        btnLoginSubmit.innerHTML = "VERIFICA IN CORSO...";
        
        try {
            const parts = email.split('@')[0].split('.');
            let nome = parts[0] || '';
            let cognome = parts.length > 1 ? parts[1] : '';
            
            nome = nome ? nome.charAt(0).toUpperCase() + nome.slice(1) : '';
            cognome = cognome ? cognome.charAt(0).toUpperCase() + cognome.slice(1) : '';
            const fullName = (nome + ' ' + cognome).trim();
            
            if (isFirebaseConfigured) {
                const { collection, query, where, getDocs, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                const q = query(collection(db, "anagrafiche"), where("email", "==", email));
                const snap = await getDocs(q);
                
                if (snap.empty) {
                    await addDoc(collection(db, "anagrafiche"), {
                        id: Date.now().toString(),
                        timestamp: serverTimestamp(),
                        nome: nome,
                        cognome: cognome,
                        email: email,
                        telefono1: phone,
                        localita: "App (Dipendente)",
                        indirizzo: "-",
                        codiceFiscale: "",
                        provincia: ""
                    });
                }
            }
            localStorage.setItem('antimo_user_email', email);
            localStorage.setItem('antimo_user_phone', phone);
            localStorage.setItem('antimo_user_name', fullName);
            
            document.getElementById('loginModal').classList.add('hidden');
        } catch(err) {
            console.error("Errore login / anagrafiche", err);
            errDiv.textContent = "Errore di connessione al database.";
            errDiv.style.display = "block";
            btnLoginSubmit.disabled = false;
            btnLoginSubmit.innerHTML = "AUTENTICATI";
        }
    });
}
checkLoginStatus();

// Inizializzazione Globale
initApp();

// ========================================================
// REPARTO DATA BACKUP & RIPRISTINO (Esportazione Cloud .json)
// ========================================================
const btnOpenDataBackup = document.getElementById('btnOpenDataBackup');
const dataBackupModal = document.getElementById('dataBackupModal');
const btnCloseDataBackup = document.getElementById('btnCloseDataBackup');
const btnExportDataJson = document.getElementById('btnExportDataJson');
const btnImportDataJson = document.getElementById('btnImportDataJson');
const importDataFile = document.getElementById('importDataFile');

if(btnOpenDataBackup) {
    btnOpenDataBackup.addEventListener('click', () => {
        if(dataBackupModal) dataBackupModal.classList.remove('hidden');
        const settingsModal = document.getElementById('settingsModal');
        if(settingsModal) settingsModal.classList.add('hidden');
    });
}
if(btnCloseDataBackup) {
    btnCloseDataBackup.addEventListener('click', () => {
        if(dataBackupModal) dataBackupModal.classList.add('hidden');
    });
}

if(btnExportDataJson) {
    btnExportDataJson.addEventListener('click', async () => {
        if(!isFirebaseConfigured) { alert("Firebase non configurato! Nessun database reperibile."); return; }
        try {
            btnExportDataJson.textContent = "Elaborazione in corso...";
            btnExportDataJson.disabled = true;
            
            const { getDocs, collection } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            
            const collectionsToExport = ["interventi", "programmati", "messaggi", "anagrafiche"];
            const exportData = {};
            
            for(let collName of collectionsToExport) {
                exportData[collName] = [];
                const snap = await getDocs(collection(db, collName));
                snap.forEach(d => {
                    exportData[collName].push({ __firebaseDocId: d.id, ...d.data() });
                });
            }
            
            const jsonStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            const now = new Date();
            const pdZ = n => n.toString().padStart(2, '0');
            a.download = `Backup_Antimo_${now.getFullYear()}${pdZ(now.getMonth()+1)}${pdZ(now.getDate())}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            btnExportDataJson.innerHTML = `<span class="btn-icon">⬇️</span> Scarica Database (.json)`;
            btnExportDataJson.disabled = false;
        } catch(e) {
            alert("Errore esportazione dati: " + e.message);
            btnExportDataJson.innerHTML = `<span class="btn-icon">⬇️</span> Scarica Database (.json)`;
            btnExportDataJson.disabled = false;
        }
    });
}

if(btnImportDataJson) {
    btnImportDataJson.addEventListener('click', async () => {
        if(!isFirebaseConfigured) { alert("Firebase non è configurato per il ripristino!"); return; }
        
        if(!importDataFile || !importDataFile.files[0]) {
            alert("Devi prima selezionare un file JSON usando il tasto Scegli File!");
            return;
        }
        
        if(!confirm("ATTENZIONE CRITICA: Stai per inviare i dati di questo file JSON sul Server Cloud.\n\nQuesta operazione non cancellerà i dati esistenti che non sono nel file, ma AGGIUNGERÀ o SOVRASCRIVERÀ i documenti che hanno lo stesso ID. Continuare?")) return;
        
        const file = importDataFile.files[0];
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                btnImportDataJson.textContent = "Ripristino in corso...";
                btnImportDataJson.disabled = true;
                
                const data = JSON.parse(e.target.result);
                const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                
                let successCount = 0;
                for(let collName of Object.keys(data)) {
                    for(let item of data[collName]) {
                        // Identifichiamo l'ID del documento Firestore salvato precedentemente
                        const itemFbId = item.__firebaseDocId || item.id || item.fbId || Date.now().toString();
                        
                        let payload = {...item};
                        delete payload.__firebaseDocId; // rimuovo la traccia interna
                        
                        await setDoc(doc(db, collName, itemFbId), payload, { merge: true });
                        successCount++;
                    }
                }
                
                alert(`✅ Ripristino Database Completato!\nSono stati letti ed elaborati ${successCount} record.\nL'applicazione si aggiornerà ora per mostrare i dati ripristinati.`);
                
                // Forza reinizializzazione per leggere il nuovo db
                window.location.reload(true);
            } catch(err) {
                alert("Errore nel ripristino o formato file JSON non valido:\n" + err.message);
                btnImportDataJson.innerHTML = `<span class="btn-icon">⬆️</span> Ripristina da File .json`;
                btnImportDataJson.disabled = false;
            }
        };
        reader.readAsText(file);
    });
}
