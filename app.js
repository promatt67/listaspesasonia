const EMAIL_AUTORIZZATE = [
    "pietro.procopio@gmail.com"
];

const auth = firebase.auth();
const db   = firebase.database();
const prodottiRef = db.ref("prodotti");

const CATEGORIE_ORDER = [
    "Frutta e Verdura","Carne e Pesce","Latticini","Pane e Dolci",
    "Bevande","Pulizia Casa","Igiene Personale","Altro"
];
const CAT_EMOJI = {
    "Frutta e Verdura":"🥦","Carne e Pesce":"🥩","Latticini":"🧀",
    "Pane e Dolci":"🍞","Bevande":"🥤","Pulizia Casa":"🧹",
    "Igiene Personale":"🧴","Altro":"📦"
};

const STORAGE_KEY = "lista_spesa_sonia_cache";

function loginGoogle() {
    auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
        .catch(() => {
            const el = document.getElementById("login-error");
            if (el) el.textContent = "Errore di accesso. Riprova.";
        });
}

function logout() {
    prodottiRef.off();
    auth.signOut();
}

// Mostra subito i dati salvati in cache (anche offline)
function mostraCacheLocale() {
    try {
        const cache = localStorage.getItem(STORAGE_KEY);
        if (cache) {
            const prodotti = JSON.parse(cache);
            renderTabella(prodotti);
        }
    } catch (e) {}
}

// Salva i dati per uso offline
function salvaCacheLocale(prodotti) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prodotti));
    } catch (e) {}
}

// Funzione isolata per attivare l'ascolto dei dati sul DB
function attivaListenerProdotti() {
    prodottiRef.off();
    prodottiRef.on("value",
        snapshot => {
            const prodotti = [];
            snapshot.forEach(child => {
                const val = child.val();
                if (!val.categoria || !CATEGORIE_ORDER.includes(val.categoria)) {
                    val.categoria = "Altro";
                }
                prodotti.push({ id: child.key, ...val });
            });
            prodotti.sort((a, b) => {
                if (a.acquistato !== b.acquistato) return a.acquistato ? 1 : -1;
                return (a.timestamp || 0) - (b.timestamp || 0);
            });
            renderTabella(prodotti);
            salvaCacheLocale(prodotti);
        },
        err => console.error("Errore DB:", err.message)
    );
}

// Gestore Autenticazione Corretto per supportare l'ambiente offline
auth.onAuthStateChanged(user => {
    const loginScreen = document.getElementById("login-screen");
    const appScreen   = document.getElementById("app-screen");
    const loginError  = document.getElementById("login-error");

    // Controllo flessibile: valido se Firebase passa l'utente o se è presente nella cache locale
    const utenteAttivo = user || auth.currentUser;

    if (utenteAttivo) {
        if (utenteAttivo.email && !EMAIL_AUTORIZZATE.includes(utenteAttivo.email)) {
            if (loginError) loginError.textContent = "⛔ Account non autorizzato.";
            auth.signOut();
            return;
        }
        if (loginScreen) loginScreen.style.display = "none";
        if (appScreen) appScreen.style.display   = "block";
        
        const userNameEl = document.getElementById("user-name");
        if (userNameEl) userNameEl.textContent = utenteAttivo.displayName || utenteAttivo.email;
        
        const photo = document.getElementById("user-photo");
        if (photo && utenteAttivo.photoURL) { 
            photo.src = utenteAttivo.photoURL; 
            photo.style.display = "inline"; 
        }

        // 1. Mostra IMMEDIATAMENTE i vecchi dati locali (zero attese, l'app si popola subito)
        mostraCacheLocale();

        // 2. Avvia l'ascolto in background (se c'è rete aggiorna, se offline mantiene la cache)
        attivaListenerProdotti();
    } else {
        prodottiRef.off();
        if (loginScreen) loginScreen.style.display = "flex";
        if (appScreen) appScreen.style.display   = "none";
    }
});

function setStatus(msg, isError = false) {
    const el = document.getElementById("status");
    if (!el) return;
    el.style.color = isError ? "#e63946" : "#f4a261";
    el.innerHTML = msg;
}

function escHtml(str) {
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function renderTabella(prodotti) {
    const tbody   = document.getElementById("tabella-prodotti");
    const counter = document.getElementById("counter");
    if (!tbody) return;
    
    if (prodotti.length === 0) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="4" data-i18n="messaggio_vuoto">Nessun prodotto da comprare</td></tr>`;
        if (counter) counter.innerHTML = "";
        applicaLinguaCorrente();
        return;
    }
    
    const acquistati = prodotti.filter(p => p.acquistato).length;
    if (counter) {
        const linguaSalvata = localStorage.getItem('lingua_selezionata') || 'it';
        const testoAcquistati = linguaSalvata === 'pl' ? 'kupione' : 'acquistati';
        counter.innerHTML = `<span class="acquistati-count">${acquistati}</span> / ${prodotti.length} <span>${testoAcquistati}</span>`;
    }
    
    const gruppi = {};
    CATEGORIE_ORDER.forEach(c => gruppi[c] = []);
    prodotti.forEach(p => {
        const cat = p.categoria || "Altro";
        if (!gruppi[cat]) gruppi[cat] = [];
        gruppi[cat].push(p);
    });
    
    let html = "";
    CATEGORIE_ORDER.forEach(cat => {
        const items = gruppi[cat];
        if (!items.length) return;
        
        // Recupera la lingua attiva per tradurre direttamente la categoria
        const linguaSalvata = localStorage.getItem('lingua_selezionata') || 'it';
        let nomeCategoriaTradotto = cat;

        // Mappa le chiavi esatte del dizionario HTML
        const catChiavi = {
            "Frutta e Verdura": "group_frutta_verdura",
            "Carne e Pesce": "group_carne_pesce",
            "Latticini": "group_latticini_uova",
            "Pane e Dolci": "group_pane_pasta_dispensa",
            "Bevande": "group_bevande",
            "Pulizia Casa": "group_pulizia_casa",
            "Igiene Personale": "group_igiene_personale",
            "Altro": "group_altro_casa"
        };

        const chiaveDizionario = catChiavi[cat];
        if (chiaveDizionario && typeof traduzioni !== 'undefined' && traduzioni[linguaSalvata] && traduzioni[linguaSalvata][chiaveDizionario]) {
            nomeCategoriaTradotto = traduzioni[linguaSalvata][chiaveDizionario];
        }

        html += `<tr class="cat-header"><td colspan="4"><span class="cat-emoji-span">${CAT_EMOJI[cat]||"📦"}</span> <span>${nomeCategoriaTradotto}</span></td></tr>`;
        
        items.forEach(p => {
            let logoHtml = '';
            const ubi = p.ubicazione || '';
            const ubiLower = String(ubi).toLowerCase().trim();

            if (ubiLower.includes('bennet')) logoHtml = '🏪 ';
            else if (ubiLower.includes('coop') || ubiLower.includes('ipercoop')) logoHtml = '🌱 ';
            else if (ubiLower.includes('esselunga')) logoHtml = '🍓 ';
            else if (ubiLower.includes('md')) logoHtml = '💛 ';
            else if (ubiLower.includes('lidl')) logoHtml = '🟡 ';
            else if (ubiLower.includes('aldi')) logoHtml = '🔵 ';
            else if (ubiLower.includes('eurospin')) logoHtml = '💛 ';
            else if (ubiLower.includes('carrefour') || ubiLower.includes('carefour')) logoHtml = '🔵 ';
            else if (ubiLower.includes('famila')) logoHtml = '🧡 ';
            else if (ubiLower.includes('tigros') || ubiLower.includes('tigro')) logoHtml = '🐯 ';
            else if (ubiLower.includes('conad')) logoHtml = '🌼 ';
            else if (ubiLower.includes('gulliver')) logoHtml = '⛵ ';
            else if (ubiLower.includes('frigo')) logoHtml = '❄️ ';
            else if (ubiLower.includes('dispensa')) logoHtml = '📦 ';
            else if (ubiLower.includes('casa')) logoHtml = '🏠 ';

            // Gestione traduzione dinamica per l'ubicazione "In Casa"
            let ubiAttr = '';
            if (ubiLower === 'frigo') ubiAttr = 'data-i18n="posto_frigo"';
            else if (ubiLower === 'dispensa') ubiAttr = 'data-i18n="posto_dispensa"';
            else if (ubiLower === 'casa') ubiAttr = 'data-i18n="posto_casa"';

            html += `<tr class="${p.acquistato?"acquistato":""}">
              <td><span class="nome-prodotto">${escHtml(p.nome)}</span></td>
              <td><span class="badge-qty">${p.quantita}</span></td>
              <td><span class="badge-loc">${logoHtml}<span ${ubiAttr}>${escHtml(ubi)}</span></span></td>
              <td>
                <button class="btn-check" onclick="toggleAcquistato('${p.id}',${!!p.acquistato})" data-i18n="btn_spunta">${p.acquistato?"↩️":"✓"}</button>
                <button class="btn-del" onclick="eliminaProdotto('${p.id}')" data-i18n="btn_elimina">🗑</button>
              </td></tr>`;
        });
    });
    tbody.innerHTML = html;

    // Traduce all'istante tutti i nuovi elementi iniettati
    applicaLinguaCorrente();
}

// Funzione helper per applicare la traduzione della lingua corrente
function applicaLinguaCorrente() {
    const linguaSalvata = localStorage.getItem('lingua_selezionata') || 'it';
    if (typeof impostaLingua === 'function') {
        impostaLingua(linguaSalvata);
    }
}

function aggiungiProdotto() {
    const nome       = document.getElementById("nome").value.trim();
    const quantita   = parseInt(document.getElementById("quantita").value);
    const ubicazione = document.getElementById("ubicazione").value;
    const categoria  = document.getElementById("categoria").value;
    if (!nome || !ubicazione || isNaN(quantita) || quantita < 1) {
        setStatus("⚠️ Compila tutti i campi.", true); return;
    }
    const btn = document.getElementById("btn-aggiungi");
    btn.disabled = true; btn.textContent = "Salvataggio…";
    
    prodottiRef.push({ nome, quantita, ubicazione, categoria, acquistato: false, timestamp: Date.now() })
        .then(() => {
            setStatus("✅ Prodotto aggiunto!");
            setTimeout(() => setStatus(""), 2500);
        })
        .catch(err => setStatus("❌ Errore: " + err.message, true));

    document.getElementById("nome").value = "";
    document.getElementById("quantita").value = "";
    btn.disabled = false; btn.textContent = "Aggiungi Prodotto";
    
    applicaLinguaCorrente();
}

function toggleAcquistato(id, stato) {
    db.ref("prodotti/" + id).update({ acquistato: !stato })
        .catch(err => setStatus("❌ Errore.", true));
}

function eliminaProdotto(id) {
    // 1. Rileva la lingua selezionata dall'utente (se non c'è, usa l'italiano 'it' come base)
    const linguaSalvata = localStorage.getItem('lingua_selezionata') || 'it';
    
    // 2. Imposta un messaggio di riserva (salvavita)
    let messaggio = "Eliminare?";
    if (linguaSalvata === 'pl') {
        messaggio = "Czy chcesz usunąć?";
    }
    
    // 3. Se il dizionario in index.html è pronto, usa la frase esatta che abbiamo aggiunto prima
    if (typeof traduzioni !== 'undefined' && traduzioni[linguaSalvata] && traduzioni[linguaSalvata]['conferma_elimina']) {
        messaggio = traduzioni[linguaSalvata]['conferma_elimina'];
    }

    // Mostra il popup con la lingua corretta
    if (!confirm(messaggio)) return;
    
    // Se l'utente clicca OK, procedi con l'eliminazione su Firebase
    db.ref("prodotti/" + id).remove()
        .then(() => {
            setStatus(linguaSalvata === 'pl' ? "🗑️ Usunięto." : "🗑️ Eliminato.");
            setTimeout(() => setStatus(""), 2000);
        })
        .catch(err => setStatus("❌ Errore.", true));
}

document.addEventListener("keydown", e => { if (e.key === "Enter") aggiungiProdotto(); });

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js")
        .catch(err => console.warn("SW:", err));
}

let deferredPrompt = null;
const banner = document.getElementById("install-banner");
window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault(); deferredPrompt = e; if (banner) banner.style.display = "flex";
});
const btnInstall = document.getElementById("btn-install");
if (btnInstall) {
    btnInstall.addEventListener("click", async () => {
        if (banner) banner.style.display = "none";
        if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; }
    });
}
const dismissInstall = document.getElementById("dismiss-install");
if (dismissInstall) {
    dismissInstall.addEventListener("click", () => { if (banner) banner.style.display = "none"; });
}
