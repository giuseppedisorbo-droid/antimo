const fs = require('fs');
const path = require('path');

const basePath = path.join('g:', 'Il mio Drive', 'STORAGE', 'ANTIMO', 'GestioneAttivitaWeb');
const indexHtmlPaths = path.join(basePath, 'index.html');
const adminHtmlPaths = path.join(basePath, 'admin.html');
const appJsPaths = path.join(basePath, 'app.js');
const adminJsPaths = path.join(basePath, 'admin.js');

try {
    // 1. App.js -> Admin.js
    let appJsContent = fs.readFileSync(appJsPaths, 'utf8');
    let adminJsContent = fs.readFileSync(adminJsPaths, 'utf8');
    
    // estrai blocco da app.js
    const startStrJs = "/* ==========================================\r\n * VALORIZZAZIONE ATTIVITÀ";
    let startIdx = appJsContent.indexOf("/* ==========================================\n * VALORIZZAZIONE ATTIVITÀ");
    if(startIdx === -1) startIdx = appJsContent.indexOf("/* ==========================================\r\n * VALORIZZAZIONE ATTIVITÀ");
    
    let endIdx = appJsContent.indexOf("/* ==========================================\n * RICERCA MAGICA GLOBALE");
    if(endIdx === -1) endIdx = appJsContent.indexOf("/* ==========================================\r\n * RICERCA MAGICA GLOBALE");
    
    if(startIdx !== -1 && endIdx !== -1) {
        const extractedJs = appJsContent.substring(startIdx, endIdx);
        // Rimuovi da app.js
        appJsContent = appJsContent.substring(0, startIdx) + appJsContent.substring(endIdx);
        fs.writeFileSync(appJsPaths, appJsContent, 'utf8');
        
        // Aggiungi in fondo ad admin.js
        adminJsContent += '\n\n' + extractedJs;
        fs.writeFileSync(adminJsPaths, adminJsContent, 'utf8');
        console.log("Moved JS logic to admin.js!");
    } else {
        console.log("Could not find JS bounds in app.js", startIdx, endIdx);
    }
    
    // 2. Index.html -> Admin.html
    let indexHtmlContent = fs.readFileSync(indexHtmlPaths, 'utf8');
    let adminHtmlContent = fs.readFileSync(adminHtmlPaths, 'utf8');
    
    // Rimuovi il pulsante da index.html
    const btnBlockOpen = '<button id="btnOpenValuation" class="btn btn-primary btn-large" style="width: 100%; border: none; padding: 15px; font-size: 1.1rem; box-shadow: 0 4px 10px rgba(34,197,94,0.2); background: #22c55e; display: flex; align-items: center; justify-content: center; gap: 8px; color: white; margin: 0; cursor: pointer;">\n                <span style="font-size: 1.4rem;">💰</span> VALORIZZAZIONE ATTIVITÀ\n            </button>';
    const btnBlockOpenWin = '<button id="btnOpenValuation" class="btn btn-primary btn-large" style="width: 100%; border: none; padding: 15px; font-size: 1.1rem; box-shadow: 0 4px 10px rgba(34,197,94,0.2); background: #22c55e; display: flex; align-items: center; justify-content: center; gap: 8px; color: white; margin: 0; cursor: pointer;">\r\n                <span style="font-size: 1.4rem;">💰</span> VALORIZZAZIONE ATTIVITÀ\r\n            </button>';
    indexHtmlContent = indexHtmlContent.replace(btnBlockOpen, '');
    indexHtmlContent = indexHtmlContent.replace(btnBlockOpenWin, '');
    
    // Estrai la modale
    const modalStartHTML = "<!-- MODAL VALORIZZAZIONE ATTIVITÀ -->";
    const modalEndHTML = '<script type="module" src="app.js?v=61"></script>';
    let modStartIdx = indexHtmlContent.indexOf(modalStartHTML);
    let modEndIdx = indexHtmlContent.lastIndexOf('</div>', indexHtmlContent.indexOf(modalEndHTML));
    
    if(modStartIdx !== -1 && modEndIdx !== -1) {
        // Extract up to just after that closing div
        const extractedModal = indexHtmlContent.substring(modStartIdx, modEndIdx + 6);
        indexHtmlContent = indexHtmlContent.substring(0, modStartIdx) + indexHtmlContent.substring(modEndIdx + 6);
        fs.writeFileSync(indexHtmlPaths, indexHtmlContent, 'utf8');
        
        // Inserisci modale in admin.html prima dei tag script
        const adminScriptIdx = adminHtmlContent.indexOf('<!-- Libs -->');
        if(adminScriptIdx !== -1) {
            adminHtmlContent = adminHtmlContent.substring(0, adminScriptIdx) + '\n\n' + extractedModal + '\n\n' + adminHtmlContent.substring(adminScriptIdx);
            
            // Inserisci il bottone nella dashboard
            // Troviamo btnExportExcel e lo mettiamo vicino
            const exportBtnStr = '<button class="btn btn-primary" id="btnExportExcel"';
            const exportBtnIdx = adminHtmlContent.indexOf(exportBtnStr);
            if(exportBtnIdx !== -1) {
                const newBtnHtml = `
                    <button class="btn btn-primary" id="btnOpenValuation" style="background-color: #22c55e; border-color: #16a34a; height: 100%; display: flex; align-items: center; justify-content: center; text-align: center; line-height: 1.2; margin-left: 10px;">
                        <span class="btn-icon">💰</span> VALORIZZAZIONE<br>ATTIVITÀ
                    </button>`;
                // metto dopo la chiusura di btnExportExcel
                const exportEndIdx = adminHtmlContent.indexOf('</button>', exportBtnIdx) + 9;
                adminHtmlContent = adminHtmlContent.substring(0, exportEndIdx) + newBtnHtml + adminHtmlContent.substring(exportEndIdx);
            }
            fs.writeFileSync(adminHtmlPaths, adminHtmlContent, 'utf8');
            console.log("Moved HTML logic to admin.html!");
        } else {
             console.log("Could not find insertion points in admin.html");
        }
    } else {
        console.log("Could not find Modal bounds in index.html");
    }
} catch (e) {
    console.error(e);
}
