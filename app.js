import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, query, where, onSnapshot, orderBy, deleteDoc, deleteField, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
const firebaseConfig = {apiKey: "AIzaSyAh7dwRs1j7Vxib7OlB7mVRB-MNthAo5NA", authDomain: "peppe-ai-platform.firebaseapp.com", projectId: "peppe-ai-platform", storageBucket: "peppe-ai-platform.firebasestorage.app", messagingSenderId: "214462018633", appId: "1:214462018633:web:f224407eba3b107e27fb98", measurementId: "G-54RQ3L1EDW"};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
let currentUser = null;
const appCache = { locations: {}, families: {}, organizations: {}, people: {}, external_workers: {}, labor_rates: {} };
let liveTasks = [], liveRequests = [], liveExpenses = [], liveCash = [], liveNotifications = [], liveLogs = [], liveWorkSessions = [];

const ICONS = {
 home: `<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`,
 agenda: `<svg viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/></svg>`,
 finance: `<svg viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v-2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>`,
 directory: `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 18H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V8h2v2zm0-4H6V4h2v2zm6 12h-4v-2h4v2zm0-4h-4v-2h4v2zm0-4h-4V8h4v2zm0-4h-4V4h4v2zm6 12h-4v-2h4v2zm0-4h-4v-2h4v2zm0-4h-4V8h4v2zm0-4h-4V4h4v2z"/></svg>`,
 report: `<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>`
};

window.togglePcMode = function() {
    document.body.classList.toggle('pc-mode');
    localStorage.setItem('pclayout', document.body.classList.contains('pc-mode'));
};
if (localStorage.getItem('pclayout') === 'true') {
    document.body.classList.add('pc-mode');
}

async function init() {
    await Promise.all(['locations','families','organizations','people','external_workers','labor_rates'].map(async coll => {
        const s = await getDocs(collection(db, coll));
        s.forEach(d => appCache[coll][d.id] = {...d.data(), id: d.id});
    }));
    
    const needsSeed = Object.keys(appCache.people).length === 0 || Object.keys(appCache.organizations).length === 0;
    if (needsSeed) {
        loginSelect.innerHTML = '<option value="">(Database Incompleto - Esegui Seed)</option>';
        alert("Attenzione: Il database Firestore (collezione 'people' o 'organizations') risulta vuoto o incompleto! Vai su /seed.html per inizializzare il DB della V3.");
    } else {
        loginSelect.innerHTML = '<option value="">-- Seleziona Utente --</option>';
    }
    
    Object.keys(appCache.people).forEach(id => {
        const p = appCache.people[id];
        p.roles = p.roles || [];
        const hasAccess = p.appAccess === true || (p.appAccess === undefined && ['giuseppe', 'teresa', 'caterina', 'stefano', 'davide', 'paolo', 'luca'].includes(id));
        if(p.active !== false && hasAccess) {
            let roleLbl = p.roles[0] || p.role || 'Utente';
            if(id === 'giuseppe') roleLbl = 'Admin totale';
            else if(id === 'davide' || id === 'teresa') roleLbl = 'Supervisore';
            else if(id === 'stefano' || id === 'caterina') roleLbl = 'Approvatore';
            else if(id === 'paolo') roleLbl = 'Operativo';
            const dispName = p.fullName || p.name || id;
            loginSelect.innerHTML += `<option value="${id}">${dispName} — ${roleLbl}</option>`;
        }
    });

    document.getElementById('btnLogin').addEventListener('click', () => {
        if(!loginSelect.value) return;
        currentUser = { id: loginSelect.value, ...appCache.people[loginSelect.value] };
        document.getElementById('loginOverlay').classList.remove('open');
        setTimeout(() => document.getElementById('loginOverlay').style.display='none', 300);
        boot();
    });
    
    document.getElementById('bottomNav').addEventListener('click', (e) => {
        const b = e.target.closest('.nav-item');
        if(!b) return;
        document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        document.querySelectorAll('.view-section').forEach(v=>v.classList.remove('active'));
        document.getElementById(b.dataset.target).classList.add('active');
        document.getElementById('headerTitle').textContent = b.dataset.title;
        if(b.dataset.target === 'view-agenda' && window.taskCalendar) {
            setTimeout(() => window.taskCalendar.render(), 100);
        }
    });

    document.getElementById('fabMain').addEventListener('click', openNewRequestWizard);
    document.querySelectorAll('.btn-close-modal').forEach(b => b.addEventListener('click', e => {
        const p = e.target.closest('.modal-fs, .bottom-sheet'); if(p) p.classList.remove('open');
        const bd = document.getElementById('bsBackdrop'); if(bd) bd.classList.remove('open');
    }));
    document.getElementById('btnNotifs').addEventListener('click', () => { document.getElementById('notifPanel').classList.add('open'); });
}

const logActivity = async(a, eT, eI)=>addDoc(collection(db,"activity_logs"),{userId:currentUser.id,userName:currentUser.fullName,action:a,entityType:eT,entityId:eI,timestamp:serverTimestamp()});
const sendNotification = async(tI, t, m)=>addDoc(collection(db,"notifications"),{userId:tI,title:t,message:m,read:false,createdAt:serverTimestamp()});
window.markNotifRead = async(id)=>updateDoc(doc(db,"notifications",id),{read:true});

function boot() {
    const dName = currentUser.fullName || currentUser.name || currentUser.id;
    document.getElementById('headerUserInfo').textContent = `${dName} | v6.4`;
    const r = currentUser.roles||[];
    let nav = '';
    const isSuper = r.includes('admin') || r.includes('owner') || r.includes('management_control') || r.includes('admin_support') || r.includes('domain_approver');
    if(isSuper) {
        nav = `<button class="nav-item active" data-target="view-home" data-title="Home Controllo">${ICONS.home}<span>Home</span></button>
               <button class="nav-item" data-target="view-agenda" data-title="Agenda">${ICONS.agenda}<span>Agenda</span></button>
               <button class="nav-item" data-target="view-finance" data-title="Costi e Spese">${ICONS.finance}<span>Finanza</span></button>
               <button class="nav-item" data-target="view-directory" data-title="Rubrica">${ICONS.directory}<span>Enti</span></button>
               <button class="nav-item" data-target="view-report" data-title="Report Statistico">${ICONS.report}<span>Report</span></button>`;
    } else if(r.includes('technician')||r.includes('coordinator')) {
        nav = `<button class="nav-item active" data-target="view-home" data-title="Oggi">${ICONS.home}<span>Oggi</span></button>
               <button class="nav-item" data-target="view-agenda" data-title="Agenda">${ICONS.agenda}<span>Agenda</span></button>
               <button class="nav-item" data-target="view-finance" data-title="Cassa">${ICONS.finance}<span>Cassa</span></button>
               <button class="nav-item" data-target="view-directory" data-title="Rubrica">${ICONS.directory}<span>Rubrica</span></button>`;
        document.getElementById('headerWallet').classList.remove('hidden');
    } else {
        nav = `<button class="nav-item active" data-target="view-home" data-title="Le Mie Richieste">${ICONS.home}<span>Home</span></button>
               <button class="nav-item" data-target="view-agenda" data-title="Agenda">${ICONS.agenda}<span>Agenda</span></button>
               <button class="nav-item" data-target="view-directory" data-title="Proprietà">${ICONS.directory}<span>Proprietà</span></button>`;
    }
    document.getElementById('bottomNav').innerHTML = nav;

    onSnapshot(query(collection(db,"tasks"),orderBy("createdAt","desc")), snap=>{liveTasks=snap.docs.map(d=>({id:d.id,...d.data()})); renderHome(); renderAgenda(); renderReport();});
    onSnapshot(query(collection(db,"requests"),orderBy("createdAt","desc")), snap=>{liveRequests=snap.docs.map(d=>({id:d.id,...d.data()})); renderHome();});
    onSnapshot(query(collection(db,"expenses"),orderBy("createdAt","desc")), snap=>{liveExpenses=snap.docs.map(d=>({id:d.id,...d.data()})); renderFinance(); renderReport();});
    onSnapshot(query(collection(db,"cash_movements"),orderBy("createdAt","desc")), snap=>{liveCash=snap.docs.map(d=>({id:d.id,...d.data()})); if(r.includes('technician')){const bal=liveCash.filter(c=>c.givenTo===currentUser.id).sort((a,b)=>b.createdAt-a.createdAt)[0]?.balanceAfter||0; document.getElementById('headerWallet').textContent=`€${bal.toFixed(2)}`; currentUser.wallet=bal;} renderFinance();});
    onSnapshot(query(collection(db,"notifications"),where("userId","==",currentUser.id)), snap=>{
        const todayIso = new Date().toISOString().split('T')[0];
        liveNotifications=snap.docs.map(d=>({id:d.id,...d.data()}))
        .filter(n => !n.scheduledStart || n.scheduledStart.split('T')[0] >= todayIso)
        .sort((a,b)=>b.createdAt-a.createdAt);
        const unread = liveNotifications.filter(n=>!n.read);
        const x=unread.length; 
        const b=document.getElementById('notifBadge'); 
        if(x>0){b.textContent=x;b.classList.remove('hidden');}else b.classList.add('hidden'); 
        document.getElementById('notifList').innerHTML = unread.length === 0 ? '<p class="text-center text-muted" style="padding:20px;">Nessuna nuova notifica.</p>' : unread.map(n=>`<div class="card" onclick="window.markNotifRead('${n.id}')" style="border-left:4px solid var(--danger); cursor:pointer;"><strong>${n.title}</strong><p>${n.message}</p></div>`).join('');
    });
    onSnapshot(query(collection(db,"activity_logs")), snap=>liveLogs=snap.docs.map(d=>({id:d.id,...d.data()})));
    onSnapshot(query(collection(db,"work_sessions"),orderBy("createdAt","desc")), snap=>{liveWorkSessions=snap.docs.map(d=>({id:d.id,...d.data()})); renderFinance(); renderReport();});
    renderDirectory();
}

const getEntTags=(fam,org)=>`${(fam||[]).map(x=>`<span class="entity-tag family">${appCache.families[x]?.name}</span>`).join('')}${(org||[]).map(x=>`<span class="entity-tag org">${appCache.organizations[x]?.name}</span>`).join('')}`;

function renderHome() {
    const feed = document.getElementById('feedList'); feed.innerHTML='';

    const isAdmin = currentUser.roles.includes('admin') || currentUser.roles.includes('owner');
    const isSupervisor = currentUser.roles.includes('management_control') || currentUser.roles.includes('admin_support');
    const isDomainApprover = currentUser.roles.includes('domain_approver');
    const isWorker = currentUser.roles.includes('technician');

    const myFam = [...(currentUser.familyIds||[]), ...(currentUser.familyIds||[]).map(f=>f.replace('famiglia_','fam_'))];
    const myOrgs = (currentUser.organizationRoles||[]).map(x=>x.organizationId);

    const canSee = (item) => {
        if(isAdmin) return true;
        if(isSupervisor) {
            if(item.status === 'pending_approval' || item.status === 'new' || item.status === 'completed' || item.status === 'accounted') return true;
            if((item.familyIds||[]).includes('famiglia_teresa') || (item.familyIds||[]).includes('fam_teresa')) return true;
            if((item.organizationIds||[]).includes('eubios') || (item.organizationIds||[]).includes('org_eubios')) return true;
            return false;
        }
        if(isDomainApprover) {
            if(item.status === 'pending_approval' && (
                (item.familyIds||[]).some(x=>myFam.includes(x)) || 
                (item.organizationIds||[]).some(x=>myOrgs.includes(x))
            )) return true;
            if((item.familyIds||[]).some(x=>myFam.includes(x))) return true;
            if((item.organizationIds||[]).some(x=>myOrgs.includes(x))) return true;
            return false;
        }
        if(isWorker) {
            if(item.assignedTo === currentUser.id) return true;
            if(item.requestedBy === currentUser.id) return true;
            return false;
        }
        return false;
    };

    const getPriCounters = (filterType) => {
        let count = 0, newCount = 0;
        liveTasks.forEach(t => {
            if((t.status === 'completed' || t.status === 'accounted') && filterType !== 'completed' && filterType !== 'accounted') return;
            if(!canSee(t)) return; // <-- Only count what user can see
            
            let match = false;
            if(filterType === 'all') match = true;
            else if(filterType === 'completed') { if(t.status === 'completed') match = true; }
            else if(filterType === 'accounted') { if(t.status === 'accounted') match = true; }
            else if(filterType === 'high') { if(t.priority==='high') match=true; }
            else if(filterType === 'medium') { if(t.priority==='medium' || !t.priority) match=true; }
            else if(filterType === 'low') { if(t.priority==='low') match=true; }
            else if(filterType === 'scheduled') { if(t.scheduledStart) match=true; }
            if(match) { count++; if(!(t.readBy||[]).includes(currentUser.id)) newCount++; }
        });
        return {count, newCount};
    };

    let dashHtml = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px;">`;
    const btns = [
        {id:'all', label:'TUTTI I TASK', bg:'#10b981'},
        {id:'high', label:'Alta Priorità', bg:'#dc2626'},
        {id:'medium', label:'Media Priorità', bg:'#d97706'},
        {id:'low', label:'Bassa Priorità', bg:'#2563eb'},
        {id:'scheduled', label:'Programmati', bg:'#0284c7'},
        {id:'completed', label:'Completati', bg:'#059669'},
        {id:'accounted', label:'Contabilizzati', bg:'#3b82f6'}
    ];
    btns.forEach((b, i) => {
        const c = getPriCounters(b.id);
        const span = (b.id === 'all') ? `grid-column: 1 / -1;` : '';
        dashHtml += `<div onclick="window.openPivotModal('${b.id}')" class="shadow-sm" style="background:${b.bg}; color:white; padding:15px; border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; position:relative; ${span} transition:0.2s;" onmouseover="this.style.opacity=0.9" onmouseout="this.style.opacity=1">
            <div style="font-weight:bold; font-size:1.1rem; text-align:center;">${b.label}</div>
            <div style="font-size:1.8rem; font-weight:800; margin-top:5px;">${c.count}</div>
            ${c.newCount > 0 ? `<div style="position:absolute; top:-8px; right:-8px; background:var(--danger); color:white; border-radius:12px; padding:4px 10px; font-size:0.85rem; font-weight:bold; border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.2); animation: pulse 2s infinite;">${c.newCount} Nuovi</div>` : ''}
        </div>`;
    });
    dashHtml += `</div>`;
    feed.innerHTML = dashHtml;


    if(isAdmin || isSupervisor || isDomainApprover) {
        liveRequests.filter(r=> (r.status==='new'||r.status==='approved') && canSee(r)).forEach(r => feed.innerHTML += `<div class="card"><div class="card-header"><span class="status-badge status-${r.status}">${r.status}</span> <span style="font-size:0.8rem;color:var(--text-muted)">📍 ${appCache.locations[r.locationId]?.name||'N/D'}</span></div><div class="card-title">${r.title}</div><p style="font-size:0.9rem;color:#666">${r.description}</p><div class="entity-tags">${getEntTags(r.familyIds,r.organizationIds)}</div><button class="btn btn-primary mt-2" onclick="window.openApproveWizard('${r.id}')">Assegna e Pianifica</button></div>`);
        liveTasks.filter(t=>t.status==='pending_approval' && canSee(t)).forEach(t => feed.innerHTML += `<div class="card" style="border-left: 5px solid var(--warning)"><div class="card-header"><span class="status-badge" style="background:var(--warning); color:white;">Proposto da ${t.requestedBy ? (appCache.people[t.requestedBy]?.shortName || appCache.people[t.requestedBy]?.name || t.requestedBy) : 'Tecnico'}</span></div><div class="card-title">${t.title}</div><div class="entity-tags">${getEntTags(t.familyIds,t.organizationIds)}</div><button class="btn btn-success mt-2" onclick="window.execAction('APPROVE_PROPOSED','${t.id}')">👍 Approva (Inizia Oggi)</button></div>`);
        liveTasks.filter(t=>t.status!=='completed' && t.status!=='pending_approval' && canSee(t)).forEach(t => feed.innerHTML += `<div class="card" onclick="window.openTaskDetail('${t.id}')"><div class="card-header"><span class="status-badge status-${t.status}">${t.status}</span> <div style="text-align:right"><div style="font-weight:bold;color:var(--primary);font-size:0.8rem">${t.scheduledStart?new Date(t.scheduledStart).toLocaleDateString():''}</div><span style="font-size:0.75rem;color:var(--text-muted)">📍 ${appCache.locations[t.locationId]?.name}</span></div></div><div class="card-title">${t.title}</div><div class="entity-tags">${getEntTags(t.familyIds,t.organizationIds)}</div></div>`);
    } else if(isWorker) {
        const todayStr = new Date().toISOString().split('T')[0];
        let validTasks = liveTasks.filter(t => t.assignedTo === currentUser.id && t.status !== 'completed');
        
        const morning = []; const afternoon = []; const pendingProps = [];
        
        validTasks.forEach(t => {
            if(t.status==='pending_approval') { pendingProps.push(t); return; }
            const isUrgent = t.priority === 'high' || t.priority === 'urgent';
            let tgt = afternoon;
            if(t.scheduledStart) {
                const d = new Date(t.scheduledStart); const hrs = d.getHours(); const dStr = t.scheduledStart.split('T')[0];
                if(dStr < todayStr && !isUrgent) tgt = morning; // Overdue top priority
                else if(dStr === todayStr) tgt = hrs < 13 ? morning : afternoon;
                else if(isUrgent) tgt = morning;
                else return; // Future skipped
            } else { if(isUrgent) tgt = morning; }
            tgt.push(t);
        });

        const sortAgenda = (arr) => arr.sort((a,b) => {
            const aU=(a.priority==='high'||a.priority==='urgent')?1:0, bU=(b.priority==='high'||b.priority==='urgent')?1:0;
            if(aU !== bU) return bU - aU;
            if(a.locationId && b.locationId && a.locationId !== b.locationId) return a.locationId.localeCompare(b.locationId);
            if(a.scheduledStart && b.scheduledStart) return a.scheduledStart.localeCompare(b.scheduledStart);
            return 0;
        });

        sortAgenda(morning); sortAgenda(afternoon);

        let html = '';
        if(morning.length===0 && afternoon.length===0 && pendingProps.length===0) { feed.innerHTML += '<div class="text-center text-muted mt-4 mb-4">Nessuna attività pendente per oggi. Vai al mare! 🏖️</div>'; return; }

        const buildQA = (t) => `
            <div class="card" style="border-left: 5px solid ${t.priority==='urgent'||t.priority==='high'?'var(--danger)':'var(--primary)'}">
                <div class="card-header">
                    <div><span class="status-badge status-${t.status}">${t.status}</span> ${t.priority==='urgent'||t.priority==='high'?'<span class="status-badge badge-urgent">🚨 URGENTE</span>':''} ${t.needsMaterial?'<span class="status-badge badge-material">📦 NO MAT</span>':''}</div>
                    <div style="text-align:right"><span style="font-size:0.85rem; font-weight:bold; color:var(--text-main); display:block;">${t.scheduledStart?`🕒 ${new Date(t.scheduledStart).getHours().toString().padStart(2,'0')}:${new Date(t.scheduledStart).getMinutes().toString().padStart(2,'0')}`:'Nessun Orario'}</span><span style="font-size:0.75rem; color:var(--text-muted)">📍 ${appCache.locations[t.locationId]?.name||'N/D'}</span></div>
                </div>
                <div class="card-title" onclick="window.openTaskDetail('${t.id}')" style="cursor:pointer; margin-bottom:8px;">${t.title}</div>
                <div class="entity-tags" style="margin-bottom:10px;">${getEntTags(t.familyIds,t.organizationIds)}</div>
                <div class="quick-actions-bar">
                    <button class="qa-btn qa-close" onclick="window.execAction('COMP_TASK','${t.id}')"><svg viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>Chiudi</button>
                    <button class="qa-btn qa-material" onclick="window.execAction('TOGGLE_MATERIAL','${t.id}')"><svg viewBox="0 0 24 24"><path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/></svg>Materia</button>
                    <button class="qa-btn qa-expense" onclick="window.openExpenseWizard('${t.id}')"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.11-1.36-3.11-2.92v-.46h2.26v.29c0 .61.75 1.14 2.18 1.14 1.63 0 2.21-.6 2.21-1.31 0-.89-.96-1.32-2.5-1.84-1.86-.64-3.32-1.52-3.32-3.23 0-1.54 1.25-2.58 2.95-2.92V4h2.67v1.94c1.55.33 2.81 1.25 2.81 2.8v.4h-2.2v-.23c0-.68-.81-1.21-2.04-1.21-1.52 0-2.12.59-2.12 1.22 0 .84.85 1.22 2.5 1.76 1.88.62 3.32 1.54 3.32 3.26 0 1.58-1.23 2.62-2.94 2.91z"/></svg>Spesa</button>
                    <button class="qa-btn qa-reschedule" onclick="window.openRescheduleWizard('${t.id}')"><svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>Sposta</button>
                </div>
            </div>`;

        if(morning.length > 0) { html += '<h3 style="margin-bottom:12px; color:var(--primary); font-size:1.1rem; border-bottom:2px solid var(--border); padding-bottom:5px;">☀️ Mattina</h3>'; morning.forEach(t => html += buildQA(t)); }
        if(afternoon.length > 0) { html += '<h3 style="margin-top:20px; margin-bottom:12px; color:var(--primary); font-size:1.1rem; border-bottom:2px solid var(--border); padding-bottom:5px;">🌙 Pomeriggio</h3>'; afternoon.forEach(t => html += buildQA(t)); }
        if(pendingProps.length > 0) { html += '<h3 style="margin-top:20px; margin-bottom:12px; color:var(--warning); font-size:1.1rem; border-bottom:2px solid var(--border); padding-bottom:5px;">🟡 Proposti (In Attesa)</h3>'; pendingProps.forEach(t => html += `<div class="card" style="border-left: 5px solid var(--warning)"><div class="card-header"><div><span class="status-badge" style="background:var(--warning); color:white;">⏳ IN ATTESA</span></div><div style="text-align:right"><span style="font-size:0.75rem; color:var(--text-muted)">📍 ${appCache.locations[t.locationId]?.name||'N/D'}</span></div></div><div class="card-title" onclick="window.openTaskDetail('${t.id}')" style="cursor:pointer;">${t.title}</div><div class="entity-tags" style="margin-bottom:10px;">${getEntTags(t.familyIds,t.organizationIds)}</div></div>`); }
        feed.innerHTML += html;
    } else {
        liveTasks.filter(t=> t.requestedBy===currentUser.id || (t.familyIds||[]).some(b=>myFam.includes(b)) || (t.organizationIds||[]).some(b=>myOrgs.includes(b)))
                 .forEach(t => {
                     let hb = '';
                     if(t.status === 'pending_approval' && (
                         (t.familyIds||[]).some(b=>myFam.includes(b)) || (t.organizationIds||[]).some(b=>myOrgs.includes(b))
                     )) hb = `<button class="btn btn-success mt-2" onclick="window.execAction('APPROVE_PROPOSED','${t.id}')" style="display:block; width:100%;">👍 Approva Task Proposto</button>`;
                     feed.innerHTML += `<div class="card" onclick="window.openTaskDetail('${t.id}')"><div class="card-title">${t.title}</div><span class="status-badge status-${t.status} mt-2">${t.status}</span>${hb}</div>`;
                 });
    }
}

window.taskCalendar = null;
window.selectedAgendaDate = null;
window.getStatusText = (s) => s === 'assigned' ? 'APPROVATO' : (s === 'pending_approval' ? 'DA APPROVARE' : (s === 'in_progress' ? 'IN CORSO' : (s === 'completed' ? 'COMPLETATO' : (s === 'accounted' ? 'CONTABILIZZATO' : s.toUpperCase()))));

window.filterAgendaList = (dateStr) => {
    window.selectedAgendaDate = dateStr;
    const btn = document.getElementById('btnShowAllCards');
    const title = document.getElementById('agendaListTitle');
    if(dateStr) {
        if(btn) btn.style.display = 'block';
        if(title) {
            const d = new Date(dateStr);
            title.textContent = `Interventi del ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
        }
    } else {
        if(btn) btn.style.display = 'none';
        if(title) title.textContent = 'Prossimi Interventi';
    }
    renderAgendaCards();
};

const DAY_COLORS = [
    { bg: '#a855f7', text: '#ffffff' }, // Dom 0
    { bg: '#ef4444', text: '#ffffff' }, // Lun 1
    { bg: '#f97316', text: '#ffffff' }, // Mar 2
    { bg: '#fcd34d', text: '#000000' }, // Mer 3
    { bg: '#10b981', text: '#ffffff' }, // Gio 4
    { bg: '#0ea5e9', text: '#ffffff' }, // Ven 5
    { bg: '#6366f1', text: '#ffffff' }  // Sab 6
];

function renderAgendaCards() {
    const listEl = document.getElementById('agendaList');
    if(!listEl) return;
    listEl.innerHTML = '';
    
    const isSuper = currentUser.roles.includes('admin') || currentUser.roles.includes('owner') || currentUser.roles.includes('management_control') || currentUser.roles.includes('admin_support') || currentUser.roles.includes('domain_approver');
    let q = liveTasks;
    if(!isSuper) {
        if(currentUser.roles.includes('technician')) {
            q = liveTasks.filter(t=>t.assignedTo===currentUser.id);
        } else {
            const myFam = [...(currentUser.familyIds||[]), ...(currentUser.familyIds||[]).map(f=>f.replace('famiglia_','fam_'))];
            const myOrgs = (currentUser.organizationRoles||[]).map(x=>x.organizationId);
            q = liveTasks.filter(t=> t.requestedBy===currentUser.id || (t.familyIds||[]).some(b=>myFam.includes(b)) || (t.organizationIds||[]).some(b=>myOrgs.includes(b)));
        }
    }
    q = q.filter(t => t.scheduledStart && t.status !== 'completed');
    
    if(window.selectedAgendaDate) {
        q = q.filter(t => t.scheduledStart.startsWith(window.selectedAgendaDate));
    }
    
    q.sort((a,b)=>a.scheduledStart.localeCompare(b.scheduledStart)).forEach(t => {
        const d = new Date(t.scheduledStart);
        const dayIdx = d.getDay();
        const colors = DAY_COLORS[dayIdx];
        
        const loc = appCache.locations[t.locationId]?.name || 'N/D';
        const ur = (t.priority === 'urgent' || t.priority === 'high') ? `<span class="status-badge badge-urgent" style="margin-left:5px;">🚨 URGENTE</span>` : '';
        const assignedName = appCache.people[t.assignedTo]?.fullName || t.assignedTo || 'Nessuno';
        
        listEl.innerHTML += `
        <div class="card" onclick="window.openTaskDetail('${t.id}')" style="background-color:${colors.bg}; color:${colors.text}; border-radius:12px; margin-bottom:12px; border:none;">
            <div class="flex-between">
                <div style="font-weight:bold; font-size:1.1rem;">🕒 ${t.scheduledStart.split('T')[1]} - ${d.getDate()}/${d.getMonth()+1}</div>
                <div style="font-size:0.8rem; background:rgba(255,255,255,0.3); padding:3px 8px; border-radius:12px; font-weight:bold;">👤 ${assignedName}</div>
            </div>
            <div class="card-title mt-2" style="font-weight:800; font-size:1.15rem; color:${colors.text};">${t.title} ${ur}</div>
            <div style="font-size:0.85rem; margin-top:5px; opacity:0.95;">📍 ${loc}</div>
            <div style="font-size:0.85rem; margin-top:5px; font-weight:800; opacity:0.95;">${window.getStatusText(t.status)}</div>
        </div>`;
    });
    
    if(q.length === 0) {
        listEl.innerHTML = `<div class="text-center text-muted" style="padding:20px;">Nessun intervento.</div>`;
    }
}

function renderAgenda() {
    const btn = document.getElementById('btnWorkerSessionCal');
    if(btn) btn.style.display = currentUser.roles.includes('technician') ? 'inline-flex' : 'none';

    renderAgendaCards();

    const calEl = document.getElementById('calendarContainer');
    if(!calEl) return;
    
    const events = [];
    const isSuper = currentUser.roles.includes('admin') || currentUser.roles.includes('owner') || currentUser.roles.includes('management_control') || currentUser.roles.includes('admin_support') || currentUser.roles.includes('domain_approver');
    let q = liveTasks;
    if(!isSuper) {
        if(currentUser.roles.includes('technician')) {
            q = liveTasks.filter(t=>t.assignedTo===currentUser.id);
        } else {
            const myFam = [...(currentUser.familyIds||[]), ...(currentUser.familyIds||[]).map(f=>f.replace('famiglia_','fam_'))];
            const myOrgs = (currentUser.organizationRoles||[]).map(x=>x.organizationId);
            q = liveTasks.filter(t=> t.requestedBy===currentUser.id || (t.familyIds||[]).some(b=>myFam.includes(b)) || (t.organizationIds||[]).some(b=>myOrgs.includes(b)));
        }
    }
    
    q.filter(t => t.scheduledStart).forEach(t => {
        const d = new Date(t.scheduledStart);
        const dayIdx = d.getDay();
        const colors = DAY_COLORS[dayIdx];
        events.push({
            id: t.id,
            title: t.title,
            start: t.scheduledStart,
            end: t.scheduledEnd || t.scheduledStart,
            backgroundColor: colors.bg,
            borderColor: colors.bg,
            textColor: colors.text,
            extendedProps: { taskId: t.id }
        });
    });

    if(!window.taskCalendar) {
        if(typeof FullCalendar !== 'undefined') {
            window.taskCalendar = new FullCalendar.Calendar(calEl, {
                initialView: 'dayGridMonth',
                locale: 'it',
                firstDay: 1, // Start on Monday
                headerToolbar: {
                    left: 'prev,next',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay'
                },
                buttonText: { today: 'Oggi', month: 'Mese', week: 'Sett', day: 'Giorno' },
                height: '100%',
                events: events,
                eventClick: function(info) {
                    window.openTaskDetail(info.event.extendedProps.taskId);
                },
                dateClick: function(info) {
                    window.filterAgendaList(info.dateStr);
                    document.getElementById('agendaListTitle').scrollIntoView({behavior: 'smooth', block: 'start'});
                }
            });
            window.taskCalendar.render();
        }
    } else {
        window.taskCalendar.removeAllEvents();
        window.taskCalendar.addEventSource(events);
    }
}

function renderFinance() {
    const fl = document.getElementById('financeList'); fl.innerHTML='';
    const isSuper = currentUser.roles.includes('admin') || currentUser.roles.includes('owner') || currentUser.roles.includes('management_control') || currentUser.roles.includes('admin_support') || currentUser.roles.includes('domain_approver');
    
    if(currentUser.roles.includes('technician') && !isSuper) {
        let h = `<h3>Le Mie Spese (Da Giustificare)</h3>`;
        const pend = liveExpenses.filter(e => e.paidBy === currentUser.id && e.status === 'pending_approval');
        if(pend.length === 0) h += `<p class="text-muted text-center">Nessuna spesa in sospeso.</p>`;
        pend.forEach(e => {
            h += `<div class="card" style="border-left: 4px solid var(--warning)">
                <div class="flex-between"><strong>€ ${e.amount.toFixed(2)}</strong> <span class="status-badge" style="background:var(--warning); color:white;">⏳ IN ATTESA</span></div>
                <div class="card-meta mt-2">${e.description}</div>
                                ${!e.receiptUrl ? `<div class="mt-2"><span class="status-badge" style="background:#fee2e2; color:#b91c1c;">⚠️ MANCA SCONTRINO</span></div><button class="btn btn-secondary mt-2" onclick="window.attachReceipt('${e.id}')">📷 Fai Foto Scontrino</button>` : `<div class="mt-2"><span class="status-badge" style="background:#d1fae5; color:#059669;">🧾 SCONTRINO OK</span></div>`}
                <div class="mt-2" style="display:flex; gap:10px;">
                    <button class="btn btn-outline" style="flex:1; padding:8px;" onclick="window.editExpense('${e.id}')">✏️ Modifica</button>
                    <button class="btn btn-danger btn-outline" style="flex:1; padding:8px;" onclick="window.deleteExpense('${e.id}', true)">🗑️ Elimina</button>
                </div>
            </div>`;
        });

        h += `<h3 class="mt-4">Storico Cassa</h3><ul style="list-style:none; padding:10px 0;">`;
        liveCash.filter(c=>c.givenTo===currentUser.id).sort((a,b)=>b.createdAt-a.createdAt).forEach(c=> { 
            const p=c.type==='advance'||c.type==='reimbursement'||c.type==='adjustment'; 
            let btns = '';
            if(c.relatedExpenseId) {
                btns = `<span style="margin-left:8px;"><button style="background:none;border:none;cursor:pointer;font-size:1.1rem;padding:0 5px;" onclick="window.editExpense('${c.relatedExpenseId}')">✏️</button><button style="background:none;border:none;cursor:pointer;font-size:1.1rem;padding:0 5px;" onclick="window.deleteExpense('${c.relatedExpenseId}', true)">🗑️</button></span>`;
            }
            h+=`<li class="flex-between" style="padding:12px 0; border-bottom:1px solid var(--border); align-items:center;"><div><span style="font-weight:500;">${c.reason||c.type}</span>${btns}</div> <strong style="color:${p?'var(--success)':'var(--danger)'}">${p?'+':'-'}€${c.amount.toFixed(2)}</strong></li>`
        });
        fl.innerHTML = h+`</ul><button class="btn btn-primary mt-4 mb-4" onclick="window.openExpenseWizard()">➕ Aggiungi Spesa (Preleva da Cassa)</button>`;
    }
    if(isSuper) {
        let h = `<h3>Fondi Operatori</h3>`;
        Object.values(appCache.people).filter(p=>p.roles.includes('technician') && p.id!=='luca').forEach(w => {
            const cList = liveCash.filter(c=>c.givenTo===w.id).sort((a,b)=>b.createdAt-a.createdAt);
            const bal = cList.length > 0 ? cList[0].balanceAfter : 0;
            h += `<div class="card flex-between" style="align-items:center;"><div><strong>${w.fullName}</strong><div style="font-size:1.2rem; color:${bal<0?'var(--danger)':'var(--success)'}; font-weight:bold;">€ ${bal.toFixed(2)}</div></div> <button class="btn btn-info" style="width:auto; padding:8px 15px;" onclick="window.topUpWallet('${w.id}')">Ricarica Fondo</button></div>`;
        });
        h += `<h3 class="mt-4">Gestione Tutte le Spese</h3>`;
        
        const isDomainAppr = currentUser.roles.includes('domain_approver');
        const myFam = [...(currentUser.familyIds||[]), ...(currentUser.familyIds||[]).map(f=>f.replace('famiglia_','fam_'))];
        const myOrgs = (currentUser.organizationRoles||[]).map(x=>x.organizationId);

        let unalloc = liveExpenses;
        
        if(isDomainAppr) {
            unalloc = unalloc.filter(e => {
                if(e.taskId) {
                    const t = liveTasks.find(x=>x.id===e.taskId);
                    if(t && ((t.familyIds||[]).some(b=>myFam.includes(b)) || (t.organizationIds||[]).some(b=>myOrgs.includes(b)))) return true;
                }
                if((e.allocations||[]).some(a=> myFam.includes(a.entityId) || myOrgs.includes(a.entityId))) return true;
                return false;
            });
        }
        
        // Ordina per data creazione per avere le ultime
        unalloc.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));

        if(unalloc.length === 0) h += `<p class="text-muted text-center">Nessuna spesa nel database.</p>`;
        unalloc.forEach(e => {
            const isAlloc = e.allocations && e.allocations.length > 0;
            const badge = e.status === 'pending_approval' ? `<span class="status-badge" style="background:var(--warning); color:white;">⏳ DA APPROVARE</span>` : (isAlloc ? `<span class="status-badge status-completed">ALLOCATA</span>` : `<span class="status-badge status-new">DA ALLOCARE</span>`);
            h += `<div class="card" style="border-left: 4px solid ${isAlloc?'var(--success)':'var(--primary)'}">
                <div class="flex-between">
                    <strong>€ ${e.amount.toFixed(2)}</strong>
                    ${badge}
                </div>
                <div class="card-meta mt-2">Da: ${appCache.people[e.paidBy]?.shortName || e.paidBy} | ${e.description}</div>
                                ${(e.status==='pending_approval')?'':(!e.receiptUrl ? `<div class="mt-2"><span class="status-badge" style="background:#fee2e2; color:#b91c1c;">⚠️ NESSUN SCONTRINO</span></div>` : `<div class="mt-2"><span class="status-badge" style="background:#d1fae5; color:#059669;">🧾 SCONTRINO OK</span></div>`)}
                <div class="mt-2" style="display:flex; gap:10px;">
                    ${!isAlloc ? `<button class="btn btn-primary" style="flex:2;" onclick="window.openAllocationWizard('${e.id}', 'expenses')">Ripartisci</button>` : `<button class="btn btn-secondary" style="flex:2;" onclick="window.openAllocationWizard('${e.id}', 'expenses')">Rivedi</button>`}
                    <button class="btn btn-outline" style="flex:1; padding:8px;" onclick="window.editExpense('${e.id}')">✏️</button>
                    <button class="btn btn-danger btn-outline" style="flex:1; padding:8px;" onclick="window.deleteExpense('${e.id}', false)">🗑️</button>
                </div>
            </div>`;
        });
        h += `<h3 class="mt-4">Gestione Manovalanza</h3>`;
        const unallocW = liveWorkSessions.sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
        if(unallocW.length === 0) h += `<p class="text-muted text-center">Nessuna manovalanza.</p>`;
        unallocW.forEach(w => {
            const wName = appCache.external_workers[w.workerId]?.fullName || w.workerId.toUpperCase();
            const isAlloc = w.allocations && w.allocations.length > 0;
            h += `<div class="card" style="border-left: 4px solid ${isAlloc?'var(--success)':'var(--primary)'}">
                <div class="flex-between"><strong>€ ${w.totalCost.toFixed(2)}</strong><span class="status-badge ${isAlloc?'status-completed':'status-new'}">${isAlloc?'ALLOCATO':'DA ALLOCARE'}</span></div>
                <div class="card-meta mt-2">Manovale: <strong>${wName}</strong> | In Data: ${w.date}</div>
                <div class="mt-2" style="display:flex; gap:10px;">
                    ${!isAlloc ? `<button class="btn btn-primary" style="flex:2;" onclick="window.openAllocationWizard('${w.id}', 'work_sessions')">Ripartisci</button>`:`<button class="btn btn-secondary" style="flex:2;" onclick="window.openAllocationWizard('${w.id}', 'work_sessions')">Rivedi</button>`}
                    <button class="btn btn-outline" style="flex:1; padding:8px;" onclick="window.editWorkSession('${w.id}')">✏️</button>
                    <button class="btn btn-danger btn-outline" style="flex:1; padding:8px;" onclick="window.deleteWorkSession('${w.id}')">🗑️</button>
                </div>
            </div>`;
        });
        fl.innerHTML = h;
    }
}

window.toggleDirSection = (sec) => {
    const el = document.getElementById('dir_sec_' + sec);
    if(el.style.display === 'none') el.style.display = 'block';
    else el.style.display = 'none';
};

window.addDirectoryItem = async (coll) => {
    const name = prompt("Inserisci il nome per il nuovo elemento:");
    if(!name || !name.trim()) return;
    try {
        const docRef = await addDoc(collection(db, coll), { name: name.trim() });
        appCache[coll][docRef.id] = { name: name.trim() };
        renderDirectory();
    } catch(e) {
        alert("Errore salvataggio: " + e.message);
    }
};

window.addLaborRate = async () => {
    const opts = [...Object.values(appCache.organizations).map(o=>o.name), ...Object.values(appCache.families).map(f=>f.name)];
    const locName = prompt("Inserisci Proprietario o Luogo per questa tariffa:\n(Es: " + opts.slice(0,5).join(', ') + "...)");
    if(!locName || !locName.trim()) return;
    const rate = prompt("Inserisci la tariffa oraria (€/h) per " + locName + ":");
    if(!rate || isNaN(rate)) return;
    try {
        const docRef = await addDoc(collection(db, 'labor_rates'), { locationName: locName.trim(), hourlyRate: parseFloat(rate) });
        appCache['labor_rates'][docRef.id] = { id: docRef.id, locationName: locName.trim(), hourlyRate: parseFloat(rate) };
        renderDirectory();
    } catch(e) {
        alert("Errore salvataggio: " + e.message);
    }
};

window.editLaborRate = async (id) => {
    const r = appCache['labor_rates'][id];
    if(!r) return;
    const locName = prompt("Modifica Nome Luogo:", r.locationName);
    if(!locName || !locName.trim()) return;
    const rate = prompt("Modifica Tariffa (€/h):", r.hourlyRate);
    if(!rate || isNaN(rate)) return;
    try {
        await updateDoc(doc(db, 'labor_rates', id), { locationName: locName.trim(), hourlyRate: parseFloat(rate) });
        r.locationName = locName.trim();
        r.hourlyRate = parseFloat(rate);
        renderDirectory();
    } catch(e) {
        alert("Errore modifica: " + e.message);
    }
};

window.deleteLaborRate = async (id) => {
    if(!confirm("Sicuro di eliminare questa tariffa?")) return;
    try {
        await deleteDoc(doc(db, 'labor_rates', id));
        delete appCache['labor_rates'][id];
        renderDirectory();
    } catch(e) {
        alert("Errore eliminazione: " + e.message);
    }
};

function renderDirectory() {
    const d = document.getElementById('directoryList'); d.innerHTML='';
    const sections = [
        { id: 'organizations', title: 'Organizzazioni' },
        { id: 'families', title: 'Famiglie' },
        { id: 'locations', title: 'Luoghi' }
    ];
    let html = '';
    sections.forEach(s => {
        const items = Object.values(appCache[s.id]).sort((a,b)=>a.name.localeCompare(b.name));
        html += `<div class="card mb-3" style="padding:0; overflow:hidden;">
            <div class="card-header" style="margin:0; padding:15px; background:var(--surface); cursor:pointer; border-bottom:1px solid var(--border);" onclick="window.toggleDirSection('${s.id}')">
                <h3 style="margin:0; font-size:1.1rem; color:var(--primary);">${s.title} (${items.length}) <span>▼</span></h3>
            </div>
            <div id="dir_sec_${s.id}" style="display:none; padding:15px; background:var(--bg);">
                <button class="btn btn-outline mb-3" onclick="window.addDirectoryItem('${s.id}')" style="padding:8px; font-size:0.9rem;">➕ Aggiungi ${s.title}</button>
                ${items.map(o => `<div class="flex-between" style="padding:8px 0; border-bottom:1px dashed #ccc;"><strong style="font-size:0.95rem;">${o.name}</strong></div>`).join('')}
                ${items.length===0 ? '<div class="text-muted">Nessun elemento.</div>' : ''}
            </div>
        </div>`;
    });
    
    // Labor Rates Section
    const rates = Object.values(appCache['labor_rates']).sort((a,b)=>(a.locationName||'').localeCompare(b.locationName||''));
    html += `<div class="card mb-3" style="padding:0; overflow:hidden;">
        <div class="card-header" style="margin:0; padding:15px; background:var(--surface); cursor:pointer; border-bottom:1px solid var(--border);" onclick="window.toggleDirSection('labor_rates')">
            <h3 style="margin:0; font-size:1.1rem; color:var(--danger);">Costi Orari per Proprietario (${rates.length}) <span>▼</span></h3>
        </div>
        <div id="dir_sec_labor_rates" style="display:none; padding:15px; background:var(--bg);">
            <button class="btn btn-outline mb-3" onclick="window.addLaborRate()" style="padding:8px; font-size:0.9rem;">➕ Aggiungi Nuova Tariffa</button>
            ${rates.map(r => `<div class="flex-between" style="padding:8px 0; border-bottom:1px dashed #ccc;"><strong style="font-size:0.95rem;">${r.locationName}</strong><div><span style="margin-right:15px; color:var(--danger); font-weight:bold;">€${r.hourlyRate.toFixed(2)}/h</span><button style="background:none; border:none; cursor:pointer;" onclick="window.editLaborRate('${r.id}')">✏️</button><button style="background:none; border:none; cursor:pointer; margin-left:10px;" onclick="window.deleteLaborRate('${r.id}')">🗑️</button></div></div>`).join('')}
            ${rates.length===0 ? '<div class="text-muted">Nessuna tariffa impostata.</div>' : ''}
        </div>
    </div>`;

    d.innerHTML = html;
}

function renderReport() {
    const rep = document.getElementById('reportContent'); if(!rep) return;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    let paoloCompleted = 0, paoloOpen = 0, paoloOverdue = 0;
    let visitedLocations = new Set();
    liveTasks.forEach(t => {
        if(t.assignedTo === 'worker_paolo') {
            if(t.status === 'completed') paoloCompleted++;
            else { paoloOpen++; if(t.scheduledStart && t.scheduledStart.split('T')[0] < todayStr) paoloOverdue++; }
            if(t.locationId) visitedLocations.add(t.locationId);
        }
    });

    let expTotal = 0, expApproved = 0, expPending = 0;
    liveExpenses.forEach(e => { expTotal += e.amount; if(e.status === 'pending_approval') expPending += e.amount; if(e.status === 'approved') expApproved += e.amount; });
    
    let workerCostTotal = 0; const workerCostMap = {};
    liveWorkSessions.forEach(w => { workerCostTotal += w.totalCost; workerCostMap[w.workerId] = (workerCostMap[w.workerId]||0) + w.totalCost; });
    
    const sumsFam = {}, sumsOrg = {};
    liveExpenses.filter(e => e.status === 'approved').forEach(e => { (e.allocations||[]).forEach(a => { const t = a.type === 'family' ? sumsFam : sumsOrg; t[a.entityId] = (t[a.entityId]||0) + a.amount; }); });
    liveWorkSessions.filter(w => w.allocations && w.allocations.length > 0).forEach(w => { (w.allocations||[]).forEach(a => { const t = a.type === 'family' ? sumsFam : sumsOrg; t[a.entityId] = (t[a.entityId]||0) + a.amount; }); });

    const opsByLoc = {};
    liveTasks.forEach(t => { if(t.locationId) opsByLoc[t.locationId] = (opsByLoc[t.locationId] || 0) + 1; });

    rep.innerHTML = `
        <div class="card mb-4" style="background:#f8fafc; border:1px solid #e2e8f0;">
            <h3 style="color:var(--primary); margin-bottom:10px;">👤 Attività Paolo (Worker)</h3>
            <div class="flex-between" style="padding:8px 0; border-bottom:1px solid #eee;"><span>Task Completati</span> <strong><span class="status-badge status-completed">${paoloCompleted}</span></strong></div>
            <div class="flex-between" style="padding:8px 0; border-bottom:1px solid #eee;"><span>Task Aperti</span> <strong><span class="status-badge status-assigned">${paoloOpen}</span></strong></div>
            <div class="flex-between" style="padding:8px 0; border-bottom:1px solid #eee;"><span>Task in Ritardo</span> <strong><span class="status-badge" style="background:var(--danger); color:white;">${paoloOverdue}</span></strong></div>
            <div class="flex-between" style="padding:8px 0;"><span>Luoghi unici visitati</span> <strong>${visitedLocations.size}</strong></div>
        </div>

        <div class="card mb-4" style="background:#f8fafc; border:1px solid #e2e8f0;">
            <h3 style="color:var(--primary); margin-bottom:10px;">💸 Sintesi Finanziaria</h3>
            <div class="flex-between" style="padding:8px 0; border-bottom:1px solid #eee;"><span>Spese Materiali Tot.</span> <strong style="font-size:1.1rem;">€ ${expTotal.toFixed(2)}</strong></div>
            <div class="flex-between" style="padding:8px 0; border-bottom:1px solid #eee;"><span>Costi Manovalanza Tot.</span> <strong style="color:var(--danger);">€ ${workerCostTotal.toFixed(2)}</strong></div>
            <div style="padding:0 0 10px 10px; font-size:0.85rem; color:#666;">${Object.entries(workerCostMap).map(([k,v])=>`↳ ${appCache.external_workers[k]?.fullName||k}: €${v.toFixed(2)}`).join('<br>')}</div>
            <div class="flex-between" style="padding:8px 0; border-bottom:1px solid #eee;"><span>Approvate/Ripartite</span> <strong style="color:var(--success);">€ ${expApproved.toFixed(2)}</strong></div>
            <div class="flex-between" style="padding:8px 0;"><span>Attesa Scontrino/Verifica</span> <strong style="color:var(--warning);">€ ${expPending.toFixed(2)}</strong></div>
        </div>

        <div class="card mb-4" style="background:#f8fafc; border:1px solid #e2e8f0;">
            <h3 style="color:var(--primary); margin-bottom:10px;">📊 Allocazione Costi</h3>
            <h4 style="margin-top:10px; font-size:0.9rem; color:#666;">Per Famiglia</h4>
            <div style="margin-bottom:10px;">
                ${Object.keys(sumsFam).length === 0 ? '<div class="text-muted" style="font-size:0.8rem;">Nessun costo ripartito.</div>' : ''}
                ${Object.entries(sumsFam).map(([k,v])=>`<div class="flex-between" style="padding:6px 0; border-bottom:1px dashed #eee;"><span style="font-size:0.85rem;">${appCache.families[k]?.name}</span><strong>€ ${v.toFixed(2)}</strong></div>`).join('')}
            </div>
            <h4 style="margin-top:15px; font-size:0.9rem; color:#666;">Per Organizzazione</h4>
            <div>
                ${Object.keys(sumsOrg).length === 0 ? '<div class="text-muted" style="font-size:0.8rem;">Nessun costo ripartito.</div>' : ''}
                ${Object.entries(sumsOrg).map(([k,v])=>`<div class="flex-between" style="padding:6px 0; border-bottom:1px dashed #eee;"><span style="font-size:0.85rem;">${appCache.organizations[k]?.name}</span><strong>€ ${v.toFixed(2)}</strong></div>`).join('')}
            </div>
        </div>

        <div class="card mb-4" style="background:#f8fafc; border:1px solid #e2e8f0;">
            <h3 style="color:var(--primary); margin-bottom:10px;">📍 Operatività per Luogo</h3>
            ${Object.keys(opsByLoc).length === 0 ? '<div class="text-muted" style="font-size:0.8rem;">Nessuna operazione registrata.</div>' : ''}
            ${Object.entries(opsByLoc).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="flex-between" style="padding:6px 0; border-bottom:1px dashed #eee;"><span style="font-size:0.85rem;">${appCache.locations[k]?.name||k}</span><span class="entity-tag location">${v} Interv.</span></div>`).join('')}
        </div>

        <div class="card mb-4" style="background:#f8fafc; border:1px solid #e2e8f0; border-left: 4px solid var(--primary);">
            <h3 style="color:var(--primary); margin-bottom:10px;">📈 Pivot Costi e Ore Lavoro</h3>
            <p style="font-size:0.85rem; color:#666; margin-bottom:15px;">Analizza ed esplora i task completati e i costi orari imputati.</p>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <button class="btn btn-outline" style="padding:10px; font-weight:bold;" onclick="window.openPivotModal('today')">Oggi</button>
                <button class="btn btn-outline" style="padding:10px; font-weight:bold;" onclick="window.openPivotModal('week')">Ultimi 7 gg</button>
                <button class="btn btn-outline" style="padding:10px; font-weight:bold;" onclick="window.openPivotModal('month')">Ultimo Mese</button>
                <button class="btn btn-outline" style="padding:10px; font-weight:bold;" onclick="window.openPivotModal('year')">Quest'Anno</button>
            </div>
            <button class="btn btn-primary mt-3" style="width:100%; padding:12px; font-weight:bold; font-size:1.1rem;" onclick="window.openPivotModal('completed')">Tutti i Task Completati</button>
        </div>

        <button class="btn btn-outline" style="margin-bottom:20px;" onclick="alert('Export CSV / Struttura Dati pronta nel database Firebase!')">📥 Esporta Dati</button>
    `;
}

window.openTaskDetail = async (taskId) => {
    const t = liveTasks.find(x=>x.id===taskId); if(!t) return;
    if(!(t.readBy||[]).includes(currentUser.id)) {
        await updateDoc(doc(db,"tasks",taskId),{readBy: arrayUnion(currentUser.id)});
        if(!t.readBy) t.readBy = [];
        t.readBy.push(currentUser.id);
        renderHome();
    }
    const ev = liveExpenses.filter(e=>e.taskId===taskId);
    const expHtml = ev.length===0?'Nessuna spesa.':ev.map(e=>`<div class="flex-between"><span>${e.description}</span><strong>€${e.amount.toFixed(2)}</strong></div><div style="font-size:0.75rem; color:var(--text-muted)">${(e.allocations||[]).map(a=>`${appCache.organizations[a.entityId]?.name || appCache.families[a.entityId]?.name || a.entityId}(${a.percentage.toFixed(0)}%)`).join(', ')}</div><div class="mt-1" style="text-align:right;"><button class="btn btn-outline" style="padding:4px 8px; font-size:0.75rem; margin-right:5px;" onclick="window.editExpense('${e.id}')">✏️ Modifica</button><button class="btn btn-danger btn-outline" style="padding:4px 8px; font-size:0.75rem;" onclick="window.deleteExpense('${e.id}', true)">🗑️ Elimina</button></div>`).join('');
    let supW = ``; if(t.supportWorkers && t.supportWorkers.length > 0) { supW = `<div class="mt-2"><span style="font-size:0.8rem; color:#666;">👨‍🔧 Supporto:</span> ${t.supportWorkers.map(w=>`<span class="entity-tag" style="background:#e0f2fe; color:#1e40af;">${appCache.external_workers[w]?.fullName||w}</span>`).join(' ')}</div>`; }
    
    let acts = '';
    
    if(currentUser.roles.includes('technician') && t.assignedTo===currentUser.id) {
        if(t.status==='assigned') acts = `<button class="btn btn-primary" onclick="window.execAction('START_TASK','${t.id}')">Inizia Lavoro</button>`;
        else if(t.status==='in_progress') acts = `<button class="btn btn-secondary mb-2" onclick="window.openExpenseWizard('${t.id}')">➕ Aggiungi Spesa</button><button class="btn btn-success" onclick="window.execAction('COMP_TASK','${t.id}')">✔️ Completato</button>`;
    }
    
    if(t.status !== 'completed') acts = `<button class="btn btn-warning mb-2" style="width:100%; color:black;" onclick="window.openNewRequestWizard('${t.id}')">✏️ Modifica Task</button>` + acts;
    else acts = `<button class="btn btn-info mb-2" style="width:100%; color:white; background:var(--primary);" onclick="window.openCompleteTaskWizard('${t.id}')">✏️ Modifica Consuntivo Costo</button>` + acts;
    acts += `<button class="btn btn-danger btn-outline mt-4" onclick="window.execAction('DEL_TASK','${t.id}')">🗑️ Elimina</button>`;

    const wv = liveWorkSessions.filter(w=>w.taskId===taskId);
    const wrkHtml = wv.length===0?'<div class="text-muted" style="font-size:0.85rem;">Nessuna manovalanza.</div>':wv.map(w=>`<div class="flex-between" style="margin-top:5px; border-top:1px dashed #eee; padding-top:5px;"><span>${appCache.external_workers[w.workerId]?.fullName||w.workerId} (${w.hours}h)</span><strong>€${w.cost.toFixed(2)}</strong></div><div style="font-size:0.75rem; color:var(--text-muted)">${(w.allocations||[]).map(a=>`${appCache.organizations[a.entityId]?.name || appCache.families[a.entityId]?.name || a.entityId}(${a.percentage.toFixed(0)}%)`).join(', ')}</div><div class="mt-1" style="text-align:right;"><button class="btn btn-outline" style="padding:4px 8px; font-size:0.75rem; margin-right:5px;" onclick="window.editWorkSession('${w.id}')">✏️ Modifica</button><button class="btn btn-danger btn-outline" style="padding:4px 8px; font-size:0.75rem;" onclick="window.deleteWorkSession('${w.id}')">🗑️ Elimina</button></div>`).join('');
    
    let prioBadge = '';
    if(t.priority) {
        const pColors = {high: '#dc2626', medium: '#d97706', low: '#2563eb'};
        const pText = {high: 'Alta', medium: 'Media', low: 'Bassa'};
        prioBadge = `<span class="status-badge" style="background:${pColors[t.priority]}; color:white; margin-left:10px;">Priorità: ${pText[t.priority]}</span>`;
    }

    let laborInfo = '';
    if(t.status === 'completed' && t.laborCost !== undefined) {
        laborInfo = `<div style="margin-top:15px; padding:15px; background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px;">
            <div style="font-size:0.9rem; color:#0369a1; margin-bottom:5px;"><strong>Costo Ora di Lavoro:</strong> €${t.laborCost.toFixed(2)} (${t.activityType||'N/A'})</div>
            <div style="font-size:0.8rem; color:#475569;">Inizio: ${new Date(t.actualStart).toLocaleString()}<br>Fine: ${new Date(t.actualEnd).toLocaleString()}</div>
        </div>`;
    }

    document.getElementById('taskDetailContent').innerHTML = `<span class="status-badge status-${t.status} mb-2">${window.getStatusText(t.status)}</span>${prioBadge}<h2 class="mb-2 mt-2">${t.title}</h2><div class="entity-tags">${getEntTags(t.familyIds,t.organizationIds)}</div>${supW}${laborInfo}<p class="mt-2">${t.description}</p><h4 class="mt-4">Spese Materiali</h4>${expHtml}<h4 class="mt-4">Manovalanza Esterna</h4>${wrkHtml}`;
    const logH = liveLogs.filter(l=>l.entityId===taskId).sort((a,b)=>b.timestamp-a.timestamp).map(l=>`<div style="font-size:0.75rem; border-left:2px solid #ccc; padding-left:5px;"><strong>${l.userName}</strong>: ${l.action}</div>`).join('');
    const isSuper = currentUser.roles.includes('admin') || currentUser.roles.includes('owner') || currentUser.roles.includes('management_control') || currentUser.roles.includes('admin_support') || currentUser.roles.includes('domain_approver');
    document.getElementById('taskDetailContent').innerHTML += isSuper ? `<h4 class="mt-4">Audit Logs</h4>${logH}` : '';
    document.getElementById('taskDetailActions').innerHTML = acts;
    document.getElementById('taskDetailModal').classList.add('open');
};

window.execAction = async (act, id) => {
    const bd = document.getElementById('bsBackdrop'); if(bd) bd.classList.remove('open');
    if(act==='APPROVE_PROPOSED') { const t=liveTasks.find(x=>x.id===id); await updateDoc(doc(db,"tasks",id),{status:'assigned', scheduledStart: new Date().toISOString()}); await logActivity('APPROVE_PROPOSED','task',id); sendNotification(t.assignedTo, 'Proposta Approvata', `${currentUser.fullName} ha approvato: ${t.title}`); return; }
    else if(act==='ACCOUNT_TASK') { await updateDoc(doc(db,"tasks",id),{status:'accounted'}); await logActivity('ACCOUNT_TASK','task',id); const t=liveTasks.find(x=>x.id===id); if(t) t.status='accounted'; window.renderPivotTable(document.getElementById('pivotGroupSelect').value); return; }
    else if(act==='START_TASK') { await updateDoc(doc(db,"tasks",id),{status:'in_progress', actualStart: new Date().toISOString()}); await logActivity('START_TASK','task',id); }
    else if(act==='COMP_TASK') { window.openCompleteTaskWizard(id); return; }
    else if(act==='DEL_TASK') { 
        if(confirm("Sicuro di voler eliminare definitivamente questo task e le sue registrazioni associate?")) { await logActivity('DEL_TASK','task',id); await deleteDoc(doc(db,"tasks",id)); } 
    }
    else if(act==='TOGGLE_MATERIAL') { const t=liveTasks.find(x=>x.id===id); await updateDoc(doc(db,"tasks",id),{needsMaterial:!t.needsMaterial}); await logActivity(t.needsMaterial?'FOUND_MATERIAL':'MISSING_MATERIAL','task',id); if(!t.needsMaterial) sendNotification('admin', 'Materiale Mancante', `${t.title} è senza materiali.`); }
    const m = document.getElementById('taskDetailModal'); if(m) m.classList.remove('open');
};

window.openCompleteTaskWizard = (taskId) => {
    const t = liveTasks.find(x=>x.id===taskId); if(!t) return;
    const b = document.getElementById('wizardBody'); document.getElementById('wizardTitle').textContent="Completa Task e Costi";
    
    let rate = 0;
    const names = [ ...(t.familyIds||[]).map(x=>appCache.families[x]?.name), ...(t.organizationIds||[]).map(x=>appCache.organizations[x]?.name) ].filter(x=>x);
    if(names.length > 0) {
        const labor = Object.values(appCache['labor_rates']).find(r => names.includes(r.locationName));
        if (labor) rate = labor.hourlyRate;
    }

    const nowD = new Date();
    const nowIso = new Date(nowD.getTime() - (nowD.getTimezoneOffset() * 60000)).toISOString().slice(0,16);
    let startIso = nowIso;
    if(t.actualStart) {
        const sD = new Date(t.actualStart); sD.setMinutes(sD.getMinutes() - sD.getTimezoneOffset());
        startIso = sD.toISOString().slice(0,16);
    } else if (t.scheduledStart) {
        const sD = new Date(t.scheduledStart); sD.setMinutes(sD.getMinutes() - sD.getTimezoneOffset());
        startIso = sD.toISOString().slice(0,16);
    }

    b.innerHTML = `<form id="wcF">
        <label>Ora Inizio Effettiva</label>
        <input type="datetime-local" id="wcStart" value="${startIso}" required>
        <label>Ora Fine Effettiva</label>
        <input type="datetime-local" id="wcEnd" value="${nowIso}" required>
        <label>Tipo di Attività</label>
        <input type="text" id="wcType" placeholder="Es. Riparazione Elettrica o Idraulica" value="${t.activityType||''}" required>
        <label>Tariffa Oraria Applicata (€/h)</label>
        <input type="number" id="wcRate" step="0.01" value="${rate}">
        <div id="wcCostDiv" style="font-weight:bold; font-size:1.1rem; margin:15px 0; color:var(--danger);">Costo Totale: €0.00</div>
        <button type="submit" class="btn btn-success" style="width:100%;">Conferma Chiusura Task</button>
    </form>`;

    const updC = () => {
        const s = new Date(b.querySelector('#wcStart').value);
        const e = new Date(b.querySelector('#wcEnd').value);
        const r = parseFloat(b.querySelector('#wcRate').value) || 0;
        if(s && e && e > s) {
            const hrs = (e - s) / 3600000;
            b.querySelector('#wcCostDiv').textContent = `Costo Totale: €${(hrs * r).toFixed(2)} (${hrs.toFixed(2)} ore)`;
        } else {
            b.querySelector('#wcCostDiv').textContent = `Costo Totale: €0.00`;
        }
    };
    b.querySelector('#wcStart').addEventListener('change', updC);
    b.querySelector('#wcEnd').addEventListener('change', updC);
    b.querySelector('#wcRate').addEventListener('input', updC);
    updC();

    b.querySelector('#wcF').addEventListener('submit', async (e) => {
        e.preventDefault();
        const start = new Date(b.querySelector('#wcStart').value).toISOString();
        const end = new Date(b.querySelector('#wcEnd').value).toISOString();
        const type = b.querySelector('#wcType').value;
        const r = parseFloat(b.querySelector('#wcRate').value) || 0;
        const hrs = (new Date(end) - new Date(start)) / 3600000;
        const cost = hrs > 0 ? hrs * r : 0;

        await updateDoc(doc(db,"tasks",taskId),{
            status:'completed',
            actualStart: start,
            actualEnd: end,
            activityType: type,
            laborRateValue: r,
            laborCost: parseFloat(cost.toFixed(2))
        });
        await logActivity('COMP_TASK','task',taskId);
        if(t.assignedTo) sendNotification('admin', 'Task Completato', `${currentUser.fullName} ha completato: ${t.title} con costo €${cost.toFixed(2)}`);
        
        document.getElementById('actionWizardModal').classList.remove('open');
        const m = document.getElementById('taskDetailModal'); if(m) m.classList.remove('open');
    });
    document.getElementById('actionWizardModal').classList.add('open');
};

window.tempRichDescription = "";
window.tempAttachments = [];

window.openRichDescriptionModal = () => {
    document.getElementById('richDescText').value = window.tempRichDescription;
    document.getElementById('richDescFiles').value = "";
    document.getElementById('richDescModal').classList.add('open');
};

window.saveRichDescription = () => {
    window.tempRichDescription = document.getElementById('richDescText').value;
    const files = document.getElementById('richDescFiles').files;
    window.tempAttachments = Array.from(files).map(f => 'attachment_' + Date.now() + '_' + f.name);
    
    const summary = document.getElementById('rdSummary');
    if(window.tempRichDescription || window.tempAttachments.length > 0) {
        summary.style.display = 'block';
        summary.textContent = `Dettagli: ${window.tempRichDescription ? 'Sì' : 'No'} | Allegati: ${window.tempAttachments.length}`;
    } else {
        summary.style.display = 'none';
    }
    document.getElementById('richDescModal').classList.remove('open');
};

window.openNewRequestWizard = (taskIdToEdit = null) => {
    if(typeof taskIdToEdit !== 'string') taskIdToEdit = null;
    let t = null;
    if(taskIdToEdit) t = liveTasks.find(x=>x.id===taskIdToEdit);

    window.tempRichDescription = t ? (t.description||"") : "";
    window.tempAttachments = t ? (t.attachments||[]) : [];
    
    const b = document.getElementById('wizardBody');
    document.getElementById('wizardTitle').textContent = t ? "Modifica Task" : "Nuovo Task / Richiesta";
    
    // Checkboxes pre-selection logic
    const orgHtml = Object.values(appCache.organizations).map(o=>`<label class="check-item"><input type="checkbox" value="org_${o.id}" ${t && (t.organizationIds||[]).includes(o.id) ? 'checked' : ''}>${o.name}</label>`).join('');
    const famHtml = Object.values(appCache.families).map(f=>`<label class="check-item"><input type="checkbox" value="fam_${f.id}" ${t && (t.familyIds||[]).includes(f.id) ? 'checked' : ''}>${f.name}</label>`).join('');
    
    let initialBtnText = "Seleziona Beneficiari...";
    if(t) {
        let names = [];
        (t.organizationIds||[]).forEach(id => names.push(appCache.organizations[id]?.name));
        (t.familyIds||[]).forEach(id => names.push(appCache.families[id]?.name));
        let validNames = names.filter(Boolean);
        if(validNames.length > 0) {
            let j = validNames.join(', ');
            initialBtnText = j.length > 35 ? j.substring(0,32) + "..." : j;
        }
    }
    
    // Costruisci le opzioni dei tecnici escludendo Luca
    const wOpts = Object.values(appCache.people).filter(p=>p.roles.includes('technician') && p.id !== 'worker_luca').map(p=>`<option value="${p.id}" ${t && t.assignedTo===p.id?'selected':(!t && currentUser.id===p.id?'selected':(p.id==='worker_paolo'?'selected':''))}>${p.fullName||p.name}</option>`).join('');

    b.innerHTML = `<form id="wizF" data-edit-id="${taskIdToEdit||''}">
        <input type="text" id="rt" placeholder="Titolo" value="${t ? t.title : ''}" required>
        
        <label>Pianificazione</label>
        <select id="rSchedMode" style="margin-bottom:8px;">
            <option value="none" ${t && !t.scheduledStart ? 'selected' : ''}>Senza Scadenza (Proponi)</option>
            <option value="today">Oggi</option>
            <option value="tomorrow">Domani</option>
            <option value="datetime" ${t && t.scheduledStart && !t.scheduledEnd ? 'selected' : ''}>Data e Ora precisa</option>
            <option value="range" ${t && t.scheduledEnd ? 'selected' : ''}>Da... a...</option>
        </select>
        <div id="rSchedDtDiv" style="display:${t && t.scheduledStart ? 'flex' : 'none'}; gap:10px; margin-bottom:12px;">
            <input type="datetime-local" id="rSchedStart" style="flex:1;" value="${t && t.scheduledStart ? t.scheduledStart.slice(0,16) : ''}">
            <input type="datetime-local" id="rSchedEnd" style="flex:1; display:${t && t.scheduledEnd ? 'block' : 'none'};" value="${t && t.scheduledEnd ? t.scheduledEnd.slice(0,16) : ''}">
        </div>
        
        <button type="button" class="btn btn-secondary mb-2" onclick="window.openRichDescriptionModal()">✏️ Aggiungi Dettagli/Allegati (Opzionale)</button>
        <div id="rdSummary" class="text-muted" style="font-size:0.8rem; margin-bottom:12px; display:${window.tempRichDescription || window.tempAttachments.length ? 'block' : 'none'}; font-weight:bold;">
            Dettagli: ${window.tempRichDescription ? 'Sì' : 'No'} | Allegati: ${window.tempAttachments.length}
        </div>
        
        <input type="hidden" id="rl" value="${t && t.locationId ? t.locationId : ''}">
        
        <label>Priorità</label>
        <select id="rPriority" style="margin-bottom:15px; width:100%;">
            <option value="low" ${t && t.priority==='low'?'selected':''}>Bassa</option>
            <option value="medium" ${t && t.priority==='medium'?'selected':(!t?'selected':'')}>Media</option>
            <option value="high" ${t && t.priority==='high'?'selected':''}>Alta</option>
        </select>
        
        <label>Tecnico Incaricato</label>
        <select id="rAssignee" style="margin-bottom:15px; width:100%;">
            ${wOpts}
            <option value="none">-- Da decidere --</option>
        </select>
        
        <label>Luoghi di Lavoro / Destinatari (Multi-selezione)</label>
        <div style="border:1px solid #ccc; padding:10px; border-radius:8px; margin-bottom:15px; background:#fafafa;">
            <div id="multiSelectCheckboxes" style="display:flex; flex-direction:column; gap:5px;">
                ${orgHtml}
                ${famHtml}
            </div>
        </div>
        
        <button type="submit" class="btn ${t ? 'btn-warning' : 'btn-primary'}" style="color:${t ? '#000' : '#fff'}">${t ? 'Salva Modifiche' : 'Salva ed Invia'}</button>
    </form>`;

    b.querySelector('#rSchedMode').addEventListener('change', e => {
        const v = e.target.value;
        const dDiv = b.querySelector('#rSchedDtDiv');
        const sDt = b.querySelector('#rSchedStart');
        const eDt = b.querySelector('#rSchedEnd');
        if(v === 'datetime') { dDiv.style.display='flex'; eDt.style.display='none'; sDt.required=true; eDt.required=false; }
        else if(v === 'range') { dDiv.style.display='flex'; eDt.style.display='block'; sDt.required=true; eDt.required=true; }
        else { dDiv.style.display='none'; sDt.required=false; eDt.required=false; }
    });

    document.getElementById('wizF').addEventListener('submit', async (e) => {
        e.preventDefault();
        const checks = Array.from(b.querySelectorAll('input[type=checkbox]:checked')).map(x=>x.value);
        if(checks.length===0) return alert("Devi selezionare almeno un centro di costo!");
        const orgIds=checks.filter(x=>x.startsWith('org_')).map(x=>x.slice(4)), famIds=checks.filter(x=>x.startsWith('fam_')).map(x=>x.slice(4));
        
        let sStart = null; let sEnd = null;
        const mode = b.querySelector('#rSchedMode').value;
        if(mode === 'today') { const d = new Date(); d.setHours(8,0,0,0); sStart = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,19); }
        else if(mode === 'tomorrow') { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(8,0,0,0); sStart = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,19); }
        else if(mode === 'datetime') { sStart = b.querySelector('#rSchedStart').value; }
        else if(mode === 'range') { sStart = b.querySelector('#rSchedStart').value; sEnd = b.querySelector('#rSchedEnd').value; }

        const taskData = {
            title: b.querySelector('#rt').value,
            description: window.tempRichDescription,
            attachments: window.tempAttachments,
            organizationIds: orgIds, familyIds: famIds,
            priority: b.querySelector('#rPriority').value,
            assignedTo: b.querySelector('#rAssignee').value === 'none' ? null : b.querySelector('#rAssignee').value
        };
        
        const locId = b.querySelector('#rl').value;
        if(locId) taskData.locationId = locId;

        if(sStart) taskData.scheduledStart = sStart;
        if(sEnd) taskData.scheduledEnd = sEnd;

        const editId = b.querySelector('#wizF').getAttribute('data-edit-id');

        if(editId) {
            // Se in aggiornamento utente svuota le date
            if(!sStart) taskData.scheduledStart = deleteField();
            if(!sEnd) taskData.scheduledEnd = deleteField();
            
            if(sStart) taskData.status = 'assigned';
            await updateDoc(doc(db,"tasks",editId), taskData);
            await logActivity('EDIT_TASK', 'task', editId);
        } else {
            taskData.createdAt = serverTimestamp();
            if(!currentUser.roles.includes('technician')) { taskData.requestedBy = currentUser.id; }
            taskData.status = sStart ? 'assigned' : 'pending_approval';

            const tk = await addDoc(collection(db,"tasks"), taskData);
            await logActivity(sStart ? 'CREATE_TASK' : 'PROPOSE_TASK', 'task', tk.id);
            
            Object.keys(appCache.people).filter(id => id !== currentUser.id && appCache.people[id].active).forEach(pid => {
                addDoc(collection(db,"notifications"), {
                    userId: pid, title: 'Nuovo Task Inserito', 
                    message: `${currentUser.fullName} ha inserito il task: ${taskData.title}`,
                    read: false, createdAt: serverTimestamp(), 
                    taskId: tk.id, scheduledStart: sStart || null
                });
            });
        }
        document.getElementById('bsBackdrop').classList.remove('open'); document.getElementById('actionWizardModal').classList.remove('open');
        document.getElementById('taskDetailModal').classList.remove('open');
    });
    document.getElementById('actionWizardModal').classList.add('open');
}

window.confirmMultiSelect = () => {
    const checks = Array.from(document.querySelectorAll('#multiSelectCheckboxes input[type=checkbox]:checked'));
    const btn = document.getElementById('btnMultiSelect');
    const container = document.getElementById('multiSelectContainer');
    if(checks.length === 0) {
        btn.innerHTML = "Seleziona Beneficiari... <span>▼</span>";
    } else {
        const names = checks.map(c => c.parentElement.textContent.trim()).join(', ');
        const fmt = names.length > 35 ? names.substring(0,32) + "..." : names;
        btn.innerHTML = fmt + " <span>▼</span>";
    }
    container.style.display = 'none';
    btn.style.display = 'flex';
};

window.confirmMultiSelectExp = () => {
    const checks = Array.from(document.querySelectorAll('#multiSelectContainerExp .we-alloc:checked'));
    const btn = document.getElementById('btnMultiSelectExp');
    const container = document.getElementById('multiSelectContainerExp');
    if(checks.length === 0) {
        btn.innerHTML = "Seleziona Beneficiari... <span>▼</span>";
    } else {
        const names = checks.map(c => c.textContent.trim() || c.parentElement.textContent.trim()).join(', ');
        const fmt = names.length > 35 ? names.substring(0,32) + "..." : names;
        btn.innerHTML = fmt + " <span>▼</span>";
    }
    container.style.display = 'none';
    btn.style.display = 'flex';
};

window.openApproveWizard = (reqId) => {
    const r = liveRequests.find(x=>x.id===reqId);
    const b = document.getElementById('wizardBody'); document.getElementById('wizardTitle').textContent="Assegna e Pianifica";
    
    let dtHtml = '';
    if(r.scheduledStart) {
        dtHtml = `<label class="mt-3">Conferma Data e Ora</label><input type="datetime-local" id="was" value="${r.scheduledStart.slice(0,16)}">`;
    } else {
        dtHtml = `<label class="mt-3">Pianifica Data (Opzionale, lascia vuoto per mantenere Senza Data)</label><input type="datetime-local" id="was">`;
    }

    b.innerHTML = `<form id="waF">
        <label>Seleziona Tecnico</label>
        <select id="waw" required>${Object.values(appCache.people).filter(p=>p.roles.includes('technician') && p.id !== 'worker_luca').map(p=>`<option value="${p.id}" ${p.id==='worker_paolo'?'selected':''}>${p.fullName}</option>`).join('')}</select>
        ${dtHtml}
        <button type="submit" class="btn btn-success mt-4">Definitivo: Assegna e Crea Task</button>
    </form>`;

    b.querySelector('#waF').addEventListener('submit', async (e) => {
        e.preventDefault();
        const was = b.querySelector('#was').value;
        await updateDoc(doc(db,"requests",reqId),{status:'assigned'});
        await addDoc(collection(db,"tasks"),{
            requestId:reqId, title:r.title, description:r.description, attachments: r.attachments||[],
            locationId:r.locationId, familyIds:r.familyIds, organizationIds:r.organizationIds, priority:r.priority||'medium',
            assignedTo:b.querySelector('#waw').value, 
            scheduledStart: was ? was : null, 
            scheduledEnd: r.scheduledEnd || null,
            status:'assigned', 
            createdAt:serverTimestamp()
        });
        document.getElementById('actionWizardModal').classList.remove('open');
    });
    document.getElementById('actionWizardModal').classList.add('open');
};

window.openExpenseWizard = (taskId=null) => {
    if(typeof taskId !== 'string') taskId = null;
    const b = document.getElementById('wizardBody'); document.getElementById('wizardTitle').textContent="Aggiungi Spesa";
    const opts = liveTasks.filter(t=>t.status!=='completed').map(t=>`<option value="${t.id}" ${t.id===taskId?'selected':''}>${t.title}</option>`).join('');
    const fams = Object.values(appCache.families).map(f=>`<label class="check-item"><input type="checkbox" class="we-alloc" value="fam_${f.id}">${f.name}</label>`).join('');
    const orgs = Object.values(appCache.organizations).map(o=>`<label class="check-item"><input type="checkbox" class="we-alloc" value="org_${o.id}">${o.name}</label>`).join('');
    b.innerHTML = `<form id="weF">
        <label>Categoria</label>
        <select id="weCat"><option value="materiali">Materiali / Generico</option><option value="carburante">Carburante Veicolo</option></select>
        <div id="weVeicDiv" style="display:none;"><label>Veicolo</label><select id="weVeic"><option value="furgone">Furgone Aziendale</option><option value="auto">Auto</option><option value="altro">Altro</option></select></div>
        <label>Importo (€)</label>
        <input type="number" id="wea" step="0.01" placeholder="0.00" required>
        <label>Descrizione / Causale</label>
        <input type="text" id="wed" placeholder="Es. Viti e tasselli" required>
        <label>Seleziona Task (Applica automaticamente i centri di costo)</label>
        <select id="wet"><option value="">Nessun Task</option>${opts}</select>
        <div id="weAllocDiv" style="margin-top:10px; padding:10px; border:1px solid #ddd; background:#fafafa; border-radius:8px;">
            <label style="font-size:0.85rem; color:var(--danger); margin-bottom:8px; display:block;">Seleziona esplicitamente almeno un centro di costo se non hai scelto un Task:</label>
            <button type="button" id="btnMultiSelectExp" class="btn btn-outline" style="width:100%; text-align:left; display:flex; justify-content:space-between; align-items:center; background:#fff; border:1px solid #ccc; color:#333; padding:10px;" onclick="document.getElementById('multiSelectContainerExp').style.display='block'; this.style.display='none';">Seleziona Beneficiari... <span>▼</span></button>
            <div id="multiSelectContainerExp" style="display:none; background:#fff; border:1px solid #ccc; border-radius:8px; padding:10px; margin-top:8px;">
                <div style="max-height:180px; overflow-y:auto; margin-bottom:10px; display:flex; flex-direction:column; gap:8px;">
                    ${fams}${orgs}
                </div>
                <button type="button" class="btn btn-primary" style="width:100%; padding:8px;" onclick="window.confirmMultiSelectExp()">Conferma Selezione</button>
            </div>
        </div>
        <label class="mt-2">Giustificativo</label>
        <input type="file" id="weFile" accept="image/*" capture="environment" style="margin-bottom:10px; width:100%;">
        <textarea id="weNote" placeholder="Nota giustificativa (se non hai lo scontrino)" rows="2" style="width:100%; border:1px solid #ccc; border-radius:8px; padding:8px;"></textarea>
        <button type="submit" class="btn btn-success mt-4">Registra Spesa e Scala Cassa</button>
    </form>`;

    b.querySelector('#weCat').addEventListener('change', (e) => {
        b.querySelector('#weVeicDiv').style.display = e.target.value==='carburante' ? 'block' : 'none';
    });

    const tSel = b.querySelector('#wet');
    const allocDiv = b.querySelector('#weAllocDiv');
    const updateAllocVis = () => { allocDiv.style.display = tSel.value ? 'none' : 'block'; };
    tSel.addEventListener('change', updateAllocVis);
    updateAllocVis();

    b.querySelector('#weF').addEventListener('submit', async(e)=>{
        e.preventDefault(); 
        const amt = parseFloat(b.querySelector('#wea').value);
        const tId = b.querySelector('#wet').value;
        const cat = b.querySelector('#weCat').value;
        const veic = b.querySelector('#weVeic').value;
        const desc = b.querySelector('#wed').value;
        const note = b.querySelector('#weNote').value;
        const fileInput = b.querySelector('#weFile');
        
        let allocs = [];
        let hasAlloc = !!tId;
        
        if(tId) {
            const t = liveTasks.find(x=>x.id===tId);
            if(t) {
                const checks = [...(t.familyIds||[]).map(x=>'fam_'+x), ...(t.organizationIds||[]).map(x=>'org_'+x)];
                if(checks.length > 0) {
                    const q = amt / checks.length, pc = 100 / checks.length;
                    allocs = checks.map(s => ({
                        type: s.startsWith('fam_') ? 'family' : 'organization', 
                        entityId: s.replace('fam_','').replace('org_',''), 
                        amount: q, percentage: pc
                    }));
                }
            }
        } else {
            const checks = Array.from(b.querySelectorAll('.we-alloc:checked')).map(x=>x.value);
            if(checks.length === 0) return alert("Devi selezionare un Task o almeno un Centro di Costo!");
            hasAlloc = true;
            const q = amt / checks.length, pc = 100 / checks.length;
            allocs = checks.map(s => ({
                type: s.startsWith('fam_') ? 'family' : 'organization', 
                entityId: s.replace('fam_','').replace('org_',''), 
                amount: q, percentage: pc
            }));
        }

        const hasReceipt = fileInput.files.length > 0;
        const hasJust = note.trim().length > 0;
        let finalStatus = 'pending_approval';

        if(currentUser.id === 'worker_paolo') {
            if(amt <= 50) {
                if(hasAlloc && desc.trim().length > 0 && (hasReceipt || hasJust)) {
                    finalStatus = 'self_approved_by_paolo';
                }
            } else {
                if(cat === 'carburante' && veic === 'furgone' && hasAlloc && hasReceipt) {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const fuelCount = liveExpenses.filter(ex => 
                        ex.paidBy === currentUser.id && 
                        ex.category === 'carburante' && 
                        ex.status === 'self_approved_by_paolo' && 
                        ex.dateStr === todayStr
                    ).length;
                    
                    if(fuelCount < 2) {
                        finalStatus = 'self_approved_by_paolo';
                    }
                }
            }
        }

        const receiptMock = hasReceipt ? ('receipt_' + Date.now() + '_' + fileInput.files[0].name) : null;
        
        const exp=await addDoc(collection(db,"expenses"),{
            taskId: tId, amount: amt, description: desc, category: cat, veicolo: cat==='carburante'?veic:null, 
            paidBy: currentUser.id, allocations: allocs, status: finalStatus, receiptUrl: receiptMock, justification: note,
            dateStr: new Date().toISOString().split('T')[0], createdAt: serverTimestamp()
        });
        
        if(currentUser.roles.includes('technician')) { 
            await addDoc(collection(db,"cash_movements"),{type:'expense',givenBy:currentUser.id,givenTo:currentUser.id,amount:amt,reason:desc, relatedExpenseId:exp.id,balanceAfter:(currentUser.wallet||0)-amt,createdAt:serverTimestamp()}); 
        }
        
        await logActivity('ADD_EXPENSE','expense',exp.id);
        sendNotification('admin', 'Nuova Spesa', `${currentUser.fullName} ha inserito spesa di €${amt} (${finalStatus})`);
        
        document.getElementById('bsBackdrop').classList.remove('open'); document.getElementById('actionWizardModal').classList.remove('open'); 
        const tdm=document.getElementById('taskDetailModal'); if(tdm) tdm.classList.remove('open');
    });
    document.getElementById('bsBackdrop').classList.add('open'); document.getElementById('actionWizardModal').classList.add('open');
};

window.openAllocationWizard = (itemId, coll='expenses') => {
    const e = coll==='expenses' ? liveExpenses.find(x=>x.id===itemId) : liveWorkSessions.find(x=>x.id===itemId); if(!e) return;
    const b = document.getElementById('wizardBody'); document.getElementById('wizardTitle').textContent="Ripartizione";
    let autoS = []; 
    if(coll==='expenses' && e.taskId) { const t=liveTasks.find(x=>x.id===e.taskId); if(t) autoS=[...(t.familyIds||[]).map(x=>'fam_'+x), ...(t.organizationIds||[]).map(x=>'org_'+x)]; }
    if(coll==='work_sessions' && e.tasks) { e.tasks.forEach(tid=>{const t=liveTasks.find(x=>x.id===tid); if(t){ (t.familyIds||[]).forEach(x=>{if(!autoS.includes('fam_'+x))autoS.push('fam_'+x)}); (t.organizationIds||[]).forEach(x=>{if(!autoS.includes('org_'+x))autoS.push('org_'+x)}); }}); }
    
    b.innerHTML = `<h2 class="text-center" style="color:var(--danger);">€${(e.amount||e.totalCost).toFixed(2)}</h2><div class="mt-4">${Object.values(appCache.families).map(f=>`<label class="check-item flex-between">Fam: ${f.name} <input type="checkbox" class="wa-sel" value="fam_${f.id}" ${autoS.includes('fam_'+f.id)?'checked':''}></label>`).join('')}${Object.values(appCache.organizations).map(o=>`<label class="check-item flex-between">Az: ${o.name} <input type="checkbox" class="wa-sel" value="org_${o.id}" ${autoS.includes('org_'+o.id)?'checked':''}></label>`).join('')}</div><div id="waRes" class="text-center mt-4 font-bold text-primary"></div><button id="waBtn" class="btn btn-primary mt-4">Salva Divisione Equa</button>`;
    
    const upd = () => { const c = b.querySelectorAll('.wa-sel:checked').length; const baseCost=e.amount||e.totalCost; b.querySelector('#waRes').textContent = c>0 ? `Quota: €${(baseCost/c).toFixed(2)} (${(100/c).toFixed(1)}%)` : 'Seleziona!'; };
    b.querySelectorAll('.wa-sel').forEach(x=>x.addEventListener('change', upd)); upd();
    
    b.querySelector('#waBtn').addEventListener('click', async () => {
        const sels = Array.from(b.querySelectorAll('.wa-sel:checked')).map(x=>x.value);
        if(sels.length===0) return;
        const baseCost=e.amount||e.totalCost;
        const q = baseCost/sels.length, pc = 100/sels.length;
        await updateDoc(doc(db,coll,itemId),{status: 'approved', allocations: sels.map(s => ({type:s.startsWith('fam_')?'family':'organization', entityId:s.replace('fam_','').replace('org_',''), amount:q, percentage:pc}))});
        document.getElementById('actionWizardModal').classList.remove('open'); document.getElementById('bsBackdrop').classList.remove('open');
    });
    document.getElementById('bsBackdrop').classList.add('open'); document.getElementById('actionWizardModal').classList.add('open');
};

window.attachReceipt = async (expId) => {
    const input = document.getElementById('nativeCameraInput');
    if(!input) return;
    const onCapture = async (e) => {
        if(e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            await updateDoc(doc(db,"expenses",expId), {receiptUrl: 'receipt_' + Date.now() + '_' + file.name});
            await logActivity('ATTACH_RECEIPT','expense',expId, `Acquisito file: ${file.name}`);
        }
        input.removeEventListener('change', onCapture);
    };
    input.addEventListener('change', onCapture);
    input.click();
};

window.topUpWallet = async (workerId) => {
    const w = appCache.people[workerId];
    if(confirm(`Versare Acconto Cassa di €500 a ${w.fullName}?`)) {
        const cList = liveCash.filter(z=>z.givenTo===workerId).sort((a,b)=>b.createdAt-a.createdAt);
        const oldBal = cList.length > 0 ? cList[0].balanceAfter : 0;
        const newBal = oldBal + 500;
        await addDoc(collection(db,"cash_movements"),{type:'advance',givenBy:currentUser.id,givenTo:workerId,amount:500,reason:'Ricarica Cassa Operativa',balanceAfter:newBal,createdAt:serverTimestamp()});
    }
};

window.openRescheduleWizard = (taskId) => {
    const t = liveTasks.find(x=>x.id===taskId); if(!t) return;
    const b = document.getElementById('wizardBody'); document.getElementById('wizardTitle').textContent="Riprogramma";
    b.innerHTML = `<form id="wresF"><h3 style="margin-bottom:15px; color:var(--text-muted); font-size:1rem;">${t.title}</h3><label>Nuovo Inizio Previsto:</label><input type="datetime-local" id="wresDate" value="${(t.scheduledStart||'').slice(0,16)}" required><button type="submit" class="btn btn-info mt-4" style="background:var(--info); color:white;">Sposta e Salva</button></form>`;
    b.querySelector('#wresF').addEventListener('submit', async (e) => {
        e.preventDefault();
        await updateDoc(doc(db,"tasks",taskId), { scheduledStart: b.querySelector('#wresDate').value });
        document.getElementById('actionWizardModal').classList.remove('open');
    });
    document.getElementById('actionWizardModal').classList.add('open');
};

window.openWorkerSessionWizard = () => {
    const b = document.getElementById('wizardBody'); document.getElementById('wizardTitle').textContent="Giornata Manovale";
    const myTodayTasks = liveTasks.filter(t=>t.assignedTo===currentUser.id && t.status!=='completed');
    const taskChecks = myTodayTasks.map(t=>`<label class="check-item"><input type="checkbox" value="${t.id}"> ${t.title}</label>`).join('');
    if(myTodayTasks.length===0) return alert("Non hai task attivi a cui associare il manovale!");
    const wOpts = Object.values(appCache.external_workers).filter(w=>w.active && w.id !== 'worker_luca').map(w=>`<option value="${w.id}" data-rate="${w.dailyRate}">${w.fullName}</option>`).join('');
    b.innerHTML = `<form id="wwF">
        <label>Seleziona Manovale</label>
        <select id="wwn" required><option value="">-- Scegliere Manovale --</option>${wOpts}</select>
        <label>Costo Giornaliero Concordato (€)</label><input type="number" id="wwc" step="1" placeholder="Es. 80" required>
        <label>Seleziona i Task in cui ha aiutato (obbligatorio):</label>
        <div style="max-height:150px; overflow-y:auto; border:1px solid #ccc; padding:10px;">${taskChecks}</div>
        <button type="submit" class="btn btn-success mt-4">Salva Sessione Lavoro</button>
    </form>`;
    b.querySelector('#wwn').addEventListener('change', (e) => {
        const o = e.target.options[e.target.selectedIndex];
        if(o && o.dataset.rate) b.querySelector('#wwc').value = o.dataset.rate;
    });
    b.querySelector('#wwF').addEventListener('submit', async(e)=>{
        e.preventDefault();
        const tks = Array.from(b.querySelectorAll('input[type=checkbox]:checked')).map(x=>x.value);
        if(tks.length===0) return alert("Devi associare il manovale ad almeno un task!");
        const amt = parseFloat(b.querySelector('#wwc').value);
        const wId = b.querySelector('#wwn').value;
        const wName = appCache.external_workers[wId]?.fullName || wId;
        const nw = await addDoc(collection(db,"work_sessions"),{workerId:wId, date:new Date().toISOString().split('T')[0], assignedBy:currentUser.id, tasks:tks, dailyRate:amt, totalCost:amt, status:'worked', allocations:[], createdAt:serverTimestamp()});
        for(let tid of tks) {
            const tkObj = liveTasks.find(x=>x.id===tid);
            if(tkObj) {
                const arr = tkObj.supportWorkers || [];
                if(!arr.includes(wId)) { arr.push(wId); updateDoc(doc(db,"tasks",tid),{supportWorkers: arr}); }
            }
        }
        await logActivity('ADD_WORK_SESSION','work_sessions',nw.id, `Manovale ${wName} inserito per €${amt}`);
        sendNotification('admin', 'Nuovo Costo Manovalanza', `${currentUser.fullName} ha inserito giornata per ${wName} (${amt}€)`);
        document.getElementById('bsBackdrop').classList.remove('open'); document.getElementById('actionWizardModal').classList.remove('open');
    });
    document.getElementById('bsBackdrop').classList.add('open'); document.getElementById('actionWizardModal').classList.add('open');
};

/* ===============================================================
   AI ASSISTANCE LAYER (Aiuto AI)
   =============================================================== */

window.openAiModal = () => {
    document.getElementById('aiInput').value = '';
    document.getElementById('aiResponseContainer').style.display = 'none';
    document.getElementById('aiLoadingIndicator').style.display = 'none';
    document.getElementById('aiHistory').innerHTML = '<div class="text-muted" style="font-size:0.8rem">Caricamento dello storico... (Mocked)</div>';
    
    const banner = document.getElementById('aiContextBanner');
    let ctx = 'Generale';
    if(document.getElementById('view-home').classList.contains('active')) ctx = 'Dashboard / Home';
    if(document.getElementById('view-finance').classList.contains('active')) ctx = 'Finanza / Spese';
    if(document.getElementById('taskDetailModal').classList.contains('open')) ctx = 'Dettaglio Task';
    banner.innerText = `Contesto attuale: ${ctx}`;
    banner.dataset.ctx = ctx;

    document.getElementById('aiAssistModal').classList.add('open');
};

document.getElementById('btnCloseAiModal').addEventListener('click', () => document.getElementById('aiAssistModal').classList.remove('open'));

// Phase 1 Mock / Client-side proxy for Gemini 
window.sendAIRequest = async (promptText, context, role) => {
    // TODO: implement actual fetch to backend serverless function pointing to Google AI Studio
    return new Promise(resolve => {
        setTimeout(() => {
            if(promptText.toLowerCase().includes('problema') || promptText.toLowerCase().includes('segnala')) {
                resolve({ type: "ISSUE_MODE", shortAnswer: "Vuoi segnalare un problema o anomalia. Posso preparare un Ticket Strutturato per te.", suggestedAction: "Confermi la creazione del ticket di supporto?", structuredOutput: { title: "Problema Segnalato", category: "technical_issue", priority: "high", summary: promptText } });
            } else if(promptText.toLowerCase().includes('richiesta')) {
                resolve({ type: "STRUCTURE_MODE", shortAnswer: "Ho capito che vuoi istituire una nuova richiesta operativa per la squadra.", suggestedAction: "Generiamo il record strutturato nel sistema?", structuredOutput: { detectedType: "request", title: "Nuova Richiesta da AI", summary: promptText } });
            } else {
                resolve({ type: "HELP_MODE", shortAnswer: "La piattaforma gestisce flussi di manutenzione con logica di dominio. Assicurati di usare l'apposita scheda in base al tuo ruolo (Tecnico, Super o Normale).", suggestedAction: "Procedi navigando tramite i tab in basso.", structuredOutput: null });
            }
        }, 1200);
    });
};

window.logAIInteraction = async (interactionData) => {
    try { await addDoc(collection(db, "ai_interactions"), interactionData); } catch(e) { console.error("Logging AI err:", e); }
};

window.createSupportRequestFromAI = async (struct) => {
    try {
        await addDoc(collection(db, "support_requests"), {
            createdBy: currentUser.id,
            createdByName: currentUser.fullName,
            createdByRole: currentUser.roles[0] || 'user',
            title: struct.title || 'Nuovo Problema',
            description: struct.summary || '',
            category: struct.category || 'functional_doubt',
            priority: struct.priority || 'medium',
            status: 'new',
            aiGeneratedSummary: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        alert('Ticket di supporto strutturato creato con successo!');
        document.getElementById('aiAssistModal').classList.remove('open');
    } catch(e) { alert("Errore creazione ticket."); }
};

window.submitAiPrompt = async () => {
    const prompt = document.getElementById('aiInput').value.trim();
    if(!prompt) return;

    document.getElementById('btnSubmitAi').style.display = 'none';
    document.getElementById('aiLoadingIndicator').style.display = 'block';
    document.getElementById('aiResponseContainer').style.display = 'none';

    const ctx = document.getElementById('aiContextBanner').dataset.ctx;
    
    try {
        const response = await window.sendAIRequest(prompt, ctx, currentUser.roles[0]);
        document.getElementById('btnSubmitAi').style.display = 'flex';
        document.getElementById('aiLoadingIndicator').style.display = 'none';
        
        const acts = document.getElementById('aiSuggestedActions');
        document.getElementById('aiResponseText').innerHTML = `<strong>L'AI dice:</strong><br/>${response.shortAnswer}`;
        let htmlActs = `<p style="font-size:0.85rem; color:#666; margin-top:10px;"><em>Suggerimento: ${response.suggestedAction}</em></p>`;
        
        if(response.type === "ISSUE_MODE" || response.type === "STRUCTURE_MODE") {
            const safeObj = encodeURIComponent(JSON.stringify(response.structuredOutput));
            htmlActs += `<button class="btn btn-primary" style="margin-top:10px; background:#10b981; width:100%;" onclick="window.createSupportRequestFromAI(JSON.parse(decodeURIComponent('${safeObj}')))">✅ Salva e Procedi</button>`;
        }
        
        acts.innerHTML = htmlActs;
        document.getElementById('aiResponseContainer').style.display = 'block';

        window.logAIInteraction({
            userId: currentUser.id, userName: currentUser.fullName, userRoles: currentUser.roles,
            screen: ctx, messageType: response.type,
            userInput: prompt, aiResponse: response.shortAnswer, suggestedAction: response.suggestedAction,
            createdAt: serverTimestamp(), modelName: "gemini-2.5-flash-mock", success: true
        });

    } catch(e) {
        document.getElementById('btnSubmitAi').style.display = 'flex';
        document.getElementById('aiLoadingIndicator').style.display = 'none';
        alert('Errore di connessione con AI.');
    }
};

window.deleteWorkSession = async (id) => {
    if(!confirm("Vuoi annullare questa sessione di lavoro e stornare il costo?")) return;
    try {
        await deleteDoc(doc(db, "work_sessions", id));
        document.getElementById('taskDetailModal').classList.remove('open');
        renderReport();
        renderFinance();
    } catch(e) { alert("Errore durante l'eliminazione."); }
};

window.editWorkSession = async (id) => {
    const ws = liveWorkSessions.find(x => x.id === id);
    if(!ws) return;
    const nCost = prompt("Nuovo Costo Totale da imputare al Manovale (€):", ws.cost || 0);
    if(nCost === null) return;
    const nCostFloat = parseFloat(nCost);
    if(isNaN(nCostFloat) || nCostFloat < 0) { alert("Importo non valido"); return; }
    
    try {
        await updateDoc(doc(db, "work_sessions", id), { cost: nCostFloat });
        document.getElementById('taskDetailModal').classList.remove('open');
        renderReport();
        renderFinance();
    } catch(e) { alert("Errore durante la modifica."); }
};

init();

window.deleteExpense = async (id, isFromWorker = false) => {
    if(!confirm("Sicuro di voler eliminare questa spesa?")) return;
    try {
        const e = liveExpenses.find(x => x.id === id);
        if(!e) return;
        if(isFromWorker && e.paidBy === currentUser.id && currentUser.roles.includes('technician')) {
            const cList = liveCash.filter(c=>c.givenTo===currentUser.id).sort((a,b)=>b.createdAt-a.createdAt);
            const currentBal = cList.length > 0 ? cList[0].balanceAfter : 0;
            const balAfter = currentBal + e.amount;
            await addDoc(collection(db,"cash_movements"),{
                type: 'adjustment', givenBy: currentUser.id, givenTo: currentUser.id,
                amount: e.amount, reason: "Storno eliminazione spesa: " + e.description,
                balanceAfter: balAfter, createdAt: serverTimestamp()
            });
        }
        await deleteDoc(doc(db,"expenses", id));
        await logActivity('DELETE_EXPENSE','expense',id);
        const tm = document.getElementById('taskDetailModal');
        if(tm && tm.classList.contains('open') && e.taskId) window.openTaskDetail(e.taskId);
        else { const b = document.getElementById('bottomNav').querySelector('.nav-item.active'); if(b && b.dataset.target === 'view-finance') renderFinance(); }
    } catch(err) { alert("Errore: " + err.message); }
};

window.editExpense = async (id) => {
    const e = liveExpenses.find(x => x.id === id);
    if(!e) return;
    const newDesc = prompt("Modifica causale della spesa:", e.description);
    if(newDesc === null) return;
    const newAmtStr = prompt(`Modifica l'importo (attuale: €${e.amount.toFixed(2)}):`, e.amount);
    if(newAmtStr === null) return;
    const newAmt = parseFloat(newAmtStr);
    if(isNaN(newAmt) || newAmt <= 0) return alert("Importo non valido.");
    try {
        const diff = newAmt - e.amount;
        await updateDoc(doc(db, "expenses", id), { description: newDesc.trim(), amount: newAmt });
        if(diff !== 0 && e.paidBy === currentUser.id && currentUser.roles.includes('technician')) {
            const cList = liveCash.filter(c=>c.givenTo===currentUser.id).sort((a,b)=>b.createdAt-a.createdAt);
            const currentBal = cList.length > 0 ? cList[0].balanceAfter : 0;
            const balAfter = currentBal - diff; 
            await addDoc(collection(db,"cash_movements"),{
                type: 'adjustment', givenBy: currentUser.id, givenTo: currentUser.id,
                amount: Math.abs(diff), reason: `Conguaglio per modifica spesa (${newDesc.trim()})`,
                balanceAfter: balAfter, createdAt: serverTimestamp()
            });
        }
        await logActivity('EDIT_EXPENSE','expense',id);
        const tm = document.getElementById('taskDetailModal');
        if(tm && tm.classList.contains('open') && e.taskId) window.openTaskDetail(e.taskId);
        else { const b = document.getElementById('bottomNav').querySelector('.nav-item.active'); if(b && b.dataset.target === 'view-finance') renderFinance(); }
    } catch(err) { alert("Errore modifica: " + err.message); }
};

window.openPivotModal = (filterType) => {
    let tasks = [];
    const todayIso = new Date().toISOString().split('T')[0];
    const wD = new Date(); wD.setDate(wD.getDate()-7);
    const mD = new Date(); mD.setMonth(mD.getMonth()-1);
    const currY = new Date().getFullYear().toString();

    const isAdmin = currentUser.roles.includes('admin') || currentUser.roles.includes('owner');
    const isSupervisor = currentUser.roles.includes('management_control') || currentUser.roles.includes('admin_support');
    const isDomainApprover = currentUser.roles.includes('domain_approver');
    const isWorker = currentUser.roles.includes('technician');
    const myFam = [...(currentUser.familyIds||[]), ...(currentUser.familyIds||[]).map(f=>f.replace('famiglia_','fam_'))];
    const myOrgs = (currentUser.organizationRoles||[]).map(x=>x.organizationId);

    const canSee = (item) => {
        if(isAdmin) return true;
        if(isSupervisor) {
            if(item.status === 'pending_approval' || item.status === 'new' || item.status === 'completed' || item.status === 'accounted') return true;
            if((item.familyIds||[]).includes('famiglia_teresa') || (item.familyIds||[]).includes('fam_teresa')) return true;
            if((item.organizationIds||[]).includes('eubios') || (item.organizationIds||[]).includes('org_eubios')) return true;
            return false;
        }
        if(isDomainApprover) {
            if(item.status === 'pending_approval' && (
                (item.familyIds||[]).some(x=>myFam.includes(x)) || 
                (item.organizationIds||[]).some(x=>myOrgs.includes(x))
            )) return true;
            if((item.familyIds||[]).some(x=>myFam.includes(x))) return true;
            if((item.organizationIds||[]).some(x=>myOrgs.includes(x))) return true;
            return false;
        }
        if(isWorker) {
            if(item.assignedTo === currentUser.id) return true;
            if(item.requestedBy === currentUser.id) return true;
            return false;
        }
        return false;
    };

    liveTasks.forEach(t => {
        if(!canSee(t)) return;
        
        let match = false;
        if(filterType === 'all') match = true;
        else if (filterType === 'completed') { if(t.status === 'completed') match = true; }
        else if (filterType === 'accounted') { if(t.status === 'accounted') match = true; }
        else if (filterType === 'today') { if((t.status==='completed'||t.status==='accounted') && t.actualEnd && t.actualEnd.startsWith(todayIso)) match=true; }
        else if (filterType === 'week') { if((t.status==='completed'||t.status==='accounted') && t.actualEnd && new Date(t.actualEnd) >= wD) match=true; }
        else if (filterType === 'month') { if((t.status==='completed'||t.status==='accounted') && t.actualEnd && new Date(t.actualEnd) >= mD) match=true; }
        else if (filterType === 'year') { if((t.status==='completed'||t.status==='accounted') && t.actualEnd && t.actualEnd.startsWith(currY)) match=true; }
        else if(t.status !== 'completed' && t.status !== 'accounted') {
            if(filterType === 'high') { if(t.priority==='high') match=true; }
            else if(filterType === 'medium') { if(t.priority==='medium' || !t.priority) match=true; }
            else if(filterType === 'low') { if(t.priority==='low') match=true; }
            else if(filterType === 'scheduled') { if(t.scheduledStart) match=true; }
        }
        if(match) tasks.push(t);
    });

    const labels = {
        'high': 'Alta Priorità', 'medium': 'Media Priorità', 'low': 'Bassa Priorità',
        'scheduled': 'Programmati', 'all': 'Tutti i Task', 'completed': 'Tutti Completati', 'accounted': 'Contabilizzati',
        'today': 'Completati/Contab. Oggi', 'week': 'Complessivi (7gg)', 'month': 'Mensilità', 'year': "Quest'Anno"
    };
    document.getElementById('pivotTitle').textContent = `Pivot: ${labels[filterType] || filterType}`;
    document.getElementById('pivotModal').classList.add('open');
    
    window.originalPivotTasks = tasks;
    window.renderPivotTable('none', 'all');
};

window.renderPivotTable = (groupBy = 'none', dateFilter = null) => {
    if (dateFilter !== null) window.currentPivotDateFilter = dateFilter;
    else dateFilter = window.currentPivotDateFilter || 'all';

    let tasks = window.originalPivotTasks || [];
    
    if(dateFilter !== 'all') {
        const todayIso = new Date().toISOString().split('T')[0];
        const wD = new Date(); wD.setDate(wD.getDate()-7);
        const mD = new Date(); mD.setMonth(mD.getMonth()-1);
        const currY = new Date().getFullYear().toString();
        
        let customStart = null, customEnd = null;
        if(dateFilter === 'custom') {
            const sd = document.getElementById('pivotStartDt')?.value;
            const ed = document.getElementById('pivotEndDt')?.value;
            if(sd) customStart = new Date(sd);
            if(ed) { customEnd = new Date(ed); customEnd.setHours(23,59,59); }
        }

        tasks = tasks.filter(t => {
            const dtField = t.actualEnd || t.scheduledStart;
            if(!dtField) return false;
            const d = new Date(dtField);
            if(dateFilter === 'today') return dtField.startsWith(todayIso);
            if(dateFilter === 'week') return d >= wD;
            if(dateFilter === 'month') return d >= mD;
            if(dateFilter === 'year') return dtField.startsWith(currY);
            if(dateFilter === 'custom') {
                if(customStart && d < customStart) return false;
                if(customEnd && d > customEnd) return false;
                return true;
            }
            return true;
        });
    }

    window.currentPivotTasks = tasks; // Update for rendering

    const container = document.getElementById('pivotContainer');
    const controls = document.getElementById('pivotControls');

    controls.innerHTML = `
        <div style="display:flex; gap:15px; align-items:center;">
            <div>
                <strong>Filtra Data:</strong>
                <select id="pivotDateFilter" onchange="window.renderPivotTable(document.getElementById('pivotGroupSelect').value, this.value)" style="padding:5px; border-radius:4px; margin-left:5px;">
                    <option value="all" ${dateFilter==='all'?'selected':''}>Qualsiasi Data</option>
                    <option value="today" ${dateFilter==='today'?'selected':''}>Oggi</option>
                    <option value="week" ${dateFilter==='week'?'selected':''}>Ultimi 7 gg</option>
                    <option value="month" ${dateFilter==='month'?'selected':''}>Questo Mese</option>
                    <option value="year" ${dateFilter==='year'?'selected':''}>Quest'Anno</option>
                    <option value="custom" ${dateFilter==='custom'?'selected':''}>Personalizzata...</option>
                </select>
            </div>
            <div id="pivotCustomDateDiv" style="display:${dateFilter==='custom'?'flex':'none'}; gap:5px; align-items:center;">
                <input type="date" id="pivotStartDt" style="padding:4px; margin:0; border-radius:4px;" value="${document.getElementById('pivotStartDt')?.value||''}">
                <input type="date" id="pivotEndDt" style="padding:4px; margin:0; border-radius:4px;" value="${document.getElementById('pivotEndDt')?.value||''}">
                <button class="btn btn-secondary" style="padding:4px 8px; font-size:0.8rem; width:auto; border-radius:4px;" onclick="window.renderPivotTable(document.getElementById('pivotGroupSelect').value, 'custom')">Applica</button>
            </div>
            <div>
                <strong>Raggruppa:</strong>
                <select id="pivotGroupSelect" onchange="window.renderPivotTable(this.value, document.getElementById('pivotDateFilter').value)" style="padding:5px; border-radius:4px; margin-left:5px;">
                    <option value="none" ${groupBy==='none'?'selected':''}>Nessuno</option>
                    <option value="day" ${groupBy==='day'?'selected':''}>Giorno</option>
                    <option value="location" ${groupBy==='location'?'selected':''}>Proprietario</option>
                </select>
            </div>
        </div>
        <div style="flex:1;"></div>
        <div style="display:flex; gap:10px; font-size:0.85rem;" id="pivotColumnsToggle">
            <label><input type="checkbox" checked onchange="window.pivotToggleCol('col-start')"> Inizio</label>
            <label><input type="checkbox" checked onchange="window.pivotToggleCol('col-end')"> Fine</label>
            <label><input type="checkbox" checked onchange="window.pivotToggleCol('col-luogo')"> Destinatario</label>
            <label><input type="checkbox" checked onchange="window.pivotToggleCol('col-costo')"> Costo Lavoro</label>
            <label><input type="checkbox" checked onchange="window.pivotToggleCol('col-tech')"> Tecnico</label>
        </div>
    `;

    let groups = {};
    if (groupBy === 'none') {
        groups['Tutti i Task'] = tasks;
    } else if (groupBy === 'day') {
        tasks.forEach(t => {
            const date = t.actualEnd ? t.actualEnd.split('T')[0] : (t.scheduledStart ? t.scheduledStart.split('T')[0] : 'Senza Data');
            if(!groups[date]) groups[date] = [];
            groups[date].push(t);
        });
    } else if (groupBy === 'location') {
        tasks.forEach(t => {
            const names = [ ...(t.familyIds||[]).map(x=>appCache.families[x]?.name), ...(t.organizationIds||[]).map(x=>appCache.organizations[x]?.name) ].filter(x=>x);
            const loc = names.length > 0 ? names.join(', ') : 'Nessun Proprietario';
            if(!groups[loc]) groups[loc] = [];
            groups[loc].push(t);
        });
    }

    let html = `<table style="width:100%; border-collapse:collapse; min-width:800px;">
        <thead>
            <tr style="background:var(--surface); border-bottom:2px solid var(--border); text-align:left;">
                <th style="padding:10px;">Titolo</th>
                <th style="padding:10px;" class="pivot-col col-start">Inizio</th>
                <th style="padding:10px;" class="pivot-col col-end">Fine</th>
                <th style="padding:10px;" class="pivot-col col-luogo">Luogo</th>
                <th style="padding:10px;" class="pivot-col col-tech">Incaricato</th>
                <th style="padding:10px; text-align:right;" class="pivot-col col-costo">Costo Lavoro</th>
                <th style="padding:10px; text-align:center;">Azioni</th>
            </tr>
        </thead>
        <tbody>
    `;

    let totalGlobalCost = 0;

    Object.keys(groups).sort((a,b)=>b.localeCompare(a)).forEach(gName => {
        const gTasks = groups[gName];
        let groupCost = 0;
        
        let rowHtml = '';
        gTasks.forEach(t => {
            const cost = t.laborCost || 0;
            groupCost += cost;
            totalGlobalCost += cost;
            
            const startStr = t.actualStart ? new Date(t.actualStart).toLocaleString() : (t.scheduledStart ? new Date(t.scheduledStart).toLocaleDateString() : '-');
            const endStr = t.actualEnd ? new Date(t.actualEnd).toLocaleString() : '-';
            const names = [ ...(t.familyIds||[]).map(x=>appCache.families[x]?.name), ...(t.organizationIds||[]).map(x=>appCache.organizations[x]?.name) ].filter(x=>x);
            const locName = names.length > 0 ? names.join(', ') : '-';
            const workerName = appCache.people[t.assignedTo]?.name || appCache.people[t.assignedTo]?.fullName || '-';

            rowHtml += `<tr style="border-bottom:1px solid #eee;">
                <td style="padding:8px; font-weight:bold;">${t.title} <span class="status-badge status-${t.status}" style="font-size:0.7rem; padding:2px 4px;">${window.getStatusText(t.status)}</span></td>
                <td style="padding:8px; font-size:0.85rem;" class="pivot-col col-start">${startStr}</td>
                <td style="padding:8px; font-size:0.85rem;" class="pivot-col col-end">${endStr}</td>
                <td style="padding:8px; font-size:0.85rem;" class="pivot-col col-luogo">${locName}</td>
                <td style="padding:8px; font-size:0.85rem;" class="pivot-col col-tech">${workerName}</td>
                <td style="padding:8px; text-align:right; color:var(--danger); font-weight:bold;" class="pivot-col col-costo">€${cost.toFixed(2)}</td>
                <td style="padding:8px; text-align:center;">
                    ${(() => {
                        let actsHtml = `<button class="btn btn-outline" style="padding:4px 8px; font-size:0.8rem; margin:2px;" onclick="window.openTaskDetail('${t.id}')">Apri</button>`;
                        const isTechAssigned = currentUser.roles.includes('technician') && t.assignedTo===currentUser.id;
                        const isSuper = currentUser.roles.includes('admin') || currentUser.roles.includes('owner') || currentUser.roles.includes('management_control');
                        
                        if(t.status === 'assigned' && (isTechAssigned || isSuper)) {
                            actsHtml += `<button class="btn btn-primary" style="padding:4px 8px; font-size:0.8rem; margin:2px;" onclick="window.execAction('START_TASK','${t.id}')">▶️ Inizia</button>`;
                        } else if(t.status === 'in_progress' && (isTechAssigned || isSuper)) {
                            actsHtml += `<button class="btn btn-success" style="padding:4px 8px; font-size:0.8rem; margin:2px;" onclick="window.execAction('COMP_TASK','${t.id}')">✔️ Fine</button>`;
                        }

                        if(t.status === 'completed' || t.status === 'accounted') {
                            actsHtml += `<button class="btn btn-primary" style="padding:4px 8px; font-size:0.8rem; margin:2px;" onclick="window.openCompleteTaskWizard('${t.id}')">€ Costi</button>`;
                        } else {
                            actsHtml += `<button class="btn btn-warning" style="padding:4px 8px; font-size:0.8rem; margin:2px; color:black;" onclick="window.openNewRequestWizard('${t.id}')">✏️ Mod</button>`;
                        }
                        
                        if(t.status === 'completed' && isSuper) {
                            actsHtml += `<button class="btn btn-success" style="padding:4px 8px; font-size:0.8rem; margin:2px;" onclick="window.execAction('ACCOUNT_TASK','${t.id}')">🆗 Contabilizza</button>`;
                        }

                        actsHtml += `<button class="btn btn-danger" style="padding:4px 8px; font-size:0.8rem; margin:2px;" onclick="window.execAction('DEL_TASK','${t.id}')">🗑️ Canc</button>`;
                        return actsHtml;
                    })()}
                </td>
            </tr>`;
        });

        if(groupBy !== 'none') {
            html += `<tr style="background:#f1f5f9; border-top:2px solid #cbd5e1; border-bottom:1px solid #cbd5e1;">
                <td colspan="5" style="padding:10px; font-weight:bold; color:var(--primary);">📁 ${gName} (${gTasks.length} task)</td>
                <td style="padding:10px; text-align:right; font-weight:bold; color:var(--danger);" class="pivot-col col-costo">€${groupCost.toFixed(2)}</td>
                <td></td>
            </tr>`;
        }
        html += rowHtml;
    });

    html += `</tbody>
        <tfoot style="background:var(--surface); border-top:2px solid var(--border);">
            <tr>
                <td colspan="5" style="padding:12px; font-weight:800; text-align:right;">TOTALE GENERALE:</td>
                <td style="padding:12px; font-weight:800; text-align:right; color:var(--danger);" class="pivot-col col-costo">€${totalGlobalCost.toFixed(2)}</td>
                <td></td>
            </tr>
        </tfoot>
    </table>`;

    container.innerHTML = html;
    
    document.querySelectorAll('#pivotColumnsToggle input').forEach(cb => {
        const cls = cb.getAttribute('onchange').match(/'([^']+)'/)[1];
        window.pivotToggleCol(cls, cb.checked);
    });
};

window.pivotToggleCol = (colClass, forcedState) => {
    const cb = document.querySelector(`input[onchange*="${colClass}"]`);
    const isVisible = forcedState !== undefined ? forcedState : (cb ? cb.checked : true);
    document.querySelectorAll('.' + colClass).forEach(el => {
        el.style.display = isVisible ? '' : 'none';
    });
};

