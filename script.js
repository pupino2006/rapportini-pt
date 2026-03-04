const SB_URL = "https://vnzrewcbnoqbqvzckome.supabase.co";
const SB_KEY = "sb_publishable_Sq9txbu-PmKdbxETSx2cjw_WqWEFBPO";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let carrello = [];
let signaturePad;

// --- 1. NAVIGAZIONE ---

function mostraApp() {
    // Nasconde la Home e lo Storico
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('tab-storico').style.display = 'none';
    
    // Mostra l'interfaccia dell'app (Header, Nav e Contenuto)
    document.getElementById('app-interface').style.display = 'block';
    
    // Reset alle tab iniziali
    openTab(null, 'tab1');
}

function tornaAllaHome() {
    // Nasconde l'interfaccia app e lo storico
    document.getElementById('app-interface').style.display = 'none';
    document.getElementById('tab-storico').style.display = 'none';
    
    // Mostra la Home
    document.getElementById('home-screen').style.display = 'block';
}

function openTab(evt, tabId) {
    // Nasconde tutte le sezioni interne (tab1, tab2, tab3)
    const sections = ['tab1', 'tab2', 'tab3'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Rimuove classe active dai bottoni
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    // Mostra la sezione corretta
    const target = document.getElementById(tabId);
    if (target) {
        target.style.display = 'block';
        if (evt) {
            evt.currentTarget.classList.add('active');
        } else {
            // Se attivato da codice, cerca il bottone corrispondente
            const btn = document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
            if(btn) btn.classList.add('active');
        }
    }

    // Se entriamo nella tab firma, resize obbligatorio del canvas
    if (tabId === 'tab3') {
        setTimeout(resizeCanvas, 150);
    }
}

// --- 2. GESTIONE STORICO ---

async function caricaStorico() {
    const lista = document.getElementById('lista-rapportini');
    if(!lista) return;

    // Navigazione
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('app-interface').style.display = 'none';
    document.getElementById('tab-storico').style.display = 'block';

    lista.innerHTML = "<p style='text-align:center;'>Caricamento in corso...</p>";

    try {
        const { data, error } = await supabaseClient
            .from('rapportini')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            lista.innerHTML = "<p style='text-align:center;'>Nessun rapporto trovato.</p>";
            return;
        }

        lista.innerHTML = data.map(rap => `
            <div class="card-rapportino" style="border-left: 6px solid ${rap.completato ? '#27ae60' : '#f39c12'};">
                <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <strong style="font-size:1.1rem;">${rap.zona || 'N/A'}</strong>
                    <input type="checkbox" style="transform: scale(1.3);" ${rap.completato ? 'checked' : ''} onchange="aggiornaStato('${rap.id}', this.checked)">
                </div>
                <div style="font-size: 0.85rem; color: #666; margin-bottom: 10px;">
                    📅 ${rap.data || 'N/A'} | 👷 ${rap.operatore || 'N/A'}
                </div>
                <div class="azioni-storico">
                    <button onclick="window.open('${rap.pdf_url}', '_blank')">👁️ PDF</button>
                    <button onclick="reinviaRapporto('${rap.id}')">📧 Reinvia</button>
                    <button onclick="eliminaRapporto('${rap.id}')" style="background:#e74c3c; color:white;">🗑️</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        lista.innerHTML = `<p style="color:red; text-align:center;">Errore database: ${err.message}</p>`;
    }
}

// --- 3. LOGICA FIRMA E CARRELLO (UGUALE A PRIMA) ---

window.onload = () => {
    const canvas = document.getElementById('signature-pad');
    if (canvas) {
        signaturePad = new SignaturePad(canvas, { backgroundColor: 'rgb(255, 255, 255)' });
        resizeCanvas();
    }
    // Imposta data odierna
    if(document.getElementById('dataIntervento')) {
        document.getElementById('dataIntervento').valueAsDate = new Date();
    }
};

function resizeCanvas() {
    const canvas = document.getElementById('signature-pad');
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
}

window.addEventListener("resize", resizeCanvas);

// --- 4. RICERCA E DATABASE ---

async function searchInDanea() {
    let input = document.getElementById('searchArticolo');
    let query = input.value.trim();
    let divRisultati = document.getElementById('risultatiRicerca');
    
    if (query.length < 2) { 
        divRisultati.innerHTML = ""; 
        return; 
    }

    const { data, error } = await supabaseClient
        .from('articoli')
        .select('"Cod.", "Descrizione", "Immagine"')
        .or(`"Cod.".ilike.%${query}%,"Descrizione".ilike.%${query}%`)
        .limit(10);

    if (error) return;

    divRisultati.innerHTML = data.map(art => `
        <div class="item-ricerca" onclick="aggiungiAlCarrello('${art["Cod."]}', '${art["Descrizione"].replace(/'/g, "\\'")}')" style="display: flex; align-items: center; padding: 10px; border-bottom: 1px solid #eee; cursor:pointer;">
            <img src="${art["Immagine"] || 'https://via.placeholder.com/50'}" style="width:40px; height:40px; margin-right:10px;">
            <div><strong>${art["Cod."]}</strong><br><small>${art["Descrizione"]}</small></div>
        </div>
    `).join('');
}

function aggiungiAlCarrello(cod, desc) {
    carrello.push({ cod, desc, qta: 1 });
    document.getElementById('risultatiRicerca').innerHTML = "";
    document.getElementById('searchArticolo').value = "";
    aggiornaCarrelloUI();
}

function aggiornaCarrelloUI() {
    const container = document.getElementById('carrelloMateriali');
    container.innerHTML = carrello.map((item, index) => `
        <div class="card-materiale">
            <div><b>${item.cod}</b> - ${item.desc}</div>
            <div style="display:flex; gap:10px;">
                <input type="number" value="${item.qta}" style="width:50px" onchange="carrello[${index}].qta=this.value">
                <button onclick="carrello.splice(${index}, 1); aggiornaCarrelloUI()" style="color:red; border:none; background:none;">❌</button>
            </div>
        </div>
    `).join('');
}

// --- 5. FUNZIONI PDF E INVIO ---

async function generaEInviaPDF() {
    // Mantieni la tua logica originale di generaEInviaPDF qui
    // Assicurati di chiamare tornaAllaHome() alla fine del successo
}

async function aggiornaStato(id, completato) {
    await supabaseClient.from('rapportini').update({ completato: completato }).eq('id', id);
}

async function eliminaRapporto(id) {
    if (confirm("Eliminare definitivamente?")) {
        await supabaseClient.from('rapportini').delete().eq('id', id);
        caricaStorico();
    }
}

async function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
