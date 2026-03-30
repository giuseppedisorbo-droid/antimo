import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, query, where, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// Simulated App State
let currentUser = null; 
// Mock user profiles
const PROFILES = {
    "Paolo": { role: "worker", wallet: 0 },
    "Giuseppe": { role: "admin" },
    "Stefano": { role: "manager" }
};

// DOM Elements
const loginModal = document.getElementById('loginModal');
const loginUserSelect = document.getElementById('loginUserSelect');
const btnLogin = document.getElementById('btnLogin');
const currentUserDisplay = document.getElementById('currentUserDisplay');

const tabDashboard = document.getElementById('tab-dashboard');
const tabManager = document.getElementById('tab-manager');
const tabAdmin = document.getElementById('tab-admin');
const viewDashboard = document.getElementById('view-dashboard');
const viewManager = document.getElementById('view-manager');
const viewAdmin = document.getElementById('view-admin');

const btnOpenWallet = document.getElementById('btnOpenWallet');
const walletModal = document.getElementById('walletModal');
const btnCloseWallet = document.getElementById('btnCloseWallet');
const walletBalanceDisplay = document.getElementById('walletBalanceDisplay');
const modalWalletAmount = document.getElementById('modalWalletAmount');
const walletHistoryList = document.getElementById('walletHistoryList');
const btnRequestRecharge = document.getElementById('btnRequestRecharge');

const btnNewRequest = document.getElementById('btnNewRequest');
const newRequestModal = document.getElementById('newRequestModal');
const btnCloseRequestModal = document.getElementById('btnCloseRequestModal');
const newRequestForm = document.getElementById('newRequestForm');
const reqTargets = document.getElementById('reqTargets');

const btnQuickExpense = document.getElementById('btnQuickExpense');
const quickExpenseModal = document.getElementById('quickExpenseModal');
const btnCloseExpenseModal = document.getElementById('btnCloseExpenseModal');
const quickExpenseForm = document.getElementById('quickExpenseForm');
const expTaskRef = document.getElementById('expTaskRef');

// Initialize
function init() {
    setupEventListeners();
    checkAuthStatus();
    loadTargetsDropdown();
}

function checkAuthStatus() {
    const savedUser = localStorage.getItem('ps_user');
    if (savedUser && PROFILES[savedUser]) {
        loginAs(savedUser);
    } else {
        loginModal.classList.remove('hidden');
        populateLoginSelect();
    }
}

function populateLoginSelect() {
    loginUserSelect.innerHTML = '<option value="">-- Seleziona --</option>';
    Object.keys(PROFILES).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = `${name} (${PROFILES[name].role.toUpperCase()})`;
        loginUserSelect.appendChild(opt);
    });
}

function loginAs(userName) {
    currentUser = { name: userName, ...PROFILES[userName] };
    localStorage.setItem('ps_user', userName);
    loginModal.classList.add('hidden');
    
    currentUserDisplay.textContent = `Profilo: ${userName} (${currentUser.role})`;

    // Configure UI based on role
    tabManager.style.display = ['admin', 'manager'].includes(currentUser.role) ? 'block' : 'none';
    tabAdmin.style.display = currentUser.role === 'admin' ? 'block' : 'none';
    
    if (currentUser.role === 'worker') {
        btnOpenWallet.style.display = 'block';
        btnQuickExpense.classList.remove('hidden');
        tabDashboard.click();
        listenToWalletBalance();
    } else {
        btnOpenWallet.style.display = 'none';
        btnQuickExpense.classList.add('hidden');
        if (currentUser.role === 'admin') tabAdmin.click();
        else tabManager.click();
    }

    loadDataForRole();
}

function setupEventListeners() {
    btnLogin.addEventListener('click', () => {
        const u = loginUserSelect.value;
        if(u) loginAs(u);
    });

    currentUserDisplay.addEventListener('click', () => {
        if(confirm("Vuoi eseguire il Logout?")) {
            localStorage.removeItem('ps_user');
            location.reload();
        }
    });

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(e.target.dataset.target).classList.add('active');
        });
    });

    // Modals
    btnOpenWallet.addEventListener('click', () => walletModal.classList.remove('hidden'));
    btnCloseWallet.addEventListener('click', () => walletModal.classList.add('hidden'));

    btnNewRequest.addEventListener('click', () => newRequestModal.classList.remove('hidden'));
    btnCloseRequestModal.addEventListener('click', () => newRequestModal.classList.add('hidden'));

    btnQuickExpense.addEventListener('click', () => quickExpenseModal.classList.remove('hidden'));
    btnCloseExpenseModal.addEventListener('click', () => quickExpenseModal.classList.add('hidden'));

    // Forms
    newRequestForm.addEventListener('submit', handleNewRequest);
    quickExpenseForm.addEventListener('submit', handleNewExpense);
    btnRequestRecharge.addEventListener('click', handleRechargeRequest);
}

// ------ FIREBASE DATA LOGIC ------

async function loadTargetsDropdown() {
    // Seed hardcoded targets for UI
    const targets = ["Eubios", "Ortotek", "Anima Antiqua", "Famiglia Peppe", "Famiglia Stefano"];
    targets.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        reqTargets.appendChild(opt);
    });
}

function loadDataForRole() {
    listenToRequests();
    listenToTasks();
    if(currentUser.role === 'admin') {
        listenToExpensesToAllocate();
    }
}

// Real-time Requests
function listenToRequests() {
    const q = query(collection(db, "pp_requests"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        const list = document.getElementById('requestsList');
        list.innerHTML = '';
        if(snapshot.empty) {
            list.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">Nessuna richiesta.</div>';
            return;
        }
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const div = document.createElement('div');
            div.className = 'card';
            const targetsHtml = (data.targetOwnerIds || []).map(t => `<span class="card-target">${t}</span>`).join(' ');
            
            div.innerHTML = `
                <div class="card-title">${data.title}</div>
                <div class="card-meta">Da: ${data.requesterId} | Stato: <strong>${data.status}</strong></div>
                <div>${targetsHtml}</div>
                <p style="font-size:0.9rem; margin-top:8px;">${data.description}</p>
                ${(currentUser.role === 'admin' || currentUser.role === 'manager') && data.status === 'Pending' ? `
                    <button class="btn btn-success" style="margin-top:10px; padding:8px 15px; font-size:0.85rem;" onclick="window.approveRequest('${docSnap.id}')">Approva & Crea Task</button>
                ` : ''}
            `;
            list.appendChild(div);
        });
    });
}

// Real-time Tasks
function listenToTasks() {
    const q = query(collection(db, "pp_tasks"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        const list = document.getElementById('tasksList');
        list.innerHTML = '';
        expTaskRef.innerHTML = '<option value="">-- Seleziona Task Riferimento --</option>'; // per la modale spese

        if(snapshot.empty) {
            list.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">Nessuna attività assegnata.</div>';
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            
            // Allow worker to log expense against this task
            if(data.status !== 'Completed') {
                const opt = document.createElement('option');
                opt.value = docSnap.id;
                opt.textContent = `${data.title} (${data.status})`;
                expTaskRef.appendChild(opt);
            }

            // Filtraggio visivo per ruolo
            if(currentUser.role === 'worker' && data.assignedWorkerId !== currentUser.name) return;

            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `
                <div class="card-title">${data.title}</div>
                <div class="card-meta">Assegnato a: ${data.assignedWorkerId} | Stato: <strong>${data.status}</strong></div>
                ${data.status === 'Assigned' && currentUser.role === 'worker' ? `
                    <button class="btn btn-primary" style="margin-top:10px; padding:8px 15px; font-size:0.85rem; width:100%;" onclick="window.startTask('${docSnap.id}')">Inizia Lavoro</button>
                ` : ''}
                ${data.status === 'In Progress' && currentUser.role === 'worker' ? `
                    <button class="btn btn-success" style="margin-top:10px; padding:8px 15px; font-size:0.85rem; width:100%;" onclick="window.completeTask('${docSnap.id}')">Completa Task</button>
                ` : ''}
            `;
            list.appendChild(div);
        });
    });
}

// Wallet Listener for Worker
function listenToWalletBalance() {
    if(currentUser.role !== 'worker') return;
    const q = query(collection(db, "pp_cash_movements"), where("walletOwnerId", "==", currentUser.name), orderBy("date", "desc"));
    
    onSnapshot(q, (snapshot) => {
        let balance = 0;
        walletHistoryList.innerHTML = '';
        if(snapshot.empty) {
            walletHistoryList.innerHTML = '<li style="text-align:center; color:#64748b;">Nessun movimento.</li>';
        } else {
            // First doc is the latest balance since we order DESC
            let isFirst = true;
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                if(isFirst) {
                    balance = data.balanceAfter;
                    isFirst = false;
                }
                const li = document.createElement('li');
                const isPos = data.type === 'recharge';
                li.innerHTML = `<span>${data.note || data.type}</span><span class="${isPos ? 'pos' : 'neg'}">${isPos ? '+' : '-'}€ ${data.amount.toFixed(2)}</span>`;
                walletHistoryList.appendChild(li);
            });
        }
        
        walletBalanceDisplay.textContent = `€ ${balance.toFixed(2)}`;
        modalWalletAmount.textContent = `€ ${balance.toFixed(2)}`;
        currentUser.wallet = balance;
    });
}

// Admin Allocations View
function listenToExpensesToAllocate() {
    // Visualizza le spese loggate che necessitano split manuale (per semplificare, le mostriamo tutte)
    const q = query(collection(db, "pp_expenses"), orderBy("date", "desc"));
    onSnapshot(q, (snapshot) => {
        const list = document.getElementById('unallocatedExpensesList');
        list.innerHTML = '';
        if(snapshot.empty) {
            list.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">Nessuna spesa da splittare.</div>';
            return;
        }
        
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `
                <div class="flex-between" style="margin-bottom:8px;">
                    <div class="card-title">€ ${data.amount.toFixed(2)}</div>
                    <span style="font-size:0.8rem; background:#fef08a; padding:3px 8px; border-radius:10px;">Da Ripartire</span>
                </div>
                <div class="card-meta">Pagato da: ${data.paidByPersonId} | Fornitore: ${data.vendor}</div>
                <div style="margin-top:10px;">
                    <button class="btn btn-secondary" style="padding:5px 10px; font-size:0.85rem;" onclick="alert('Splitter UI: Permette di allocare la spesa tra Eubios/Famiglie/ecc.')">Esegui Ripartizione</button>
                </div>
            `;
            list.appendChild(div);
        });
    });
}

// ------ ACTIONS ------ //

async function handleNewRequest(e) {
    e.preventDefault();
    const targets = Array.from(reqTargets.selectedOptions).filter(o => !o.disabled).map(o => o.value);
    
    try {
        await addDoc(collection(db, "pp_requests"), {
            title: document.getElementById('reqTitle').value,
            description: document.getElementById('reqDesc').value,
            targetOwnerIds: targets,
            requesterId: currentUser.name,
            status: 'Pending',
            createdAt: serverTimestamp()
        });
        newRequestForm.reset();
        newRequestModal.classList.add('hidden');
    } catch(err) {
        console.error("Errore creazione richiesta", err);
    }
}

async function handleNewExpense(e) {
    e.preventDefault();
    const taskId = expTaskRef.value;
    const amount = parseFloat(document.getElementById('expAmount').value);
    const vendor = document.getElementById('expVendor').value;
    
    try {
        const expRef = await addDoc(collection(db, "pp_expenses"), {
            taskId,
            amount,
            vendor,
            paidByPersonId: currentUser.name,
            date: serverTimestamp()
        });

        // Dedurre dalla cassa
        if(currentUser.role === 'worker') {
            const newBal = (currentUser.wallet || 0) - amount;
            await addDoc(collection(db, "pp_cash_movements"), {
                walletOwnerId: currentUser.name,
                amount: amount,
                type: 'expense',
                referenceId: expRef.id,
                balanceAfter: newBal,
                note: `Acquisto: ${vendor}`,
                date: serverTimestamp()
            });
        }
        
        quickExpenseForm.reset();
        quickExpenseModal.classList.add('hidden');
    } catch(err) {
        console.error("Errore spesa", err);
    }
}

async function handleRechargeRequest() {
    if(confirm("Simula Ricarica Fondo da Admin per € 500?")) {
        try {
            const newBal = (currentUser.wallet || 0) + 500;
            await addDoc(collection(db, "pp_cash_movements"), {
                walletOwnerId: currentUser.name,
                amount: 500,
                type: 'recharge',
                referenceId: null,
                balanceAfter: newBal,
                note: `Ricarica Admin (Giuseppe)`,
                date: serverTimestamp()
            });
        } catch(e) { console.error(e); }
    }
}

// Window Globals per HTML onclick
window.approveRequest = async (reqId) => {
    try {
        const reqRef = doc(db, "pp_requests", reqId);
        const docSnap = await getDoc(reqRef);
        if(!docSnap.exists()) return;
        const reqData = docSnap.data();

        // 1. Update Request
        await updateDoc(reqRef, { status: 'Approved' });
        
        // 2. Spawn Task
        await addDoc(collection(db, "pp_tasks"), {
            requestId: reqId,
            title: `Task: ${reqData.title}`,
            assignedWorkerId: 'Paolo', // Auto-assign to Paolo for simplicity
            status: 'Assigned',
            targetOwnerIds: reqData.targetOwnerIds,
            createdAt: serverTimestamp()
        });
    } catch(e) { console.error(e); }
};

window.startTask = async (taskId) => {
    try {
        await updateDoc(doc(db, "pp_tasks", taskId), { status: 'In Progress' });
    } catch(e) { console.error(e); }
};

window.completeTask = async (taskId) => {
    try {
        await updateDoc(doc(db, "pp_tasks", taskId), { 
            status: 'Completed',
            completedAt: serverTimestamp() 
        });
    } catch(e) { console.error(e); }
};

init();
