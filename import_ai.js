// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyC0OFuNjPa8TrOGUfWMELBHS2tB07U7Pu4",
    authDomain: "eubiotech.firebaseapp.com",
    projectId: "eubiotech",
    storageBucket: "eubiotech.firebasestorage.app",
    messagingSenderId: "55119431815",
    appId: "1:55119431815:web:5b5ab02b59b1ce51119022",
    measurementId: "G-L59VJ4OJ69"
};

// Initialize Firebase
const _firebaseApp = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const dataCollection = db.collection('financial_records');
const anagraficheCollection = db.collection('eubiotech_anagrafiche');

let historicalData = []; // To train the AI
let stagingRecords = []; // Records waiting to be saved
let uniqueTypes = new Set();
let uniqueCategories = new Set();
let uniqueDescriptions = new Set();
let rawXmlData = []; // Store raw XML content independently of staging records
let extractedAnagrafiche = []; // Store detected master data (Fornitori/Clienti)

document.addEventListener('DOMContentLoaded', async () => {
    
    // Load learning data
    try {
        const snapshot = await dataCollection.get();
        snapshot.forEach(doc => {
            const data = doc.data();
            historicalData.push(data);
            if(data.type) uniqueTypes.add(data.type);
            if(data.category) uniqueCategories.add(data.category);
            if(data.description) uniqueDescriptions.add(data.description);
        });
        console.log("AI Trained on " + historicalData.length + " historical records.");
    } catch(e) {
        console.error("Failed to load historical data for AI", e);
    }
    
    setupDragAndDrop();
    
    document.getElementById('file-uploader').addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
    
    document.getElementById('save-all-btn').addEventListener('click', saveToGestionale);
});

function setupDragAndDrop() {
    const dropZone = document.getElementById('drag-zone');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        handleFiles(e.dataTransfer.files);
    }, false);
}

async function handleFiles(files) {
    if (!files || files.length === 0) return;
    
    const loadingUI = document.getElementById('loading-indicator');
    const tableUI = document.getElementById('staging-container');
    const dropUI = document.getElementById('drag-zone');
    
    dropUI.style.display = 'none';
    loadingUI.style.display = 'block';

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop().toLowerCase();
        
        try {
            if (ext === 'xml') {
                await parseXMLFattura(file);
            } else if (ext === 'csv' || ext === 'xlsx') {
                 // To implement CSV parsing
                 alert("Bozza: Parser CSV in costruzione.");
            } else if (ext === 'pdf') {
                 // To implement basic PDF text extraction
                 alert("Bozza: Parser PDF in costruzione.");
            }
        } catch(e) {
            console.error("Errore lettura file", file.name, e);
            alert("Errore nella lettura del file " + file.name);
        }
    }
    
    loadingUI.style.display = 'none';
    tableUI.style.display = 'block';
    
    renderStagingTable();
}

async function parseXMLFattura(file) {
    const text = await file.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");
    
    // Extract Basic Information
    const cedenteNode = xmlDoc.querySelector("CedentePrestatore DatiAnagrafici Anagrafica Denominazione");
    const nomeFornitore = cedenteNode ? cedenteNode.textContent : 
                          (xmlDoc.querySelector("CedentePrestatore DatiAnagrafici Anagrafica Nome")?.textContent + " " + xmlDoc.querySelector("CedentePrestatore DatiAnagrafici Anagrafica Cognome")?.textContent);

    // --- ANAGRAFICA EXTRACTION (Cedente/Fornitore) ---
    const cpNode = xmlDoc.querySelector("CedentePrestatore");
    if (cpNode) {
        const den = cpNode.querySelector("DatiAnagrafici Anagrafica Denominazione")?.textContent || 
                   (cpNode.querySelector("DatiAnagrafici Anagrafica Nome")?.textContent + " " + cpNode.querySelector("DatiAnagrafici Anagrafica Cognome")?.textContent);
        const piva = cpNode.querySelector("DatiAnagrafici IdFiscaleIVA IdCodice")?.textContent || "";
        const cf = cpNode.querySelector("DatiAnagrafici CodiceFiscale")?.textContent || "";
        const cap = cpNode.querySelector("Sede CAP")?.textContent || "";
        const comune = cpNode.querySelector("Sede Comune")?.textContent || "";
        const prov = cpNode.querySelector("Sede Provincia")?.textContent || "";
        const ind = cpNode.querySelector("Sede Indirizzo")?.textContent || "";
        const indirizzoPieno = `${ind} ${cap} ${comune} (${prov})`.replace(/\s+/g, ' ').trim();
        
        if (den && den.trim() !== "undefined undefined") {
            extractedAnagrafiche.push({
                tipo: 'fornitore',
                ragioneSociale: den.trim(),
                piva: piva,
                cf: cf,
                indirizzo: indirizzoPieno
            });
        }
    }

    // --- ANAGRAFICA EXTRACTION (Cessionario/Cliente) ---
    const ccNode = xmlDoc.querySelector("CessionarioCommittente");
    if (ccNode) {
        const den = ccNode.querySelector("DatiAnagrafici Anagrafica Denominazione")?.textContent || 
                   (ccNode.querySelector("DatiAnagrafici Anagrafica Nome")?.textContent + " " + ccNode.querySelector("DatiAnagrafici Anagrafica Cognome")?.textContent);
        const piva = ccNode.querySelector("DatiAnagrafici IdFiscaleIVA IdCodice")?.textContent || "";
        const cf = ccNode.querySelector("DatiAnagrafici CodiceFiscale")?.textContent || "";
        const cap = ccNode.querySelector("Sede CAP")?.textContent || "";
        const comune = ccNode.querySelector("Sede Comune")?.textContent || "";
        const prov = ccNode.querySelector("Sede Provincia")?.textContent || "";
        const ind = ccNode.querySelector("Sede Indirizzo")?.textContent || "";
        const indirizzoPieno = `${ind} ${cap} ${comune} (${prov})`.replace(/\s+/g, ' ').trim();

        if (den && den.trim() !== "undefined undefined") {
            extractedAnagrafiche.push({
                tipo: 'cliente',
                ragioneSociale: den.trim(),
                piva: piva,
                cf: cf,
                indirizzo: indirizzoPieno
            });
        }
    }
    
    const datiGenerali = xmlDoc.querySelector("DatiGeneraliDocumento Data");
    const dataFattura = datiGenerali ? datiGenerali.textContent : new Date().toISOString().split('T')[0];

    const numeroNode = xmlDoc.querySelector("DatiGeneraliDocumento Numero");
    const numeroFattura = numeroNode ? numeroNode.textContent : "N/A";

    const isDuplicate = historicalData.some(rec => 
        rec.numero === numeroFattura && 
        rec.fornitore === nomeFornitore && 
        numeroFattura !== "N/A"
    );

    // Read lines (Articoli / Servizi)
    const linee = xmlDoc.querySelectorAll("DettaglioLinee");
    
    linee.forEach(linea => {
        const desc = linea.querySelector("Descrizione")?.textContent || "";
        const prezzoTot = parseFloat(linea.querySelector("PrezzoTotale")?.textContent || "0");
        const quantita = parseFloat(linea.querySelector("Quantita")?.textContent || "1");
        const prezzoUnitario = parseFloat(linea.querySelector("PrezzoUnitario")?.textContent || prezzoTot.toString());
        const aliquotaIVA = parseFloat(linea.querySelector("AliquotaIVA")?.textContent || "0");
        
        // Salva TUTTE le righe nell'array raw per il visualizzatore Raw XML
        rawXmlData.push({
            file: file.name,
            numero: numeroFattura,
            date: dataFattura,
            fornitore: nomeFornitore || "Sconosciuto",
            dettaglio: desc,
            quantita: quantita,
            prezzoUnitario: prezzoUnitario,
            aliquotaIVA: aliquotaIVA,
            prezzoTot: prezzoTot
        });
        
        if (prezzoTot === 0) return; // Skip zero value lines per il modulo staging di import
        
        // AI matching logic!
        const prediction = predictCategoryAndType(nomeFornitore, desc);
        
        stagingRecords.push({
            id: Date.now() + Math.random().toString(36),
            numero: numeroFattura,
            date: dataFattura,
            fornitore: nomeFornitore || "Sconosciuto",
            dettaglio: desc,
            amount: prezzoTot,
            quantita: quantita,
            prezzoUnitario: prezzoUnitario,
            aliquotaIVA: aliquotaIVA,
            fileSorgente: file.name,
            predictedType: prediction.type,
            predictedCategory: prediction.category,
            predictedDescription: prediction.description,
            confidence: prediction.confidence,
            status: isDuplicate ? 'error' : 'ready', // ready, saved, error
            errorMsg: isDuplicate ? "Fattura già caricata (Stesso Fornitore e Numero)" : null
        });
    });
}

// THE MACHINE LEARNING ENGINE
function predictCategoryAndType(fornitore, descrizione) {
    let bestMatch = { type: 'COSTS_EUBIOTECH', category: '', description: '', confidence: 'low' };
    
    if (historicalData.length === 0) return bestMatch;
    
    const fStr = (fornitore || "").toLowerCase();
    const dStr = (descrizione || "").toLowerCase();
    
    let highestScore = 0;
    
    for (const record of historicalData) {
        if (!record.type || !record.category) continue;
        
        let score = 0;
        const rForn = (record.fornitore || "").toLowerCase();
        const rDesc = (record.description || "").toLowerCase();
        
        // Exact supplier match is a very strong indicator
        if (rForn && fStr && (rForn === fStr || fStr.includes(rForn) || rForn.includes(fStr))) {
            score += 50;
        }
        
        // Description similarity
        if (rDesc && dStr && (dStr.includes(rDesc) || rDesc.includes(dStr))) {
            score += 30;
        }
        
        // Also compare category names appearing in description text 
        // e.g., if description says "pedaggio telepass" and category is "TELEPASS"
        if (record.category && dStr.includes(record.category.toLowerCase())) {
            score += 40;
        }
        
        if (score > highestScore) {
            highestScore = score;
            bestMatch.type = record.type;
            bestMatch.category = record.category;
            bestMatch.description = record.description || '';
            
            if (score > 60) bestMatch.confidence = 'high';
            else bestMatch.confidence = 'low';
        }
    }
    
    return bestMatch;
}

function renderStagingTable() {
    const tbody = document.getElementById('staging-tbody');
    tbody.innerHTML = '';
    
    document.getElementById('record-count').textContent = stagingRecords.length;
    
    const typeOpts = Array.from(uniqueTypes).sort().map(t => `<option value="${t}">${t}</option>`).join('');
    
    // Create mapping of Type -> Valid Categories and Type+Category -> Valid Descriptions
    const typeCategoryMap = {};
    const catDescMap = {};
    historicalData.forEach(record => {
        if (!record.type) return;
        if (!typeCategoryMap[record.type]) typeCategoryMap[record.type] = new Set();
        if (record.category) {
             typeCategoryMap[record.type].add(record.category);
             const catKey = `${record.type}_${record.category}`;
             if (!catDescMap[catKey]) catDescMap[catKey] = new Set();
             if (record.description) catDescMap[catKey].add(record.description);
        }
    });

    function buildCatOptions(type) {
        if (!type || !typeCategoryMap[type]) return `<option value="">-- Seleziona --</option>`;
        return `<option value="">-- Seleziona --</option>` + Array.from(typeCategoryMap[type]).sort().map(c => `<option value="${c}">${c}</option>`).join('');
    }
    function buildDescOptions(type, category) {
        if (!type || !category) return `<option value="">-- Nessuna Descrizione --</option>`;
        const catKey = `${type}_${category}`;
        if (!catDescMap[catKey]) return `<option value="">-- Nessuna Descrizione --</option>`;
        return `<option value="">-- Nessuna Descrizione --</option>` + Array.from(catDescMap[catKey]).sort().map(d => `<option value="${d}">${d}</option>`).join('');
    }
    
    stagingRecords.forEach((record, index) => {
        const tr = document.createElement('tr');
        tr.className = `row-status-${record.status}`;
        tr.id = `row-${record.id}`;
        
        let confidenceBadge = '';
        if (record.confidence === 'high') {
             confidenceBadge = `<span class="ai-badge ai-high-confidence"><i class="fas fa-brain"></i> Alta Confidenza</span>`;
        } else {
             confidenceBadge = `<span class="ai-badge ai-low-confidence"><i class="fas fa-robot"></i> Previsione (Verificare)</span>`;
        }

        const injectedTypeOpts = record.predictedType ? typeOpts.replace(`value="${record.predictedType}"`, `value="${record.predictedType}" selected`) : typeOpts;

        let defaultCatOpts = buildCatOptions(record.predictedType);
        if (record.predictedCategory && !defaultCatOpts.includes(`value="${record.predictedCategory}"`)) {
            defaultCatOpts += `<option value="${record.predictedCategory}" selected>${record.predictedCategory}</option>`;
        } else if (record.predictedCategory) {
            defaultCatOpts = defaultCatOpts.replace(`value="${record.predictedCategory}"`, `value="${record.predictedCategory}" selected`);
        }

        let defaultDescOpts = buildDescOptions(record.predictedType, record.predictedCategory);
        if (record.predictedDescription && !defaultDescOpts.includes(`value="${record.predictedDescription}"`)) {
            defaultDescOpts += `<option value="${record.predictedDescription}" selected>${record.predictedDescription}</option>`;
        } else if (record.predictedDescription) {
            defaultDescOpts = defaultDescOpts.replace(`value="${record.predictedDescription}"`, `value="${record.predictedDescription}" selected`);
        }

        let statusIcon = '<i class="fas fa-file-invoice" style="color:#64748b;"></i>';
        let statusText = '';
        if (record.status === 'saved') statusIcon = '<i class="fas fa-check-circle" style="color:#10b981;"></i>';
        else if (record.status === 'error') {
            statusIcon = '<i class="fas fa-exclamation-triangle" style="color:#ef4444;" title="' + record.errorMsg + '"></i>';
            statusText = `<div style="color:#ef4444; font-size:0.7em; font-weight:bold; max-width: 100px; margin-bottom:5px;">${record.errorMsg}</div>`;
            if (record.errorMsg && record.errorMsg.includes('Fattura già caricata')) {
                statusText += `<button class="btn-small override-btn" data-idx="${index}" style="background:#f59e0b; color:white; border:none; border-radius:4px; font-size: 0.7em; cursor:pointer;" title="Forza re-importazione (es. se era stata cancellata)">Forza Invio</button>`;
            }
        }

        tr.innerHTML = `
            <td>
                ${statusIcon}
                ${statusText}
            </td>
            <td>${record.date}</td>
            <td style="font-size: 0.8em; color:#475569; font-family: monospace;"><b>${record.numero || '-'}</b></td>
            <td style="font-size: 0.9em;"><strong>${record.fornitore}</strong></td>
            <td>
                <select class="staging-select staging-desc" data-idx="${index}" ${record.status==='saved'?'disabled':''}>
                    ${defaultDescOpts}
                </select>
            </td>
            <td style="font-size: 0.85em; color: #475569;">${record.dettaglio.substring(0,60)}${record.dettaglio.length > 60 ? '...' : ''}</td>
            <td><strong>€ ${(record.amount || 0).toFixed(2)}</strong></td>
            <td>
                <select class="staging-select staging-type" data-idx="${index}" ${record.status==='saved'?'disabled':''}>
                    <option value="" ${!record.predictedType ? 'selected' : ''}>-- Seleziona --</option>
                    ${!uniqueTypes.has(record.predictedType) && record.predictedType ? `<option value="${record.predictedType}" selected>${record.predictedType}</option>` : ''}
                    ${injectedTypeOpts}
                </select>
            </td>
            <td>
                <select class="staging-select staging-cat" data-idx="${index}" ${record.status==='saved'?'disabled':''}>
                    ${defaultCatOpts}
                </select>
            </td>
            <td>
                ${confidenceBadge}
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    // Bind change events to update object
    document.querySelectorAll('.staging-type').forEach(el => {
        el.addEventListener('change', (e) => {
            const idx = e.target.getAttribute('data-idx');
            stagingRecords[idx].predictedType = e.target.value;
            // Optionally clear category when type changes? Let user decide, but we re-render to update dynamic options
            renderStagingTable(); 
        });
    });
    document.querySelectorAll('.staging-cat').forEach(el => {
        el.addEventListener('change', (e) => {
            const idx = e.target.getAttribute('data-idx');
            stagingRecords[idx].predictedCategory = e.target.value;
            renderStagingTable();
        });
    });
    document.querySelectorAll('.staging-desc').forEach(el => {
        el.addEventListener('change', (e) => {
            stagingRecords[e.target.getAttribute('data-idx')].predictedDescription = e.target.value;
        });
    });

    // Override duplicate warnings
    document.querySelectorAll('.override-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.target.getAttribute('data-idx');
            stagingRecords[idx].status = 'ready';
            stagingRecords[idx].errorMsg = null;
            renderStagingTable();
        });
    });
}

async function saveToGestionale() {
    const btn = document.getElementById('save-all-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvataggio...';
    
    let savedCount = 0;
    
    // --- AUTO-CREATE ORPHANED ANAGRAFICHE ---
    let uniqueAna = [];
    let seenRS = new Set();
    extractedAnagrafiche.forEach(a => {
        if (!seenRS.has(a.ragioneSociale.toLowerCase())) {
             uniqueAna.push(a);
             seenRS.add(a.ragioneSociale.toLowerCase());
        }
    });

    for (let currentAna of uniqueAna) {
        try {
            const rsSnap = await anagraficheCollection.where('ragioneSociale', '==', currentAna.ragioneSociale).get();
            if (rsSnap.empty) {
                await anagraficheCollection.add({
                    tipo: currentAna.tipo,
                    ragioneSociale: currentAna.ragioneSociale,
                    piva: currentAna.piva,
                    cf: currentAna.cf,
                    sdi: '',
                    pec: '',
                    indirizzo: currentAna.indirizzo,
                    email: '',
                    telefono: '',
                    updatedAt: new Date().toISOString()
                });
            }
        } catch(e) { console.error("Error saving anagrafica auto", e); }
    }
    
    for (let i = 0; i < stagingRecords.length; i++) {
        const record = stagingRecords[i];
        if (record.status !== 'ready') continue;
        
        if (!record.predictedType || !record.predictedCategory) {
            alert("Attenzione: una o più righe non hanno Tipo o Categoria. Selezionali prima di salvare.");
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check-double"></i> Approva e Salva Tutto nel Gestionale';
            return;
        }
        
        const payload = {
            numero: record.numero || "N/A",
            date: record.date,
            type: record.predictedType,
            category: record.predictedCategory,
            description: record.predictedDescription || '',
            dettaglio: record.dettaglio || '',
            fornitore: record.fornitore,
            amount: parseFloat(record.amount) || 0,
            attachmentUrl: null,
            attachmentName: null,
            createdAt: new Date().toISOString()
        };
        
        try {
            await dataCollection.add(payload);
            record.status = 'saved';
            savedCount++;
            
            // Add to live learning buffer for next drops!
            historicalData.push(payload);
            
            // UI visual update
            const row = document.getElementById(`row-${record.id}`);
            row.className = 'row-status-saved';
            row.cells[0].innerHTML = '<i class="fas fa-check-circle" style="color:#10b981;"></i>';
            row.querySelectorAll('select').forEach(s => s.disabled = true);
            
        } catch (e) {
            console.error("Failed to save record", e);
            record.status = 'error';
            document.getElementById(`row-${record.id}`).className = 'row-status-error';
        }
    }
    
    btn.innerHTML = '<i class="fas fa-check"></i> Importazione Completata';
    
    if (savedCount > 0) {
        setTimeout(() => {
            alert(`✅ ${savedCount} record importati con successo nel Gestionale Eubiotech! Il sistema ha imparato dalle tue classificazioni.`);
        }, 300);
    }
}

// Logica "Mostra Fatture e Contenuto" - Visualizzatore Raw XML
document.addEventListener('DOMContentLoaded', () => {
    const showRawBtn = document.getElementById('show-raw-xml-btn');
    if (showRawBtn) {
        showRawBtn.addEventListener('click', () => {
             renderRawXmlModal();
             document.getElementById('raw-xml-modal').style.display = 'flex';
        });
    }
    
    const searchInput = document.getElementById('raw-search-input');
    const fileFilter = document.getElementById('raw-file-filter');
    
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderRawXmlModal();
        });
    }
    if (fileFilter) {
        fileFilter.addEventListener('change', () => {
            renderRawXmlModal();
        });
    }
});

function renderRawXmlModal() {
    const tbody = document.getElementById('raw-xml-tbody');
    const fileFilter = document.getElementById('raw-file-filter');
    const searchInput = document.getElementById('raw-search-input');
    if (!tbody) return;
    
    // Aggiorna le opzioni del filtro file, mantenendo quella attualmente selezionata
    const uniqueFiles = Array.from(new Set(rawXmlData.map(d => d.file))).sort();
    const currentFileExt = fileFilter.value;
    
    let filterHtml = '<option value="">-- Tutti i File --</option>';
    uniqueFiles.forEach(f => {
        filterHtml += `<option value="${f}" ${f === currentFileExt ? 'selected' : ''}>${f}</option>`;
    });
    fileFilter.innerHTML = filterHtml;
    
    const query = (searchInput.value || '').toLowerCase().trim();
    const selFile = fileFilter.value;
    
    const filtered = rawXmlData.filter(d => {
        if (selFile && d.file !== selFile) return false;
        
        if (query) {
            const rowStr = `${d.fornitore} ${d.dettaglio} ${d.date} ${d.file} ${d.prezzoTot}`.toLowerCase();
            return rowStr.includes(query);
        }
        return true;
    });
    
    const formatCurrency = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);
    
    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px; color: #64748b;">Nessun dato corrispondente trovato o nessun file caricato.</td></tr>';
        return;
    }
    
    filtered.forEach(d => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-size: 0.8em; color: #64748b; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${d.file}">${d.file}</td>
            <td style="font-size: 0.85em;">${d.date}</td>
            <td style="font-family: monospace; font-weight: bold; color:#475569;">${d.numero || '-'}</td>
            <td style="font-size: 0.9em; font-weight: 500;">${d.fornitore}</td>
            <td style="font-size: 0.85em; color: #475569;">${d.dettaglio}</td>
            <td style="font-family: monospace; text-align: center;">${d.quantita}</td>
            <td style="font-family: monospace; text-align: right;">${formatCurrency(d.prezzoUnitario)}</td>
            <td style="font-family: monospace; text-align: right;">${d.aliquotaIVA}%</td>
            <td style="font-family: monospace; font-weight: bold; color: #0f172a; text-align: right;">${formatCurrency(d.prezzoTot)}</td>
        `;
        tbody.appendChild(tr);
    });
}
