const SB_URL = "https://vnzrewcbnoqbqvzckome.supabase.co";
const SB_KEY = "sb_publishable_Sq9txbu-PmKdbxETSx2cjw_WqWEFBPO"; // La tua chiave publishable
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let carrello = [];
let signaturePad;

// --- 1. NAVIGAZIONE ---
function nascondiTutto() {
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('tab-storico').style.display = 'none';
    document.getElementById('app-interface').style.display = 'none';
}

function mostraApp() {
    nascondiTutto();
    document.getElementById('app-interface').style.display = 'block';
    openTab(null, 'tab1');
}

function tornaAllaHome() {
    nascondiTutto();
    document.getElementById('home-screen').style.display = 'block';
}

function openTab(evt, tabId) {
    const sections = ['tab1', 'tab2', 'tab3'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    const target = document.getElementById(tabId);
    if (target) {
        target.style.display = 'block';
        if (evt) {
            evt.currentTarget.classList.add('active');
        } else {
            const btn = document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
            if(btn) btn.classList.add('active');
        }
    }

    if (tabId === 'tab3') {
        setTimeout(resizeCanvas, 150);
    }
}

// --- 2. GESTIONE STORICO ---
async function caricaStorico() {
    nascondiTutto();
    const lista = document.getElementById('lista-rapportini');
    document.getElementById('tab-storico').style.display = 'block';
    lista.innerHTML = "<p style='text-align:center;'>Caricamento in corso...</p>";

    try {
        const { data, error } = await supabaseClient
            .from('rapportini')
            .select('*')
            .order('data', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            lista.innerHTML = "<p style='text-align:center; padding: 20px;'>Nessun rapporto trovato.</p>";
            return;
        }

        lista.innerHTML = data.map(rap => `
            <div class="card-rapportino" style="border-left: 6px solid ${rap.completato ? '#27ae60' : '#f39c12'}; margin-bottom:15px; background:white; padding:15px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom:10px;">
                    <strong>${rap.zona || 'Senza Zona'}</strong>
                    <input type="checkbox" ${rap.completato ? 'checked' : ''} onchange="aggiornaStato(${rap.id}, this.checked)">
                </div>
                <div style="font-size: 0.85rem; color: #666;">📅 ${rap.data} | 👷 ${rap.operatore || 'N.D.'}</div>
                <div style="display: flex; gap: 8px; margin-top:10px;">
                    ${rap.pdf_url ? `<button onclick="window.open('${rap.pdf_url}', '_blank')" style="flex:1; padding:8px; background:#004a99; color:white; border:none; border-radius:4px;">👁️ PDF</button>` : ''}
                    <button onclick="eliminaRapporto(${rap.id})" style="padding:8px; background:#e74c3c; color:white; border:none; border-radius:4px;">🗑️</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        lista.innerHTML = `<p style="color:red;">Errore: ${err.message}</p>`;
    }
}

async function aggiornaStato(id, completato) {
    await supabaseClient.from('rapportini').update({ completato }).eq('id', id);
}

async function eliminaRapporto(id) {
    if (!confirm("Eliminare il rapporto?")) return;
    const { error } = await supabaseClient.from('rapportini').delete().eq('id', id);
    if (!error) caricaStorico();
}

// --- 3. RICERCA E CARRELLO ---
async function searchInDanea() {
    let query = document.getElementById('searchArticolo').value.trim();
    let divRisultati = document.getElementById('risultatiRicerca');
    if (query.length < 2) { divRisultati.innerHTML = ""; return; }

    const { data, error } = await supabaseClient
        .from('articoli')
        .select('"Cod.", "Descrizione", "Immagine"')
        .or(`"Cod.".ilike.%${query}%,"Descrizione".ilike.%${query}%`)
        .limit(10);

    if (error) return;
    divRisultati.innerHTML = data.map(art => `
        <div class="item-ricerca" onclick="aggiungiAlCarrello('${art["Cod."]}', '${art["Descrizione"].replace(/'/g, "\\'")}')" style="padding: 10px; border-bottom: 1px solid #eee; cursor:pointer; background:white;">
            <strong>${art["Cod."]}</strong> - <small>${art["Descrizione"]}</small>
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
        <div class="card-materiale" style="background:white; padding:10px; border-radius:8px; margin-bottom:5px; border:1px solid #ddd; display:flex; justify-content:space-between; align-items:center;">
            <div><b>${item.cod}</b><br><small>${item.desc}</small></div>
            <input type="number" value="${item.qta}" style="width:50px;" onchange="carrello[${index}].qta=this.value">
            <button onclick="carrello.splice(${index}, 1); aggiornaCarrelloUI()" style="color:red; background:none; border:none; cursor:pointer;">❌</button>
        </div>
    `).join('');
}

// --- 4. GENERAZIONE PDF E INVIO ---
async function generaEInviaPDF() {
    console.log("Pulsante Invia cliccato");
    const btn = document.querySelector('.btn-send');
    
    // Recupero valori
    const zona = document.getElementById('zona')?.value;
    const operatore = document.getElementById('operatore')?.value;
    const dataInt = document.getElementById('dataIntervento')?.value;
    const descrizione = document.getElementById('descrizioneIntervento')?.value;

    if (!zona || !operatore) {
        alert("Attenzione: Inserisci Zona e Operatore!");
        return;
    }

    btn.disabled = true;
    btn.innerText = "⏳ Invio...";

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.text("RAPPORTO INTERVENTO", 20, 20);
        doc.text(`Zona: ${zona}`, 20, 30);
        doc.text(`Operatore: ${operatore}`, 20, 40);
        doc.text(`Data: ${dataInt}`, 20, 50);
        
        const pdfBlob = doc.output('blob');
        const fileName = `Rapp_${Date.now()}.pdf`;

        // Upload
        const { error: upErr } = await supabaseClient.storage.from('carichi').upload(fileName, pdfBlob);
        if (upErr) throw upErr;

        const { data: urlData } = supabaseClient.storage.from('carichi').getPublicUrl(fileName);
        const pdfUrl = urlData.publicUrl;

        // DB
        await supabaseClient.from('rapportini').insert([{
            data: dataInt, operatore, zona, descrizione, materiali: carrello, pdf_url: pdfUrl
        }]);

        // Mail
        await fetch("https://vnzrewcbnoqbqvzckome.supabase.co/functions/v1/invio-rapportini", {
            method: 'POST',
            body: JSON.stringify({ operatore, zona, dataInt, descrizione, pdfUrl })
        });

        alert("Inviato!");
        location.reload();
    } catch (err) {
        alert("Errore: " + err.message);
        btn.disabled = false;
        btn.innerText = "🚀 INVIA RAPPORTO";
    }
}

// Assicurati che generaAnteprimaPDF sia definita così:
function generaAnteprimaPDF() {
    console.log("Pulsante Anteprima cliccato");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("ANTEPRIMA", 20, 20);
    doc.text("Zona: " + (document.getElementById('zona')?.value || "N/D"), 20, 30);
    window.open(doc.output('bloburl'), '_blank');
}
