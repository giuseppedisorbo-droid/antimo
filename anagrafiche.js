import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// ====== CONFIGURAZIONE FIREBASE ======
const firebaseConfig = {
    apiKey: "AIzaSyB6CLQZHPG60LqsIKHAlS_Wt5OFXqfwqkw",
    authDomain: "antimo-6a86b.firebaseapp.com",
    projectId: "antimo-6a86b",
    storageBucket: "antimo-6a86b.firebasestorage.app",
    messagingSenderId: "671676764068",
    appId: "1:671676764068:web:95027e0babe3f30042fb31"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// DOM Elements
const anagraficheForm = document.getElementById('anagraficheForm');
const toggleFormAnagrafica = document.getElementById('toggleFormAnagrafica');
const formIcon = document.getElementById('formIcon');
const anagraficheTableBody = document.getElementById('anagraficheTableBody');
const searchAnagrafiche = document.getElementById('searchAnagrafiche');

const iNome = document.getElementById('nome');
const iCognome = document.getElementById('cognome');
const iCodiceFiscale = document.getElementById('codiceFiscale');
const iQualifica = document.getElementById('qualifica');
const iLocalita = document.getElementById('localita');
const iProvincia = document.getElementById('provincia');
const iIndirizzo = document.getElementById('indirizzo');
const iTelefono1 = document.getElementById('telefono1');
const iTelefono2 = document.getElementById('telefono2');
const inputAllegati = document.getElementById('allegati');
const filePreviewContainer = document.getElementById('filePreviewContainer');
const btnSaveAnagrafica = document.getElementById('btnSaveAnagrafica');

let anagraficheList = [];
let currentAttachments = [];

// Toggle Form Visibility
toggleFormAnagrafica.addEventListener('click', () => {
    anagraficheForm.classList.toggle('hidden');
    formIcon.textContent = anagraficheForm.classList.contains('hidden') ? '▼' : '▲';
});

// File Preview
inputAllegati.addEventListener('change', (e) => {
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
    
    inputAllegati.value = "";
});

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
        removeBtn.onclick = (e) => {
            e.preventDefault();
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

// Load Data
async function loadAnagrafiche() {
    anagraficheTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Caricamento in corso...</td></tr>';
    try {
        const snap = await getDocs(collection(db, "anagrafiche"));
        anagraficheList = [];
        snap.forEach(doc => {
            anagraficheList.push({ idb: doc.id, ...doc.data() });
        });

        // Ordinamento per nome
        anagraficheList.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        renderTable(anagraficheList);
    } catch(err) {
        console.error("Errore fetch anagrafiche", err);
        anagraficheTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Errore caricamento.</td></tr>';
    }
}

function renderTable(dataToRender) {
    anagraficheTableBody.innerHTML = '';
    
    if(dataToRender.length === 0) {
        anagraficheTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Nessuna anagrafica trovata.</td></tr>';
        return;
    }

    dataToRender.forEach(a => {
        const tr = document.createElement('tr');
        
        let fileLinks = '<span style="color:#aaa;">-</span>';
        if(a.fileUrls && a.fileUrls.length > 0) {
            fileLinks = a.fileUrls.map((url, idx) => `<a href="${url}" target="_blank" style="display:block; font-size:0.8rem; margin-bottom:2px;">📎 File ${idx+1}</a>`).join('');
        }

        const nomeCognome = `${a.nome || ''} ${a.cognome || ''}`.trim();
        const qual = a.qualifica ? `<span style="background:var(--blue-light); color:var(--blue-dark); padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:bold;">${a.qualifica}</span>` : '-';
        const locInd = `${a.localita || ''} ${a.provincia ? `(${a.provincia})` : ''} <br><small>${a.indirizzo || ''}</small>`;
        const rec = `${a.telefono1 || ''} <br><small>${a.telefono2 || ''}</small>`;

        tr.innerHTML = `
            <td><strong>${nomeCognome}</strong></td>
            <td>${qual}</td>
            <td>${locInd}</td>
            <td>${rec}</td>
            <td><span style="text-transform:uppercase;">${a.codiceFiscale || '-'}</span></td>
            <td>${fileLinks}</td>
            <td style="text-align: center;">
                <button class="btn btn-danger btn-sm btn-delete-anagrafica" data-idb="${a.idb}" style="padding: 4px 8px; font-size: 0.75rem;"><span class="btn-icon">🗑️</span> Elimina</button>
            </td>
        `;

        tr.querySelector('.btn-delete-anagrafica').addEventListener('click', async (e) => {
            if(!confirm("Sei sicuro di voler eliminare questa anagrafica?")) return;
            const docId = e.target.getAttribute('data-idb');
            try {
                await deleteDoc(doc(db, "anagrafiche", docId));
                await loadAnagrafiche();
            } catch(err) {
                alert("Errore: " + err.message);
            }
        });

        anagraficheTableBody.appendChild(tr);
    });
}

// Search
searchAnagrafiche.addEventListener('input', () => {
    const s = searchAnagrafiche.value.toLowerCase().trim();
    if(!s) {
        renderTable(anagraficheList);
        return;
    }
    const filtered = anagraficheList.filter(a => {
        return (a.nome || '').toLowerCase().includes(s) ||
               (a.cognome || '').toLowerCase().includes(s) ||
               (a.codiceFiscale || '').toLowerCase().includes(s) ||
               (a.localita || '').toLowerCase().includes(s);
    });
    renderTable(filtered);
});

// Submit Form
anagraficheForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if(!iNome.value || !iLocalita.value || !iIndirizzo.value || !iTelefono1.value) {
        return alert("Compila tutti i campi obbligatori (Nome, Località, Indirizzo, Telefono 1).");
    }

    const oldBtnText = btnSaveAnagrafica.innerHTML;
    btnSaveAnagrafica.innerHTML = `<span class="btn-icon">⏳</span> SALVATAGGIO IN CORSO...`;
    btnSaveAnagrafica.disabled = true;

    try {
        const id = Date.now().toString();
        let uploadedUrls = [];

        // Upload Allegati
        for(let i = 0; i < currentAttachments.length; i++) {
            const att = currentAttachments[i];
            let ext = "jpg";
            if(att.name) ext = att.name.split('.').pop();
            else if(att.type === "application/pdf") ext = "pdf";
            else if(att.type && att.type.startsWith("video/")) ext = "mp4";

            const storageRef = ref(storage, `anagrafiche/${id}_${i}.${ext}`);
            await uploadString(storageRef, att.data, 'data_url');
            const url = await getDownloadURL(storageRef);
            uploadedUrls.push(url);
        }

        const payload = {
            id: id,
            timestamp: serverTimestamp(),
            nome: iNome.value.trim(),
            cognome: iCognome.value.trim(),
            qualifica: iQualifica.value,
            codiceFiscale: iCodiceFiscale.value.trim().toUpperCase(),
            localita: iLocalita.value.trim(),
            provincia: iProvincia.value.trim().toUpperCase(),
            indirizzo: iIndirizzo.value.trim(),
            telefono1: iTelefono1.value.trim(),
            telefono2: iTelefono2.value.trim(),
            fileUrls: uploadedUrls
        };

        await addDoc(collection(db, "anagrafiche"), payload);
        
        // Reset Form
        anagraficheForm.reset();
        currentAttachments = [];
        renderAttachmentsPreview();
        anagraficheForm.classList.add('hidden');
        formIcon.textContent = '▼';

        await loadAnagrafiche();
        alert("Anagrafica salvata con successo!");

    } catch(err) {
        console.error("Errore salvataggio anagrafica", err);
        alert("Errore di rete durante il salvataggio.");
    } finally {
        btnSaveAnagrafica.innerHTML = oldBtnText;
        btnSaveAnagrafica.disabled = false;
    }
});

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadAnagrafiche();
});
