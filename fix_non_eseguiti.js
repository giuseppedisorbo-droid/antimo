const fs = require('fs');
const path = require('path');
const filePath = path.join('g:', 'Il mio Drive', 'STORAGE', 'ANTIMO', 'GestioneAttivitaWeb', 'admin.html');

try {
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const lines = rawContent.split('\n');
    
    // Replace lines 176 to 197 (1-indexed) which corresponds to indices 175 to 196
    const newContent = `            <h2 id="toggleNonEseguitiHeader" style="padding: 1rem 1.5rem; margin: 0; background: #fffcf0; color: #b45309; border-bottom: 1px solid #fef08a; display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <span>⚠️ Interventi Non Eseguiti (Da Chiudere)</span>
                    <span id="badgeNonEseguitiHeader" style="background:#ef4444; color:white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;">0</span>
                    <button id="btnMassDeleteNonEseguiti" class="btn btn-danger btn-sm hidden" style="margin: 0; padding: 6px 12px; font-weight: bold; font-size: 0.8rem; box-shadow: 0 4px 6px rgba(239, 68, 68, 0.4);">🗑️ Elimina (<span id="countNonEseguiti">0</span>)</button>
                </div>
                <span id="nonEseguitiToggleIcon" style="font-size: 0.9rem;">Apri ⬇️</span>
            </h2>
            <div id="nonEseguitiWrapper" class="hidden">
                <table id="nonEseguitiTable">
                    <thead>
                        <tr>
                            <th style="width: 40px; text-align: center;"><input type="checkbox" id="selectAllNonEseguiti" style="transform: scale(1.3); cursor: pointer;"></th>
                            <th>Data Prevista</th>
                            <th>Paziente</th>
                            <th>Località</th>
                            <th>Indirizzo (Tel)</th>
                            <th>Tipo Intervento / Disp.</th>
                            <th>Motivazione Mancata Esecuzione</th>
                            <th>Azioni</th>
                        </tr>
                    </thead>
                    <tbody id="nonEseguitiTableBody">
                        <tr><td colspan="6" class="loading-spinner">Caricamento dati da Firebase... ⏳</td></tr>
                    </tbody>
                </table>`;

    // Because splitting by \n keeps the \r on Windows, we'll just splice it
    // Wait, let's just make sure we replace the correct chunk.
    const startIdx = 176;
    const countToRemove = 197 - 176 + 1;
    lines.splice(startIdx, countToRemove, newContent);
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log("Successfully replaced lines 177 to 198");
} catch (e) {
    console.error(e);
}
