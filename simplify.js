const fs = require('fs');
const htmlFile = 'index.html';
const content = fs.readFileSync(htmlFile, 'utf8');

const replacement = `
                <div id="chap1" class="guide-chap" style="display:none;">
                    <h2 style="color:var(--primary); margin-bottom:20px; border-bottom:3px solid var(--border); padding-bottom:10px;">Capitolo 1 - Creazione e Gestione dei Task</h2>
                    <ul style="margin-left:20px; line-height:1.8; list-style-type:circle;">
                        <li style="margin-bottom:15px;"><strong>Creare un Task:</strong> Premi il pulsante <strong>"+"</strong> posizionato in basso a destra. Si aprirà il modulo dove descrivere il guasto o l'intervento. Ricorda che è obbligatorio assegnare una <em>Famiglia</em> o un <em>Centro di Costo</em>.</li>
                        <li style="margin-bottom:15px;"><strong>Aggiungere Dettagli e Foto:</strong> Usa il pulsante <strong>"✏️ Aggiungi Dettagli/Allegati"</strong> per espandere le informazioni. Qui puoi caricare foto del problema, inserire file PDF o scrivere appunti più lunghi (<em>Rich Description</em>).</li>
                        <li style="margin-bottom:15px;"><strong>Approvazione e Assegnazione:</strong> I nuovi task nascono in stato di <em>"Proposta (In Attesa)"</em>. Spetta a <strong>Giuseppe (Admin)</strong> o ai <strong>Supervisori</strong> approvare la richiesta e decidere a quale operatore (es. Paolo) assegnarla.</li>
                        <li style="margin-bottom:15px;"><strong>Le Urgenze:</strong> Se il problema non può aspettare, usa il flag di <strong>Urgenza Massima</strong>. Sulla scheda apparirà un bollino rosso <em>"🚨 URGENTE"</em> e il task balzerà in cima alla lista di chi deve eseguire il lavoro.</li>
                        <li style="margin-bottom:15px;"><strong>Chiudere un Lavoro:</strong> Una volta terminato l'intervento, premi il pulsante <strong>"✔️ Completato"</strong>. Il task sparirà dalla lista delle cose da fare e verrà archiviato nel sistema per i report futuri.</li>
                    </ul>
                </div>

                <div id="chap2" class="guide-chap" style="display:none;">
                    <h2 style="color:var(--primary); margin-bottom:20px; border-bottom:3px solid var(--border); padding-bottom:10px;">Capitolo 2 - Agenda, Calendario e Interventi</h2>
                    <ul style="margin-left:20px; line-height:1.8; list-style-type:square;">
                        <li style="margin-bottom:15px;"><strong>Il Calendario (FullCalendar):</strong> La schermata <em>"Agenda"</em> ti permette di visualizzare tutti i lavori programmati in una comoda griglia Mensile, Settimanale o Giornaliera. È perfetta per avere un'anteprima chiara degli impegni.</li>
                        <li style="margin-bottom:15px;"><strong>Colori per Ogni Giorno:</strong> Ogni giorno ha un colore speciale: ad esempio, il <strong>Lunedì</strong> è sempre <em>rosso</em>, il <strong>Martedì</strong> è <em>arancione</em>. Questo aiuta a riconoscere al volo quando cade un appuntamento.</li>
                        <li style="margin-bottom:15px;"><strong>Ordine Programmato (Mattina / Pomeriggio):</strong> I task della giornata si dividono automaticamente. Troviamo prima le emergenze in ritardo, poi i blocchi <strong>"☀️ Mattina"</strong> e a seguire quelli etichettati <strong>"🌙 Pomeriggio"</strong>.</li>
                        <li style="margin-bottom:15px;"><strong>Filtrare un Singolo Giorno:</strong> Se clicchi sulla data numerica nel calendario, l'elenco in basso ti mostrerà <strong>solo</strong> i lavori previsti per quel giorno (<em>Focus View</em>). Ricliccando, tornerai a vedere il flusso generale.</li>
                        <li style="margin-bottom:15px;"><strong>Giornata Manovale (Lavoratori Esterni):</strong> Se c'è un operatore esterno (come Dino o Antimo) che ti aiuta, usa il pulsante <strong>"👨‍🔧 Giornata Manovale"</strong> per registrare le sue ore di affiancamento a fine giornata.</li>
                    </ul>
                </div>

                <div id="chap3" class="guide-chap" style="display:none;">
                    <h2 style="color:var(--primary); margin-bottom:20px; border-bottom:3px solid var(--border); padding-bottom:10px;">Capitolo 3 - Ripartizione, Cassa e Finanza</h2>
                    <ul style="margin-left:20px; line-height:1.8; list-style-type:disc;">
                        <li style="margin-bottom:15px;"><strong>Il Wallet (Il tuo saldo in tempo reale):</strong> In cima allo schermo c'è sempre un indicatore verde. È il tuo saldo di "Cassa" (Wallet). Quando aggiungi una spesa, i soldi scendono. Solo l'<strong>Admin</strong> può ricaricare questo fondo.</li>
                        <li style="margin-bottom:15px;"><strong>Aggiungere una Spesa:</strong> Clicca sul tasto <em>"Aggiungi Spesa"</em> all'interno del task o nella pagina Finanza. Scrivi l'importo pagato per materiali o fornitori e i soldi scaleranno subito dal tuo portafoglio virtuale.</li>
                        <li style="margin-bottom:15px;"><strong>Obbligo dello Scontrino Fiscale:</strong> Non puoi registrare spese valide senza allegare la foto della ricevuta. Se non hai la foto pronta, la spesa resterà marcata come <em>"⚠️ MANCA SCONTRINO"</em> o "Pendente" finché non ne fai una.</li>
                        <li style="margin-bottom:15px;"><strong>L'Allocation Wizard (Ripartizione dei Costi):</strong> A fine giornata, l'Admin o il Supervisore distribuiscono la spesa tra i vari centri di costo. Usano l'<em>Allocation Wizard</em> per decidere al centesimo se i soldi spettano all'<strong>Organizzazione A</strong> o alla <strong>Famiglia B</strong>.</li>
                        <li style="margin-bottom:15px;"><strong>La Vista Finanza Centrale:</strong> Solo l'amministrazione vede questa pagina protetta. Qui i supervisori controllano tutti i movimenti in uscita, ricaricano il wallet degli operatori e generano estratti conto.</li>
                    </ul>
                </div>

                <div id="chap4" class="guide-chap" style="display:none;">
                    <h2 style="color:var(--primary); margin-bottom:20px; border-bottom:3px solid var(--border); padding-bottom:10px;">Capitolo 4 - Direttorio, Organizzazioni e Famiglie</h2>
                    <ul style="margin-left:20px; line-height:1.8; list-style-type:circle;">
                        <li style="margin-bottom:15px;"><strong>A Chi si Intesta il Lavoro:</strong> Ogni intervento o acquisto di materiali deve basarsi su chi richiederà la prestazione. Non puoi creare un task senza aver indicato un'<em>Organizzazione</em> o una <em>Famiglia</em> a cui fatturare.</li>
                        <li style="margin-bottom:15px;"><strong>I Menù a Scomparsa:</strong> Nelle Impostazioni c'è il <strong>Direttorio</strong>. Visto che la lista è lunga, è divisa in bottoni a fisarmonica: cliccando su <em>"Famiglie"</em> o <em>"Organizzazioni"</em> si apre l'elenco vero e proprio.</li>
                        <li style="margin-bottom:15px;"><strong>Aggiungere Nuove Voci:</strong> Se devi registrare un cliente fresco, basta premere <strong>"➕ Aggiungi"</strong>. Inserisci il nome nel pop-up e verrà immediatamente salvato in cloud (su Firebase), visibile subito anche a chi deve chiudere i conti.</li>
                        <li style="margin-bottom:15px;"><strong>Luoghi e Indirizzi (Location Id):</strong> Sono i cantieri fisici o gli immobili. Quando aggiungi un task, scegli da questo elenco di <em>Luoghi</em> prememorizzati per far sapere subito agli operatori dove dirigere il veicolo o ritirare gli attrezzi.</li>
                        <li style="margin-bottom:15px;"><strong>I Limiti di Visualizzazione:</strong> Un tecnico operativo vede l'essenziale per pensare a lavorare (lista semplificata). Tutte le liste sensibili coi nomi, le suddivisioni di fatturazione interne e i partner finanziari sono visibili <strong>esclusivamente all'Admin</strong>.</li>
                    </ul>
                </div>

                <div id="chap5" class="guide-chap" style="display:none;">
                    <h2 style="color:var(--primary); margin-bottom:20px; border-bottom:3px solid var(--border); padding-bottom:10px;">Capitolo 5 - Supporto Intelligente e Notifiche</h2>
                    <ul style="margin-left:20px; line-height:1.8; list-style-type:square;">
                        <li style="margin-bottom:15px;"><strong>L'Aiuto AI:</strong> Se ti blocchi, apri il modulo <strong>✨ Aiuto AI</strong>. Troverai un'intelligenza artificiale pronta a chattare con te per darti una mano a usare i comandi dell'applicazione o capire chi contattare in caso di blocco.</li>
                        <li style="margin-bottom:15px;"><strong>Il Context Banner:</strong> Mentre scrivi all'AI, noterai in alto una fascetta colorata (es. <em>"Contesto: Finanza"</em>). Ricorda in quale schermata ti trovi, così l'AI potrà darti risposte specifiche per quella singola pagina.</li>
                        <li style="margin-bottom:15px;"><strong>Prompt Veloci:</strong> Invece di scrivere tutta la domanda a mano, puoi pigiare i pulsanti pre-costruiti come <strong>"Come faccio a..."</strong> o <strong>"Segnala Problema..."</strong> per avviare subito la conversazione in maniera tecnica ed efficace.</li>
                        <li style="margin-bottom:15px;"><strong>Notifiche Push Interne:</strong> Se ti viene inoltrato un task, se una priorità cambia o se ti arriva una ricarica nel wallet, un campanellino in alto e una riga in Home ti avviseranno immediatamente del nuovo evento.</li>
                        <li style="margin-bottom:15px;"><strong>Pulizia Automatica Giornaliera:</strong> Per non ingolfare il telefono o l'app, a mezzanotte il sistema pialla automaticamente i task completati del giorno precedente e svuota le notifiche già lette, accogliendoti ogni mattina con il desk sgombro.</li>
                    </ul>
                </div>

                <div id="chap6" class="guide-chap" style="display:none;">
                    <h2 style="color:var(--primary); margin-bottom:20px; border-bottom:3px solid var(--border); padding-bottom:10px;">Capitolo 6 - Glossario Tecnico</h2>
                    <ul style="list-style-type:none; padding:0; margin:0; line-height:1.7;" id="glossaryList">
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>1. Admin:</strong> Livello massimo (Giuseppe). Approva interventi, gestisce finanze, distribuisce fondi e organizza directory.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>2. Agenda:</strong> Schermata (Calendario) per visualizzare gli appuntamenti nel mese, settimana o giornata.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>3. Aiuto AI:</strong> Modulo di Intelligenza Artificiale per l'assistenza al software in-app.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>4. Allegato:</strong> File audio, video o foto aggiunto al "Task" per capirne visivamente o oralmente l'entità.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>5. Allocazione:</strong> Procedura con cui l'Admin calcola al centesimo quanto una <em>Famiglia</em> dovrà pagare tra le spese libere inserite.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>6. Approvatore:</strong> Supervisore che dà il via libera ad una "Proposta" trasformandola in lavoro con budget.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>7. Assegnazione:</strong> Istante in cui un manager decide e collega il compito all'operaio effettivo (Es: Paolo o Luca).</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>8. Badge Status:</strong> Micro etichetta colorata posta sulla card del task ("Assegnato", "Finito", ecc.).</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>9. Cassa:</strong> Denaro contante o circuito di portafogli su cui appoggiare acquisti impellenti.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>10. Completato:</strong> Tasto e stato finale da cliccare a guasto riparato per togliere la card dal proprio feed quotidiano.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>11. Consuntivo:</strong> Riepilogo dettagliato della riparazione appena terminata per uso contabile o come appunto storico.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>12. Context Banner:</strong> Scrittina evidenziata che dice all'AI dove ti trovi per farti aiutare meglio nelle deduzioni visive.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>13. Dettaglio Task:</strong> Finestra "Modal" profonda in cui si entra cliccando la card per leggere gli allegati sfuggiti nell'anteprima.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>14. Direttorio:</strong> L'elenco madre, diviso per "Organizzazioni, Famiglie e Luoghi" posto sotto Impostazioni.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>15. Famiglia:</strong> Entità fisica o società privata alla quale deviare la spesa vera e propria di manovalanza.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>16. Feed:</strong> Schermata principale "Home" col muro cascante dei task da adempiere dall'alto verso il basso per urgenza.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>17. Finanza:</strong> Pagina riservata in cui l'Admim vede tutto il ricaricato, lo speso e provvede ad esportare i report rendiconto.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>18. Focus View:</strong> Tappando in alto su un giorno nel Calendario, si filtrano all'istante spazzando via le altre occorrenze estranee della settimana.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>19. Fondo:</strong> Capitale e soldi ricaricabili in capo ad un Tecnico. L'admin compie "Ricarica Fondo" per alzarne il saldo.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>20. FullCalendar:</strong> Il plugin visivo dell'app che disegna la tabellina dell'agenda con colori inconfutabili.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>21. Giornata Manovale:</strong> Segnalazione apposita per le ore lavorate da dipendenti o aiuti esterni sul posto (Es: Antimo).</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>22. In-Progress:</strong> Fase in cui si trova un'attività dal primo mattino sino alla pressione sul verde e rasserenante "Completato".</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>23. Log Activity:</strong> Memoria di sistema blindata. Salva i click ed ogni cambio di data o messaggio avvenuto (utile contro modifiche accidentali).</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>24. Luogo (Location):</strong> Identificativo dell'edificio reale o del cantiere civico a cui indirizzare i dipendenti.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>25. Modal:</strong> Schermata gigante pop-up che si piazza sopra l'app per bloccarti su una singola azione voluta.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>26. Notifica Push:</strong> Segnalino per avvisi in tempo reale. Sbriga la comunicazione urgente o avvisa chi entra di un Task Fresco.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>27. Nuovo Task:</strong> Il compito non appena compilato ed incerto, spesso timido in "Attesa".</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>28. Operativo (Tecnico):</strong> Ruolo per colui che combatte materialmente i guasti dell'app ma che non penetra nei meandri direzionali delle finanze.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>29. Organizzazione:</strong> Sede, partner forte o società fattuarbile. Struttura preposta ad addossarsi i pagamenti ripartiti.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>30. Proposta Lavoro:</strong> Idea di intervento originata da operatori, non visibile ancora in agenda programmata ufficiale.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>31. PWA (WebApp):</strong> Il sistema vitale che consente all'app d'istallarsi su cellulare bypassando l'ingombro degli Stores digitali iOS/Android.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>32. Quick Actions:</strong> I bottoni scattanti sulle card ("+ Aggiungi Spesa" o "Scontrino") per non obbligarti all'apertura profonda in 5 click.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>33. Report:</strong> Sezione stringata utilissima ai commercialisti in cui scaricare elenchi nudi di fatturazione, compensi ed ore.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>34. Rich Description:</strong> Il box sterminato dentro il quale, incollare files audio vocali, e scrivere un log o lamenti estesi a corredo d'un titolo striminzito.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>35. Rimborso:</strong> Flusso in entrata o pareggio cassa azionato dall'amministrazione locale per ripagare un'eccessiva uscita di monete del dipendente ("Wallet").</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>36. Scontrino Fotografato:</strong> Assoluta precondizione obbligatoria. Un'emergenza senza sfilza fiscale jpg annessa rimarrà inevasa nel Wallet e "Pendente in Approvazione".</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>37. Sessione Lavorativa:</strong> Il riquadro che conteggia la parentesi oraria degli aiuti occasionali assoldati ad ore esterne.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>38. Supervisore:</strong> Secondo in scala, approva, accelera urgenze e muove calendari imponendo decisioni intermedie in supporto.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>39. Urgenza (Badge):</strong> Segnalino Letale "Rosso"; sopprime in tempo zero gli obblighi feriali scaraventando la card in testa al palinsesto generale per farsi sbrigare ad ogni costo.</li>
                        <li style="margin-bottom:8px; border-bottom:1px dashed var(--border);"><strong>40. Wallet:</strong> Sull'interfaccia Home (in Cima Destra o Sinistra) il badge verde o rosso monetario dei TUOI esatti importi rimanenti d'ufficio prima di dover fare richieste SOS soldi (Ricariche).</li>
                    </ul>
                </div>
`;

// Replace from <div id="chap1" ... to the </div> of chap6
const startMarker = '<div id="chap1" class="guide-chap" style="display:none;">';
const endMarker = '</div>';
const startIndex = content.indexOf(startMarker);
if(startIndex === -1) {
    console.error('Start marker non trovato');
    process.exit(1);
}

// Find the 6th closing div after chap6
let currentIndex = content.indexOf('<div id="chap6"', startIndex);
let endIndex = content.indexOf('</div>', currentIndex);
// Actually we can just find 'window.openChapter = function(n) {' and go back...
const nextScriptIndex = content.indexOf('<script>', currentIndex);
endIndex = content.lastIndexOf('</div>', nextScriptIndex); // The </div> of chap6

const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex + 6);

// Bump version for cache busting
const bumpedHtml = newContent.replace(/v5\.4/g, 'v5.5');

fs.writeFileSync(htmlFile, bumpedHtml, 'utf8');

// also bump app.js and sw.js
let appjs = fs.readFileSync('app.js', 'utf8');
appjs = appjs.replace(/v5\.4/g, 'v5.5');
fs.writeFileSync('app.js', appjs, 'utf8');

let swjs = fs.readFileSync('sw.js', 'utf8');
swjs = swjs.replace(/v5\.4/g, 'v5.5');
fs.writeFileSync('sw.js', swjs, 'utf8');

console.log('Fatto!');
