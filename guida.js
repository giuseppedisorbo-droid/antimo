export const guideData = {
    categories: [
        { id: "iniziare", title: "🚀 Per Iniziare & Basi" },
        { id: "gestione", title: "🛠️ Gestione Interventi" },
        { id: "ufficio", title: "💼 Funzioni Ufficio" },
        { id: "troubleshooting", title: "⚠️ Risoluzione Problemi" }
    ],
    articles: [
        {
            id: "creare_intervento",
            cat_id: "iniziare",
            title: "Come compilare un nuovo intervento libero",
            tags: ["nuovo", "creare", "intervento", "paziente", "aggiungere", "inserire"],
            content: `
                <h3>Creazione di un intervento libero</h3>
                <p>Nella schermata principale dell'App, puoi inserire un intervento non previsto premendo il grande pulsante in fondo alla pagina intitolato <strong>📝 NUOVO INTERVENTO (LIBERO)</strong>.</p>
                
                <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 10px; margin: 15px 0;">
                    <strong>Suggerimento:</strong> Assicurati di inserire correttamente il Cognome e Nome o seleziona un paziente dall'Anagrafica cliccando sul pulsante dedicato nella tabella.
                </div>

                <h4>Passaggi:</h4>
                <ol>
                    <li>Premi il pulsante "Nuovo Intervento".</li>
                    <li>Compila tutti i dati del paziente (oppure seleziona da anagrafica).</li>
                    <li>Scegli <strong>Tipo di Intervento</strong> e <strong>Dispositivo</strong> dal menù a tendina.</li>
                    <li>Aggiungi un allegato (foto o PDF) se necessario, scattando una foto direttamente sul posto.</li>
                    <li>Premi su <strong>"SALVA SUL SERVER (Invia e Pulisci)"</strong> per confermare l'attività come eseguita.</li>
                </ol>
            `
        },
        {
            id: "gestione_offline",
            cat_id: "troubleshooting",
            title: "Cosa fare se manca internet (Modalità Offline)",
            tags: ["offline", "no internet", "connessione", "senza linea", "sincronizzazione", "sync"],
            content: `
                <h3>Modalità Offline e Coda di Sincronizzazione</h3>
                <p>Antimo è progettato in architettura PWA (Progressive Web App). Questo significa che può funzionare regolarmente <strong>anche in assenza totale di segnale internet</strong> nel telefono.</p>

                <h4>Lavorare Offline</h4>
                <ul>
                    <li>L'App ti segnalerà l'assenza di linea diventando grigia e spuntando un'avvertenza "Modalità Offline".</li>
                    <li>Puoi inserire tutti i tuoi interventi o chiudere i programmati come faresti sempre.</li>
                    <li>Al momento del "Salvataggio", l'intervento finirà temporaneamente in memoria locale (Cache) e <strong>non andrà perso.</strong></li>
                </ul>

                <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 10px; margin: 15px 0;">
                    <strong>ATTENZIONE:</strong> Non dimenticare di avviare l'App non appena torni sotto copertura wi-fi o 4G. L'app rileverà la connessione e invierà tutto silenziosamente in background.
                </div>
            `
        },
        {
            id: "chiusura_programmati",
            cat_id: "gestione",
            title: "Come chiudere un intervento Programmato (PT)",
            tags: ["programmato", "pt", "chiusura", "eseguito", "lista pt"],
            content: `
                <h3>Chiusura Programmati</h3>
                <p>Se la direzione ha calendarizzato un impegno per te, lo troverai nella colonna <strong>PT</strong> (Programmati). Cliccando sul badge <span style="background: purple; color: white; padding: 2px 5px; border-radius: 4px;">PT</span> dalla Dashboard, si aprirà l'elenco.</p>
                <ol>
                    <li>Scorrendo la lista PT, scegli la card dell'intervento che hai appena evaso.</li>
                    <li>Clicca il bottone verde <strong>✅ Chiudi (Eseguito)</strong>.</li>
                    <li>Si aprirà un modulo di conferma. Qui potrai correggere i dispositivi installati e aggiungere un allegato firmato.</li>
                    <li>Conferma premendo "Applica Risoluzione". L'intervento passerà nello Storico Eseguiti!</li>
                </ol>
            `
        },
        {
            id: "valorizzazione",
            cat_id: "ufficio",
            title: "Calcolo Valorizzazione (Rendiconto Economico)",
            tags: ["soldi", "valorizzazione", "rendiconto", "fattura", "euro", "calcolo"],
            content: `
                <h3>Calcolo Valorizzazione</h3>
                <p>La schermata di Valutazione Economica è una funzione dedicata alla Dashboard Ufficio.</p>
                <p>Andando in <a href="admin.html">Dashboard Ufficio</a> e premendo 💰 <strong>VALORIZZAZIONE ATTIVITÀ</strong> (Tasto Verde a destra), è possibile generare simulacri contabili incrociando i costi standard degli interventi per singolo dipendente o ruolo e le uscite effettuate.</p>
                <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 10px; margin: 15px 0;">
                    Dispone anche di stampa rapida in <strong>File EXCEL / CSV</strong>!
                </div>
            `
        }
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    const btnOpenGuida = document.getElementById('btnOpenGuida');
    const settingsModal = document.getElementById('settingsModal');
    const guidaModal = document.getElementById('guidaModal');
    const btnCloseGuida = document.getElementById('btnCloseGuida');
    const searchInput = document.getElementById('guidaSearchInput');

    const catList = document.getElementById('guidaCategoriesList');
    const contentArea = document.getElementById('guidaActualContent');
    const breadcrumbs = document.getElementById('guidaBreadcrumbs');
    const bcCategory = document.getElementById('bcCategory');
    const bcArticle = document.getElementById('bcArticle');

    let currentCategoryId = null;

    if (btnOpenGuida) {
        btnOpenGuida.addEventListener('click', () => {
            if(settingsModal) settingsModal.classList.add('hidden');
            guidaModal.classList.remove('hidden');
            renderCategories();
            showWelcome();
        });
    }

    if (btnCloseGuida) {
        btnCloseGuida.addEventListener('click', () => {
            guidaModal.classList.add('hidden');
            if(searchInput) searchInput.value = '';
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (query.length > 2) {
                renderSearchResults(query);
            } else if (query.length === 0) {
                renderCategories();
                showWelcome();
            }
        });
    }

    function renderCategories() {
        if(!catList) return;
        catList.innerHTML = '';
        guideData.categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-secondary';
            btn.style.cssText = 'width: 100%; text-align: left; padding: 10px; font-weight: 600; margin: 0; background: #f8fafc; color: var(--blue-dark); justify-content: start; border: 1px solid #e2e8f0; border-radius: 8px; transition: background 0.2s;';
            btn.innerText = cat.title;
            btn.onclick = () => {
                Array.from(catList.children).forEach(c => { c.style.background = '#f8fafc'; c.style.color = 'var(--blue-dark)'; });
                btn.style.background = 'var(--blue-primary)';
                btn.style.color = 'white';
                showCategory(cat.id);
            };
            catList.appendChild(btn);
        });
    }

    function showCategory(catId) {
        currentCategoryId = catId;
        const cat = guideData.categories.find(c => c.id === catId);
        const arts = guideData.articles.filter(a => a.cat_id === catId);
        
        breadcrumbs.style.display = 'block';
        bcCategory.innerText = cat.title;
        bcCategory.onclick = () => showCategory(catId);
        bcArticle.innerText = arts.length + ' Argomenti';

        if(arts.length === 0) {
            contentArea.innerHTML = '<div style="color: #64748b;">Nessun articolo per questa categoria.</div>';
            return;
        }

        let html = '<div style="display:flex; flex-direction:column; gap:10px;">';
        arts.forEach(a => {
            html += `
                <div class="guida-art-card" onclick="window.viewGuideArticle('${a.id}')" style="background: white; border: 1px solid #e2e8f0; border-left: 4px solid var(--blue-primary); padding: 15px; border-radius: 8px; cursor: pointer; transition: transform 0.1s; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <h4 style="margin: 0 0 5px 0; color: var(--blue-dark); font-size: 1.1rem;">${a.title}</h4>
                    <div style="font-size: 0.8rem; color: #94a3b8;">${a.tags.slice(0, 3).map(t => '#' + t).join(' ')}</div>
                </div>
            `;
        });
        html += '</div>';

        contentArea.innerHTML = html;
        contentArea.scrollTo(0, 0);
    }

    window.viewGuideArticle = function(artId) {
        const art = guideData.articles.find(a => a.id === artId);
        if(!art) return;
        const cat = guideData.categories.find(c => c.id === art.cat_id);

        breadcrumbs.style.display = 'block';
        if(cat) {
            bcCategory.innerText = cat.title;
            bcCategory.onclick = () => showCategory(cat.id);
        } else {
            bcCategory.innerText = 'Ricerca';
            bcCategory.onclick = () => { searchInput.value=''; renderCategories(); showWelcome(); };
        }
        bcArticle.innerText = art.title;

        let contentHtml = `
            <h1 style="color: var(--blue-dark); margin-top: 0; margin-bottom: 20px; font-size: 1.6rem; line-height: 1.3;">${art.title}</h1>
            <div style="color: #334155; line-height: 1.6; font-size: 1.05rem;" class="html-guide-content">
                ${art.content}
            </div>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 2px dashed #e2e8f0; display: flex; flex-direction: column; align-items: center; gap: 10px;">
                <strong style="color: #64748b;">Ti è stato d'aiuto questo articolo?</strong>
                <div style="display: flex; gap: 15px;">
                    <button class="btn btn-secondary" style="margin:0; font-size: 1.5rem; background: white; padding: 10px 20px;" onclick="this.innerHTML='✅ Grazie!'; this.disabled=true;">👍🏻</button>
                    <button class="btn btn-secondary" style="margin:0; font-size: 1.5rem; background: white; padding: 10px 20px;" onclick="this.innerHTML='😔 Miglioreremo'; this.disabled=true;">👎🏻</button>
                </div>
            </div>
        `;
        
        contentArea.innerHTML = contentHtml;
        contentArea.scrollTo(0, 0);
    };

    function renderSearchResults(query) {
        breadcrumbs.style.display = 'block';
        bcCategory.innerText = 'Risultati per: "' + query + '"';
        bcCategory.onclick = () => {};
        bcArticle.innerText = '';
        
        Array.from(catList.children).forEach(c => { c.style.background = '#f8fafc'; c.style.color = 'var(--blue-dark)'; });

        const results = guideData.articles.filter(a => {
            return a.title.toLowerCase().includes(query) || 
                   a.tags.some(t => t.toLowerCase().includes(query)) ||
                   a.content.toLowerCase().includes(query);
        });

        if (results.length === 0) {
            contentArea.innerHTML = `
                <div style="text-align: center; color: #94a3b8; font-size: 1.1rem; margin-top: 50px;">
                    <div style="font-size: 3rem; margin-bottom: 15px;">🧐</div>
                    Nessun risultato trovato per "<strong>${query}</strong>".<br>Prova a usare termini diversi.
                </div>
            `;
            return;
        }

        let html = '<div style="display:flex; flex-direction:column; gap:10px;">';
        results.forEach(a => {
            const cat = guideData.categories.find(c => c.id === a.cat_id);
            html += `
                <div class="guida-art-card" onclick="window.viewGuideArticle('${a.id}')" style="background: white; border: 1px solid #e2e8f0; border-left: 4px solid var(--orange); padding: 15px; border-radius: 8px; cursor: pointer; transition: transform 0.1s; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="font-size: 0.75rem; color: var(--orange); font-weight: bold; margin-bottom: 4px; text-transform: uppercase;">${cat ? cat.title : 'Guida'}</div>
                    <h4 style="margin: 0 0 5px 0; color: var(--blue-dark); font-size: 1.1rem;">${a.title}</h4>
                    <div style="font-size: 0.8rem; color: #94a3b8;">${a.tags.slice(0, 3).map(t => '#' + t).join(' ')}</div>
                </div>
            `;
        });
        html += '</div>';
        contentArea.innerHTML = html;
    }

    function showWelcome() {
        breadcrumbs.style.display = 'none';
        contentArea.innerHTML = `
            <div style="text-align: center; color: #94a3b8; font-size: 1.1rem; margin-top: 50px;">
                <div style="font-size: 3rem; margin-bottom: 15px;">👋🏻</div>
                Benvenuto nella Guida di Antimo.<br>Seleziona un argomento dalla barra laterale o usa la ricerca in alto.
            </div>
            
            <div style="margin-top: 30px; display: grid; gap: 15px; text-align: left; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                <div style="background: white; padding: 15px; border-radius: 8px; border: 1px dashed #cbd5e1; cursor: pointer;" onclick="window.viewGuideArticle('creare_intervento')">
                    <strong>📝 Come iniziare</strong><br><small>Scopri come creare il tuo primo intervento.</small>
                </div>
                <div style="background: white; padding: 15px; border-radius: 8px; border: 1px dashed #cbd5e1; cursor: pointer;" onclick="window.viewGuideArticle('gestione_offline')">
                    <strong>📴 Niente WiFi? Nessun problema!</strong><br><small>Scopri come funziona la modalità Offline PWA.</small>
                </div>
            </div>
        `;
    }
});
