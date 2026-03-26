import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyB6CLQZHPG60LqsIKHAlS_Wt5OFXqfwqkw",
    authDomain: "antimo-6a86b.firebaseapp.com",
    projectId: "antimo-6a86b",
    storageBucket: "antimo-6a86b.firebasestorage.app",
    messagingSenderId: "671676764068",
    appId: "1:671676764068:web:95027e0babe3f30042fb31",
    measurementId: "G-WTWNH23PLS"
};

let app, db;
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
} catch(e) { console.error("Firebase init failed for global notifications"); }

if(db) {
    const q = query(collection(db, "messaggi"));
    onSnapshot(q, (snapshot) => {
        let activeNotes = [];
        const currentUser = localStorage.getItem('antimo_user_name') || "Sconosciuto";
        const filterTecnico = localStorage.getItem('antimo_filterTecnicoOggi') || "MIO";
        const filterName = filterTecnico === "MIO" ? currentUser : filterTecnico;

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            
            let sN = data.sender || "Sconosciuto";
            let rN = data.recipients || "Bacheca (Tutti)";
            if (Array.isArray(rN)) rN = rN.join(', ');

            if (filterTecnico !== "TUTTI") {
                const isRelevantForFilter = (sN === filterName) || (rN.includes(filterName)) || (rN === "Bacheca (Tutti)");
                if (!isRelevantForFilter) return; // ignore this message for notification
            }

            if(data.isNotification && !data.eliminato && !data.letto && !data.presoInCarico) {
                activeNotes.push(data.text);
            }
        });
        
        // Nascondi la scheda floating in index.html perché c'è già quella rossa
        const p = window.location.pathname.toLowerCase();
        const onMainPage = p.endsWith('index.html') || p.endsWith('/') || p === '' || p.includes('index');
        
        if (!onMainPage) {
            let badge = document.getElementById('globalFloatingNotification');
            if(!badge) {
                badge = document.createElement('div');
                badge.id = 'globalFloatingNotification';
            badge.style.cssText = `
                position: fixed;
                top: 20px;
                left: 20px;
                background-color: var(--orange);
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                font-weight: bold;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                z-index: 10000;
                display: flex; align-items: center; gap: 10px; max-width: 300px; cursor: pointer; border: 2px solid white;`;
                
                badge.onclick = () => {
                    window.location.href = "index.html#messagesSection";
                };
                
                document.body.appendChild(badge);
            }
            
            if(activeNotes.length > 0) {
                badge.style.display = 'flex';
                badge.innerHTML = `
                    <div style="font-size: 1.5rem; animation: pulse 2s infinite;">🔔</div>
                    <div style="font-size: 0.85rem; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${activeNotes.length > 1 ? `(${activeNotes.length}) ` : ''}${activeNotes[0]}
                    </div>
                `;
                if (navigator.setAppBadge) navigator.setAppBadge(activeNotes.length).catch(e => console.error("AppBadge error", e));
            } else {
                badge.style.display = 'none';
                if (navigator.clearAppBadge) navigator.clearAppBadge().catch(e => console.error("AppBadge error", e));
            }
        }
    });
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            console.log('SW registrato a livello globale:', reg.scope);
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('Nuovo aggiornamento disponibile. Ricarico la pagina...');
                        window.location.reload(true);
                    }
                });
            });
        }).catch(err => console.error('Errore registrazione SW:', err));
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
            refreshing = true;
            window.location.reload(true);
        }
    });
}
