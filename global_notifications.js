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
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if(data.isNotification && !data.eliminato && !data.letto && !data.presoInCarico) {
                activeNotes.push(data.text);
            }
        });
        
        let badge = document.getElementById('globalFloatingNotification');
        if(!badge) {
            badge = document.createElement('div');
            badge.id = 'globalFloatingNotification';
            badge.style.cssText = "position: fixed; bottom: 20px; right: 20px; background: #e11d48; color: white; padding: 10px 15px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.4); z-index: 10000; display: flex; align-items: center; gap: 10px; max-width: 300px; cursor: pointer; border: 2px solid white;";
            
            badge.onclick = () => {
                if(window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/') || window.location.pathname === '') {
                    const msgSec = document.getElementById('messagesSection');
                    const msgContainer = document.getElementById('messagesContainer');
                    const btnTgg = document.getElementById('btnToggleMessages');
                    if(msgContainer && msgContainer.classList.contains('hidden')) {
                        msgContainer.classList.remove('hidden');
                        if (btnTgg) btnTgg.textContent = 'Nascondi';
                    }
                    if(msgSec) msgSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    window.location.href = "index.html#messagesSection";
                }
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
    });
}
