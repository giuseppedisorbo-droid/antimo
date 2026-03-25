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
const storage = firebase.storage();

// Collection reference
const dataCollection = db.collection('financial_records');
const anagraficheCollection = db.collection('anagrafiche');
const fattureCollection = db.collection('fatture');

// --- Global State & UI Elements ---
let appData = [];
let anagraficheData = [];
let customGroupings = []; // Added for custom causali groupings
let isDataLoaded = false;
let tableBody = null;
let filtersGeneratedOnce = false;

// Form Elements
let form, dateInput, typeInput, categorySelect, customCategoryInput, descInput, amountInput, submitBtn, cancelEditBtn, tableHeadRow;
let editingId = null;
// Buttons & Imports
let clearBtn, loadBackupBtn, importExtraBtn, importExtraFile, exportBackupBtn, importBackupBtn, importBackupFile;
// Filter Elements
let filterContainer, toggleFiltersBtn, globalClearFiltersBtn, clearFiltersBtn;
let yearFiltersContainer, monthFiltersContainer, typeFiltersContainer, categoryFiltersContainer, groupBySelect;
let actionsMenuBtn, actionsDropdownContent;
// Settings Modal Elements
let settingsBtn, settingsModal, closeSettingsModal, saveGroupBtn, cancelGroupBtn;
let newGroupNameInput, customGroupsContainer, settingsFormTitle, settingsFormArea;
let settingsTypesContainer, settingsCategoriesContainer, settingsDescriptionsContainer;
let editingGroupId = null; // Track if we're editing an existing custom group

// Context Menu Elements
let contextMenu, ctxEditBtn, ctxDeleteBtn;
let contextMenuTargetId = null;
// Summary Cards Elements
let sumRevenueEubiosEl, sumRevenueTechEl, sumCogsEl, sumOpexEl, sumProfitEl;

// Filter State
let filterState = {
    years: new Set(),
    months: new Set([1,2,3,4,5,6,7,8,9,10,11,12]), // 1 to 12
    types: new Set(),
    categories: new Set(),
    descriptions: new Set(),
    customGroups: new Set(), // Added for custom group filtering
    sortCols: [{ col: 'date', dir: 'desc' }], // Multi-level sorting array
    groupBy: 'year',
    searchQuery: '',
    columnFilters: {
        type: '',
        category: '',
        description: ''
    }
};

// --- Utilities ---
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(parseFloat(amount) || 0);
};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize State
    const DATA_KEY = 'EUBIOTECH_financial_data';
    const CUSTOM_GROUPS_KEY = 'EUBIOTECH_custom_groups';

    // Variables initialized here to prevent ReferenceErrors
    tableBody = document.getElementById('data-body');


    // Show loading state
    if(tableBody) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">Caricamento dati dal Cloud... <span style="display:inline-block; animation: spin 1s infinite linear;">⚙️</span></td></tr>';
    }

    try {
        // Load from Firestore
        const [snapshot, anagraficheSnapshot] = await Promise.all([
            dataCollection.get(),
            anagraficheCollection.get()
        ]);
        
        appData = [];
        anagraficheData = [];
        
        anagraficheSnapshot.forEach(doc => {
            anagraficheData.push({ id: doc.id, ...doc.data() });
        });
        const descriptionsSet = new Set();
        const providersSet = new Set();
        const clientsSet = new Set();

        snapshot.forEach(doc => {
            const data = doc.data();
            // Just gather all unique descriptions across the system
            if (data.description) descriptionsSet.add(data.description);
            if (data.fornitore) providersSet.add(data.fornitore);
            if (data.cliente) clientsSet.add(data.cliente);
        });

        const descriptions = Array.from(descriptionsSet).sort();
        const providers = Array.from(providersSet).sort();
        const clients = Array.from(clientsSet).sort();

        // 3. Popola i select per l'interfaccia principale
        const buildOptionsHtml = (arr) => arr.map(item => `<option value="${item.replace(/"/g, '&quot;')}">${item.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</option>`).join('');
        
        const descSelect = document.getElementById('description-input');
        if (descSelect) {
            descSelect.innerHTML = `<option value="" selected>Nessuna descrizione</option>` +
                                   buildOptionsHtml(descriptions) +
                                   `<option value="altro">+ Aggiungi nuova voce...</option>`;
        }
        
        const provSelect = document.getElementById('fornitore-input');
        if (provSelect) {
            provSelect.innerHTML = `<option value="" selected>Nessun fornitore</option>` +
                                   buildOptionsHtml(providers);
        }
        
        const cliSelect = document.getElementById('cliente-input');
        if (cliSelect) {
            cliSelect.innerHTML = `<option value="" selected>Nessun cliente</option>` +
                                  buildOptionsHtml(clients);
        }
        
        snapshot.forEach(doc => {
            const item = doc.data();
            // Migrate legacy types just in case
            if (item.type === 'COGS') item.type = 'COGS_TECH';
            if (item.type === 'OPEX') item.type = 'OPEX_TECH';
            
            // Revert Costi risorse umane / Costi altri back to generic COSTI EUBIOTECH
            if (item.type === 'Costi risorse umane' || item.type === 'Costi altri' || item.type === 'COGS_TECH' || item.type === 'OPEX_TECH') {
                item.type = 'COSTS_EUBIOTECH';
                // Fire and forget updating the backend
                dataCollection.doc(item.id).update({ type: 'COSTS_EUBIOTECH' }).catch(e=>console.log(e));
            }
            
            // Migrate COSTS_EUBIOS to COSTS_EUBIOTECH if they match the specified categories
            if (item.type === 'COSTS_EUBIOS') {
                const cat = (item.category || '').toUpperCase().trim();
                const movesToOpex = [
                    'ALTRI ACQUISTI', 'ARVAL', 'CENE', 'CONSULENZA/PROGETTI', 'FORMAZIONE DIPENDENTI',
                    'LEASEPLAN', 'ONERI BANCARI', 'POLIZZA ASSICURATIVA AXA', 'RIFORNIMENTO',
                    'RIPARAZIONI AUTO', 'SANZIONI', 'SICUREZZA SUL LAVORO', 
                    'SPESE LEGALI COSTITUZIONE SOCIETÀ-COMMERCIALISTA', 'TELEPASS', 'VISITE MEDICHE',
                    'SPESE LEGALI', 'CONSULENZA', 'MANUTENZIONE AUTO', 'FORMAZIONE', 'ASSICURAZIONI'
                ];
                if (movesToOpex.includes(cat) || movesToOpex.some(m => cat.includes(m))) {
                    item.type = 'COSTS_EUBIOTECH';
                    // Safely update the backend
                    dataCollection.doc(item.id).update({ type: 'COSTS_EUBIOTECH' }).catch(e=>console.error(e));
                }
            }
            
            appData.push(item);
        });
        
        isDataLoaded = true;

        // Fallback: If absolutely empty from cloud AND we have local data, we could migrate it
        if (appData.length === 0) {
            const localStored = localStorage.getItem(DATA_KEY);
            if (localStored) {
                console.log("Migrando dati locali su Firebase...");
                const localData = JSON.parse(localStored);
                if (Array.isArray(localData) && localData.length > 0) {
                    for (const item of localData) {
                        if (item.type === 'COGS') item.type = 'COGS_TECH';
                        if (item.type === 'OPEX') item.type = 'OPEX_TECH';
                        appData.push(item);
                        // Save individually to Cloud (async)
                        dataCollection.doc(item.id).set(item).catch(e => console.error("Migrazione errore sul record", item.id, e));
                    }
                    console.log("Migrazione completata.");
                }
            } else if (typeof preloadData !== 'undefined' && Array.isArray(preloadData) && preloadData.length > 0) {
                 // Or execute preload if entirely new system
                 executePreload();
            }
        }
    } catch (e) {
        console.error("Error reading from Firestore:", e);
        alert("Errore di connessione al database Cloud (Firebase). Sto caricando i dati offline locali se disponibili.");
        
        // Offline Fallback
        const offlineStored = localStorage.getItem(DATA_KEY);
        if (offlineStored) {
            appData = JSON.parse(offlineStored);
            if (!Array.isArray(appData)) appData = [];
        } else {
            appData = [];
        }
    }

    // --- GLOBAL MIGRATION ---
    // Apply migration rules to appData regardless of source (Cloud or Offline)
    let needsLocalSave = false;
    appData.forEach(item => {
        if (item.type === 'COSTS_EUBIOS') {
            const cat = (item.category || '').toUpperCase().trim();
            const movesToOpex = [
                'ALTRI ACQUISTI', 'ARVAL', 'CENE', 'CONSULENZA/PROGETTI', 'FORMAZIONE DIPENDENTI',
                'LEASEPLAN', 'ONERI BANCARI', 'POLIZZA ASSICURATIVA AXA', 'RIFORNIMENTO',
                'RIPARAZIONI AUTO', 'SANZIONI', 'SICUREZZA SUL LAVORO', 
                'SPESE LEGALI COSTITUZIONE SOCIETÀ-COMMERCIALISTA', 'TELEPASS', 'VISITE MEDICHE',
                'SPESE LEGALI', 'CONSULENZA', 'MANUTENZIONE AUTO', 'FORMAZIONE', 'ASSICURAZIONI',
                'FONDO ACCANTONAMENTO', 'NOLEGGIO AUTO SOSTITUTIVA'
            ];
            if (movesToOpex.includes(cat) || movesToOpex.some(m => cat.includes(m))) {
                item.type = 'OPEX_TECH';
                needsLocalSave = true;
                // Safely update the backend if it was from Cloud
                dataCollection.doc(item.id).update({ type: 'OPEX_TECH' }).catch(()=>{});
            }
        }
    });

    if (needsLocalSave) {
        localStorage.setItem(DATA_KEY, JSON.stringify(appData));
    }

    form = document.getElementById('data-entry-form');
    dateInput = document.getElementById('date-input');
    typeInput = document.getElementById('type-input');
    categorySelect = document.getElementById('category-input');
    customCategoryInput = document.getElementById('custom-category-input');
    descInput = document.getElementById('description-input');
    customDescInput = document.getElementById('custom-description-input');
    clienteInputSelect = document.getElementById('cliente-input');
    customClienteInput = document.getElementById('custom-cliente-input');
    fornitoreInputSelect = document.getElementById('fornitore-input');
    customFornitoreInput = document.getElementById('custom-fornitore-input');
    amountInput = document.getElementById('amount-input');
    submitBtn = document.getElementById('submit-btn');
    cancelEditBtn = document.getElementById('cancel-edit-btn');
    tableHeadRow = document.querySelector('#data-table thead tr');
    clearBtn = document.getElementById('clear-all-btn');
    loadBackupBtn = document.getElementById('load-backup-btn');
    importExtraBtn = document.getElementById('import-extra-btn');
    importExtraFile = document.getElementById('import-extra-file');
    exportBackupBtn = document.getElementById('export-backup-btn');
    importBackupBtn = document.getElementById('import-backup-btn');
    importBackupFile = document.getElementById('import-backup-file');
    filterContainer = document.getElementById('filter-grid-container');
    toggleFiltersBtn = document.getElementById('toggle-filters-btn');
    globalClearFiltersBtn = document.getElementById('global-clear-filters-btn');
    clearFiltersBtn = document.getElementById('clear-filters-btn'); // Nuovi filtri
    actionsMenuBtn = document.getElementById('actions-menu-btn'); // Dropdown menu
    actionsDropdownContent = document.getElementById('actions-dropdown-content');

    // 2.a Filter Elements
    yearFiltersContainer = document.getElementById('year-filters');
    monthFiltersContainer = document.getElementById('month-filters');
    typeFiltersContainer = document.getElementById('type-filters');
    categoryFiltersContainer = document.getElementById('category-filters');
    groupBySelect = document.getElementById('group-by-select');
    
    // 2.b Settings Modal Elements
    settingsBtn = document.getElementById('settings-btn');
    settingsModal = document.getElementById('settings-modal');
    closeSettingsModal = document.getElementById('close-settings-modal');
    saveGroupBtn = document.getElementById('save-group-btn');
    cancelGroupBtn = document.getElementById('cancel-group-btn');
    newGroupNameInput = document.getElementById('new-group-name');
    customGroupsContainer = document.getElementById('custom-groups-container');
    settingsFormTitle = document.getElementById('settings-form-title');
    settingsFormArea = document.getElementById('settings-form-area');
    settingsTypesContainer = document.getElementById('settings-types-container');
    settingsCategoriesContainer = document.getElementById('settings-categories-container');
    settingsDescriptionsContainer = document.getElementById('settings-descriptions-container');

    // Settings Modal Event Listeners
    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', () => {
            openSettingsModal();
        });
    }
    if (closeSettingsModal) {
        closeSettingsModal.addEventListener('click', () => {
            closeSettingsModalFunc();
        });
    }
    document.addEventListener('click', (e) => {
        if (settingsModal && !settingsModal.classList.contains('hidden') && e.target === settingsModal) {
            closeSettingsModalFunc();
        }
    });
    
    // Load Custom Groupings initially
    await loadCustomGroupings();
    
    // Context Menu Elements
    contextMenu = document.getElementById('row-context-menu');
    ctxEditBtn = document.getElementById('ctx-edit');
    ctxDeleteBtn = document.getElementById('ctx-delete');
    
    // Search Element
    const globalSearchInput = document.getElementById('global-search-input');
    if (globalSearchInput) {
        globalSearchInput.addEventListener('input', (e) => {
            filterState.searchQuery = e.target.value;
            renderTable();
        });
    }

    // iPhone view toggle
    const iphoneBtn = document.getElementById('iphone-view-btn');
    const tableContainer = document.querySelector('.table-container');
    if (iphoneBtn && tableContainer) {
        iphoneBtn.addEventListener('click', () => {
            tableContainer.classList.toggle('iphone-mode');
            if (tableContainer.classList.contains('iphone-mode')) {
                iphoneBtn.style.backgroundColor = '#2563eb';
                iphoneBtn.style.color = '#fff';
            } else {
                iphoneBtn.style.backgroundColor = 'transparent';
                iphoneBtn.style.color = '#2563eb';
            }
        });
    }

    // Clear Filters Logic handled at the bottom with dropdown buttons.

    // Actions Dropdown Logic
    if (actionsMenuBtn && actionsDropdownContent) {
        actionsMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent immediate closing
            actionsDropdownContent.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        window.addEventListener('click', (e) => {
            if (!actionsMenuBtn.contains(e.target) && !actionsDropdownContent.contains(e.target)) {
                if (actionsDropdownContent.classList.contains('show')) {
                    actionsDropdownContent.classList.remove('show');
                }
            }
        });
    }
    
    // Summary Cards Elements
    sumRevenueEubiosEl = document.getElementById('sum-revenue-eubios');
    sumRevenueTechEl = document.getElementById('sum-revenue-tech');
    sumCogsEl = document.getElementById('sum-cogs');
    sumOpexEl = document.getElementById('sum-opex');
    sumProfitEl = document.getElementById('sum-profit');

    // Load Backup Helper
    async function executePreload() {
        if (typeof preloadData !== 'undefined' && Array.isArray(preloadData) && preloadData.length > 0) {
            console.log("Forzatura caricamento dei dati pre-elaborati da data.js...");
            
            // Clean out old data to avoid duplicates upon multiple re-loads
            appData = [];
            
            // Map the legacy schema to the new simplified schema
            let isEubiotechSection = false;
            let seenExRv24_0 = false;
            
            // Track which months of Eubios Revenue we've already imported 
            // because data.js contains duplicate/secondary revenue sequences that inflate the total
            const seenEubiosRevenues = new Set();
            
            const newMappedData = preloadData.map((item, index) => {
                let mappedType;
                let mappedCategory = item.category || 'Generico';
                let mappedDescription = item.description || '';
                
                const catUpper = mappedCategory.toUpperCase().trim();
                if (catUpper === 'TOTALE' || catUpper.includes('TOTALE') || 
                    catUpper === 'FONDO ACCANTONAMENTO' || 
                    catUpper === 'NOLEGGIO AUTO' || catUpper.includes('NOLEGGIO AUTO') ||
                    catUpper.includes('COSTI DIVERSI GESTIONE EUBIOTECH')) {
                    return null;
                }

                if (item.type === "Ricavo" || item.type === "REVENUE") {
                     // The old logic skipped duplicate revenue sequences (because Fatturato was a single line).
                     // Now we have Ausili, Comunicatori, Nutrizione that share the same date.
                     // We don't want to skip them if they are distinct categories.
                     const dateObj = new Date(item.date);
                     const yyyyMm = `${dateObj.getFullYear()}-${dateObj.getMonth()}`;
                     const dedupeKey = `${yyyyMm}-${catUpper}`;
                     
                     if (seenEubiosRevenues.has(dedupeKey)) {
                         return null; // Skip duplicate revenue sequence ONLY if it's the exact same category and month
                     }
                     seenEubiosRevenues.add(dedupeKey);
                     mappedType = "REVENUE_EUBIOS"; 
                } else if (item.type === "Costo del Venduto" || item.type === "COSTO PERSONALE" || item.type === "COSTO PERSONALE (EUBIOTECH)") {
                     mappedType = "COGS_TECH";
                     mappedCategory = "SALARI E STIPENDI";
                     if (!mappedDescription && item.category) {
                         mappedDescription = item.category; 
                     }
                } else {
                     // item.type === "Altro Costo"
                     mappedType = "OPEX_TECH"; // Used to be COSTS_EUBIOS, but all these elements belong to Eubiotech
                }

                // Macro-Category mapping logic
                if (["INTERESSI PASSIVI", "ALTRI ONERI O PROVENTI FINANZIARI", "ONERI FINANZIARI", "PROVENTI FINANZIARI"].includes(catUpper) || catUpper.includes("ONERI FINANZIARI")) {
                    mappedDescription = item.category + (mappedDescription ? " - " + mappedDescription : "");
                    mappedCategory = "GESTIONE FINANZIARIA";
                    mappedType = "OPEX_TECH";
                } else if (["IRES", "IRAP", "POSTALI E BOLLI", "DIRITTI CAMERALI", "SANZIONI"].includes(catUpper)) {
                    mappedDescription = item.category + (mappedDescription ? " - " + mappedDescription : "");
                    mappedCategory = "GESTIONE FISCALE";
                    mappedType = "OPEX_TECH";
                } else if (["ONERI CONTRIBUTIVI", "INPS", "INAIL", "F24", "TFR"].includes(catUpper) || catUpper.includes("INPS") || catUpper.includes("INAIL") || catUpper.includes("F24") || catUpper.includes("TFR") || catUpper.includes("CONTRIBUTI")) {
                    mappedDescription = item.category + (mappedDescription ? " - " + mappedDescription : "");
                    mappedCategory = "SALARI E STIPENDI";
                    mappedType = "COGS_TECH"; 
                }

                return {
                    id: (item.id ? item.id.replace(/\//g, '-') : 'raw-' + Date.now() + Math.random()),
                    date: item.date,
                    type: mappedType,
                    category: mappedCategory,
                    description: mappedDescription,
                    amount: parseFloat(item.amount) || 0,
                    createdAt: new Date().toISOString()
                };
            });
            
            // INJECT missing Eubiotech Revenue (Compenso) from the user's explicit Excel file image
            const eubiotechRevenues = [
                {date: "2024-01-01", amount: 22000}, {date: "2024-02-01", amount: 22000}, {date: "2024-03-01", amount: 28670},
                {date: "2024-04-01", amount: 27780}, {date: "2024-05-01", amount: 27990}, {date: "2024-06-01", amount: 27810},
                {date: "2024-07-01", amount: 29540}, {date: "2024-08-01", amount: 26290}, {date: "2024-09-01", amount: 27900},
                {date: "2024-10-01", amount: 37660}, {date: "2024-11-01", amount: 30020}, {date: "2024-12-01", amount: 27880},
                
                {date: "2025-01-01", amount: 22000}, {date: "2025-02-01", amount: 22000}, {date: "2025-03-01", amount: 40295},
                {date: "2025-04-01", amount: 22000}, {date: "2025-05-01", amount: 22000}, {date: "2025-06-01", amount: 41380},
                {date: "2025-07-01", amount: 22000}, {date: "2025-08-01", amount: 22000}, {date: "2025-09-01", amount: 39375},
                {date: "2025-10-01", amount: 22000}, {date: "2025-11-01", amount: 22000}, {date: "2025-12-01", amount: 41885}
            ];
            
            eubiotechRevenues.forEach((rev, i) => {
                const months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
                const d = new Date(rev.date);
                newMappedData.push({
                    id: 'eubio-rev-calc-' + d.getFullYear() + '-' + d.getMonth(),
                    date: rev.date,
                    type: "REVENUE_EUBIOTECH",
                    category: "Compenso Eubiotech",
                    description: `Fatturato / Compenso ${months[d.getMonth()]} ${d.getFullYear()}`,
                    amount: rev.amount,
                    createdAt: new Date().toISOString()
                });
            });

            // INJECT Ad-Hoc Corporate/Tax expenses for 2024 and 2025
            const corpData = [
                // 2024 - Dec 24
                // { id: 'corp-inject-2024-altricompensi', date: '2024-12-01', type: 'OPEX_TECH', category: 'Altri compensi', description: 'Inserimento corporate', amount: 23000.00, createdAt: new Date().toISOString() },
                { id: 'corp-inject-2024-oneri', date: '2024-12-01', type: 'OPEX_TECH', category: 'Oneri contributivi (INPS, INAIL, F24)', description: 'Inserimento corporate', amount: 58164.82, createdAt: new Date().toISOString() },
                { id: 'corp-inject-2024-tfr', date: '2024-12-01', type: 'OPEX_TECH', category: 'TFR', description: 'Inserimento corporate', amount: 2302.35, createdAt: new Date().toISOString() },
                { id: 'corp-inject-2024-oneri-fin', date: '2024-12-01', type: 'OPEX_TECH', category: 'Altri oneri o proventi finanziari', description: 'Inserimento corporate', amount: 8372.86, createdAt: new Date().toISOString() },
                // { id: 'corp-inject-2024-gestione', date: '2024-12-01', type: 'OPEX_TECH', category: 'GESTIONE FISCALE', description: 'Inserimento corporate', amount: 20136.46, createdAt: new Date().toISOString() },
                { id: 'corp-inject-2024-ires', date: '2024-12-01', type: 'OPEX_TECH', category: 'IRES', description: 'Inserimento corporate', amount: 7782.00, createdAt: new Date().toISOString() },
                { id: 'corp-inject-2024-irap', date: '2024-12-01', type: 'OPEX_TECH', category: 'IRAP', description: 'Inserimento corporate', amount: 11845.00, createdAt: new Date().toISOString() },
                { id: 'corp-inject-2024-postali', date: '2024-12-01', type: 'OPEX_TECH', category: 'Postali e bolli', description: 'Inserimento corporate', amount: 90.87, createdAt: new Date().toISOString() },
                { id: 'corp-inject-2024-camerali', date: '2024-12-01', type: 'OPEX_TECH', category: 'Diritti camerali', description: 'Inserimento corporate', amount: 120.00, createdAt: new Date().toISOString() },
                { id: 'corp-inject-2024-sanzioni', date: '2024-12-01', type: 'OPEX_TECH', category: 'Sanzioni', description: 'Inserimento corporate', amount: 298.59, createdAt: new Date().toISOString() },

                // 2025 - Nov 25
                // { id: 'corp-inject-2025-altricompensi', date: '2025-11-01', type: 'OPEX_TECH', category: 'Altri compensi', description: 'Inserimento corporate', amount: 21000.00, createdAt: new Date().toISOString() },
                { id: 'corp-inject-2025-oneri', date: '2025-11-01', type: 'OPEX_TECH', category: 'Oneri contributivi (INPS, INAIL, F24)', description: 'Inserimento corporate', amount: 92346.62, createdAt: new Date().toISOString() },
                { id: 'corp-inject-2025-tfr', date: '2025-11-01', type: 'OPEX_TECH', category: 'TFR', description: 'Inserimento corporate', amount: 3104.62, createdAt: new Date().toISOString() },
                { id: 'corp-inject-2025-oneri-fin', date: '2025-11-01', type: 'OPEX_TECH', category: 'Altri oneri o proventi finanziari', description: 'Inserimento corporate', amount: 3293.33, createdAt: new Date().toISOString() },
                // { id: 'corp-inject-2025-gestione', date: '2025-11-01', type: 'OPEX_TECH', category: 'GESTIONE FISCALE', description: 'Inserimento corporate', amount: 13065.77, createdAt: new Date().toISOString() },
                { id: 'corp-inject-2025-ires', date: '2025-11-01', type: 'OPEX_TECH', category: 'IRES', description: 'Inserimento corporate', amount: 2905.43, createdAt: new Date().toISOString() },
                { id: 'corp-inject-2025-irap', date: '2025-11-01', type: 'OPEX_TECH', category: 'IRAP', description: 'Inserimento corporate', amount: 10160.35, createdAt: new Date().toISOString() }
            ];
            newMappedData.push(...corpData);

            appData = newMappedData.filter(item => item !== null);
            saveData(true); // Param true to bypass individual save and do a bulk logic or let render handle it
            
            // Batch write to Firestore for preload in chunks
            try {
                let count = 0;
                const batches = [db.batch()];
                let batchIndex = 0;
                
                appData.forEach(item => {
                    const docRef = dataCollection.doc(item.id);
                    batches[batchIndex].set(docRef, item);
                    count++;
                    if (count >= 490) {
                        batches.push(db.batch());
                        batchIndex++;
                        count = 0;
                    }
                });
                
                for (let b of batches) {
                    await b.commit();
                }
                console.log("Preload batch completato su Firebase");
            } catch(e) {
                console.error("Errore batch preload Firestore:", e);
                alert("Si è verificato un errore durante il salvataggio dei dati su Firebase.");
            }
            
            // Force re-generating filter logic since data changed completely
            filtersGeneratedOnce = false;
            renderTable();
            alert(`Caricati ${appData.length} record dal file base Excel (inclusi i compensi Eubiotech calcolati).`);
        } else {
            alert("Nessun dato di base trovato nel file data.js.");
        }
    }

    if(loadBackupBtn) {
        loadBackupBtn.addEventListener('click', async () => {
            if (confirm("Vuoi caricare i dati base estratti dall'Excel? Questo CANCELLERÀ e SOSTITUIRÀ tutti i dati attualmente salvati.")) {
                try {
                    // Wipe the database completely first to avoid orphaned duplicates
                    console.log("Svuotamento database prima del ripristino dei dati base...");
                    const snapshot = await dataCollection.get();
                    let count = 0;
                    const batches = [db.batch()];
                    let batchIndex = 0;
                    
                    snapshot.docs.forEach((doc) => {
                        batches[batchIndex].delete(doc.ref);
                        count++;
                        if (count >= 490) {
                            batches.push(db.batch());
                            batchIndex++;
                            count = 0;
                        }
                    });
                    
                    for (let b of batches) {
                        await b.commit();
                    }
                    console.log("Database svuotato. Avvio generazione nuovi dati...");
                } catch(e) {
                    console.error("Errore durante lo svuotamento del database:", e);
                }
                
                await executePreload();
            }
        });
    }

    if(clearBtn) {
        clearBtn.addEventListener('click', async () => {
            if (confirm("ATTENZIONE! Vuoi davvero CANCELLARE TUTTI I DATI dal database? Questa operazione è irreversibile e dovrai ricaricarli dal Base Excel o da un Backup.")) {
                try {
                    const snapshot = await dataCollection.get();
                    let count = 0;
                    const batches = [db.batch()];
                    let batchIndex = 0;
                    
                    snapshot.docs.forEach((doc) => {
                        batches[batchIndex].delete(doc.ref);
                        count++;
                        if (count >= 490) {
                            batches.push(db.batch());
                            batchIndex++;
                            count = 0;
                        }
                    });
                    
                    for (let b of batches) {
                        await b.commit();
                    }
                    appData = [];
                    updateActiveFiltersDisplay();
                    renderTable();
                    alert("Database svuotato con successo.");
                } catch(e) {
                    console.error("Errore durante lo svuotamento del database:", e);
                    alert("Errore durante l'operazione di pulizia del database cloud.");
                }
            }
        });
    }

    // --- IMPORT COSTI EXTRA DA EXCEL ---
    if (importExtraBtn && importExtraFile) {
        importExtraBtn.addEventListener('click', () => {
             if (typeof XLSX === 'undefined') {
                 alert("La libreria per leggere i file Excel (SheetJS) non è ancora caricata. Riprova tra qualche istante o ricarica la pagina.");
                 return;
             }
             importExtraFile.click();
        });

        importExtraFile.addEventListener('change', (e) => {
             const file = e.target.files[0];
             if(!file) return;

             const reader = new FileReader();
             reader.onload = function(evt) {
                 try {
                     const data = new Uint8Array(evt.target.result);
                     const workbook = XLSX.read(data, {type: 'array'});
                     let newEntries = [];
                     let parsedCount = 0;

                     workbook.SheetNames.forEach(sheetName => {
                         console.log("Analizzando foglio:", sheetName); // Debug log
                         
                         // More permissive sheet name matching
                         const sheetNameLower = sheetName.toLowerCase();
                         const isRiepilogo = sheetNameLower.includes("riepilogo") && sheetNameLower.includes("costi");
                         
                         if (isRiepilogo) {
                             console.log(" Trovato foglio valido:", sheetName);
                             const sheet = workbook.Sheets[sheetName];
                             const json = XLSX.utils.sheet_to_json(sheet, {header: 1});
                             if (!json || json.length === 0) return;

                             let descRowIdx = -1;
                             for(let i=0; i<Math.min(15, json.length); i++) { // Increased search depth to 15
                                 if(json[i] && typeof json[i][0] === 'string') {
                                     const cellValue = json[i][0].trim().toLowerCase();
                                     // Relaxed check: just needs to contain 'descriz'
                                     if(cellValue.includes('descriz')) {
                                         descRowIdx = i;
                                         console.log("  Trovata riga intestazione a indice:", i);
                                         break;
                                     }
                                 }
                             }

                             if(descRowIdx !== -1 && json[descRowIdx-1]) {
                                 const monthsRow = json[descRowIdx-1];
                                 const monthCols = [];
                                 
                                 for(let c=1; c<monthsRow.length; c++) {
                                     const cellValue = monthsRow[c];
                                     if(cellValue !== null && cellValue !== undefined && cellValue !== "" && cellValue !== "Totale") {
                                         let y, m;
                                         if (typeof cellValue === 'number' && cellValue > 10000) {
                                             // Excel serial date (e.g. 45658)
                                             const jsDate = new Date((cellValue - 25569) * 86400 * 1000);
                                             y = jsDate.getFullYear();
                                             m = jsDate.getMonth() + 1;
                                         } else if (typeof cellValue === 'string' && cellValue.includes('-')) {
                                             // Fallback for strings like 'gen-25'
                                             const parts = cellValue.split('-');
                                             const monthNames = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
                                             const mIdx = monthNames.indexOf(parts[0].toLowerCase().trim());
                                             y = parseInt(parts[1], 10);
                                             if (y < 2000) y += 2000;
                                             m = mIdx !== -1 ? mIdx + 1 : null;
                                         }
                                         
                                         if (y && m && !isNaN(y)) {
                                             monthCols.push({ colIdx: c, year: y, month: m });
                                         }
                                     }
                                 }
                                 
                                 console.log(`  Identificati ${monthCols.length} mesi in questo foglio.`);

                                 for(let r=descRowIdx+1; r<json.length; r++) {
                                     const row = json[r];
                                     if(!row || !row[0]) continue;
                                     
                                     const rawCat = row[0].toString();
                                     const cat = rawCat.trim();
                                     const catUpper = cat.toUpperCase();
                                     
                                     // Escludi Noleggio auto, Totale, Fondo accantonamento in tutte le variazioni possibili
                                     if(catUpper === 'TOTALE' || 
                                        catUpper === 'FONDO ACCANTONAMENTO' || 
                                        catUpper === 'NOLEGGIO AUTO' || 
                                        catUpper.includes('NOLEGGIO AUTO') ||
                                        catUpper.includes('TOTALE')) continue; 
                                     
                                     monthCols.forEach(mc => {
                                         let val = row[mc.colIdx]; 
                                         if (typeof val === 'string') {
                                             val = parseFloat(val.replace(/€/g, '').replace(/\./g, '').replace(/,/g, '.').trim());
                                         }
                                         if(!isNaN(val) && val !== 0 && val !== undefined && val !== null) {
                                             const dateStr = `${mc.year}-${mc.month.toString().padStart(2, '0')}-01`;
                                             
                                             // Check if we already have this specific opex imported to avoid exact duplicates
                                             const existingIdx = appData.findIndex(item => 
                                                 item.date === dateStr && 
                                                 item.category.toLowerCase() === cat.toLowerCase() && 
                                                 item.type === "OPEX_TECH" && 
                                                 Math.abs(item.amount - val) < 0.01 // Soft match amount
                                             );

                                             if (existingIdx === -1) {
                                                 newEntries.push({
                                                     id: 'ex-op-' + Date.now() + Math.random().toString(36).substr(2, 5),
                                                     date: dateStr,
                                                     type: "OPEX_TECH",
                                                     description: "Costo Extra Excel: " + cat,
                                                     category: cat,
                                                     amount: val,
                                                     provider: "Importazione Extra",
                                                     createdAt: new Date().toISOString()
                                                 });
                                                 parsedCount++;
                                             } else {
                                                 // Log duplicates for debugging
                                                 console.log(`  Scartato duplicato: ${dateStr} - ${cat} - ${val}€`);
                                             }
                                         }
                                     });
                                 }
                             } else {
                                 console.log("  ATTENZIONE: Non ho trovato la riga 'Descrizione' nel foglio", sheetName);
                             }
                         }
                     });
                     
                     if (parsedCount > 0) {
                         appData = [...appData, ...newEntries];
                         localStorage.setItem(DATA_KEY, JSON.stringify(appData));
                         
                         // Batch write new entries to Firestore
                         try {
                              const batch = db.batch();
                              newEntries.forEach(item => {
                                  const docRef = dataCollection.doc(item.id);
                                  batch.set(docRef, item);
                              });
                              batch.commit().then(() => console.log("Importazione extra salvata su Firebase"));
                         } catch(e) {
                              console.error("Errore salvataggio import extra su Firestore:", e);
                         }
                         
                         // Re-initialize completely
                         updateUI();
                         populateCategoryDropdown(); // Update dropdowns with new categories
                         alert(`Importazione completata con successo! Inseriti ${parsedCount} nuovi record in "Costi altri Eubiotech".`);
                     } else {
                         alert("L'analisi del file è andata a buon fine, ma non ci sono nuovi dati da inserire in tabella. I dati presenti nel file (ad es. per i noleggi, spese legali, ecc.) sono tutti GIÀ PRESENTI all'interno dell'applicazione!");
                     }
                 } catch (err) {
                     console.error("Errore durante l'importazione Excel:", err);
                     alert("Si è verificato un errore durante la lettura del file Excel.");
                 }
                 // Reset input so the same file could be selected again if needed
                 importExtraFile.value = '';
             };
             reader.readAsArrayBuffer(file);
        });
    }

    // --- PRELOAD DATA INJECTION (AUTO) ---
    if (appData.length === 0) {
        executePreload();
    }

    function isItemInCustomGroup(item, groupName) {
        if (!typeof customGroupings !== 'undefined' && customGroupings) {
            const group = customGroupings.find(g => g.name.toLowerCase() === groupName.toLowerCase());
            if (group) {
                const matchType = group.filters.types && group.filters.types.includes(item.type);
                const matchCat = group.filters.categories && group.filters.categories.includes(item.category);
                const matchDesc = group.filters.descriptions && item.description && group.filters.descriptions.includes(item.description);
                return matchType || matchCat || matchDesc;
            }
        }
        return false;
    }

    // --- SUMMARY CALCULATIONS ---
    function updateSummaryCards(dataToSummarize) {
        let revEubios = 0, costsEubios = 0, revTech = 0, costiRisorseUmane = 0, costiAltri = 0, costsTechTotal = 0;
        dataToSummarize.forEach(item => {
            // Support legacy 'REVENUE' in case any exists
            if(item.type === 'REVENUE_EUBIOS' || item.type === 'REVENUE') revEubios += item.amount;
            else if(item.type === 'COSTS_EUBIOS') costsEubios += item.amount;
            else if(item.type === 'REVENUE_EUBIOTECH') {
                revTech += item.amount;
                costsEubios += item.amount; // Aggiunge i Ricavi Eubiotech ai Costi Eubios
            }
            else if(isItemInCustomGroup(item, 'Costi risorse umane') || isItemInCustomGroup(item, 'Risorse umane') || item.type === 'Costi risorse umane' || item.type === 'COGS_TECH' || item.type === 'COGS') {
                costiRisorseUmane += item.amount;
                costsTechTotal += item.amount;
            }
            else if(isItemInCustomGroup(item, 'Costi altri') || isItemInCustomGroup(item, 'Altri costi') || item.type === 'Costi altri' || item.type === 'OPEX_TECH' || item.type === 'OPEX' || item.type === 'ALTRI COSTI EUBIOTECH') {
                costiAltri += item.amount;
                costsTechTotal += item.amount;
            }
        });
        
        // Eubios Profit = Eubios Revenue - Eubios Costs (which now includes Eubiotech Revenue)
        const profitEubios = revEubios - costsEubios;
        
        // Eubiotech Profit = Eubiotech Revenue - All other operating costs and compensations
        const profitTech = revTech - costsTechTotal;

        // Formulate period label
        let availableYearsCount = document.querySelectorAll('.flt-year').length;
        let yearsArr = Array.from(filterState.years).sort();
        let yearStr = yearsArr.length > 0 ? yearsArr.join(", ") : "Nessun anno";
        if (availableYearsCount > 0 && yearsArr.length === availableYearsCount) yearStr = "Tutti gli anni";

        let monthsArr = Array.from(filterState.months).sort((a,b)=>a-b);
        let monthStr = "";
        if (monthsArr.length === 12) {
            monthStr = "";
        } else if (monthsArr.length === 0) {
            monthStr = " - Nessun mese";
        } else {
            const mNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
            // Simplify quarters if full quarter is selected exactly
            if (monthsArr.length === 3 && monthsArr[0] === 1 && monthsArr[1] === 2 && monthsArr[2] === 3) monthStr = " - Q1";
            else if (monthsArr.length === 3 && monthsArr[0] === 4 && monthsArr[1] === 5 && monthsArr[2] === 6) monthStr = " - Q2";
            else if (monthsArr.length === 3 && monthsArr[0] === 7 && monthsArr[1] === 8 && monthsArr[2] === 9) monthStr = " - Q3";
            else if (monthsArr.length === 3 && monthsArr[0] === 10 && monthsArr[1] === 11 && monthsArr[2] === 12) monthStr = " - Q4";
            else monthStr = " - " + monthsArr.map(m => mNames[m-1]).join(", ");
        }
        
        let periodLabel = `<span style="font-size:0.85em; font-weight:normal; display:block; margin-top:0.3rem; color: #94a3b8;">${yearStr}${monthStr}</span>`;

        const updateTitle = (id, baseText) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = `${baseText}${periodLabel}`;
        };

        updateTitle('title-revenue-eubios', 'Ricavi Eubios');
        updateTitle('title-costs-eubios', 'Costi Eubios');
        updateTitle('title-revenue-tech', 'Ricavi Eubiotech');
        // Removed Costi Eubiotech card update
        updateTitle('title-cogs', 'Costi risorse umane');
        updateTitle('title-opex', 'Costi altri');
        updateTitle('title-profit-eubios', 'Utile Eubios');
        updateTitle('title-profit-tech', 'Utile Eubiotech');

        const formatCurrency = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);
        const formatPct = (val, base) => {
            if (!base || base === 0 || val === base) return "";
            return `(${((val / base) * 100).toFixed(1)}%)`;
        };
        const setValAndPct = (id, val, base) => {
            const el = document.getElementById(id);
            if(el) {
                const pctStr = formatPct(val, base);
                if (pctStr) {
                    el.innerHTML = `${formatCurrency(val)} <span style="font-size: 0.55em; opacity: 0.7; margin-left: 5px; font-weight: normal;">${pctStr}</span>`;
                } else {
                    el.innerHTML = formatCurrency(val);
                }
            }
        };
        
        setValAndPct('sum-revenue-eubios', revEubios, revEubios);
        setValAndPct('sum-costs-eubios', costsEubios, revEubios);
        setValAndPct('sum-profit-eubios', profitEubios, revEubios);

        setValAndPct('sum-revenue-tech', revTech, revTech);
        // Removed Costi Eubiotech total from cards
        setValAndPct('sum-cogs', costiRisorseUmane, revTech);
        setValAndPct('sum-opex', costiAltri, revTech);
        setValAndPct('sum-profit-tech', profitTech, revTech);
    }

    // --- RENDER LOGIC ---
    function renderTable() {
        tableBody.innerHTML = '';
        const tableHeadRow = document.querySelector('#data-table thead tr');

        if (appData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="empty-state">Nessun dato presente. Inizia aggiungendo un record.</td></tr>';
            updateSummaryCards([]);
            updateFilterUI(); // Ensure filters exist even if empty
            return;
        }

        updateFilterUI(); // Refresh available years

        // 1. FILTERING
        let baseFilteredData = appData.filter(item => {
            let itemYear = -1;
            let itemMonth = -1; // 1-12
            try {
                const dateObj = new Date(item.date);
                if(!isNaN(dateObj)) {
                    itemYear = dateObj.getFullYear();
                    itemMonth = dateObj.getMonth() + 1;
                }
            } catch(e){}

            // Check if year is selected
            if(filterState.years.size > 0 && !filterState.years.has(itemYear)) return false;
            
            // Check if month is selected
            if(filterState.months.size > 0 && !filterState.months.has(itemMonth)) return false;
            
            // Check if type is selected
            if(filterState.types.size > 0 && !filterState.types.has(item.type)) return false;
            
            // Check if category is selected
            if(filterState.categories.size > 0 && !filterState.categories.has(item.category)) return false;

            // Check Global Search Query (Supports AND / OR)
            if (filterState.searchQuery.trim() !== '') {
                const searchStr = `${item.date} ${item.type} ${item.category} ${item.description} ${item.amount}`.toLowerCase();
                const rawQuery = filterState.searchQuery.toLowerCase().trim();
                
                // Parse OR operators first (lowest precedence)
                const orGroups = rawQuery.split(/\s+or\s+/);
                
                let passedOr = false;
                for (const group of orGroups) {
                    // Parse AND operators within each OR group
                    const andTerms = group.split(/\s+and\s+|\s+/); // Match explicit 'and' or just spaces
                    
                    let passedAnd = true;
                    for (const term of andTerms) {
                        if (term && !searchStr.includes(term)) {
                            passedAnd = false;
                            break;
                        }
                    }
                    
                    if (passedAnd) {
                        passedOr = true;
                        break;
                    }
                }
                
                if (!passedOr) return false;
            }

            // Check Multi-Select popover filters (usually for Grouped View, but can apply globally)
            if (filterState.categories.size > 0 && !filterState.categories.has(item.category || 'Generico')) return false;
            if (filterState.types.size > 0 && !filterState.types.has(item.type)) return false;
            if (filterState.descriptions.size > 0 && !filterState.descriptions.has(item.description)) return false;

            return true;
        });

        // Split column filter logic to allow dynamic dropdown options
        let filteredData = baseFilteredData.filter(item => {
            if (filterState.columnFilters.type && item.type !== filterState.columnFilters.type) return false;
            if (filterState.columnFilters.category && item.category !== filterState.columnFilters.category) return false;
            if (filterState.columnFilters.description && item.description !== filterState.columnFilters.description) return false;
            return true;
        });

        // Update top cards with filtered totals
        updateSummaryCards(filteredData);
        updateActiveFiltersDisplay();
        
        const formatCurrency = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);

        // 2. GROUPING & RENDERING
        const groupBy = filterState.groupBy;

        if (groupBy === 'none') {
            // Sort state helpers
            const getSortIcon = (col) => {
                const sortItemIdx = filterState.sortCols.findIndex(s => s.col === col);
                if (sortItemIdx === -1) return '<span style="color:#cbd5e1;">↕</span>'; // Not sorted
                
                // Show arrow and priority number if there are multiple sorts
                const dirStr = filterState.sortCols[sortItemIdx].dir === 'asc' ? '↑' : '↓';
                const priorityStr = filterState.sortCols.length > 1 ? `<sup style="color:#8b5cf6;font-size:0.7em;">${sortItemIdx + 1}</sup>` : '';
                return `<span style="color:#0f172a; font-weight:bold;">${dirStr}${priorityStr}</span>`;
            };

            // Generate distinct values for column dropsdowns based on CURRENT filtered data
            // (but excluding the column's own filter to allow switching to other options within the same context)
            const typeOptionsData = baseFilteredData.filter(item => {
                if (filterState.columnFilters.category && item.category !== filterState.columnFilters.category) return false;
                if (filterState.columnFilters.description && item.description !== filterState.columnFilters.description) return false;
                return true;
            });
            const categoryOptionsData = baseFilteredData.filter(item => {
                if (filterState.columnFilters.type && item.type !== filterState.columnFilters.type) return false;
                if (filterState.columnFilters.description && item.description !== filterState.columnFilters.description) return false;
                return true;
            });
            const descOptionsData = baseFilteredData.filter(item => {
                if (filterState.columnFilters.type && item.type !== filterState.columnFilters.type) return false;
                if (filterState.columnFilters.category && item.category !== filterState.columnFilters.category) return false;
                return true;
            });

            const uniqueTypes = [...new Set(typeOptionsData.map(d => d.type))].filter(Boolean).sort();
            const uniqueCategoriesLocal = [...new Set(categoryOptionsData.map(d => d.category))].filter(Boolean).sort();
            const uniqueDescLocal = [...new Set(descOptionsData.map(d => d.description))].filter(Boolean).sort();
            
            const typeLabels = {
                'REVENUE_EUBIOS': 'RICAVI EUBIOS',
                'COSTS_EUBIOS': 'COSTI EUBIOS',
                'REVENUE_EUBIOTECH': 'RICAVI EUBIOTECH',
                'Costi risorse umane': 'COSTI RISORSE UMANE (EUBIOTECH)', 'COGS_TECH': 'COSTI PERSONALE EUBIOTECH (Legacy)',
                'Costi altri': 'COSTI ALTRI (EUBIOTECH)', 'OPEX_TECH': 'ALTRI COSTI EUBIOTECH (Legacy)',
                'REVENUE': 'RICAVI EUBIOS (Legacy)',
                'COGS': 'COSTI EUBIOS (Legacy)',
                'OPEX': 'ALTRI COSTI (Legacy)'
            };

            const typeOptions = `<option value="">Tutti</option>` + uniqueTypes.map(t => `<option value="${t}" ${filterState.columnFilters.type === t ? 'selected' : ''}>${typeLabels[t] || t}</option>`).join('');
            const categoryOptions = `<option value="">Tutte</option>` + uniqueCategoriesLocal.map(c => `<option value="${c}" ${filterState.columnFilters.category === c ? 'selected' : ''}>${c}</option>`).join('');
            const descOptions = `<option value="">Tutte</option>` + uniqueDescLocal.map(d => `<option value="${d}" ${filterState.columnFilters.description === d ? 'selected' : ''}>${d}</option>`).join('');

            tableHeadRow.innerHTML = `
                <th>
                    <div style="display:flex; flex-direction:column;">
                        <span class="sortable" data-sort="date">Data <span class="sort-icon">${getSortIcon('date')}</span></span>
                        <select class="col-filter-date-group" style="margin-top:4px; font-size:0.8em; padding:2px; max-width: 150px;">
                            <option value="none" disabled selected>Raggruppa per...</option>
                            <option value="year">Anno</option>
                            <option value="quarter">Trimestre</option>
                            <option value="month">Mese</option>
                            <option value="week">Settimana</option>
                            <option value="day">Giorno</option>
                        </select>
                    </div>
                </th>
                <th>
                    <div style="display:flex; flex-direction:column;">
                        <span class="sortable" data-sort="type">Tipo <span class="sort-icon">${getSortIcon('type')}</span></span>
                        <select class="col-filter" data-col="type" style="margin-top:4px; font-size:0.8em; padding:2px; max-width: 150px;">
                            ${typeOptions}
                        </select>
                    </div>
                </th>
                <th>
                    <div style="display:flex; flex-direction:column;">
                        <span class="sortable" data-sort="category">Categoria <span class="sort-icon">${getSortIcon('category')}</span></span>
                        <select class="col-filter" data-col="category" style="margin-top:4px; font-size:0.8em; padding:2px; max-width: 150px;">
                            ${categoryOptions}
                        </select>
                    </div>
                </th>
                <th>
                    <div style="display:flex; flex-direction:column;">
                        <span class="sortable" data-sort="description">Descrizione <span class="sort-icon">${getSortIcon('description')}</span></span>
                        <select class="col-filter" data-col="description" style="margin-top:4px; font-size:0.8em; padding:2px; max-width: 150px;">
                            ${descOptions}
                        </select>
                    </div>
                </th>
                <th class="sortable" data-sort="dettaglio">Dettaglio <span class="sort-icon">${getSortIcon('dettaglio')}</span></th>
                <th class="sortable" data-sort="amount">Importo (€) <span class="sort-icon">${getSortIcon('amount')}</span></th>
                <th>Cliente</th>
                <th>Fornitore</th>
                <th>Allegato</th>
                <th>Azioni</th>
            `;
            
            // Bind column filters
            document.querySelectorAll('.col-filter').forEach(select => {
                select.addEventListener('change', (e) => {
                    const col = e.target.getAttribute('data-col');
                    filterState.columnFilters[col] = e.target.value;
                    renderTable();
                });
            });

            // Bind date group fast switch
            const dateGroupSelect = document.querySelector('.col-filter-date-group');
            if(dateGroupSelect) {
                dateGroupSelect.addEventListener('change', (e) => {
                    const val = e.target.value;
                    if(val !== 'none') {
                        filterState.groupBy = val;
                        const topSelect = document.getElementById('group-by-select');
                        if (topSelect) topSelect.value = val;
                        renderTable();
                    }
                });
            }

            // Bind sorting headers
            document.querySelectorAll('#data-table th .sortable, #data-table th.sortable').forEach(th => {
                th.style.cursor = 'pointer';
                th.addEventListener('click', (e) => {
                    // Prevent triggering sort when clicking the dropdown
                    if(e.target.tagName.toLowerCase() === 'select' || e.target.tagName.toLowerCase() === 'option') return;
                    
                    const col = th.getAttribute('data-sort');
                    const isShift = e.shiftKey;
                    
                    const existingIdx = filterState.sortCols.findIndex(s => s.col === col);
                    
                    if (isShift) {
                        // Multi-sort behavior: toggle dir if exists, else append
                        if (existingIdx !== -1) {
                            filterState.sortCols[existingIdx].dir = filterState.sortCols[existingIdx].dir === 'asc' ? 'desc' : 'asc';
                        } else {
                            filterState.sortCols.push({ col: col, dir: col === 'date' || col === 'amount' ? 'desc' : 'asc' });
                        }
                    } else {
                        // Single-sort behavior (reset array, or just toggle if it's already the primary)
                        if (existingIdx === 0 && filterState.sortCols.length === 1) {
                            // It was already the only sort, just toggle it
                            filterState.sortCols[0].dir = filterState.sortCols[0].dir === 'asc' ? 'desc' : 'asc';
                        } else {
                            // Reset and make this the ONLY primary sort
                            filterState.sortCols = [{ col: col, dir: col === 'date' || col === 'amount' ? 'desc' : 'asc' }];
                        }
                    }
                    
                    renderTable();
                });
            });

            if(filteredData.length === 0) {
                 tableBody.innerHTML = '<tr><td colspan="7" class="empty-state">Nessun dato corrisponde ai filtri selezionati.</td></tr>';
                 return;
            }

            // Apply selected multi-level sort
            const sortedData = [...filteredData].sort((a, b) => {
                for (let i = 0; i < filterState.sortCols.length; i++) {
                    const sortInfo = filterState.sortCols[i];
                    const col = sortInfo.col;
                    const dir = sortInfo.dir === 'asc' ? 1 : -1;
                    
                    let cmp = 0;
                    if (col === 'date') {
                        cmp = new Date(a.date) - new Date(b.date);
                    } else if (col === 'amount') {
                        cmp = parseFloat(a.amount || 0) - parseFloat(b.amount || 0);
                    } else {
                        // Strings
                        const valA = (a[col] || '').toString().toLowerCase();
                        const valB = (b[col] || '').toString().toLowerCase();
                        if (valA < valB) cmp = -1;
                        else if (valA > valB) cmp = 1;
                    }
                    
                    if (cmp !== 0) {
                        return cmp * dir;
                    }
                }
                return 0; // All priorities equal
            });

            sortedData.forEach(item => {
                const tr = document.createElement('tr');
                let displayDate = item.date;
                try {
                    const parts = item.date.split('-');
                    if(parts.length === 3) displayDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                } catch(e){}

                let attachmentLink = '-';
                if (item.attachmentUrl) {
                    attachmentLink = `<a href="${item.attachmentUrl}" target="_blank" title="${item.attachmentName || 'Visualizza'}">📎</a>`;
                }
                
                const typeLabels = {
                    'REVENUE_EUBIOS': 'RICAVI EUBIOS',
                    'COSTS_EUBIOS': 'COSTI EUBIOS',
                    'REVENUE_EUBIOTECH': 'RICAVI EUBIOTECH',
                    'Costi risorse umane': 'COSTI RISORSE UMANE (EUBIOTECH)', 'COGS_TECH': 'COSTI PERSONALE EUBIOTECH (Legacy)',
                    'Costi altri': 'COSTI ALTRI (EUBIOTECH)', 'OPEX_TECH': 'ALTRI COSTI EUBIOTECH (Legacy)',
                    'REVENUE': 'RICAVI EUBIOS (Legacy)',
                    'COGS': 'COSTI EUBIOS (Legacy)',
                    'OPEX': 'ALTRI COSTI (Legacy)'
                };
                const displayType = typeLabels[item.type] || item.type;

                tr.className = 'raw-data-row';
                tr.setAttribute('data-id', item.id);
                tr.innerHTML = `
                    <td>${displayDate}</td>
                    <td style="font-family: monospace; font-size: 0.9em; color:#475569;"><b>${item.numero || '-'}</b></td>
                    <td><strong>${displayType}</strong></td>
                    <td>${item.category}</td>
                    <td>${item.description || '-'}</td>
                    <td>${item.dettaglio || '-'}</td>
                    <td style="font-family: monospace; font-size: 1.1em;">${formatCurrency(item.amount)}</td>
                    <td>${item.cliente || '-'}</td>
                    <td>${item.fornitore || '-'}</td>
                    <td style="text-align: center;">${attachmentLink}</td>
                    <td>
                        <button class="edit-btn btn-small" data-id="${item.id}" style="margin-right: 5px;">Modifica</button>
                        <button class="delete-btn btn-small btn-danger" data-id="${item.id}">Elimina</button>
                    </td>
                `;
                tableBody.appendChild(tr);
            });

            // Attach edit event listeners
            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idToEdit = e.currentTarget.getAttribute('data-id');
                    editEntry(idToEdit);
                });
            });

            // Attach delete event listeners
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idToDelete = e.currentTarget.getAttribute('data-id');
                    deleteEntry(idToDelete);
                });
            });

        } else {
            // GROUPED VIEW
            
            // SMART PIVOT: Se l'utente ha isolato una specifica tipologia (Tipo, Categoria, o Descrizione)
            // e raggruppa per 'Anno', la vista P&L standard è inutile. Creiamo una Pivot Nome/Anno.
            const hasPivotFilter = filterState.columnFilters.category || filterState.columnFilters.type || filterState.columnFilters.description;
            if (hasPivotFilter && groupBy === 'year') {
                
                let pivotSubtitle = [];
                if (filterState.columnFilters.type) pivotSubtitle.push(`Tipo: ${filterState.columnFilters.type}`);
                if (filterState.columnFilters.category) pivotSubtitle.push(`Cat: ${filterState.columnFilters.category}`);
                if (filterState.columnFilters.description) pivotSubtitle.push(`Desc: ${filterState.columnFilters.description}`);
                
                const yearsSet = new Set();
                filteredData.forEach(item => {
                    const d = new Date(item.date);
                    if(!isNaN(d)) yearsSet.add(d.getFullYear());
                });
                
                const years = Array.from(yearsSet).sort((a,b) => b - a); // 2025, 2024
                
                tableHeadRow.innerHTML = `
                    <th style="background:#f8fafc;">Nominativo / Descrizione<br><span style="font-size:0.8em; font-weight:normal;">(${pivotSubtitle.join(' | ')})</span></th>
                    ${years.map(y => `<th style="text-align: right; background:#f8fafc;">Anno ${y}</th>`).join('')}
                    <th style="text-align: right; background:#f1f5f9;">Totale Complessivo</th>
                `;
                
                if(filteredData.length === 0) {
                     tableBody.innerHTML = `<tr><td colspan="${years.length + 2}" class="empty-state">Nessun dato.</td></tr>`;
                     return;
                }
                
                const pivotData = {};
                filteredData.forEach(item => {
                    let desc = (item.description || item.category || 'Generico').toUpperCase().trim();
                    if (desc === 'PERSONALE EUBIOTECH' || desc === 'COSTI PERSONALE EUBIOTECH') desc = 'GENERICO';
                    
                    const dateObj = new Date(item.date);
                    const y = isNaN(dateObj) ? 'N/A' : dateObj.getFullYear();
                    
                    if (!pivotData[desc]) pivotData[desc] = { total: 0 };
                    if (!pivotData[desc][y]) pivotData[desc][y] = 0;
                    
                    pivotData[desc][y] += item.amount;
                    pivotData[desc].total += item.amount;
                });
                
                const sortedDescs = Object.keys(pivotData).sort((a,b) => pivotData[b].total - pivotData[a].total);
                
                sortedDescs.forEach(desc => {
                    const d = pivotData[desc];
                    const tr = document.createElement('tr');
                    let html = `<td data-label="Descrizione"><a href="javascript:void(0)" class="drilldown-link" data-group-type="smart_pivot" data-group-key="${desc.replace(/"/g, '&quot;')}" style="color: #3b82f6; text-decoration: none;"><strong>${desc}</strong></a></td>`;
                    years.forEach(y => {
                        const val = d[y] || 0;
                        html += `<td data-label="Anno ${y}" style="font-family:monospace; text-align: right; color:#059669;">${val !== 0 ? formatCurrency(val) : '-'}</td>`;
                    });
                    html += `<td data-label="Totale Complessivo" style="font-family:monospace; font-weight:bold; text-align: right; color:#0f172a; background:#f8fafc;">${formatCurrency(d.total)}</td>`;
                    tr.innerHTML = html;
                    tableBody.appendChild(tr);
                });
                
                return; // Early return per evitare di disegnare il P&L normale
            }

            if (groupBy === 'custom_group') {
                const yearsSet = new Set();
                filteredData.forEach(item => {
                    const d = new Date(item.date);
                    if(!isNaN(d)) yearsSet.add(d.getFullYear());
                });
                const years = Array.from(yearsSet).sort((a,b) => b - a);

                tableHeadRow.innerHTML = `
                    <th style="background:#f8fafc; border-bottom: 2px solid #0f172a;">Voce Conto Economico</th>
                    ${years.map(y => `<th style="text-align: right; background:#f8fafc; border-bottom: 2px solid #0f172a;">Anno ${y}</th>`).join('')}
                    <th style="text-align: right; background:#f1f5f9; border-bottom: 2px solid #0f172a;">Totale Complessivo</th>
                `;
                
                if(filteredData.length === 0) {
                     tableBody.innerHTML = `<tr><td colspan="${years.length + 2}" class="empty-state">Nessun dato.</td></tr>`;
                     return;
                }

                const groupTotals = {};
                customGroupings.forEach(g => {
                    groupTotals[g.name] = { total: 0, subCats: {} };
                    years.forEach(y => groupTotals[g.name][y] = 0);
                });
                groupTotals['Altro / Non Assegnato'] = { total: 0, subCats: {} };
                years.forEach(y => groupTotals['Altro / Non Assegnato'][y] = 0);

                filteredData.forEach(item => {
                    const dateObj = new Date(item.date);
                    const y = isNaN(dateObj) ? 'N/A' : dateObj.getFullYear();
                    if (y === 'N/A') return;

                    const matchedGroup = customGroupings.find(g => {
                        const matchType = g.filters.types && g.filters.types.includes(item.type);
                        const matchCat = g.filters.categories && g.filters.categories.includes(item.category);
                        const matchDesc = g.filters.descriptions && item.description && g.filters.descriptions.includes(item.description);
                        return matchType || matchCat || matchDesc;
                    });
                    const key = matchedGroup ? matchedGroup.name : 'Altro / Non Assegnato';

                    if (!groupTotals[key]) {
                        groupTotals[key] = { total: 0, subCats: {} };
                        years.forEach(y => groupTotals[key][y] = 0);
                    }

                    if (groupTotals[key][y] === undefined) groupTotals[key][y] = 0;
                    groupTotals[key][y] += item.amount;
                    groupTotals[key].total += item.amount;
                    
                    const catName = item.category || 'Nessuna Categoria';
                    if (!groupTotals[key].subCats[catName]) {
                        groupTotals[key].subCats[catName] = { total: 0, itemsByDesc: {} };
                        years.forEach(y => groupTotals[key].subCats[catName][y] = 0);
                    }
                    groupTotals[key].subCats[catName][y] += item.amount;
                    groupTotals[key].subCats[catName].total += item.amount;

                    const descName = item.description || 'Senza Descrizione';
                    if (!groupTotals[key].subCats[catName].itemsByDesc[descName]) {
                        groupTotals[key].subCats[catName].itemsByDesc[descName] = { total: 0 };
                        years.forEach(y => groupTotals[key].subCats[catName].itemsByDesc[descName][y] = 0);
                    }
                    groupTotals[key].subCats[catName].itemsByDesc[descName][y] += item.amount;
                    groupTotals[key].subCats[catName].itemsByDesc[descName].total += item.amount;
                });

                const ceSchema = [
                    { name: 'CE FATTURATO', type: 'group', sign: 1 },
                    { name: 'CE COSTI VARIABILI', type: 'group', sign: -1 },
                    { name: 'VALORE AGGIUNTO (A-B)', type: 'calc', fields: ['CE FATTURATO', 'CE COSTI VARIABILI'] },
                    { name: 'CE SALARI E STIPENDI', type: 'group', sign: -1 },
                    { name: 'EBITDA', type: 'calc', fields: ['VALORE AGGIUNTO (A-B)', 'CE SALARI E STIPENDI'] },
                    { name: 'CE AMMORTAMENTI E ACCANTONAMENTI', type: 'group', sign: -1 },
                    { name: 'EBIT', type: 'calc', fields: ['EBITDA', 'CE AMMORTAMENTI E ACCANTONAMENTI'] },
                    { name: 'CE GESTIONE FINANZIARIA', type: 'group', sign: -1 },
                    { name: 'EBIT - RISULTATO ANTE IMPOSTE', type: 'calc', fields: ['EBIT', 'CE GESTIONE FINANZIARIA'] },
                    { name: 'CE GESTIONE FISCALE', type: 'group', sign: -1 },
                    { name: 'UTILE E PERDITA DI ESERCIZIO', type: 'calc', fields: ['EBIT - RISULTATO ANTE IMPOSTE', 'CE GESTIONE FISCALE'] }
                ];

                ceSchema.filter(s => s.type === 'calc').forEach(calcDef => {
                    groupTotals[calcDef.name] = { total: 0, subCats: {} };
                    years.forEach(y => groupTotals[calcDef.name][y] = 0);
                    
                    years.forEach(y => {
                        const baseTerm = calcDef.fields[0];
                        const modTerm = calcDef.fields[1];
                        
                        const getValWithSign = (term) => {
                            const schemaNameClean = term.replace(/^CE\s+/i, '').trim();
                            const schemaDef = ceSchema.find(s => s.name.replace(/^CE\s+/i, '').trim() === schemaNameClean);
                            
                            // Try to find the term exactly, or with/without CE
                            let rawVal = 0;
                            if (groupTotals[term] && groupTotals[term][y] !== undefined) {
                                rawVal = groupTotals[term][y];
                            } else {
                                // Fallback: look for the term without 'CE ' or with 'CE ' 
                                const fallbackKey = Object.keys(groupTotals).find(k => k.replace(/^CE\s+/i, '').trim() === schemaNameClean);
                                if (fallbackKey && groupTotals[fallbackKey] && groupTotals[fallbackKey][y] !== undefined) {
                                    rawVal = groupTotals[fallbackKey][y];
                                }
                            }

                            if (schemaDef && schemaDef.type === 'group' && schemaDef.sign === -1) {
                                return -rawVal;
                            }
                            return rawVal; 
                        };
                        
                        const val = (groupTotals[baseTerm] ? groupTotals[baseTerm][y] || 0 : 0) + getValWithSign(modTerm);
                        groupTotals[calcDef.name][y] = val;
                        groupTotals[calcDef.name].total += val;
                    });
                });

                const renderedGroups = new Set();
                
                ceSchema.forEach(rowDef => {
                    const isCalc = rowDef.type === 'calc';
                    
                    // Allow matching with or without the 'CE' prefix
                    const schemaNameClean = rowDef.name.replace(/^CE\s+/i, '').trim();
                    let actualGroupName = rowDef.name;

                    if (!groupTotals[rowDef.name]) {
                        const fallbackKey = Object.keys(groupTotals).find(k => k.replace(/^CE\s+/i, '').trim() === schemaNameClean);
                        if (fallbackKey && groupTotals[fallbackKey]) {
                            actualGroupName = fallbackKey;
                        }
                    }

                    const d = groupTotals[actualGroupName] || { total: 0, subCats: {} };
                    renderedGroups.add(actualGroupName);

                    const tr = document.createElement('tr');
                    
                    let bgStyle = isCalc ? 'background-color:#fef08a;' : 'background-color:#ffffff;';
                    if (rowDef.name === 'CE COSTI VARIABILI') bgStyle = 'background-color:#e0e7ff; font-weight:bold;';
                    else if (isCalc) bgStyle = 'background-color:#fef08a; font-weight:bold; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;';
                    
                    let toggleBtnHtml = '';
                    if (!isCalc) {
                        toggleBtnHtml = `<button class="ce-expand-btn" data-group="${actualGroupName}" style="background:none; border:none; color:#3b82f6; cursor:pointer; margin-right:5px; font-weight:bold;" title="Espandi Dettagli">⊞</button>`;
                    }
                    
                    let html = `<td data-label="Voce Conto Economico" style="${bgStyle} border: 1px solid #e2e8f0; vertical-align:middle;">${toggleBtnHtml} ${rowDef.name}</td>`;
                    
                    years.forEach(y => {
                        const val = d[y] || 0;
                        let colorStr = isCalc ? '#000000' : '#0f172a';
                        if (val < 0) colorStr = '#dc2626'; // Red for negative logic in Utile
                        if (!isCalc && rowDef.sign === -1 && val > 0) colorStr = '#b91c1c'; // Red for costs
                        
                        html += `<td data-label="Anno ${y}" style="font-family:monospace; text-align: right; ${bgStyle} color:${colorStr}; border: 1px solid #e2e8f0;">${val !== 0 ? formatCurrency(val) : '-'}</td>`;
                    });
                    html += `<td data-label="Totale Complessivo" style="font-family:monospace; font-weight:bold; text-align: right; ${bgStyle} border: 1px solid #e2e8f0;">${formatCurrency(d.total)}</td>`;
                    tr.innerHTML = html;
                    tableBody.appendChild(tr);
                    
                    // Pre-generate sub-rows, initially hidden
                    if (!isCalc && d && d.subCats) {
                        const subCatsSorted = Object.keys(d.subCats).sort((a,b) => d.subCats[b].total - d.subCats[a].total);
                        subCatsSorted.forEach(catName => {
                            const subTr = document.createElement('tr');
                            const safeGroupName = actualGroupName.replace(/[^a-zA-Z0-9-]/g, '');
                            const safeCatName = catName.replace(/[^a-zA-Z0-9-]/g, '');
                            subTr.className = `ce-subrow for-${safeGroupName}`;
                            subTr.style.display = 'none';
                            
                            const hasDescriptions = d.subCats[catName].itemsByDesc && Object.keys(d.subCats[catName].itemsByDesc).length > 0;
                            let subToggleBtnHtml = hasDescriptions 
                                ? `<button class="ce-desc-expand-btn" data-group="${safeGroupName}" data-cat="${safeCatName}" style="background:none; border:none; color:#3b82f6; cursor:pointer; margin-right:5px; font-weight:bold;" title="Espandi Dettagli">⊞</button>` 
                                : '';

                            let subHtml = `<td style="padding-left: 30px; border: 1px solid #e2e8f0; font-size: 0.9em; color:#475569;">${subToggleBtnHtml} ↳ ${catName}</td>`;
                            years.forEach(y => {
                                const sval = d.subCats[catName][y] || 0;
                                let scolorStr = '#475569';
                                if (rowDef.sign === -1 && sval > 0) scolorStr = '#b91c1c';
                                subHtml += `<td style="font-family:monospace; font-size: 0.9em; text-align: right; color:${scolorStr}; border: 1px solid #e2e8f0;">${sval !== 0 ? formatCurrency(sval) : '-'}</td>`;
                            });
                            subHtml += `<td style="font-family:monospace; font-weight:bold; font-size: 0.9em; text-align: right; color:#475569; border: 1px solid #e2e8f0; background:#f8fafc;">${formatCurrency(d.subCats[catName].total)}</td>`;
                            subTr.innerHTML = subHtml;
                            tableBody.appendChild(subTr);
                            
                            // Generate 3rd level description rows
                            if (hasDescriptions) {
                                const descSorted = Object.keys(d.subCats[catName].itemsByDesc).sort((a,b) => d.subCats[catName].itemsByDesc[b].total - d.subCats[catName].itemsByDesc[a].total);
                                descSorted.forEach(descName => {
                                    const descTr = document.createElement('tr');
                                    descTr.className = `ce-descrow for-desc-${safeGroupName}-${safeCatName} under-${safeGroupName}`;
                                    descTr.style.display = 'none';
                                    
                                    let descHtml = `<td style="padding-left: 55px; border: 1px solid #e2e8f0; font-size: 0.85em; color:#64748b; font-style:italic;">• ${descName}</td>`;
                                    years.forEach(y => {
                                        const dval = d.subCats[catName].itemsByDesc[descName][y] || 0;
                                        let dcolorStr = '#64748b';
                                        if (rowDef.sign === -1 && dval > 0) dcolorStr = '#b91c1c';
                                        descHtml += `<td style="font-family:monospace; font-size: 0.85em; text-align: right; color:${dcolorStr}; border: 1px solid #e2e8f0;">${dval !== 0 ? formatCurrency(dval) : '-'}</td>`;
                                    });
                                    descHtml += `<td style="font-family:monospace; font-weight:bold; font-size: 0.85em; text-align: right; color:#64748b; border: 1px solid #e2e8f0; background:#f8fafc;">${formatCurrency(d.subCats[catName].itemsByDesc[descName].total)}</td>`;
                                    descTr.innerHTML = descHtml;
                                    tableBody.appendChild(descTr);
                                });
                            }
                        });
                    }
                });

                const remainingGroups = Object.keys(groupTotals).filter(k => !renderedGroups.has(k) && groupTotals[k].total !== 0 && k !== 'Altro / Non Assegnato');
                if (remainingGroups.length > 0) {
                    const trEmpty = document.createElement('tr');
                    trEmpty.innerHTML = `<td colspan="${years.length + 2}" style="background:#f1f5f9; font-weight:bold; text-align:center; padding-top: 20px; border-bottom: 2px solid #cbd5e1;">Altre Causali (Non incluse nello schema base)</td>`;
                    tableBody.appendChild(trEmpty);
                    
                    remainingGroups.forEach(k => {
                        const d = groupTotals[k];
                        const tr = document.createElement('tr');
                        let toggleBtnHtml = `<button class="ce-expand-btn" data-group="${k}" style="background:none; border:none; color:#3b82f6; cursor:pointer; margin-right:5px; font-weight:bold;" title="Espandi Dettagli">⊞</button>`;
                        let html = `<td data-label="Voce Conto Economico" style="border: 1px solid #e2e8f0;">${toggleBtnHtml} ${k}</td>`;
                        years.forEach(y => {
                            const val = d[y] || 0;
                            html += `<td data-label="Anno ${y}" style="font-family:monospace; text-align: right; color:#64748b; border: 1px solid #e2e8f0;">${val !== 0 ? formatCurrency(val) : '-'}</td>`;
                        });
                        html += `<td data-label="Totale Complessivo" style="font-family:monospace; font-weight:bold; text-align: right; background:#f8fafc; border: 1px solid #e2e8f0;">${formatCurrency(d.total)}</td>`;
                        tr.innerHTML = html;
                        tableBody.appendChild(tr);
                        
                        // Subrows for other specific groups
                        if (d.subCats) {
                            const subCatsSorted = Object.keys(d.subCats).sort((a,b) => d.subCats[b].total - d.subCats[a].total);
                            subCatsSorted.forEach(catName => {
                                const subTr = document.createElement('tr');
                                const safeGroupName = k.replace(/[^a-zA-Z0-9-]/g, '');
                                const safeCatName = catName.replace(/[^a-zA-Z0-9-]/g, '');
                                subTr.className = `ce-subrow for-${safeGroupName}`;
                                subTr.style.display = 'none';
                                
                                const hasDescriptions = d.subCats[catName].itemsByDesc && Object.keys(d.subCats[catName].itemsByDesc).length > 0;
                                let subToggleBtnHtml = hasDescriptions 
                                    ? `<button class="ce-desc-expand-btn" data-group="${safeGroupName}" data-cat="${safeCatName}" style="background:none; border:none; color:#3b82f6; cursor:pointer; margin-right:5px; font-weight:bold;" title="Espandi Dettagli">⊞</button>` 
                                    : '';

                                let subHtml = `<td style="padding-left: 30px; border: 1px solid #e2e8f0; font-size: 0.9em; color:#475569;">${subToggleBtnHtml} ↳ ${catName}</td>`;
                                years.forEach(y => {
                                    const sval = d.subCats[catName][y] || 0;
                                    subHtml += `<td style="font-family:monospace; font-size: 0.9em; text-align: right; color:#475569; border: 1px solid #e2e8f0;">${sval !== 0 ? formatCurrency(sval) : '-'}</td>`;
                                });
                                subHtml += `<td style="font-family:monospace; font-weight:bold; font-size: 0.9em; text-align: right; color:#475569; border: 1px solid #e2e8f0; background:#f8fafc;">${formatCurrency(d.subCats[catName].total)}</td>`;
                                subTr.innerHTML = subHtml;
                                tableBody.appendChild(subTr);

                                if (hasDescriptions) {
                                    const descSorted = Object.keys(d.subCats[catName].itemsByDesc).sort((a,b) => d.subCats[catName].itemsByDesc[b].total - d.subCats[catName].itemsByDesc[a].total);
                                    descSorted.forEach(descName => {
                                        const descTr = document.createElement('tr');
                                        descTr.className = `ce-descrow for-desc-${safeGroupName}-${safeCatName} under-${safeGroupName}`;
                                        descTr.style.display = 'none';
                                        
                                        let descHtml = `<td style="padding-left: 55px; border: 1px solid #e2e8f0; font-size: 0.85em; color:#64748b; font-style:italic;">• ${descName}</td>`;
                                        years.forEach(y => {
                                            const dval = d.subCats[catName].itemsByDesc[descName][y] || 0;
                                            descHtml += `<td style="font-family:monospace; font-size: 0.85em; text-align: right; color:#64748b; border: 1px solid #e2e8f0;">${dval !== 0 ? formatCurrency(dval) : '-'}</td>`;
                                        });
                                        descHtml += `<td style="font-family:monospace; font-weight:bold; font-size: 0.85em; text-align: right; color:#64748b; border: 1px solid #e2e8f0; background:#f8fafc;">${formatCurrency(d.subCats[catName].itemsByDesc[descName].total)}</td>`;
                                        descTr.innerHTML = descHtml;
                                        tableBody.appendChild(descTr);
                                    });
                                }
                            });
                        }
                    });
                }
                
                // Add interactivity for expand/collapse CE rows
                document.querySelectorAll('.ce-expand-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const targetGroup = e.target.getAttribute('data-group');
                        const sanitizedGroup = targetGroup.replace(/[^a-zA-Z0-9-]/g, '');
                        const subRows = document.querySelectorAll(`.for-${sanitizedGroup}`);
                        const descRows = document.querySelectorAll(`.under-${sanitizedGroup}`);
                        const isExpanded = e.target.textContent === '⊟';
                        
                        if (isExpanded) {
                            e.target.textContent = '⊞';
                            subRows.forEach(row => row.style.display = 'none');
                            descRows.forEach(row => row.style.display = 'none');
                            // Reset 3rd level buttons
                            document.querySelectorAll(`.ce-desc-expand-btn[data-group="${sanitizedGroup}"]`).forEach(b => b.textContent = '⊞');
                        } else {
                            e.target.textContent = '⊟';
                            subRows.forEach(row => row.style.display = 'table-row');
                        }
                    });
                });

                // Add toggle for 3rd level
                document.querySelectorAll('.ce-desc-expand-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const targetGroup = e.target.getAttribute('data-group');
                        const targetCat = e.target.getAttribute('data-cat');
                        const descRows = document.querySelectorAll(`.for-desc-${targetGroup}-${targetCat}`);
                        const isExpanded = e.target.textContent === '⊟';
                        
                        if (isExpanded) {
                            e.target.textContent = '⊞';
                            descRows.forEach(row => row.style.display = 'none');
                        } else {
                            e.target.textContent = '⊟';
                            descRows.forEach(row => row.style.display = 'table-row');
                        }
                    });
                });

                return; // Early return for pivot
            }

            let firstHeaderAttr = '';
            if (groupBy === 'year') firstHeaderAttr = 'class="interactive-header" data-filter-type="year"';
            else if (groupBy === 'month') firstHeaderAttr = 'class="interactive-header" data-filter-type="month"';
            else if (groupBy === 'quarter') firstHeaderAttr = 'class="interactive-header" data-filter-type="quarter"';
            else if (groupBy === 'category') firstHeaderAttr = 'class="interactive-header" data-filter-type="category"';
            else if (groupBy === 'type') firstHeaderAttr = 'class="interactive-header" data-filter-type="type"';
            else if (groupBy === 'description') firstHeaderAttr = 'class="interactive-header" data-filter-type="description"';
            else if (groupBy === 'custom_group') firstHeaderAttr = 'class="interactive-header"';

            const getGroupByLabel = (gb) => {
                const labels = {
                    'year': 'Anno',
                    'quarter': 'Trimestre',
                    'month': 'Mese',
                    'week': 'Settimana',
                    'day': 'Giorno',
                    'category': 'Categoria',
                    'type': 'Tipo',
                    'description': 'Descrizione',
                    'custom_group': 'Raggruppamento Personalizzato'
                };
                return labels[gb] || 'Gruppo';
            };

            tableHeadRow.innerHTML = `
                <th ${firstHeaderAttr}>${getGroupByLabel(groupBy)}</th>
                <th class="interactive-header" data-filter-type="category" data-type="REVENUE_EUBIOS,REVENUE">Ricavi Eubios</th>
                <th class="interactive-header" data-filter-type="category" data-type="COSTS_EUBIOS">Costi Eubios</th>
                <th class="interactive-header" data-filter-type="category" data-type="REVENUE_EUBIOTECH">Ricavi Eubiotech</th>
                <th class="interactive-header" data-filter-type="category" data-type="Costi risorse umane,COGS_TECH,COGS">Costi risorse umane</th>
                <th class="interactive-header" data-filter-type="category" data-type="Costi altri,OPEX_TECH,OPEX">Costi altri</th>
                <th>Utile Eubios</th>
                <th>Utile Eubiotech</th>
            `;

            // Bind interactive headers
            document.querySelectorAll('#data-table th.interactive-header').forEach(th => {
                th.addEventListener('click', (e) => {
                    openPopoverForHeader(th);
                });
            });

            if(filteredData.length === 0) {
                 tableBody.innerHTML = '<tr><td colspan="8" class="empty-state">Nessun dato corrisponde ai filtri selezionati.</td></tr>';
                 return;
            }

            const groupedData = {};

            filteredData.forEach(item => {
                let key = 'Sconosciuto';
                let dateObj = new Date(item.date);
                let validDate = !isNaN(dateObj);

                if (groupBy === 'year' && validDate) {
                    key = dateObj.getFullYear();
                } else if (groupBy === 'month' && validDate) {
                    const months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
                    key = `${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
                } else if (groupBy === 'quarter' && validDate) {
                    const q = Math.ceil((dateObj.getMonth() + 1) / 3);
                    key = `Q${q} ${dateObj.getFullYear()}`;
                } else if (groupBy === 'week' && validDate) {
                    const target = new Date(dateObj.valueOf());
                    const dayNr = (dateObj.getDay() + 6) % 7;
                    target.setDate(target.getDate() - dayNr + 3);
                    const firstThursday = target.valueOf();
                    target.setMonth(0, 1);
                    if (target.getDay() !== 4) {
                        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
                    }
                    const weekNum = 1 + Math.ceil((firstThursday - target) / 604800000);
                    key = `Settiman. ${weekNum.toString().padStart(2, '0')} - ${dateObj.getFullYear()}`;
                } else if (groupBy === 'day' && validDate) {
                    const d = dateObj.getDate().toString().padStart(2, '0');
                    const m = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                    key = `${d}/${m}/${dateObj.getFullYear()}`;
                } else if (groupBy === 'type') {
                    const typeLabels = {
                        'REVENUE_EUBIOS': 'RICAVI EUBIOS',
                        'COSTS_EUBIOS': 'COSTI EUBIOS',
                        'REVENUE_EUBIOTECH': 'RICAVI EUBIOTECH',
                        'Costi risorse umane': 'COSTI RISORSE UMANE (EUBIOTECH)', 'COGS_TECH': 'COSTI PERSONALE EUBIOTECH (Legacy)',
                        'Costi altri': 'COSTI ALTRI (EUBIOTECH)', 'OPEX_TECH': 'ALTRI COSTI EUBIOTECH (Legacy)',
                        'REVENUE': 'RICAVI EUBIOS (Legacy)',
                        'COGS': 'COSTI EUBIOS (Legacy)',
                        'OPEX': 'ALTRI COSTI (Legacy)'
                    };
                    key = typeLabels[item.type] || item.type;
                } else if (groupBy === 'category') {
                    key = item.category || 'Generico';
                } else if (groupBy === 'description') {
                    key = item.description || 'Nessuna Descrizione';
                } else if (groupBy === 'custom_group') {
                    // Find the first custom group that this item matches
                    const matchedGroup = customGroupings.find(g => {
                        const matchType = g.filters.types && g.filters.types.includes(item.type);
                        const matchCat = g.filters.categories && g.filters.categories.includes(item.category);
                        const matchDesc = g.filters.descriptions && item.description && g.filters.descriptions.includes(item.description);
                        
                        // It's a match if ANY of the criteria match the record
                        return matchType || matchCat || matchDesc;
                    });
                    key = matchedGroup ? matchedGroup.name : 'Altro / Non Assegnato';
                }

                if (!groupedData[key]) {
                    groupedData[key] = { revEubios: 0, costsEubios: 0, revTech: 0, cogsTech: 0, opexTech: 0, 
                        sortKey: (groupBy === 'month' || groupBy === 'quarter' || groupBy === 'week' || groupBy === 'day') ? dateObj.getTime() : key 
                    };
                }

                if (item.type === 'REVENUE_EUBIOS' || item.type === 'REVENUE') groupedData[key].revEubios += item.amount;
                else if (item.type === 'COSTS_EUBIOS') groupedData[key].costsEubios += item.amount;
                else if (item.type === 'REVENUE_EUBIOTECH') {
                    groupedData[key].revTech += item.amount;
                    groupedData[key].costsEubios += item.amount; // Aggiunge i Ricavi Eubiotech ai Costi Eubios
                }
                else if (isItemInCustomGroup(item, 'Costi risorse umane') || isItemInCustomGroup(item, 'Risorse umane') || item.type === 'Costi risorse umane' || item.type === 'COGS_TECH' || item.type === 'COGS') groupedData[key].cogsTech += item.amount;
                else if (isItemInCustomGroup(item, 'Costi altri') || isItemInCustomGroup(item, 'Altri costi') || item.type === 'Costi altri' || item.type === 'OPEX_TECH' || item.type === 'OPEX' || item.type === 'ALTRI COSTI EUBIOTECH') groupedData[key].opexTech += item.amount;
            });

            // Sort grouped keys
            const sortedKeys = Object.keys(groupedData).sort((a, b) => {
                const ga = groupedData[a];
                const gb = groupedData[b];
                
                // Compare by sortKey (time) or alphabetically
                if(typeof ga.sortKey === 'number' && typeof gb.sortKey === 'number') {
                    // Ascending time (older to newer) for month/quarter
                    return ga.sortKey - gb.sortKey; 
                }
                
                // For strings, e.g. Year or Category, sort alphabetically
                if (a < b) return -1;
                if (a > b) return 1;
                return 0;
            });

            sortedKeys.forEach(k => {
                const data = groupedData[k];
                const profitEubios = data.revEubios - data.costsEubios;
                const profitTech = data.revTech - (data.cogsTech + data.opexTech);
                const tr = document.createElement('tr');
                
                const formatPctTable = (val, base) => {
                    if (!base || base === 0 || val === base) return "";
                    return `<span style="font-size: 0.75em; opacity: 0.7; margin-left: 4px;">(${((val / base) * 100).toFixed(1)}%)</span>`;
                };

                let firstCellContent = `<a href="javascript:void(0)" class="drilldown-link" data-group-type="${groupBy}" data-group-key="${k.replace(/"/g, '&quot;')}" style="color: #3b82f6; text-decoration: none;"><strong>${k}</strong></a>`;
                let revEubiosCellContent = formatCurrency(data.revEubios);
                let revTechCellContent = formatCurrency(data.revTech);
                let cogsTechCellContent = formatCurrency(data.cogsTech) + formatPctTable(data.cogsTech, data.revTech);
                let opexTechCellContent = formatCurrency(data.opexTech) + formatPctTable(data.opexTech, data.revTech);
                let costsEubiosCellContent = formatCurrency(data.costsEubios) + formatPctTable(data.costsEubios, data.revEubios);
                let profitEubiosCellContent = formatCurrency(profitEubios) + formatPctTable(profitEubios, data.revEubios);
                let profitTechCellContent = formatCurrency(profitTech) + formatPctTable(profitTech, data.revTech);
                
                // Add expand buttons if grouped by year
                if (groupBy === 'year') {
                    firstCellContent = `
                        <div style="display: flex; align-items: center;">
                            <button class="row-expand-btn btn-q" data-year="${k}">Q</button>
                            <button class="row-expand-btn btn-m" data-year="${k}">M</button>
                            <span style="margin-left: 8px;"><a href="javascript:void(0)" class="drilldown-link" data-group-type="${groupBy}" data-group-key="${k.replace(/"/g, '&quot;')}" style="color: #3b82f6; text-decoration: none;"><strong>${k}</strong></a></span>
                        </div>
                    `;
                    tr.classList.add('year-row');
                    tr.setAttribute('data-year', k);
                    
                    if (data.revEubios > 0 || data.revEubios < 0) {
                        revEubiosCellContent = `
                            <div style="display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 4px;">
                                <span>${formatCurrency(data.revEubios)}</span>
                                <button class="row-expand-btn btn-detail" data-year="${k}" data-type="REVENUE_EUBIOS" style="margin-left: 0; margin-right: 0;" title="Dettaglio Nominativi">Dettaglio</button>
                            </div>
                        `;
                    }
                    if (data.revTech > 0 || data.revTech < 0) {
                        revTechCellContent = `
                            <div style="display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 4px;">
                                <span>${formatCurrency(data.revTech)}</span>
                                <button class="row-expand-btn btn-detail" data-year="${k}" data-type="REVENUE_EUBIOTECH" style="margin-left: 0; margin-right: 0;" title="Dettaglio Nominativi">Dettaglio</button>
                            </div>
                        `;
                    }
                    if (data.costsEubios > 0 || data.costsEubios < 0) {
                        costsEubiosCellContent = `
                            <div style="display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 4px;">
                                <span>${formatCurrency(data.costsEubios)} ${formatPctTable(data.costsEubios, data.revEubios)}</span>
                                <button class="row-expand-btn btn-detail" data-year="${k}" data-type="COSTS_EUBIOS" style="margin-left: 0; margin-right: 0;" title="Dettaglio Voci">Dettaglio</button>
                            </div>
                        `;
                    }
                    if (data.cogsTech > 0 || data.cogsTech < 0) {
                        cogsTechCellContent = `
                            <div style="display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 4px;">
                                <span>${formatCurrency(data.cogsTech)} ${formatPctTable(data.cogsTech, data.revTech)}</span>
                                <button class="row-expand-btn btn-detail" data-year="${k}" data-type="Costi risorse umane|COGS_TECH|COGS" style="margin-left: 0; margin-right: 0;" title="Dettaglio Nominativi">Dettaglio</button>
                            </div>
                        `;
                    }
                    if (data.opexTech > 0 || data.opexTech < 0) {
                        opexTechCellContent = `
                            <div style="display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 4px;">
                                <span>${formatCurrency(data.opexTech)} ${formatPctTable(data.opexTech, data.revTech)}</span>
                                <button class="row-expand-btn btn-detail" data-year="${k}" data-type="Costi altri|OPEX_TECH|OPEX" style="margin-left: 0; margin-right: 0;" title="Dettaglio Nominativi">Dettaglio</button>
                            </div>
                        `;
                    }
                }

                tr.innerHTML = `
                    <td data-label="${getGroupByLabel(groupBy)}">${firstCellContent}</td>
                    <td data-label="Ricavi Eubios" style="color:#10b981; font-family:monospace;">${revEubiosCellContent}</td>
                    <td data-label="Costi Eubios" style="color:#f43f5e; font-family:monospace;">${costsEubiosCellContent}</td>
                    <td data-label="Ricavi Eubiotech" style="color:#059669; font-family:monospace;">${revTechCellContent}</td>
                    <td data-label="Costi risorse umane" style="color:#f59e0b; font-family:monospace;">${cogsTechCellContent}</td>
                    <td data-label="Costi altri" style="color:#f43f5e; font-family:monospace;">${opexTechCellContent}</td>
                    <td data-label="Utile Eubios" style="color:#3b82f6; font-family:monospace; font-weight:bold;">${profitEubiosCellContent}</td>
                    <td data-label="Utile Eubiotech" style="color:#8b5cf6; font-family:monospace; font-weight:bold;">${profitTechCellContent}</td>
                `;
                tableBody.appendChild(tr);
            });

            // Bind expand buttons
            if (groupBy === 'year') {
                document.querySelectorAll('.btn-q').forEach(btn => {
                    btn.addEventListener('click', (e) => toggleSubRows(e.target, 'quarter', filteredData));
                });
                document.querySelectorAll('.btn-m').forEach(btn => {
                    btn.addEventListener('click', (e) => toggleSubRows(e.target, 'month', filteredData));
                });
                document.querySelectorAll('.btn-detail').forEach(btn => {
                    btn.addEventListener('click', (e) => toggleCategoryDetails(e.target, filteredData));
                });
            }
        }
    }

    function toggleSubRows(btn, expandType, allFilteredData) {
        const year = parseInt(btn.getAttribute('data-year'));
        const parentRow = btn.closest('tr');
        const isActive = btn.classList.contains('active');
        
        // Remove ANY existing sub-rows for this year (either quarters or months)
        document.querySelectorAll(`.sub-row[data-parent-year="${year}"]`).forEach(el => el.remove());
        
        // Reset both buttons
        parentRow.querySelector('.btn-q').classList.remove('active');
        parentRow.querySelector('.btn-m').classList.remove('active');

        if (isActive) {
            // It was active, we just collapsed it. Do nothing else.
            return;
        }

        // It was not active, expand it
        btn.classList.add('active');

        // Filter data for this specific year
        const yearData = allFilteredData.filter(item => {
            try {
                const d = new Date(item.date);
                return !isNaN(d) && d.getFullYear() === year;
            } catch(e) { return false; }
        });

        const subGroups = {};

        yearData.forEach(item => {
            const dateObj = new Date(item.date);
            let subKey = '';
            let sortOrder = 0;

            if (expandType === 'quarter') {
                const q = Math.ceil((dateObj.getMonth() + 1) / 3);
                subKey = `Q${q}`;
                sortOrder = q;
            } else if (expandType === 'month') {
                const monthsNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
                subKey = monthsNames[dateObj.getMonth()];
                sortOrder = dateObj.getMonth();
            }

            if (!subGroups[subKey]) {
                subGroups[subKey] = { revEubios: 0, costsEubios: 0, revTech: 0, cogsTech: 0, opexTech: 0, sortOrder: sortOrder };
            }

            if (item.type === 'REVENUE_EUBIOS' || item.type === 'REVENUE') subGroups[subKey].revEubios += item.amount;
            else if (item.type === 'COSTS_EUBIOS') subGroups[subKey].costsEubios += item.amount;
            else if (item.type === 'REVENUE_EUBIOTECH') subGroups[subKey].revTech += item.amount;
            else if (item.type === 'COGS_TECH' || item.type === 'COGS') subGroups[subKey].cogsTech += item.amount;
            else if (item.type === 'OPEX_TECH' || item.type === 'OPEX') subGroups[subKey].opexTech += item.amount;
        });

        // Generate missing empty periods so Q1-Q4 or Gen-Dic always show
        if (expandType === 'quarter') {
            [1, 2, 3, 4].forEach(q => {
                const mk = `Q${q}`;
                if (!subGroups[mk]) subGroups[mk] = { revEubios: 0, costsEubios: 0, revTech: 0, cogsTech: 0, opexTech: 0, sortOrder: q };
            });
        } else if (expandType === 'month') {
            const monthsNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
            // Only generate months that are currently checked in the global filter to prevent confusion
            // Or generate all 12. Let's filter to only generate if it's within filterState.months
            monthsNames.forEach((name, i) => {
                 if (filterState.months.has(i + 1)) {
                     if (!subGroups[name]) subGroups[name] = { revEubios: 0, costsEubios: 0, revTech: 0, cogsTech: 0, opexTech: 0, sortOrder: i };
                 } else {
                     // If we had data for it but it's filtered out globally, yearData wouldn't have it anyway.
                     // But we shouldn't show the empty row if it's filtered out.
                     delete subGroups[name];
                 }
            });
        }

        const formatCurrency = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);

        const subKeys = Object.keys(subGroups).sort((a,b) => subGroups[a].sortOrder - subGroups[b].sortOrder);
        
        // Insert subrows after parentRow in reverse order so they stack correctly below it
        for (let i = subKeys.length - 1; i >= 0; i--) {
             const k = subKeys[i];
             const data = subGroups[k];
             const profitEubios = data.revEubios - data.costsEubios;
             const profitTech = data.revTech - (data.cogsTech + data.opexTech);
             const tr = document.createElement('tr');
             tr.classList.add('sub-row');
             tr.setAttribute('data-parent-year', year);
             
             const formatPctTable = (val, base) => {
                 if (!base || base === 0 || val === base) return "";
                 return `<span style="font-size: 0.75em; opacity: 0.7; margin-left: 4px;">(${((val / base) * 100).toFixed(1)}%)</span>`;
             };
             
             tr.innerHTML = `
                 <td data-label="Periodo">↳ ${k}</td>
                 <td data-label="Ricavi Eubios" style="color:#10b981; font-family:monospace;">${formatCurrency(data.revEubios)}</td>
                 <td data-label="Costi Eubios" style="color:#f43f5e; font-family:monospace;">${formatCurrency(data.costsEubios)} ${formatPctTable(data.costsEubios, data.revEubios)}</td>
                 <td data-label="Ricavi Eubiotech" style="color:#059669; font-family:monospace;">${formatCurrency(data.revTech)}</td>
                 <td data-label="Costi personale Eubiotech" style="color:#f59e0b; font-family:monospace;">${formatCurrency(data.cogsTech)} ${formatPctTable(data.cogsTech, data.revTech)}</td>
                 <td data-label="Costi altri Eubiotech" style="color:#f43f5e; font-family:monospace;">${formatCurrency(data.opexTech)} ${formatPctTable(data.opexTech, data.revTech)}</td>
                 <td data-label="Utile Eubios" style="color:#3b82f6; font-family:monospace;">${formatCurrency(profitEubios)} ${formatPctTable(profitEubios, data.revEubios)}</td>
                 <td data-label="Utile Eubiotech" style="color:#8b5cf6; font-family:monospace;">${formatCurrency(profitTech)} ${formatPctTable(profitTech, data.revTech)}</td>
             `;
             parentRow.after(tr);
        }
    }

    function toggleCategoryDetails(btn, allFilteredData) {
        const qualificaPersonale = {
            "CATERINA": "AMMINISTRATORE",
            "FRANCESCO ECO": "AMMINISTRATIVO",
            "FRANCESCO": "AMMINISTRATORE", // defined after Francesco Eco so it doesn't substring match incorrectly
            "ASSUNTA": "COMMERCIALE",
            "GIANLUCA": "TECNICO ESTERNO",
            "SABATINO": "TECNICO ESTERNO",
            "MAURIZIO": "TECNICO ESTERNO",
            "MANUELA": "COMMERCIALE",
            "AMMINISTRAZIONE": "AMMINISTRATIVO",
            "GIOVANNI": "COMMERCIALE",
            "LUCA": "TECNICO INTERNO",
            "TONINO": "TECNICO INTERNO"
        };
        const year = parseInt(btn.getAttribute('data-year'));
        const docType = btn.getAttribute('data-type');
        const parentRow = btn.closest('tr');
        const isActive = btn.classList.contains('active');
        
        // Remove ANY existing sub-rows for this year
        // We might want to allow multiple details to be open simultaneously,
        // but it's cleaner to just show one at a time per year to avoid clutter
        document.querySelectorAll(`.sub-row[data-parent-year="${year}"]`).forEach(el => el.remove());
        
        // Reset all buttons in this row
        parentRow.querySelectorAll('.row-expand-btn').forEach(b => b.classList.remove('active'));

        if (isActive) {
            return; // Just collapsed
        }

        btn.classList.add('active');

        // Filter data for this specific year and type
        const yearData = allFilteredData.filter(item => {
            try {
                const d = new Date(item.date);
                if (isNaN(d) || d.getFullYear() !== year) return false;
                
                if (docType.includes('Costi risorse umane') || docType.includes('COGS_TECH') || docType.includes('COGS')) {
                    return isItemInCustomGroup(item, 'Costi risorse umane') || isItemInCustomGroup(item, 'Risorse umane') || item.type === 'Costi risorse umane' || item.type === 'COGS_TECH' || item.type === 'COGS';
                }
                if (docType.includes('Costi altri') || docType.includes('OPEX_TECH') || docType.includes('OPEX')) {
                    return isItemInCustomGroup(item, 'Costi altri') || isItemInCustomGroup(item, 'Altri costi') || item.type === 'Costi altri' || item.type === 'OPEX_TECH' || item.type === 'OPEX' || item.type === 'ALTRI COSTI EUBIOTECH';
                }
                if (docType === 'REVENUE_EUBIOTECH') return item.type === 'REVENUE_EUBIOTECH';
                if (docType === 'COSTS_EUBIOS') return item.type === 'COSTS_EUBIOS' || item.type === 'REVENUE_EUBIOTECH';
                if (docType === 'REVENUE_EUBIOS') return item.type === 'REVENUE_EUBIOS' || item.type === 'REVENUE';
                
                return false;
            } catch(e) { return false; }
        });

        const personGroups = {};
        const qualGroups = {}; // Used to store qualification totals
        
        yearData.forEach(item => {
            let itemName = 'Generico';
            
            if (docType.includes('Costi risorse umane') || docType.includes('COGS')) {
                 itemName = (item.description || item.category || 'Generico').toUpperCase().trim();
                 if (itemName === 'PERSONALE EUBIOTECH' || itemName === 'COSTI PERSONALE EUBIOTECH' || itemName === 'SALARI E STIPENDI' || itemName.includes('SALARI E STIPENDI')) itemName = 'GENERICO';
            } else {
                 itemName = (item.category || item.description || 'Generico').toUpperCase().trim();
            }
            
            if (!personGroups[itemName]) {
                personGroups[itemName] = { 
                    total: 0,
                    Q1: 0, Q2: 0, Q3: 0, Q4: 0,
                    ids: []
                };
            }
            
            let qual = "ALTRO/NON DEFINITO";
            if (docType.includes('Costi risorse umane') || docType.includes('COGS')) {
                for (const [key, val] of Object.entries(qualificaPersonale)) {
                    if (itemName.includes(key)) {
                        qual = val;
                        break;
                    }
                }
                if (!qualGroups[qual]) {
                    qualGroups[qual] = { total: 0, Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
                }
            }
            
            const dateObj = new Date(item.date);
            const m = dateObj.getMonth() + 1; // 1-12
            const q = Math.ceil(m / 3); // 1-4
            
            personGroups[itemName].total += item.amount;
            personGroups[itemName][`Q${q}`] += item.amount;
            if (item.id) personGroups[itemName].ids.push(item.id);
            
            if (docType.includes('Costi risorse umane') || docType.includes('COGS')) {
                qualGroups[qual].total += item.amount;
                qualGroups[qual][`Q${q}`] += item.amount;
            }
        });

        const formatCurrency = (val) => val === 0 ? '-' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);

        const itemNames = Object.keys(personGroups).sort((a,b) => personGroups[b].total - personGroups[a].total);

        const tr = document.createElement('tr');
        tr.classList.add('sub-row');
        tr.setAttribute('data-parent-year', year);
        
        let headerColor = '#ea580c';
        let bgLine = '#ffedd5';
        let borderColor = '#fed7aa';
        let valColor = '#d97706';
        let titlePrefix = 'Dettaglio Nominativi Costo Personale';
        
        if (docType.includes('Costi altri') || docType.includes('OPEX')) {
            headerColor = '#b91c1c';
            bgLine = '#fee2e2';
            borderColor = '#fecaca';
            valColor = '#dc2626';
            titlePrefix = 'Dettaglio Costi Altri Eubiotech';
        } else if (docType === 'REVENUE_EUBIOS') {
            headerColor = '#047857';
            bgLine = '#d1fae5';
            borderColor = '#a7f3d0';
            valColor = '#059669';
            titlePrefix = 'Dettaglio Ricavi Eubios';
        } else if (docType === 'REVENUE_EUBIOTECH') {
            headerColor = '#15803d';
            bgLine = '#dcfce7';
            borderColor = '#bbf7d0';
            valColor = '#16a34a';
            titlePrefix = 'Dettaglio Ricavi Eubiotech';
        } else if (docType === 'COSTS_EUBIOS') {
            headerColor = '#be123c';
            bgLine = '#ffe4e6';
            borderColor = '#fecdd3';
            valColor = '#e11d48';
            titlePrefix = 'Dettaglio Costi Eubios';
        }

        let miniTableHTML = `
            <td class="detail-container-td" colspan="8" style="padding: 1rem 2rem; background: #f8fafc; border-top: 2px dashed ${borderColor};">
                <h4 class="detail-container-title" style="margin-top: 0; margin-bottom: 0.5rem; color: ${headerColor}; display: flex; justify-content: space-between;">
                    ${titlePrefix} ${year}
                </h4>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid ${borderColor}; font-size: 0.9em;">
                        <thead>
                            <tr style="background: ${bgLine}; border-bottom: 1px solid ${borderColor}; color: ${headerColor};">
                                <th style="padding: 6px 10px; text-align: left;">Voce / Nominativo</th>
                                ${docType.includes('Costi risorse umane') || docType.includes('COGS') ? `<th style="padding: 6px 10px; text-align: left;">Qualifica</th>` : ''}
                                <th style="padding: 6px 10px; text-align: right;">Totale Anno</th>
                                <th style="padding: 6px 10px; text-align: right; border-left: 1px solid ${borderColor};">Q1</th>
                                <th style="padding: 6px 10px; text-align: right;">Q2</th>
                                <th style="padding: 6px 10px; text-align: right;">Q3</th>
                                <th style="padding: 6px 10px; text-align: right;">Q4</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        if (itemNames.length === 0) {
            miniTableHTML += `<tr><td colspan="${docType.includes('Costi risorse umane') || docType.includes('COGS') ? '7' : '6'}" style="padding: 10px; text-align: center; color: #9ca3af;">Nessun dettaglio trovato.</td></tr>`;
        } else {
            itemNames.forEach(name => {
                const d = personGroups[name];
                let rowBgColor = (docType === 'REVENUE_EUBIOTECH' || docType === 'REVENUE_EUBIOS') ? '#f0fdf4' : (docType.includes('Costi altri') || docType.includes('OPEX') ? '#fef2f2' : (docType === 'COSTS_EUBIOS' ? '#fff1f2' : '#fffbeb'));
                let rowBorderColor = (docType === 'REVENUE_EUBIOTECH' || docType === 'REVENUE_EUBIOS') ? '#bbf7d0' : (docType.includes('Costi altri') || docType.includes('OPEX') ? '#fecaca' : (docType === 'COSTS_EUBIOS' ? '#fecdd3' : '#fef3c7'));
                
                let qualifica = "-";
                if (docType.includes('Costi risorse umane') || docType.includes('COGS')) {
                    for (const [key, val] of Object.entries(qualificaPersonale)) {
                        if (name.includes(key)) {
                            qualifica = val;
                            break;
                        }
                    }
                }
                
                // If there's only one underlying record, attach it. If multiple, comma string.
                const idsString = d.ids.join(',');
                
                miniTableHTML += `
                    <tr class="inner-summary-row" data-ids="${idsString}" style="border-bottom: 1px solid ${rowBorderColor}; background: ${rowBgColor}; cursor: context-menu;">
                        <td data-label="Voce / Nominativo" style="padding: 6px 10px;"><strong>${name}</strong></td>
                        ${docType.includes('Costi risorse umane') || docType.includes('COGS') ? `<td data-label="Qualifica" style="padding: 6px 10px; color: #64748b; font-size: 0.85em;">${qualifica}</td>` : ''}
                        <td data-label="Totale Anno" style="padding: 6px 10px; text-align: right; color: ${valColor}; font-family: monospace; font-weight: bold;">${formatCurrency(d.total)}</td>
                        <td data-label="Q1" style="padding: 6px 10px; text-align: right; font-family: monospace; border-left: 1px solid ${rowBorderColor};">${formatCurrency(d.Q1)}</td>
                        <td data-label="Q2" style="padding: 6px 10px; text-align: right; font-family: monospace;">${formatCurrency(d.Q2)}</td>
                        <td data-label="Q3" style="padding: 6px 10px; text-align: right; font-family: monospace;">${formatCurrency(d.Q3)}</td>
                        <td data-label="Q4" style="padding: 6px 10px; text-align: right; font-family: monospace;">${formatCurrency(d.Q4)}</td>
                    </tr>
                `;
            });

            // Add Qualification summary row at the bottom
            if (docType.includes('Costi risorse umane') || docType.includes('COGS')) {
                miniTableHTML += `
                    <tr style="background: white;">
                        <td colspan="7" style="padding: 15px 10px 5px 10px;">
                            <h5 style="margin: 0; color: ${headerColor}; font-size: 0.95em;">Riepilogo Costi per Qualifica</h5>
                        </td>
                    </tr>
                `;
                
                const qualNames = Object.keys(qualGroups).sort((a,b) => qualGroups[b].total - qualGroups[a].total);
                qualNames.forEach(q => {
                    const qd = qualGroups[q];
                    miniTableHTML += `
                        <tr style="border-bottom: 1px solid #e5e7eb; background: #f8fafc;">
                            <td data-label="Voce / Nominativo" colspan="${docType.includes('Costi risorse umane') || docType.includes('COGS') ? '2' : '1'}" style="padding: 6px 10px; color: #475569; font-weight: bold; font-size: 0.85em; text-transform: uppercase;">▶ ${q}</td>
                            <td data-label="Totale Anno" style="padding: 6px 10px; text-align: right; color: ${valColor}; font-family: monospace; font-weight: bold;">${formatCurrency(qd.total)}</td>
                            <td data-label="Q1" style="padding: 6px 10px; text-align: right; font-family: monospace; border-left: 1px solid #e5e7eb;">${formatCurrency(qd.Q1)}</td>
                            <td data-label="Q2" style="padding: 6px 10px; text-align: right; font-family: monospace;">${formatCurrency(qd.Q2)}</td>
                            <td data-label="Q3" style="padding: 6px 10px; text-align: right; font-family: monospace;">${formatCurrency(qd.Q3)}</td>
                            <td data-label="Q4" style="padding: 6px 10px; text-align: right; font-family: monospace;">${formatCurrency(qd.Q4)}</td>
                        </tr>
                    `;
                });
            }
        }

        miniTableHTML += `
                        </tbody>
                    </table>
                </div>
            </td>
        `;
        
        tr.innerHTML = miniTableHTML;
        parentRow.after(tr);
    }

    function getGroupByLabel(groupBy) {
        if(groupBy === 'year') return 'Anno';
        if(groupBy === 'month') return 'Mese';
        if(groupBy === 'quarter') return 'Trimestre';
        if(groupBy === 'week') return 'Settimana';
        if(groupBy === 'day') return 'Giorno';
        if(groupBy === 'type') return 'Tipo';
        if(groupBy === 'category') return 'Categoria';
        return 'Raggruppamento';
    }

    // --- FILTER UI GENERATION ---
    function updateActiveFiltersDisplay() {
        const container = document.getElementById('active-filters-list');
        if (!container) return;
        
        container.innerHTML = '';
        let hasFilters = false;

        const createBadge = (text, type, onRemove) => {
            hasFilters = true;
            const badge = document.createElement('span');
            badge.className = `filter-badge filter-badge-${type}`;
            badge.innerHTML = `${text}`;
            if (onRemove) {
                const closeBtn = document.createElement('span');
                closeBtn.className = 'filter-badge-remove';
                closeBtn.innerHTML = '×';
                closeBtn.onclick = onRemove;
                badge.appendChild(closeBtn);
            }
            container.appendChild(badge);
        };

        // Years
        if (filterState.years.size > 0 && filterState.years.size < 20) {
            // Check if not all years are selected
            const allAvailableYears = new Set();
            appData.forEach(i => { try { const d = new Date(i.date); if(!isNaN(d)) allAvailableYears.add(d.getFullYear()); } catch(e){} });
            
            if (filterState.years.size < allAvailableYears.size && allAvailableYears.size > 0) {
                const sortedYears = Array.from(filterState.years).sort();
                createBadge(`Anni: ${sortedYears.join(', ')}`, 'year');
            }
        }

        // Months
        if (filterState.months.size > 0 && filterState.months.size < 12) {
            const mNames = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
            const mSelected = Array.from(filterState.months).sort((a,b)=>a-b).map(m => mNames[m-1]);
            createBadge(`Mesi: ${mSelected.join(', ')}`, 'month');
        }

        // Types (Global Checkboxes & Grouped Popovers)
        if (filterState.types.size > 0) {
             const allAppTypes = new Set(appData.map(d => d.type).filter(Boolean));
             if (filterState.types.size < allAppTypes.size && allAppTypes.size > 0) {
                 createBadge(`Tipi: ${Array.from(filterState.types).join(', ')}`, 'type');
             }
        }

        // Categories (Global Checkboxes & Grouped Popovers)
        if (filterState.categories.size > 0) {
             const allAppCats = new Set(appData.map(d => d.category || 'Generico').filter(Boolean));
             if (filterState.categories.size < allAppCats.size && allAppCats.size > 0) {
                 createBadge(`Causali: ${filterState.categories.size} selezionate`, 'category');
             }
        }

        // Descriptions
        if (filterState.descriptions.size > 0) {
             createBadge(`Descrizioni: ${filterState.descriptions.size} selezionali`, 'desc', () => {
                 filterState.descriptions.clear();
                 renderTable();
             });
        }

        // Search Query
        if (filterState.searchQuery && filterState.searchQuery.trim() !== '') {
            createBadge(`Ricerca: "${filterState.searchQuery}"`, 'search', () => {
                filterState.searchQuery = '';
                const searchInput = document.getElementById('global-search-input');
                if (searchInput) searchInput.value = '';
                renderTable();
            });
        }

        // Column Filters (Single select from table header)
        if (filterState.columnFilters.type) {
            createBadge(`Col Tipo: ${filterState.columnFilters.type}`, 'type', () => {
                filterState.columnFilters.type = '';
                renderTable();
            });
        }
        if (filterState.columnFilters.category) {
            createBadge(`Col Cat: ${filterState.columnFilters.category}`, 'category', () => {
                filterState.columnFilters.category = '';
                renderTable();
            });
        }
        if (filterState.columnFilters.description) {
            createBadge(`Col Desc: ${filterState.columnFilters.description}`, 'desc', () => {
                filterState.columnFilters.description = '';
                renderTable();
            });
        }

        // Sorting
        if (filterState.sortCols && filterState.sortCols.length > 0) {
            // Only show badge if it's not the default sort
            if (!(filterState.sortCols.length === 1 && filterState.sortCols[0].col === 'date' && filterState.sortCols[0].dir === 'desc')) {
                const sorts = filterState.sortCols.map(s => {
                    const mapNames = { date: 'Data', type: 'Tipo', category: 'Cat', description: 'Desc', amount: 'Importo' };
                    return `${mapNames[s.col] || s.col} ${s.dir === 'asc' ? '↑' : '↓'}`;
                });
                createBadge(`Ordina: ${sorts.join(', ')}`, 'sort', () => {
                    filterState.sortCols = [{ col: 'date', dir: 'desc' }];
                    renderTable();
                });
            }
        }

        // No Filters Fallback
        if (!hasFilters) {
            container.innerHTML = '<span style="font-size: 0.85em; color: #94a3b8; font-style: italic;">Nessun filtro specifico (Vista Predefinita)</span>';
        }
    }

    function updateFilterUI() {
        if (filtersGeneratedOnce) return; // For MVP, we generate only once on meaningful load to avoid cursor reset bugs or losing state

        const availableYears = new Set();
        const availableTypes = new Set();
        const availableCategories = new Set();
        
        appData.forEach(i => {
            if (i.type) availableTypes.add(i.type);
            if (i.category) availableCategories.add(i.category);
            try {
                const d = new Date(i.date);
                if(!isNaN(d)) availableYears.add(d.getFullYear());
            } catch(e){}
        });

        if(availableYears.size === 0) return; // No data

        // Years
        yearFiltersContainer.innerHTML = '';
        const sortedYears = Array.from(availableYears).sort().reverse();
        sortedYears.forEach(y => {
            filterState.years.add(y); // Select all by default
            yearFiltersContainer.innerHTML += `
                <label>
                    <input type="checkbox" class="flt-year" value="${y}" checked>
                    ${y}
                </label>
            `;
        });
        
        // Types
        typeFiltersContainer.innerHTML = '';
        const sortedTypes = Array.from(availableTypes).sort();
        const typeLabels = {
            'REVENUE_EUBIOS': 'RICAVI EUBIOS',
            'COSTS_EUBIOS': 'COSTI EUBIOS',
            'REVENUE_EUBIOTECH': 'RICAVI EUBIOTECH',
            'COSTS_EUBIOTECH': 'COSTI EUBIOTECH',
            'Costi risorse umane': 'COSTI RISORSE UMANE (EUBIOTECH) [Obs]', 'COGS_TECH': 'COSTI PERSONALE EUBIOTECH (Legacy)',
            'Costi altri': 'COSTI ALTRI (EUBIOTECH) [Obs]', 'OPEX_TECH': 'ALTRI COSTI EUBIOTECH (Legacy)',
            'REVENUE': 'RICAVI EUBIOS (Legacy)',
            'COGS': 'COSTI EUBIOS (Legacy)',
            'OPEX': 'ALTRI COSTI (Legacy)'
        };
        sortedTypes.forEach(t => {
            filterState.types.add(t);
            typeFiltersContainer.innerHTML += `
                <label>
                    <input type="checkbox" class="flt-type" value="${t}" checked>
                    ${typeLabels[t] || t}
                </label>
            `;
        });
        
        // Categories
        categoryFiltersContainer.innerHTML = '';
        const sortedCategories = Array.from(availableCategories).sort();
        sortedCategories.forEach(c => {
            filterState.categories.add(c);
            categoryFiltersContainer.innerHTML += `
                <label style="border: 1px solid #e2e8f0; padding: 0.25rem 0.5rem; border-radius: 4px; background: white;">
                    <input type="checkbox" class="flt-category" value="${c}" checked>
                    ${c}
                </label>
            `;
        });

        // Months
        const months = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
        monthFiltersContainer.innerHTML = '';
        months.forEach((mLabel, index) => {
            const mNum = index + 1;
            monthFiltersContainer.innerHTML += `
                <label>
                    <input type="checkbox" class="flt-month" value="${mNum}" checked>
                    ${mLabel}
                </label>
            `;
        });

        // Bind Events to checkboxes
        document.querySelectorAll('.flt-year').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const val = parseInt(e.target.value);
                if(e.target.checked) filterState.years.add(val);
                else filterState.years.delete(val);
                renderTable(); // Re-render instantly
            });
        });

        document.querySelectorAll('.flt-month').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const val = parseInt(e.target.value);
                if(e.target.checked) filterState.months.add(val);
                else filterState.months.delete(val);
                renderTable(); // Re-render instantly
            });
        });
        
        document.querySelectorAll('.flt-type').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const val = e.target.value;
                if(e.target.checked) filterState.types.add(val);
                else filterState.types.delete(val);
                renderTable(); // Re-render instantly
            });
        });
        
        document.querySelectorAll('.flt-category').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const val = e.target.value;
                if(e.target.checked) filterState.categories.add(val);
                else filterState.categories.delete(val);
                renderTable(); // Re-render instantly
            });
        });

        filtersGeneratedOnce = true;
    }

    // Quick Quarter Selectors
    document.querySelectorAll('.quick-selects button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.target.id === 'sel-all-categories') {
                const allCatCbs = document.querySelectorAll('.flt-category');
                allCatCbs.forEach(cb => {
                    cb.checked = true;
                    filterState.categories.add(cb.value);
                });
                renderTable();
                return;
            }
            if (e.target.id === 'desel-all-categories') {
                const allCatCbs = document.querySelectorAll('.flt-category');
                filterState.categories.clear();
                allCatCbs.forEach(cb => cb.checked = false);
                renderTable();
                return;
            }

            const q = e.target.getAttribute('data-q');
            const allMonthsCbs = document.querySelectorAll('.flt-month');
            
            if (q) {
                // Quarter button
                const qNum = parseInt(q);
                const targetMonths = [(qNum-1)*3 + 1, (qNum-1)*3 + 2, (qNum-1)*3 + 3]; // e.g Q1 -> 1,2,3
                
                filterState.months.clear();
                targetMonths.forEach(m => filterState.months.add(m));

                allMonthsCbs.forEach(cb => {
                    cb.checked = targetMonths.includes(parseInt(cb.value));
                });
            } else if (e.target.id === 'sel-all-months') {
                // Select all button
                [1,2,3,4,5,6,7,8,9,10,11,12].forEach(m => filterState.months.add(m));
                allMonthsCbs.forEach(cb => cb.checked = true);
            }
            renderTable();
        });
    });

    groupBySelect.addEventListener('change', (e) => {
        filterState.groupBy = e.target.value;
        renderTable();
    });

    // Global Reset Filters (Dropdown Cancel Button)
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            // Restore default states
            filterState.years.clear();
            
            filterState.months = new Set([1,2,3,4,5,6,7,8,9,10,11,12]);
            
            filterState.types.clear();
            filterState.categories.clear();
            filterState.descriptions.clear();
            filterState.searchQuery = '';
            filterState.sortCols = [{ col: 'date', dir: 'desc' }];
            filterState.groupBy = 'year';
            filterState.columnFilters = { type: '', category: '', description: '' };

            const searchInput = document.getElementById('global-search-input');
            if (searchInput) searchInput.value = '';
            
            const groupSelect = document.getElementById('group-by-select');
            if (groupSelect) groupSelect.value = 'year';

            appData.forEach(i => {
                if (i.type) filterState.types.add(i.type);
                if (i.category) filterState.categories.add(i.category);
                if (i.description) filterState.descriptions.add(i.description);
                try {
                    const d = new Date(i.date);
                    if(!isNaN(d)) filterState.years.add(d.getFullYear());
                } catch(e){}
            });

            // Update UI Checkboxes
            document.querySelectorAll('.flt-year, .flt-month, .flt-type, .flt-category').forEach(cb => {
                cb.checked = true;
            });

            // Close dropdown
            const actionsDropdownContent = document.getElementById('actions-dropdown-content');
            if(actionsDropdownContent) actionsDropdownContent.classList.remove('show');

            renderTable();
        });
    }

    // Toggle Filters Setion
    if (toggleFiltersBtn && filterContainer) {
        toggleFiltersBtn.addEventListener('click', () => {
            if (filterContainer.style.display === 'none') {
                filterContainer.style.display = 'grid';
            } else {
                filterContainer.style.display = 'none';
            }
            // Close dropdown menu manually after clicking
            const actionsDropdownContent = document.getElementById('actions-dropdown-content');
            if(actionsDropdownContent) actionsDropdownContent.classList.remove('show');
        });
    }

    // --- POPOVER LOGIC ---
    const popover = document.getElementById('category-popover');
    const popoverContent = document.getElementById('popover-content');
    const popoverClose = document.getElementById('close-popover');
    const popoverSelAll = document.getElementById('popover-sel-all');
    const popoverDeselAll = document.getElementById('popover-desel-all');
    let currentPopoverTypes = [];
    let currentPopoverFilterType = 'category';

    function closePopover() {
        if(popover) popover.classList.add('hidden');
    }

    if (popoverClose) popoverClose.addEventListener('click', closePopover);

    document.addEventListener('click', (e) => {
        if (popover && !popover.classList.contains('hidden') && !popover.contains(e.target) && !e.target.closest('.interactive-header')) {
            closePopover();
        }
    });

    function openPopoverForHeader(headerEl) {
        currentPopoverFilterType = headerEl.getAttribute('data-filter-type') || 'category';
        
        const titleEl = document.querySelector('#category-popover h4');
        if (titleEl) {
            if (currentPopoverFilterType === 'year') titleEl.textContent = 'Filtra Anno';
            else if (currentPopoverFilterType === 'month') titleEl.textContent = 'Filtra Mese';
            else if (currentPopoverFilterType === 'quarter') titleEl.textContent = 'Filtra Trimestre';
            else if (currentPopoverFilterType === 'type') titleEl.textContent = 'Filtra Tipo';
            else if (currentPopoverFilterType === 'description') titleEl.textContent = 'Filtra Descrizione';
            else titleEl.textContent = 'Filtra Causali';
        }
        
        popoverContent.innerHTML = '';
        
        if (currentPopoverFilterType === 'year') {
            const relevantYears = new Set();
            appData.forEach(item => {
                try {
                    const d = new Date(item.date);
                    if(!isNaN(d)) relevantYears.add(d.getFullYear());
                } catch(e){}
            });
            
            if (relevantYears.size === 0) {
                popoverContent.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Nessun anno trovato.</p>';
            } else {
                Array.from(relevantYears).sort((a,b)=>b-a).forEach(y => {
                    const isChecked = filterState.years.has(y);
                    const lbl = document.createElement('label');
                    lbl.innerHTML = `<input type="checkbox" value="${y}" ${isChecked ? 'checked' : ''}> ${y}`;
                    
                    const cb = lbl.querySelector('input');
                    cb.addEventListener('change', (e) => {
                        const val = parseInt(y);
                        if (e.target.checked) filterState.years.add(val);
                        else filterState.years.delete(val);
                        
                        const mainCb = document.querySelector(`.flt-year[value="${val}"]`);
                        if (mainCb) mainCb.checked = e.target.checked;
                        
                        renderTable();
                    });
                    
                    popoverContent.appendChild(lbl);
                });
            }
        } else if (currentPopoverFilterType === 'month' || currentPopoverFilterType === 'quarter') {
            const isQuarter = currentPopoverFilterType === 'quarter';
            const items = isQuarter ? [1, 2, 3, 4] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
            const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
            
            items.forEach(val => {
                let isChecked = false;
                let labelText = '';
                
                if (isQuarter) {
                    labelText = `Q${val}`;
                    // A quarter is checked if all its 3 months are checked
                    const qMonths = [(val-1)*3 + 1, (val-1)*3 + 2, (val-1)*3 + 3];
                    isChecked = qMonths.every(m => filterState.months.has(m));
                } else {
                    labelText = monthNames[val-1];
                    isChecked = filterState.months.has(val);
                }

                const lbl = document.createElement('label');
                lbl.innerHTML = `<input type="checkbox" value="${val}" ${isChecked ? 'checked' : ''}> ${labelText}`;
                
                const cb = lbl.querySelector('input');
                cb.addEventListener('change', (e) => {
                    if (isQuarter) {
                        const qNum = parseInt(val);
                        const qMonths = [(qNum-1)*3 + 1, (qNum-1)*3 + 2, (qNum-1)*3 + 3];
                        qMonths.forEach(m => {
                            if (e.target.checked) filterState.months.add(m);
                            else filterState.months.delete(m);
                            const mainCb = document.querySelector(`.flt-month[value="${m}"]`);
                            if (mainCb) mainCb.checked = e.target.checked;
                        });
                    } else {
                        const mNum = parseInt(val);
                        if (e.target.checked) filterState.months.add(mNum);
                        else filterState.months.delete(mNum);
                        const mainCb = document.querySelector(`.flt-month[value="${mNum}"]`);
                        if (mainCb) mainCb.checked = e.target.checked;
                    }
                    renderTable();
                });
                
                popoverContent.appendChild(lbl);
            });
        } else if (currentPopoverFilterType === 'category') {
            const typesAttr = headerEl.getAttribute('data-type');
            const filterTypes = typesAttr ? typesAttr.split(',') : [];
            const hasTypeFilter = filterTypes.length > 0;
            
            const relevantCategories = new Set();
            appData.forEach(item => {
                if (!hasTypeFilter || filterTypes.includes(item.type)) {
                    relevantCategories.add(item.category || 'Generico');
                }
            });

            if (relevantCategories.size === 0) {
                popoverContent.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Nessuna causale trovata.</p>';
            } else {
                Array.from(relevantCategories).sort().forEach(c => {
                    const isChecked = filterState.categories.has(c);
                    const lbl = document.createElement('label');
                    lbl.innerHTML = `<input type="checkbox" value="${c}" ${isChecked ? 'checked' : ''}> ${c}`;
                    
                    const cb = lbl.querySelector('input');
                    cb.addEventListener('change', (e) => {
                        if (e.target.checked) filterState.categories.add(c);
                        else filterState.categories.delete(c);
                        
                        const mainCb = document.querySelector(`.flt-category[value="${c}"]`);
                        if (mainCb) mainCb.checked = e.target.checked;
                        
                        renderTable();
                    });
                    
                    popoverContent.appendChild(lbl);
                });
            }
        } else if (currentPopoverFilterType === 'type') {
            const relevantTypes = new Set();
            appData.forEach(item => {
                if(item.type) relevantTypes.add(item.type);
            });

            if (relevantTypes.size === 0) {
                popoverContent.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Nessun tipo trovato.</p>';
            } else {
                const typeLabels = {
                    'REVENUE_EUBIOS': 'RICAVI EUBIOS',
                    'COSTS_EUBIOS': 'COSTI EUBIOS',
                    'REVENUE_EUBIOTECH': 'RICAVI EUBIOTECH',
                    'COSTS_EUBIOTECH': 'COSTI EUBIOTECH',
                    'Costi risorse umane': 'COSTI RISORSE UMANE (EUBIOTECH) [Obs]', 'COGS_TECH': 'COSTI PERSONALE EUBIOTECH (Legacy)',
                    'Costi altri': 'COSTI ALTRI (EUBIOTECH) [Obs]', 'OPEX_TECH': 'ALTRI COSTI EUBIOTECH (Legacy)',
                    'REVENUE': 'RICAVI EUBIOS (Legacy)',
                    'COGS': 'COSTI EUBIOS (Legacy)',
                    'OPEX': 'ALTRI COSTI (Legacy)'
                };
                Array.from(relevantTypes).sort().forEach(t => {
                    const isChecked = filterState.types.has(t);
                    const lbl = document.createElement('label');
                    lbl.innerHTML = `<input type="checkbox" value="${t}" ${isChecked ? 'checked' : ''}> ${typeLabels[t] || t}`;
                    
                    const cb = lbl.querySelector('input');
                    cb.addEventListener('change', (e) => {
                        if (e.target.checked) filterState.types.add(t);
                        else filterState.types.delete(t);
                        
                        const mainCb = document.querySelector(`.flt-type[value="${t}"]`);
                        if (mainCb) mainCb.checked = e.target.checked;
                        
                        renderTable();
                    });
                    
                    popoverContent.appendChild(lbl);
                });
            }
        } else if (currentPopoverFilterType === 'description') {
            const relevantDesc = new Set();
            appData.forEach(item => {
                if(item.description && item.description.trim() !== '') relevantDesc.add(item.description);
            });

            if (relevantDesc.size === 0) {
                popoverContent.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Nessuna descrizione trovata.</p>';
            } else {
                Array.from(relevantDesc).sort().forEach(d => {
                    const isChecked = filterState.descriptions.has(d);
                    const lbl = document.createElement('label');
                    lbl.innerHTML = `<input type="checkbox" value="${d}" ${isChecked ? 'checked' : ''}> ${d}`;
                    
                    const cb = lbl.querySelector('input');
                    cb.addEventListener('change', (e) => {
                        if (e.target.checked) filterState.descriptions.add(d);
                        else filterState.descriptions.delete(d);
                        
                        renderTable();
                    });
                    
                    popoverContent.appendChild(lbl);
                });
            }
        }

        const rect = headerEl.getBoundingClientRect();
        popover.style.top = (rect.bottom + window.scrollY + 5) + 'px';
        popover.style.left = (rect.left + window.scrollX) + 'px';
        popover.classList.remove('hidden');
    }

    if(popoverSelAll) {
        popoverSelAll.addEventListener('click', () => {
            const cbs = popoverContent.querySelectorAll('input[type="checkbox"]');
            cbs.forEach(cb => {
                if(!cb.checked) {
                    cb.checked = true;
                    if (currentPopoverFilterType === 'year') {
                        const val = parseInt(cb.value);
                        filterState.years.add(val);
                        const mainCb = document.querySelector(`.flt-year[value="${val}"]`);
                        if(mainCb) mainCb.checked = true;
                    } else if (currentPopoverFilterType === 'month') {
                        const mNum = parseInt(cb.value);
                        filterState.months.add(mNum);
                        const mainCb = document.querySelector(`.flt-month[value="${mNum}"]`);
                        if(mainCb) mainCb.checked = true;
                    } else if (currentPopoverFilterType === 'quarter') {
                        const qNum = parseInt(cb.value);
                        const qMonths = [(qNum-1)*3 + 1, (qNum-1)*3 + 2, (qNum-1)*3 + 3];
                        qMonths.forEach(m => {
                            filterState.months.add(m);
                            const mainCb = document.querySelector(`.flt-month[value="${m}"]`);
                            if(mainCb) mainCb.checked = true;
                        });
                    } else if (currentPopoverFilterType === 'type') {
                        filterState.types.add(cb.value);
                        const mainCb = document.querySelector(`.flt-type[value="${cb.value}"]`);
                        if(mainCb) mainCb.checked = true;
                    } else if (currentPopoverFilterType === 'description') {
                        filterState.descriptions.add(cb.value);
                    } else {
                        filterState.categories.add(cb.value);
                        const mainCb = document.querySelector(`.flt-category[value="${cb.value}"]`);
                        if(mainCb) mainCb.checked = true;
                    }
                }
            });
            renderTable();
        });
    }

    if(popoverDeselAll) {
        popoverDeselAll.addEventListener('click', () => {
             const cbs = popoverContent.querySelectorAll('input[type="checkbox"]');
             cbs.forEach(cb => {
                 if(cb.checked) {
                     cb.checked = false;
                     if (currentPopoverFilterType === 'year') {
                         const val = parseInt(cb.value);
                         filterState.years.delete(val);
                         const mainCb = document.querySelector(`.flt-year[value="${val}"]`);
                         if(mainCb) mainCb.checked = false;
                     } else if (currentPopoverFilterType === 'month') {
                         const mNum = parseInt(cb.value);
                         filterState.months.delete(mNum);
                         const mainCb = document.querySelector(`.flt-month[value="${mNum}"]`);
                         if(mainCb) mainCb.checked = false;
                     } else if (currentPopoverFilterType === 'quarter') {
                         const qNum = parseInt(cb.value);
                         const qMonths = [(qNum-1)*3 + 1, (qNum-1)*3 + 2, (qNum-1)*3 + 3];
                         qMonths.forEach(m => {
                             filterState.months.delete(m);
                             const mainCb = document.querySelector(`.flt-month[value="${m}"]`);
                             if(mainCb) mainCb.checked = false;
                         });
                     } else if (currentPopoverFilterType === 'type') {
                         filterState.types.delete(cb.value);
                         const mainCb = document.querySelector(`.flt-type[value="${cb.value}"]`);
                         if(mainCb) mainCb.checked = false;
                     } else if (currentPopoverFilterType === 'description') {
                         filterState.descriptions.delete(cb.value);
                     } else {
                         filterState.categories.delete(cb.value);
                         const mainCb = document.querySelector(`.flt-category[value="${cb.value}"]`);
                         if(mainCb) mainCb.checked = false;
                     }
                 }
             });
             renderTable();
        });
    }

    // 4. Save Data helper (To Local & Cloud)
    async function saveData(bypassCloudSync = false, affectedItem = null) {
        try {
            // Always keep local cache for offline/instant load
            localStorage.setItem(DATA_KEY, JSON.stringify(appData));
            renderTable();
            
            // se non sto facendo operazioni massive come reset totali, aggiorno il cloud sul singolo item
            if (!bypassCloudSync && affectedItem) {
                // If the item exists in our array but we want to update/add to cloud
                const docRef = dataCollection.doc(affectedItem.id);
                await docRef.set(affectedItem);
            }
        } catch (e) {
            console.error("Error saving data:", e);
        }
    }
    
    // Helper to Delete entirely
    async function deleteDataCloud(itemId) {
         try {
             await dataCollection.doc(itemId).delete();
         } catch(e) {
             console.error("Error deleting from cloud:", e);
         }
    }

    // 5. Delete Entry
    async function deleteEntry(id) {
        try {
            const strId = String(id);
            if (!id || strId === 'undefined' || strId === 'null') {
                alert("❗ Impossibile eliminare: Questo record non possiede un ID valido (vecchio salvataggio offline). Usa 'Sincronizza Cloud' per re-iniettare gli ID univoci.");
                return;
            }
            if (confirm("Vuoi davvero eliminare questo record?")) {
                appData = appData.filter(item => String(item.id) !== strId);
                
                localStorage.setItem(DATA_KEY, JSON.stringify(appData));
                renderTable();
                updateSummaryCards(appData); // also update sums
                
                // Delete from cloud independently
                await deleteDataCloud(String(id));
            }
        } catch(err) {
            console.error("Delete Error:", err);
            alert("Si è verificato un errore durante l'eliminazione: " + err.message);
        }
    }

    // 6. Handle Form Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const date = document.getElementById('date-input').value;
        const type = document.getElementById('type-input').value;
        
        let category = categorySelect.value;
        if (category === 'altro') {
            category = customCategoryInput.value.trim();
        }
        
        let description = descInput ? descInput.value : '';
        if (description === 'altro' && customDescInput) description = customDescInput.value.trim();
        
        let cliente = clienteInputSelect ? clienteInputSelect.value : '';
        let fornitore = fornitoreInputSelect ? fornitoreInputSelect.value : '';
        
        const dettaglioInput = document.getElementById('dettaglio-input');
        const dettaglio = dettaglioInput ? dettaglioInput.value.trim() : '';
        
        const amount = parseFloat(document.getElementById('amount-input').value);

        if (!date || !type || !category || isNaN(amount)) {
            alert("Compila tutti i campi obbligatori correttamente.");
            return;
        }

        const attachmentInput = document.getElementById('attachment-input');
        const file = attachmentInput && attachmentInput.files[0];
        let attachmentUrl = null;
        let attachmentName = null;

        if (file) {
            const uploadProgressText = document.getElementById('upload-progress');
            const uploadPercentText = document.getElementById('upload-percent');
            uploadProgressText.style.display = 'block';
            submitBtn.disabled = true;

            try {
                const storageRef = storage.ref();
                const fileRef = storageRef.child(`attachments/${Date.now()}_${file.name}`);
                const uploadTask = fileRef.put(file);

                await new Promise((resolve, reject) => {
                    uploadTask.on('state_changed', 
                        (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            uploadPercentText.textContent = Math.round(progress);
                        },
                        (error) => reject(error),
                        () => resolve()
                    );
                });

                attachmentUrl = await fileRef.getDownloadURL();
                attachmentName = file.name;
            } catch (error) {
                console.error("Errore upload file:", error);
                alert("Errore durante il caricamento dell'allegato.");
                uploadProgressText.style.display = 'none';
                submitBtn.disabled = false;
                return;
            }
            uploadProgressText.style.display = 'none';
            submitBtn.disabled = false;
        }

        if (editingId) {
            // Update existing record
            const idx = appData.findIndex(item => item.id === editingId);
            if (idx > -1) {
                appData[idx].date = date;
                appData[idx].type = type;
                appData[idx].category = category;
                appData[idx].description = description;
                appData[idx].dettaglio = dettaglio;
                appData[idx].cliente = cliente;
                appData[idx].fornitore = fornitore;
                appData[idx].amount = amount;
                if (file) {
                    appData[idx].attachmentUrl = attachmentUrl;
                    appData[idx].attachmentName = attachmentName;
                }
                
                saveData(false, appData[idx]);
            }
            alert("Record aggiornato con successo!");
            cancelEdit(); // Reset form state
        } else {
            // Create new record
            const newEntry = {
                id: 'raw-' + Date.now() + Math.random().toString(36).substr(2, 5),
                date: date,
                type: type,
                category: category,
                description: description,
                dettaglio: dettaglio,
                cliente: cliente,
                fornitore: fornitore,
                amount: amount,
                attachmentUrl: attachmentUrl || null,
                attachmentName: attachmentName || null,
                createdAt: new Date().toISOString()
            };

            appData.push(newEntry);
            saveData(false, newEntry);
            
            // Output message
            alert("Record salvato con successo!");
            
            // Reset form but keep date and type for faster sequential entry
            document.getElementById('category-input').value = '';
            if (descInput) descInput.value = '';
            if (dettaglioInput) dettaglioInput.value = '';
            if (clienteInputSelect) clienteInputSelect.value = '';
            if (fornitoreInputSelect) fornitoreInputSelect.value = '';
            document.getElementById('amount-input').value = '';
            if (attachmentInput) attachmentInput.value = '';
            document.getElementById('category-input').focus();
            if (customCategoryInput) customCategoryInput.style.display = 'none';
        }
        
        // Update category dropdown and UI
        populateCategoryDropdown();
    });

    // Handle Edit Cancel
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', cancelEdit);
    }

    function cancelEdit() {
        editingId = null;
        if (submitBtn) submitBtn.textContent = 'Salva Record';
        if (cancelEditBtn) cancelEditBtn.style.display = 'none';
        
        // Clear form
        document.getElementById('date-input').value = '';
        document.getElementById('type-input').value = 'REVENUE_EUBIOS';
        document.getElementById('category-input').value = '';
        if (descInput) descInput.value = '';
        if (customDescInput) customDescInput.style.display = 'none';
        const detInput = document.getElementById('dettaglio-input');
        if (detInput) detInput.value = '';
        if (clienteInputSelect) clienteInputSelect.value = '';
        if (fornitoreInputSelect) fornitoreInputSelect.value = '';
        document.getElementById('amount-input').value = '';
        const attInput = document.getElementById('attachment-input');
        if (attInput) attInput.value = '';
        if (customCategoryInput) customCategoryInput.style.display = 'none';
    }

    // --- EDIT LOGIC ---
    function editEntry(id) {
        const item = appData.find(d => d.id === id);
        if (item) {
            // Load data into form
            document.getElementById('date-input').value = item.date;
            document.getElementById('type-input').value = item.type;
            
            // Load category
            // First simulate type change to populate valid categories for this type
            typeInput.dispatchEvent(new Event('change'));
            
            let catOptions = Array.from(categorySelect.options).map(opt => opt.value);
            if (catOptions.includes(item.category)) {
                categorySelect.value = item.category;
                if(customCategoryInput) customCategoryInput.style.display = 'none';
            } else {
                categorySelect.value = 'altro';
                if(customCategoryInput) {
                    customCategoryInput.style.display = 'block';
                    customCategoryInput.value = item.category;
                }
            }
            
            function syncSelectValue(selectEl, customInputEl, value) {
                if(!selectEl) return;
                let options = Array.from(selectEl.options).map(opt => opt.value);
                if (options.includes(value) || !value) {
                    selectEl.value = value || '';
                    if(customInputEl) customInputEl.style.display = 'none';
                } else {
                    selectEl.value = 'altro';
                    if(customInputEl) {
                        customInputEl.style.display = 'block';
                        customInputEl.value = value;
                    }
                }
            }

            syncSelectValue(descInput, customDescInput, item.description);
            const detInput = document.getElementById('dettaglio-input');
            if (detInput) detInput.value = item.dettaglio || '';
            syncSelectValue(clienteInputSelect, null, item.cliente);
            syncSelectValue(fornitoreInputSelect, null, item.fornitore);
            
            document.getElementById('amount-input').value = item.amount;
            
            // Set App State
            editingId = item.id;
            if (submitBtn) submitBtn.textContent = 'Aggiorna Record';
            if (cancelEditBtn) cancelEditBtn.style.display = 'inline-block';
            
            // Scroll to top to see form
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    // --- CONTEXT MENU LOGIC ---
    // Show Menu
    tableBody.addEventListener('contextmenu', (e) => {
        const rawRow = e.target.closest('.raw-data-row');
        const summaryRow = e.target.closest('.inner-summary-row');
        
        let targetId = null;
        if (rawRow) targetId = rawRow.getAttribute('data-id');
        else if (summaryRow) {
            const idsList = summaryRow.getAttribute('data-ids');
            // If it's a single ID, we allow it. If multiple, maybe we don't open edit/delete, or just the first.
            if (idsList && idsList.split(',').length === 1 && idsList.length > 0) {
                targetId = idsList;
            } else if (idsList && idsList.split(',').length > 1) {
                // Optional: alert that multiple records can't be edited simultaneously
                // return; 
            }
        }
        
        if (targetId) {
            e.preventDefault();
            contextMenuTargetId = targetId;
            contextMenu.style.display = 'block';
            
            // Position menu at cursor
            let mouseX = e.pageX;
            let mouseY = e.pageY;
            // Prevent menu from going offscreen
            if (mouseX + contextMenu.offsetWidth > window.innerWidth) {
                mouseX = window.innerWidth - contextMenu.offsetWidth;
            }
            if (mouseY + contextMenu.offsetHeight > window.innerHeight) {
                mouseY = window.innerHeight - contextMenu.offsetHeight;
            }
            
            contextMenu.style.left = mouseX + 'px';
            contextMenu.style.top = mouseY + 'px';
        }
    });

    // Hide Menu on click outside
    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) {
            contextMenu.style.display = 'none';
        }
    });

    // Edit from Context Menu
    ctxEditBtn.addEventListener('click', () => {
        contextMenu.style.display = 'none';
        if (!contextMenuTargetId) return;
        editEntry(contextMenuTargetId);
    });

    // Delete from Context Menu
    ctxDeleteBtn.addEventListener('click', () => {
        contextMenu.style.display = 'none';
        if (contextMenuTargetId) {
            deleteEntry(contextMenuTargetId);
            if (editingId === contextMenuTargetId) {
                cancelEdit(); // Stop editing if deleted
            }
        }
    });

    // 7. Handle Clear All
    clearBtn.addEventListener('click', async () => {
        if (appData.length > 0 && confirm("ATTENZIONE STRUTTURALE: Vuoi davvero cancellare TUTTI i dati salvati? Questa operazione eliminerà i dati PER SEMPRE dal Database in Cloud. Nessuno potrà recuperarli.")) {
            if(confirm("Sei assolutamente sicuro? Non c'è modo di tornare indietro (a meno che tu non abbia esplorato prima con 'Esporta Backup').")) {
                 appData = [];
                 localStorage.setItem(DATA_KEY, JSON.stringify(appData));
                 renderTable();
                 populateCategoryDropdown(); 
                 
                 // Clear Cloud - Warning: for huge datasets you should delete in batches or server-side, 
                 // but for this scale we can query and delete in chunks from client
                 try {
                     const snapshot = await dataCollection.get();
                     let b = db.batch();
                     let count = 0;
                     snapshot.docs.forEach((doc) => {
                         b.delete(doc.ref);
                         count++;
                         // Batch limit is 500 max writes
                         if (count === 490) {
                             b.commit();
                             b = db.batch();
                             count = 0;
                         }
                     });
                     await b.commit();
                     alert("Database azzerato completamente.");
                 } catch(e) {
                     console.error("Errore reset database cloud", e);
                 }
            }
        }
    });

    // --- EXPORT/IMPORT FULL BACKUP LOGIC ---
    if (exportBackupBtn) {
        exportBackupBtn.addEventListener('click', () => {
            const dataStr = JSON.stringify(appData, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `eubiotech_backup_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    if (importBackupBtn && importBackupFile) {
        importBackupBtn.addEventListener('click', () => {
            importBackupFile.click();
        });

        importBackupFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async function(evt) {
                try {
                    const parsed = JSON.parse(evt.target.result);
                    if (Array.isArray(parsed)) {
                        appData = parsed;
                        localStorage.setItem(DATA_KEY, JSON.stringify(appData));
                        renderTable();
                        populateCategoryDropdown();
                        alert("File JSON letto con successo. Avvio sincronizzazione cloud massiva... L'app potrebbe sembrare bloccata per qualche secondo.");
                        
                        // Overwrite cloud
                        const batch = db.batch();
                        // For safety, clear existing ones first or let user clear it? We will just update/set what is in the JSON
                        let count = 0;
                        const batches = [db.batch()];
                        let batchIndex = 0;
                        
                        parsed.forEach(item => {
                            const docRef = dataCollection.doc(item.id);
                            batches[batchIndex].set(docRef, item);
                            count++;
                            if (count >= 490) {
                                batches.push(db.batch());
                                batchIndex++;
                                count = 0;
                            }
                        });
                        
                        for (let b of batches) {
                            await b.commit();
                        }
                        
                        alert("Backup caricato e sincronizzato in Cloud con successo!");
                    } else {
                        alert("Formato file non valido. Attendere un array JSON.");
                    }
                } catch (err) {
                    console.error("Errore importazione backup:", err);
                    alert("Si è verificato un errore durante la lettura del file di backup o sync Cloud.");
                }
                importBackupFile.value = ''; // reset
            };
            reader.readAsText(file);
        });
    }

    // --- SETTINGS (GESTIONE CAUSALI) LOGIC ---
    async function loadCustomGroupings() {
        try {
            const settingsDoc = await db.collection('settings').doc('custom_groupings').get();
            if (settingsDoc.exists) {
                customGroupings = settingsDoc.data().groupings || [];
                localStorage.setItem('EUBIOTECH_custom_groups', JSON.stringify(customGroupings));
            } else {
                // Fallback to local storage if Firebase doc doesn't exist yet
                const stored = localStorage.getItem('EUBIOTECH_custom_groups');
                if (stored) {
                    try {
                        customGroupings = JSON.parse(stored);
                        // Save it to Firebase so it's available everywhere
                        await db.collection('settings').doc('custom_groupings').set({ groupings: customGroupings });
                    } catch(e) { customGroupings = []; }
                } else {
                    customGroupings = [];
                }
            }
        } catch (e) {
            console.error("Error loading custom groupings from Firebase:", e);
            // Offline fallback
            const stored = localStorage.getItem('EUBIOTECH_custom_groups');
            if (stored) {
                try {
                    customGroupings = JSON.parse(stored);
                } catch(err) { customGroupings = []; }
            } else {
                customGroupings = [];
            }
        }
    }

    async function saveCustomGroupingsLocally() {
        localStorage.setItem('EUBIOTECH_custom_groups', JSON.stringify(customGroupings));
        try {
            await db.collection('settings').doc('custom_groupings').set({ groupings: customGroupings });
        } catch (e) {
            console.error("Error saving custom groupings to Firebase:", e);
        }
    }

    function openSettingsModal() {
        if (!settingsModal) return;
        
        // Reset form
        editingGroupId = null;
        if(newGroupNameInput) newGroupNameInput.value = '';
        if(settingsFormTitle) settingsFormTitle.textContent = 'Crea Nuovo Raggruppamento';
        if(saveGroupBtn) saveGroupBtn.textContent = 'Salva Raggruppamento';
        if(cancelGroupBtn) cancelGroupBtn.style.display = 'none';

        // Get unique current values from appData
        const relevantTypes = new Set();
        const relevantCategories = new Set();
        const relevantDescriptions = new Set();
        appData.forEach(item => {
            if(item.type) relevantTypes.add(item.type);
            if(item.category) relevantCategories.add(item.category);
            if(item.description) relevantDescriptions.add(item.description);
        });

        // Render Checkboxes
        renderSettingsCheckboxes(settingsTypesContainer, Array.from(relevantTypes).sort());
        renderSettingsCheckboxes(settingsCategoriesContainer, Array.from(relevantCategories).sort());
        renderSettingsCheckboxes(settingsDescriptionsContainer, Array.from(relevantDescriptions).sort());

        // Render existing combinations
        renderCustomGroupsAdminList();

        settingsModal.classList.remove('hidden');
    }

    function closeSettingsModalFunc() {
        if(settingsModal) settingsModal.classList.add('hidden');
        renderTable(); // Re-render in case groups changed
    }

    function renderSettingsCheckboxes(container, itemsArray, preselected = []) {
        if (!container) return;
        container.innerHTML = '';
        
        if (itemsArray.length === 0) {
            container.innerHTML = '<span style="color:#94a3b8;font-size:0.85em;">Nessun dato disponibile</span>';
            return;
        }

        const typeLabels = {
            'REVENUE_EUBIOS': 'RICAVI EUBIOS',
            'COSTS_EUBIOS': 'COSTI EUBIOS',
            'REVENUE_EUBIOTECH': 'RICAVI EUBIOTECH',
            'COSTS_EUBIOTECH': 'COSTI EUBIOTECH',
            'Costi risorse umane': 'COSTI RISORSE UMANE (EUBIOTECH) [Obs]', 'COGS_TECH': 'COSTI PERSONALE EUBIOTECH (Legacy)',
            'Costi altri': 'COSTI ALTRI (EUBIOTECH) [Obs]', 'OPEX_TECH': 'ALTRI COSTI EUBIOTECH (Legacy)',
            'REVENUE': 'RICAVI EUBIOS (Legacy)',
            'COGS': 'COSTI EUBIOS (Legacy)',
            'OPEX': 'ALTRI COSTI (Legacy)'
        };

        itemsArray.forEach(val => {
            const isChecked = preselected.includes(val);
            const lbl = document.createElement('label');
            lbl.style.display = 'flex';
            lbl.style.alignItems = 'center';
            lbl.style.gap = '8px';
            lbl.style.marginBottom = '5px';
            lbl.style.fontSize = '0.9em';
            lbl.style.cursor = 'pointer';
            
            const displayVal = (container === settingsTypesContainer) ? (typeLabels[val] || val) : val;

            lbl.innerHTML = `<input type="checkbox" value="${String(val).replace(/"/g, '&quot;')}" ${isChecked ? 'checked' : ''}> <span>${String(displayVal)}</span>`;
            container.appendChild(lbl);
        });
    }

    function renderCustomGroupsAdminList() {
        if(!customGroupsContainer) return;
        customGroupsContainer.innerHTML = '';

        if(customGroupings.length === 0) {
            customGroupsContainer.innerHTML = '<span style="color:#94a3b8; font-style:italic; font-size:0.9em;">Nessun raggruppamento creato.</span>';
            return;
        }

        customGroupings.forEach(group => {
            const tag = document.createElement('div');
            tag.className = 'group-tag';
            tag.innerHTML = `
                <strong>${group.name}</strong> 
                <span style="color:#64748b; font-size:0.8em;">(${group.filters.categories.length} cat, ${group.filters.types.length} tipi)</span>
                <div class="group-tag-actions">
                    <button class="edit-group" data-id="${group.id}" title="Modifica">✏️</button>
                    <button class="del-group" data-id="${group.id}" title="Elimina" style="color:var(--danger)">✖</button>
                </div>
            `;
            customGroupsContainer.appendChild(tag);
        });

        // Bind inner buttons
        customGroupsContainer.querySelectorAll('.edit-group').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                editCustomGroup(id);
            });
        });
        customGroupsContainer.querySelectorAll('.del-group').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                deleteCustomGroup(id);
            });
        });
    }

    function editCustomGroup(id) {
        const group = customGroupings.find(g => g.id === id);
        if(!group) return;

        editingGroupId = id;
        if(settingsFormTitle) settingsFormTitle.textContent = 'Modifica Raggruppamento';
        if(saveGroupBtn) saveGroupBtn.textContent = 'Aggiorna Raggruppamento';
        if(cancelGroupBtn) cancelGroupBtn.style.display = 'inline-block';
        if(newGroupNameInput) newGroupNameInput.value = group.name;

        // Re-render checkboxes with preselected values
        const relevantTypes = Array.from(new Set(appData.map(i => i.type).filter(Boolean))).sort();
        const relevantCategories = Array.from(new Set(appData.map(i => i.category).filter(Boolean))).sort();
        const relevantDescriptions = Array.from(new Set(appData.map(i => i.description).filter(Boolean))).sort();

        renderSettingsCheckboxes(settingsTypesContainer, relevantTypes, group.filters.types || []);
        renderSettingsCheckboxes(settingsCategoriesContainer, relevantCategories, group.filters.categories || []);
        renderSettingsCheckboxes(settingsDescriptionsContainer, relevantDescriptions, group.filters.descriptions || []);
    }

    if (cancelGroupBtn) {
        cancelGroupBtn.addEventListener('click', () => {
            openSettingsModal(); // Resets the form state
        });
    }

    if (saveGroupBtn) {
        saveGroupBtn.addEventListener('click', () => {
            if(!newGroupNameInput) return;
            const name = newGroupNameInput.value.trim();
            if(!name) { alert("Inserisci un nome per il raggruppamento."); return; }

            const selectedTypes = Array.from(settingsTypesContainer.querySelectorAll('input:checked')).map(cb => cb.value);
            const selectedCategories = Array.from(settingsCategoriesContainer.querySelectorAll('input:checked')).map(cb => cb.value);
            const selectedDescriptions = Array.from(settingsDescriptionsContainer.querySelectorAll('input:checked')).map(cb => cb.value);

            if (selectedTypes.length === 0 && selectedCategories.length === 0 && selectedDescriptions.length === 0) {
                alert("Seleziona almeno un Tipo, una Categoria o una Descrizione da includere nel raggruppamento.");
                return;
            }

            if (editingGroupId) {
                // Update existing
                const idx = customGroupings.findIndex(g => g.id === editingGroupId);
                if(idx > -1) {
                    customGroupings[idx].name = name;
                    customGroupings[idx].filters = {
                        types: selectedTypes,
                        categories: selectedCategories,
                        descriptions: selectedDescriptions
                    };
                }
            } else {
                // Create new
                customGroupings.push({
                    id: 'grp_' + Date.now(),
                    name: name,
                    filters: {
                        types: selectedTypes,
                        categories: selectedCategories,
                        descriptions: selectedDescriptions
                    }
                });
            }

            saveCustomGroupingsLocally();
            openSettingsModal(); // Resets form and updates list
            
            // Re-render UI to update custom filter badges / selects if we need
            updateFilterUI();
        });
    }

    function deleteCustomGroup(id) {
        if(confirm("Sei sicuro di voler eliminare questo raggruppamento?")) {
            customGroupings = customGroupings.filter(g => g.id !== id);
            saveCustomGroupingsLocally();
            
            // If we are currently filtering by this group, we should probably clear the filters or refresh
            filterState.customGroups.delete(id); 
            
            renderCustomGroupsAdminList();
            updateFilterUI();
            
            if(editingGroupId === id) {
                openSettingsModal(); // Reset form if we deleted what we were editing
            }
        }
    }

    // --- CATEGORY DYNAMIC DROPDOWN ---
    function populateCategoryDropdown() {
        if (!categorySelect || !typeInput) return;
        
        const selectedType = typeInput.value;
        const uniqueCategories = new Set();
        
        let validTypes = [selectedType];
        if (selectedType === 'COSTS_EUBIOTECH' || selectedType === 'COSTS_EUBIOS') {
            validTypes = validTypes.concat(['COSTI EUBIOTECH', 'COSTI EUBIOS', 'Costi Eubiotech', 'Costi Eubios', 'Costo Variabile', 'Costo Fisso', 'Arval', 'Costo del Personale', 'Banca o Cassa', 'Giroconto o Altro', 'Costo del Venduto', 'OPEX_TECH', 'COGS_TECH', 'OPEX', 'COGS']);
        } else if (selectedType.includes('REVENUE')) {
            validTypes = validTypes.concat(['Ricavo', 'RICAVI EUBIOTECH', 'Ricavi Eubiotech', 'RICAVI EUBIOS', 'Ricavi Eubios']);
        }
        
        // Add existing categories from data exactly as they are in the database
        appData.forEach(item => {
            if (validTypes.includes(item.type) && item.category) {
                // Ensure category is treated as a string to prevent .toUpperCase() or .trim() TypeErrors from legacy data
                const catStr = String(item.category);
                
                if(catStr.toUpperCase() !== 'TOTALE' && catStr.toUpperCase() !== 'NOLEGGIO AUTO') {
                    uniqueCategories.add(catStr.trim()); 
                }
            }
        });
        
        let sortedCategories = Array.from(uniqueCategories).sort();
        
        // Build HTML
        let html = `<option value="" disabled selected>Seleziona o aggiungi categoria...</option>`;
        
        if (sortedCategories.length > 0) {
            html += `<optgroup label="Voci / Nominativi Esistenti">`;
            sortedCategories.forEach(cat => {
                html += `<option value="${cat}">${cat}</option>`;
            });
            html += `</optgroup>`;
        }
        
        html += `<option value="altro" style="color: blue;">➕ Aggiungi nuova voce...</option>`;
        
        // Remember previous selection if possible
        const prevValue = categorySelect.value;
        categorySelect.innerHTML = html;
        
        if (sortedCategories.includes(prevValue)) {
             categorySelect.value = prevValue;
        }
        
        // Hide custom input by default
        if (customCategoryInput) {
            customCategoryInput.style.display = 'none';
            customCategoryInput.required = false;
        }
    }

    if (typeInput && categorySelect) {
        typeInput.addEventListener('change', () => {
            populateCategoryDropdown();
            populateOtherDropdowns();
        });
        
        categorySelect.addEventListener('change', (e) => {
            if (e.target.value === 'altro') {
                customCategoryInput.style.display = 'block';
                customCategoryInput.required = true;
                customCategoryInput.focus();
            } else {
                customCategoryInput.style.display = 'none';
                customCategoryInput.required = false;
            }
            populateOtherDropdowns();
        });
    }

    function populateOtherDropdowns() {
        const uniqueDesc = new Set();
        const uniqueClienti = new Set();
        const uniqueFornitori = new Set();
        
        const selectedType = typeInput ? typeInput.value : null;
        const selectedCat = (categorySelect && categorySelect.value && categorySelect.value !== 'altro') ? categorySelect.value : null;
        
        let validTypes = [selectedType];
        if (selectedType === 'COSTS_EUBIOTECH' || selectedType === 'COSTS_EUBIOS') {
            validTypes = validTypes.concat(['COSTI EUBIOTECH', 'COSTI EUBIOS', 'Costi Eubiotech', 'Costi Eubios', 'Costo Variabile', 'Costo Fisso', 'Arval', 'Costo del Personale', 'Banca o Cassa', 'Giroconto o Altro', 'Costo del Venduto', 'OPEX_TECH', 'COGS_TECH', 'OPEX', 'COGS']);
        } else if (selectedType && selectedType.includes('REVENUE')) {
            validTypes = validTypes.concat(['Ricavo', 'RICAVI EUBIOTECH', 'Ricavi Eubiotech', 'RICAVI EUBIOS', 'Ricavi Eubios']);
        }
        
        appData.forEach(item => {
            if (selectedType && !validTypes.includes(item.type)) return;
            
            // Only collect descriptions that belong to the selected category (if a category is selected)
            if (selectedCat && item.category && String(item.category).trim() !== selectedCat) return;
            
            if (item.description) uniqueDesc.add(String(item.description).trim());
            
            // Clienti and Fornitori are filtered by category as well now, though mostly they use Anagrafiche
            if (item.cliente) uniqueClienti.add(String(item.cliente).trim());
            if (item.fornitore) uniqueFornitori.add(String(item.fornitore).trim());
        });

        // Get anagrafiche arrays
        const anagraficheClienti = anagraficheData.filter(a => a.tipo === 'cliente').map(a => a.ragioneSociale.trim());
        const anagraficheFornitori = anagraficheData.filter(a => a.tipo === 'fornitore').map(a => a.ragioneSociale.trim());
        
        // Remove dedicated anagrafiche from historical ones to avoid duplicates (for Description only now)
        function populateSelect(selectEl, customEl, itemsArr, emptyLabel, isStrict) {
            if (!selectEl) return;
            const sortedItems = Array.from(itemsArr).sort();
            
            let html = `<option value="" selected>${emptyLabel}</option>`;
            
            if (sortedItems.length > 0) {
                if (isStrict) {
                     html += `<optgroup label="Anagrafiche Qualificate">`;
                } else {
                     html += `<optgroup label="Voci">`;
                }
                sortedItems.forEach(val => html += `<option value="${val}">${val}</option>`);
                html += `</optgroup>`;
            }
            
            if (!isStrict) {
                html += `<option value="altro" style="color: blue;">➕ Aggiungi nuova voce...</option>`;
            } else {
                html += `<option value="" disabled style="color: gray;">(Usa il pulsante 👥 per aggiungere)</option>`;
            }
            
            const prevValue = selectEl.value;
            selectEl.innerHTML = html;
            
            if (sortedItems.includes(prevValue)) {
                selectEl.value = prevValue;
            } else if (isStrict && prevValue && prevValue !== 'altro') {
                // If we are editing a legacy record whose name isn't in the qualified DB anymore
                html += `<option value="${prevValue}" style="color: red;">${prevValue} (Non in Anagrafica)</option>`;
                selectEl.innerHTML = html;
                selectEl.value = prevValue;
            }
            
            if (customEl) {
                customEl.style.display = selectEl.value === 'altro' ? 'block' : 'none';
                customEl.required = selectEl.value === 'altro';
            }
        }
        
        populateSelect(descInput, customDescInput, uniqueDesc, "Nessuna descrizione", false);
        // Strict mapping: Cliente/Fornitore only from qualified Anagrafiche
        populateSelect(clienteInputSelect, customClienteInput, anagraficheClienti, "Nessun cliente", true);
        populateSelect(fornitoreInputSelect, customFornitoreInput, anagraficheFornitori, "Nessun fornitore", true);
    }

    function setupOtherDropdownsListeners() {
        function attachListener(selectEl, customEl) {
            if (selectEl && customEl) {
                selectEl.addEventListener('change', (e) => {
                    if (e.target.value === 'altro') {
                        customEl.style.display = 'block';
                        customEl.required = true;
                        customEl.focus();
                    } else {
                        customEl.style.display = 'none';
                        customEl.required = false;
                    }
                });
            }
        }
        attachListener(descInput, customDescInput);
    }
    
    setupOtherDropdownsListeners();

    // --- ANAGRAFICA MODAL LOGIC ---
    const anagraficaModal = document.getElementById('anagrafica-modal');
    const closeAnagraficaBtn = document.getElementById('close-anagrafica-modal');
    const cancelAnagraficaBtn = document.getElementById('cancel-anagrafica-btn');
    const anagraficaForm = document.getElementById('anagrafica-form');
    
    function openAnagraficaModal(tipoStr = 'cliente') {
        if (!anagraficaModal) return;
        anagraficaForm.reset();
        document.getElementById('anagrafica-type').value = tipoStr;
        document.getElementById('anagrafica-id').value = '';
        document.getElementById('anagrafica-modal-title').textContent = 'Gestione Anagrafica';
        
        // Nessun text auto-fill dal form principale poiché rimosso
        
        anagraficaModal.classList.remove('hidden');
    }

    function closeAnagraficaModalFunc() {
        if (anagraficaModal) anagraficaModal.classList.add('hidden');
    }

    if (closeAnagraficaBtn) closeAnagraficaBtn.addEventListener('click', closeAnagraficaModalFunc);
    if (cancelAnagraficaBtn) cancelAnagraficaBtn.addEventListener('click', closeAnagraficaModalFunc);

    const btnAnaGeneral = document.getElementById('open-anagrafica-general-btn');
    if (btnAnaGeneral) btnAnaGeneral.addEventListener('click', () => openAnagraficaModal('cliente'));

    if (anagraficaForm) {
        anagraficaForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = document.getElementById('save-anagrafica-btn');
            if (btn) btn.disabled = true;
            
            try {
                const tipo = document.getElementById('anagrafica-type').value;
                const rsociale = document.getElementById('ana-ragione-sociale').value.trim();
                
                const payload = {
                    tipo: tipo,
                    ragioneSociale: rsociale,
                    piva: document.getElementById('ana-piva').value.trim(),
                    cf: document.getElementById('ana-cf').value.trim(),
                    sdi: document.getElementById('ana-sdi').value.trim(),
                    pec: document.getElementById('ana-pec').value.trim(),
                    indirizzo: document.getElementById('ana-indirizzo').value.trim(),
                    email: document.getElementById('ana-email').value.trim(),
                    telefono: document.getElementById('ana-telefono').value.trim(),
                    updatedAt: new Date().toISOString()
                };

                const id = document.getElementById('anagrafica-id').value;
                if (id) {
                    await anagraficheCollection.doc(id).set(payload, { merge: true });
                    // Update locally
                    const idx = anagraficheData.findIndex(a => a.id === id);
                    if (idx > -1) anagraficheData[idx] = { id, ...payload };
                } else {
                    const docRef = await anagraficheCollection.add(payload);
                    anagraficheData.push({ id: docRef.id, ...payload });
                }
                
                // If it's a new entry, we want to auto-select it in the dropdown
                populateOtherDropdowns();
                
                if (tipo === 'cliente' && clienteInputSelect) {
                    clienteInputSelect.value = rsociale;
                } else if (tipo === 'fornitore' && fornitoreInputSelect) {
                    fornitoreInputSelect.value = rsociale;
                }

                closeAnagraficaModalFunc();
                alert(`Anagrafica ${tipo} salvata con successo!`);
            } catch (error) {
                console.error("Errore salvataggio anagrafica:", error);
                alert("Errore durante il salvataggio. Riprova.");
            } finally {
                if (btn) btn.disabled = false;
            }
        });
    }

    // --- FATTURA MODAL LOGIC ---
    const fatturaModal = document.getElementById('fattura-modal');
    const openFatturaBtn = document.getElementById('open-fattura-btn');
    const closeFatturaBtn = document.getElementById('close-fattura-modal');
    const fatturaForm = document.getElementById('fattura-form');
    const fatClienteSelect = document.getElementById('fat-cliente');
    const btnNuovoClienteFat = document.getElementById('btn-nuovo-cliente-fat');

    function populateFatturaClienti() {
        if (!fatClienteSelect) return;
        const clienti = anagraficheData.filter(a => a.tipo === 'cliente').sort((a,b) => a.ragioneSociale.localeCompare(b.ragioneSociale));
        
        let html = '<option value="" disabled selected>Seleziona Cliente...</option>';
        clienti.forEach(c => {
            html += `<option value="${c.id}">${c.ragioneSociale}</option>`;
        });
        
        fatClienteSelect.innerHTML = html;
    }

    function openFatturaModal() {
        if (!fatturaModal) return;
        fatturaForm.reset();
        populateFatturaClienti();
        
        // Auto-set data emissione a oggi
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('fat-data').value = today;
        
        calcFatturaTotali();
        fatturaModal.classList.remove('hidden');
    }

    function closeFatturaModal() {
        if (fatturaModal) fatturaModal.classList.add('hidden');
    }

    if (openFatturaBtn) openFatturaBtn.addEventListener('click', openFatturaModal);
    if (closeFatturaBtn) closeFatturaBtn.addEventListener('click', closeFatturaModal);
    if (btnNuovoClienteFat) btnNuovoClienteFat.addEventListener('click', () => {
        openAnagraficaModal('cliente');
        // When closing anagrafica, we would ideally re-populate, but populateOtherDropdowns is called already on save.
        // We'll hook into that or just rely on user opening it again, but better to expose a refresh.
    });

    // We intercept populateOtherDropdowns to also update fattura client select
    const oldPopulate = populateOtherDropdowns;
    populateOtherDropdowns = function() {
        oldPopulate();
        populateFatturaClienti();
    };

    // Fattura Calculations
    const inpImponibile = document.getElementById('fat-imponibile');
    const inpIva = document.getElementById('fat-iva');
    
    function calcFatturaTotali() {
        if (!inpImponibile) return;
        
        const imp = parseFloat(inpImponibile.value) || 0;
        const percIva = parseFloat(inpIva.value) || 0;
        
        const iva = imp * (percIva / 100);
        const totale = imp + iva;
        
        document.getElementById('fat-calc-imponibile').textContent = `€ ${imp.toFixed(2)}`;
        document.getElementById('fat-calc-iva').textContent = `€ ${iva.toFixed(2)}`;
        document.getElementById('fat-calc-totale').textContent = `€ ${totale.toFixed(2)}`;
    }

    [inpImponibile, inpIva].forEach(el => {
        if(el) {
            el.addEventListener('input', calcFatturaTotali);
            el.addEventListener('change', calcFatturaTotali);
        }
    });

    if (fatturaForm) {
        fatturaForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('save-fattura-btn');
            if (btn) btn.disabled = true;
            
            try {
                const clienteId = fatClienteSelect.value;
                const clienteData = anagraficheData.find(a => a.id === clienteId);
                
                const payload = {
                    cliente_id: clienteId,
                    cliente_ragioneSociale: clienteData ? clienteData.ragioneSociale : 'Sconosciuto',
                    numero: document.getElementById('fat-numero').value.trim(),
                    data_emissione: document.getElementById('fat-data').value,
                    data_scadenza: document.getElementById('fat-scadenza').value,
                    descrizione: document.getElementById('fat-descrizione').value.trim(),
                    imponibile: parseFloat(inpImponibile.value) || 0,
                    perc_iva: parseFloat(inpIva.value) || 0,
                    totale: parseFloat(document.getElementById('fat-calc-totale').textContent.replace('€', '').trim()),
                    createdAt: new Date().toISOString()
                };

                await fattureCollection.add(payload);
                alert("Fattura emessa e salvata con successo!");
                closeFatturaModal();
            } catch (error) {
                console.error("Errore salvataggio fattura:", error);
                alert("Errore durante il salvataggio della fattura.");
            } finally {
                if (btn) btn.disabled = false;
            }
        });
    }

    // --- HISTORICAL DATA CLEANUP ---
    // Remove old 'Totale', 'Noleggio auto', and legacy 'Costi Diversi Gestione Eubiotech' entries
    let beforeLength = appData.length;
    appData = appData.filter(item => {
        if (!item.category) return true;
        const catUpper = item.category.toUpperCase().trim();
        if (catUpper === 'TOTALE' || catUpper.includes('TOTALE') || 
            catUpper === 'FONDO ACCANTONAMENTO' || 
            catUpper === 'NOLEGGIO AUTO' || catUpper.includes('NOLEGGIO AUTO') ||
            catUpper.includes('COSTI DIVERSI GESTIONE EUBIOTECH')) {
            // Need to delete individually from Cloud if filtered out during load
            deleteDataCloud(item.id); 
            return false;
        }
        return true;
    });
    if (appData.length !== beforeLength) {
        localStorage.setItem(DATA_KEY, JSON.stringify(appData));
        console.log(`Cleaned up ${beforeLength - appData.length} legacy aggregate rows ('Totale'/'Noleggio Auto').`);
    }
    
    // Initial render logic will happen after Firestore fetch as it's async now!
    renderTable(); 
    populateCategoryDropdown();
    populateOtherDropdowns();
    
    // --- DRILLDOWN MODAL LOGIC ---
    const drilldownModal = document.getElementById('drilldown-modal');
    const drilldownClose = document.getElementById('close-drilldown');
    
    if (drilldownClose) {
        drilldownClose.addEventListener('click', () => {
            if (drilldownModal) drilldownModal.classList.add('hidden');
        });
    }

    document.addEventListener('click', (e) => {
        const link = e.target.closest('.drilldown-link');
        if (link) {
            e.preventDefault();
            const groupType = link.getAttribute('data-group-type');
            const groupKey = link.getAttribute('data-group-key');
            openDrilldownModal(groupType, groupKey);
        }
    });

    function openDrilldownModal(groupType, groupKey) {
        if (!drilldownModal) return;
        
        const titleEl = document.getElementById('drilldown-title');
        const tbody = document.getElementById('drilldown-tbody');
        if (titleEl) titleEl.innerHTML = `Dettaglio Righe: <span style="color:#3b82f6;">${groupKey}</span>`;
        
        // Filter filteredData based on groupType and groupKey
        const records = filteredData.filter(item => {
            if (groupType === 'smart_pivot') {
                let desc = (item.description || item.category || 'Generico').toUpperCase().trim();
                if (desc === 'PERSONALE EUBIOTECH' || desc === 'COSTI PERSONALE EUBIOTECH') desc = 'GENERICO';
                return desc === groupKey;
            } else if (groupType === 'description') {
                const desc = item.description || 'Nessuna Descrizione';
                return desc === groupKey;
            } else if (groupType === 'category') {
                const cat = item.category || 'Generico';
                return cat === groupKey;
            } else if (groupType === 'type') {
                const typeLabels = {
                    'REVENUE_EUBIOS': 'RICAVI EUBIOS', 'COSTS_EUBIOS': 'COSTI EUBIOS', 'REVENUE_EUBIOTECH': 'RICAVI EUBIOTECH',
                    'Costi risorse umane': 'COSTI RISORSE UMANE (EUBIOTECH)', 'COGS_TECH': 'COSTI PERSONALE EUBIOTECH (Legacy)',
                    'Costi altri': 'COSTI ALTRI (EUBIOTECH)', 'OPEX_TECH': 'ALTRI COSTI EUBIOTECH (Legacy)',
                    'REVENUE': 'RICAVI EUBIOS (Legacy)', 'COGS': 'COSTI EUBIOS (Legacy)', 'OPEX': 'ALTRI COSTI (Legacy)'
                };
                return (typeLabels[item.type] || item.type) === groupKey;
            } else if (groupType === 'year') {
                const d = new Date(item.date);
                if (isNaN(d)) return groupKey === 'N/A';
                return d.getFullYear().toString() === groupKey;
            } else if (groupType === 'month') {
                const months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
                const d = new Date(item.date);
                if (isNaN(d)) return false;
                return `${months[d.getMonth()]} ${d.getFullYear()}` === groupKey;
            }
            return false;
        });

        tbody.innerHTML = '';
        if (records.length === 0) {
             tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #64748b;">Nessun record esatto trovato per questo raggruppamento (prova a cercare direttamente).</td></tr>';
        } else {
             records.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(item => {
                 const tr = document.createElement('tr');
                 
                 let displayDate = item.date;
                 try {
                     const parts = item.date.split('-');
                     if(parts.length === 3) displayDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                 } catch(e){}
                 
                 const typeLabelsShort = {
                     'REVENUE_EUBIOS': 'RICAVI EUBIOS', 'COSTS_EUBIOS': 'COSTI EUBIOS', 'REVENUE_EUBIOTECH': 'RICAVI EUBIOTECH',
                     'Costi risorse umane': 'C. RISORSE UMANE', 'Costi altri': 'ALTRI COSTI'
                 };
                 const displayType = typeLabelsShort[item.type] || item.type;

                 tr.innerHTML = `
                     <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 0.85em;">${displayDate}</td>
                     <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 0.9em; font-family: monospace; font-weight: bold; color:#475569;">${item.numero || '-'}</td>
                     <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 0.9em; font-weight: 500;">${item.fornitore || '-'}</td>
                     <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 0.9em;">${item.cliente || '-'}</td>
                     <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 0.8em;"><strong>${displayType}</strong></td>
                     <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 0.85em;">${item.category || '-'}</td>
                     <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 0.85em; color: #475569;">${item.description || '-'}</td>
                     <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 0.85em; color: #475569;">${item.dettaglio || '-'}</td>
                     <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 1.1em; text-align: right; font-weight: bold;">${formatCurrency(item.amount)}</td>
                 `;
                 tbody.appendChild(tr);
             });
        }
        
        drilldownModal.classList.remove('hidden');
    }

    // --- RAW XML VIEWER MODAL LOGIC ---
    let rawXmlState = { sortCol: 'date', sortAsc: false, query: '', fileFilter: '', typeFilter: [], catFilter: [] };
    
    const showRawBtn = document.getElementById('show-raw-xml-btn');
    const rawXmlModal = document.getElementById('raw-xml-modal');
    const closeRawBtn = document.getElementById('close-raw-xml');
    
    if (showRawBtn && rawXmlModal) {
        showRawBtn.addEventListener('click', () => {
            try {
                const rawFileFilter = document.getElementById('raw-file-filter');
                const uniqueFiles = Array.from(new Set(appData.map(d => d.fileSorgente).filter(Boolean))).sort();
                const curr = rawFileFilter.value;
                rawFileFilter.innerHTML = '<option value="">-- Tutti i File --</option>' + 
                    uniqueFiles.map(f => `<option value="${f}" ${f===curr?'selected':''}>${f}</option>`).join('');
                    
                renderRawXmlTable();
                rawXmlModal.classList.remove('hidden');
            } catch (err) {
                console.error("Error opening Raw XML modal:", err);
                alert("Errore apertura finestra: " + err.message + "\nAssicurati di aver premuto Aggiorna (Ctrl+F5).");
            }
        });
        
        closeRawBtn.addEventListener('click', () => rawXmlModal.classList.add('hidden'));
        
        document.getElementById('raw-search-input').addEventListener('input', e => {
            rawXmlState.query = e.target.value.toLowerCase().trim();
            renderRawXmlTable();
        });
        document.getElementById('raw-file-filter').addEventListener('change', e => {
            rawXmlState.fileFilter = e.target.value;
            renderRawXmlTable();
        });
        
        document.querySelectorAll('.sortable-raw').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.getAttribute('data-sort');
                if (rawXmlState.sortCol === col) rawXmlState.sortAsc = !rawXmlState.sortAsc;
                else { rawXmlState.sortCol = col; rawXmlState.sortAsc = false; }
                renderRawXmlTable();
            });
        });

        const rawTypesDropdown = document.getElementById('raw-type-dropdown');
        const rawCatsDropdown = document.getElementById('raw-cat-dropdown');
        
        document.getElementById('raw-type-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            rawTypesDropdown.classList.toggle('hidden');
            rawCatsDropdown.classList.add('hidden');
            populateRawDropdowns();
        });
        document.getElementById('raw-cat-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            rawCatsDropdown.classList.toggle('hidden');
            rawTypesDropdown.classList.add('hidden');
            populateRawDropdowns();
        });
        
        window.addEventListener('click', (e) => {
            if (!document.getElementById('raw-type-btn').contains(e.target) && !rawTypesDropdown.contains(e.target)) {
                rawTypesDropdown.classList.add('hidden');
            }
            if (!document.getElementById('raw-cat-btn').contains(e.target) && !rawCatsDropdown.contains(e.target)) {
                rawCatsDropdown.classList.add('hidden');
            }
            if (e.target === rawXmlModal) rawXmlModal.classList.add('hidden');
        });
        
        document.getElementById('raw-type-sel-all').addEventListener('click', () => {
            document.querySelectorAll('#raw-type-checkboxes input').forEach(cb => cb.checked = true);
            updateRawFilters();
        });
        document.getElementById('raw-type-desel-all').addEventListener('click', () => {
            document.querySelectorAll('#raw-type-checkboxes input').forEach(cb => cb.checked = false);
            updateRawFilters();
        });
        document.getElementById('raw-cat-sel-all').addEventListener('click', () => {
            document.querySelectorAll('#raw-cat-checkboxes input').forEach(cb => cb.checked = true);
            updateRawFilters();
        });
        document.getElementById('raw-cat-desel-all').addEventListener('click', () => {
            document.querySelectorAll('#raw-cat-checkboxes input').forEach(cb => cb.checked = false);
            updateRawFilters();
        });
    }

    function populateRawDropdowns() {
        const typeContainer = document.getElementById('raw-type-checkboxes');
        const catContainer = document.getElementById('raw-cat-checkboxes');
        
        if (typeContainer.innerHTML.trim() === '') {
            const types = Array.from(new Set(appData.map(d => d.type).filter(Boolean))).sort();
            typeContainer.innerHTML = types.map(t => `<label><input type="checkbox" value="${t}"> ${t}</label>`).join('');
            typeContainer.querySelectorAll('input').forEach(cb => cb.addEventListener('change', updateRawFilters));
        }
        if (catContainer.innerHTML.trim() === '') {
            const cats = Array.from(new Set(appData.map(d => d.category).filter(Boolean))).sort();
            catContainer.innerHTML = cats.map(c => `<label><input type="checkbox" value="${c}"> ${c}</label>`).join('');
            catContainer.querySelectorAll('input').forEach(cb => cb.addEventListener('change', updateRawFilters));
        }
    }

    function updateRawFilters() {
        rawXmlState.typeFilter = Array.from(document.querySelectorAll('#raw-type-checkboxes input:checked')).map(cb => cb.value);
        rawXmlState.catFilter = Array.from(document.querySelectorAll('#raw-cat-checkboxes input:checked')).map(cb => cb.value);
        renderRawXmlTable();
    }

    function renderRawXmlTable() {
        const tbody = document.getElementById('raw-xml-tbody');
        if (!tbody) return;
        
        // Two-pass approach to heal orphaned records (manual entries missing invoice numbers)
        let parentInvoices = {};
        appData.forEach(item => {
            if (item.numero && item.numero !== '-' && item.numero !== 'N/A' && item.fornitore) {
                const key = `${item.date}_${item.fornitore}`;
                if (!parentInvoices[key]) {
                    parentInvoices[key] = { 
                        numero: item.numero, 
                        fileSorgente: item.fileSorgente || `Fattura_${item.numero.replace(/\//g,'-')}`
                    };
                }
            }
        });

        let data = appData.map(item => {
            let num = item.numero || '-';
            let file = item.fileSorgente || 'Inserimento Manuale';
            
            if ((num === '-' || num === 'N/A') && item.fornitore) {
                const k = `${item.date}_${item.fornitore}`;
                if (parentInvoices[k]) {
                    num = parentInvoices[k].numero;
                    file = parentInvoices[k].fileSorgente;
                }
            }

            return {
                id: item.id,
                fileSorgente: file,
                date: item.date,
                numero: num,
                fornitore: item.fornitore || '-',
                type: item.type || '-',
                category: item.category || '-',
                description: item.description || '-',
                dettaglio: item.dettaglio || '-',
                quantita: item.quantita || 1,
                prezzoUnitario: item.prezzoUnitario !== undefined ? item.prezzoUnitario : item.amount,
                aliquotaIVA: item.aliquotaIVA || 0,
                amount: item.amount || 0
            };
        });

        if (rawXmlState.fileFilter) data = data.filter(d => d.fileSorgente === rawXmlState.fileFilter);
        if (rawXmlState.typeFilter.length > 0) data = data.filter(d => rawXmlState.typeFilter.includes(d.type));
        if (rawXmlState.catFilter.length > 0) data = data.filter(d => rawXmlState.catFilter.includes(d.category));
        
        if (rawXmlState.query) {
            const q = rawXmlState.query;
            data = data.filter(d => 
                `${d.fornitore} ${d.dettaglio} ${d.fileSorgente} ${d.numero} ${d.type} ${d.category} ${d.description}`.toLowerCase().includes(q)
            );
        }

        let clusterMap = {};
        data.forEach(d => {
            let key;
            if (d.numero && d.numero !== '-' && d.numero !== 'N/A') {
                key = `invoice_${d.numero}_${d.fornitore}_${d.date}`;
            } else if (d.fileSorgente && d.fileSorgente !== 'Inserimento Manuale') {
                key = d.fileSorgente;
            } else {
                key = `manual_${d.id}`;
            }
                      
            if (!clusterMap[key]) {
                clusterMap[key] = {
                    key: key,
                    fileSorgente: d.fileSorgente,
                    date: d.date,
                    numero: d.numero,
                    fornitore: d.fornitore,
                    type: d.type,
                    category: d.category,
                    description: d.description,
                    dettaglio: d.dettaglio,       // First line item
                    quantita: d.quantita,         // First line item quantity
                    prezzoUnitario: d.prezzoUnitario, // First line item price
                    amount: 0,                    // Will sum
                    lines: []
                };
            }
            clusterMap[key].lines.push(d);
            clusterMap[key].amount += parseFloat(d.amount || 0);
        });

        let clusterArray = Object.values(clusterMap);

        clusterArray.sort((a, b) => {
            let valA = a[rawXmlState.sortCol];
            let valB = b[rawXmlState.sortCol];
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            if (valA < valB) return rawXmlState.sortAsc ? -1 : 1;
            if (valA > valB) return rawXmlState.sortAsc ? 1 : -1;
            return 0;
        });

        document.querySelectorAll('.sortable-raw').forEach(th => {
            th.classList.remove('active');
            th.querySelector('.sort-icon-raw').innerHTML = '';
            if (th.getAttribute('data-sort') === rawXmlState.sortCol) {
                th.classList.add('active');
                th.querySelector('.sort-icon-raw').innerHTML = rawXmlState.sortAsc ? ' &#9650;' : ' &#9660;';
            }
        });

        const activeContainer = document.getElementById('raw-active-filters-container');
        let activeTags = [];
        if (rawXmlState.typeFilter.length > 0) activeTags.push(`<b>Tipi:</b> ${rawXmlState.typeFilter.join(', ')}`);
        if (rawXmlState.catFilter.length > 0) activeTags.push(`<b>Categorie:</b> ${rawXmlState.catFilter.join(', ')}`);
        
        if (activeTags.length > 0) activeContainer.innerHTML = 'Filtri Attivi: ' + activeTags.join(' | ');
        activeContainer.style.display = activeTags.length > 0 ? 'block' : 'none';

        tbody.innerHTML = '';
        if (clusterArray.length === 0) {
            tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 20px; color: #64748b;">Nessun dato corrispondente ai filtri.</td></tr>';
            return;
        }

        const typeLabelsShort = { 'REVENUE_EUBIOS': 'RICAVI EUBIOS', 'COSTS_EUBIOS': 'COSTI EUBIOS', 'REVENUE_EUBIOTECH': 'RICAVI EUBIOTECH', 'Costi risorse umane': 'C. RISORSE UMANE', 'Costi altri': 'ALTRI COSTI' };

        clusterArray.forEach((c, index) => {
            const hasMultiple = c.lines.length > 1;
            
            const tr = document.createElement('tr');
            tr.style.transition = "background-color 0.2s";
            
            let dispDate = c.date;
            try { const p = c.date.split('-'); if(p.length===3) dispDate = `${p[2]}/${p[1]}/${p[0]}`; } catch(e){}
            const dispType = typeLabelsShort[c.type] || c.type;
            
            let badge = '';
            if (hasMultiple) {
                badge = `<div style="margin-top:5px;"><span class="expand-btn-${index}" style="display:inline-block; font-size:0.75em; background:#e0e7ff; color:#2563eb; padding:2px 8px; border-radius:12px; cursor:pointer; font-weight:bold; border: 1px solid #bfdbfe;"><i class="fas fa-chevron-down"></i> ${c.lines.length} Righe Totali</span></div>`;
                tr.style.cursor = "pointer";
                tr.addEventListener('mouseenter', () => tr.style.backgroundColor = '#f8fafc');
                tr.addEventListener('mouseleave', () => tr.style.backgroundColor = 'transparent');
            }

            tr.innerHTML = `
                <td style="font-size: 0.8em; color: #64748b; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${c.fileSorgente}">${c.fileSorgente}</td>
                <td style="font-size: 0.85em; padding:8px;">${dispDate}</td>
                <td style="font-family: monospace; font-weight: bold; color:#475569; padding:8px;">${c.numero}</td>
                <td style="font-size: 0.9em; font-weight: 500; padding:8px;">${c.fornitore}</td>
                <td style="font-size: 0.8em; padding:8px;"><strong>${dispType}</strong></td>
                <td style="font-size: 0.85em; padding:8px;">${c.category}</td>
                <td style="font-size: 0.85em; color: #475569; padding:8px;">${c.description}</td>
                <td style="font-size: 0.85em; color: #475569; padding:8px;">${c.dettaglio} ${badge}</td>
                <td style="font-family: monospace; text-align: center; padding:8px;">${hasMultiple ? '-' : c.quantita}</td>
                <td style="font-family: monospace; text-align: right; padding:8px;">${hasMultiple ? '-' : formatCurrency(c.prezzoUnitario)}</td>
                <td style="font-family: monospace; font-weight: bold; color: #0f172a; text-align: right; padding:8px;">${formatCurrency(c.amount)}</td>
            `;
            
            if (hasMultiple) {
                tr.addEventListener('click', () => {
                    const children = document.querySelectorAll(`.child-of-${index}`);
                    let isExpanded = false;
                    children.forEach(child => {
                        if (child.style.display === 'none') {
                            child.style.display = 'table-row';
                            isExpanded = true;
                        } else {
                            child.style.display = 'none';
                        }
                    });
                    const btn = tr.querySelector(`.expand-btn-${index}`);
                    if (isExpanded) {
                        btn.innerHTML = `<i class="fas fa-chevron-up"></i> Chiudi Righe`;
                        btn.style.background = '#dbeafe';
                    } else {
                        btn.innerHTML = `<i class="fas fa-chevron-down"></i> ${c.lines.length} Righe Totali`;
                        btn.style.background = '#e0e7ff';
                    }
                });
            }

            tbody.appendChild(tr);

            if (hasMultiple) {
                c.lines.forEach((line, lidx) => {
                    const ctr = document.createElement('tr');
                    ctr.className = `child-of-${index}`;
                    ctr.style.display = 'none';
                    ctr.style.backgroundColor = '#f1f5f9'; 
                    ctr.style.borderBottom = (lidx === c.lines.length - 1) ? '2px solid #cbd5e1' : '1px solid #e2e8f0';
                    
                    ctr.innerHTML = `
                         <td colspan="7" style="text-align:right; font-size:0.8em; color:#64748b; padding:8px 15px;">↳ Riga ${lidx+1} di ${c.lines.length}</td>
                         <td style="font-size:0.85em; color:#475569; padding:8px;">${line.dettaglio}</td>
                         <td style="font-family:monospace; text-align:center; padding:8px;">${line.quantita}</td>
                         <td style="font-family:monospace; text-align:right; padding:8px;">${formatCurrency(line.prezzoUnitario)}</td>
                         <td style="font-family:monospace; font-weight:bold; color:#0f172a; text-align:right; padding:8px;">${formatCurrency(line.amount)}</td>
                    `;
                    tbody.appendChild(ctr);
                });
            }
        });
    }

});
