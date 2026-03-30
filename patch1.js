const fs = require('fs');
const file = 'g:\\Il mio Drive\\STORAGE\\ANTIMO\\GestioneAttivitaWeb\\index.html';
let html = fs.readFileSync(file, 'utf8');

const modalsHtml = `
        <!-- MODAL IMPOSTAZIONI -->
        <div id="settingsModal" class="hidden" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 2100; overflow-y: auto; display: flex; align-items: flex-start; justify-content: center;">
            <div style="background: white; padding: 20px; border-radius: 12px; width: 90%; max-width: 500px; margin: 40px auto; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                <h3 style="color: var(--blue-dark); margin-bottom: 15px; display:flex; justify-content: space-between; align-items:center; border-bottom: 2px solid #eee; padding-bottom: 10px;">
                    <span><span class="btn-icon">⚙️</span> Impostazioni</span>
                    <button id="btnCloseSettings" style="background:none; border:none; font-size:1.5rem; cursor:pointer;">&times;</button>
                </h3>
                
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <button id="btnOpenGuida" class="btn btn-primary btn-blue" style="width: 100%; padding: 15px; font-size: 1.1rem; display: flex; justify-content: flex-start; align-items: center; gap: 10px; margin: 0; border-radius: 8px;">
                        <span style="font-size: 1.5rem;">🛟</span>
                        <div style="text-align: left; line-height: 1.2;">
                            <strong style="display: block; font-size: 1.1rem;">Guida e Supporto</strong>
                            <span style="font-size: 0.8rem; font-weight: normal; color: rgba(255,255,255,0.8);">Manuale, FAQ e risoluzione problemi</span>
                        </div>
                    </button>
                    
                    <hr style="border: 0; border-top: 1px solid #e2e8f0;">

                    <button id="btnSettingsBackup_link" class="btn btn-secondary" onclick="document.getElementById('backupModal').classList.remove('hidden'); document.getElementById('settingsModal').classList.add('hidden')" style="width: 100%; padding: 12px; text-align: left; display: flex; align-items: center; gap: 10px; margin: 0; border-radius: 8px;">
                        <span>💾</span> Riepilogo Versioni e Backup
                    </button>
                    
                    <button id="btnSettingsData_link" class="btn btn-secondary" onclick="document.getElementById('dataBackupModal').classList.remove('hidden'); document.getElementById('settingsModal').classList.add('hidden')" style="width: 100%; padding: 12px; text-align: left; display: flex; align-items: center; gap: 10px; margin: 0; border-radius: 8px;">
                        <span>📊</span> Gestione Database (JSON)
                    </button>
                </div>
            </div>
        </div>

        <!-- MODAL GUIDA E SUPPORTO -->
        <div id="guidaModal" class="hidden" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #f8fafc; z-index: 5000; overflow-y: hidden; display: flex; flex-direction: column;">
            <div style="background: var(--blue-dark); color: white; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10;">
                <h2 style="margin: 0; font-size: 1.2rem; display: flex; align-items: center; gap: 10px;">🛟 In-Line Help Dashboard</h2>
                <button id="btnCloseGuida" style="background: none; border: none; color: white; font-size: 2rem; line-height: 1; cursor: pointer;">&times;</button>
            </div>
            <div style="background: white; padding: 15px 20px; border-bottom: 1px solid #e2e8f0; z-index: 9;">
                <div style="position: relative; max-width: 800px; margin: 0 auto;">
                    <input type="text" id="guidaSearchInput" placeholder="Cerchi aiuto? Scrivi qui (es. offline, nuovo intervento...)" style="width: 100%; padding: 12px 20px 12px 40px; border-radius: 30px; border: 2px solid var(--blue-light); font-size: 1rem; outline: none; transition: border-color 0.3s;">
                    <span style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); font-size: 1.2rem; color: #94a3b8;">🔍</span>
                </div>
            </div>
            <div style="display: flex; flex: 1; overflow: hidden; max-width: 1200px; margin: 0 auto; width: 100%; flex-wrap: wrap;">
                <div id="guidaSidebar" style="width: 300px; flex-grow: 1; background: white; border-right: 1px solid #e2e8f0; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 10px; max-height: 100%;">
                    <div style="font-weight: bold; color: var(--blue-dark); margin-bottom: 10px; font-size: 1.1rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">Esplora per Categoria</div>
                    <div id="guidaCategoriesList" style="display: flex; flex-direction: column; gap: 5px;"></div>
                </div>
                <div id="guidaContentArea" style="flex: 3; min-width: 320px; overflow-y: auto; padding: 30px; background: #f8fafc; position: relative; max-height: 100%;">
                    <div id="guidaBreadcrumbs" style="font-size: 0.85rem; color: #64748b; margin-bottom: 20px; display: none;">
                        <span id="bcCategory" style="cursor: pointer; color: var(--blue-primary); text-decoration: underline;">Categoria</span> &gt; 
                        <span id="bcArticle" style="font-weight: bold; color: #334155;">Articolo</span>
                    </div>
                    <div id="guidaActualContent">
                        <div style="text-align: center; color: #94a3b8; font-size: 1.1rem; margin-top: 50px;">
                            <div style="font-size: 3rem; margin-bottom: 15px;">👋🏻</div>
                            Benvenuto nella Guida di Antimo.<br>Seleziona un argomento dalla barra laterale o usa la ricerca in alto.
                        </div>
                    </div>
                </div>
            </div>
        </div>
`;

if (!html.includes('id="settingsModal"')) {
    html = html.replace('</main>', modalsHtml + '\n    </main>');
    html = html.replace('<script type="module" src="app.js?v=61"></script>', '<script type="module" src="guida.js?v=' + Date.now() + '"></script>\n    <script type="module" src="app.js?v=61"></script>');
    fs.writeFileSync(file, html, 'utf8');
    console.log('Injected successfully');
} else {
    console.log('Already injected');
}
