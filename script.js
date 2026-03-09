const SB_URL = "https://vnzrewcbnoqbqvzckome.supabase.co";
const SB_KEY = "sb_publishable_Sq9txbu-PmKdbxETSx2cjw_WqWEFBPO";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let carrello = [];
let signaturePad; // Dichiarata globalmente

// --- NAVIGAZIONE ---
function openTab(evt, tabId) {
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(tab => tab.style.display = 'none');
    
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    const target = document.getElementById(tabId);
    if (target) {
        target.style.display = 'block';
    }
    
    if (evt) evt.currentTarget.classList.add('active');

    if (tabId === 'tab3') {
        setTimeout(resizeCanvas, 200);
    }
}

// --- INIZIALIZZAZIONE ---
window.onload = () => {
    const canvas = document.getElementById('signature-pad');
    if (canvas) {
        signaturePad = new SignaturePad(canvas, {
            backgroundColor: 'rgb(255, 255, 255)',
            penColor: 'rgb(0, 0, 0)'
        });
        resizeCanvas();
    }
    
    const dateInput = document.getElementById('dataIntervento');
    if(dateInput) dateInput.valueAsDate = new Date();
    
    // Forza visualizzazione Tab 1
    openTab(null, 'tab1');
};

function resizeCanvas() {
    const canvas = document.getElementById('signature-pad');
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
    if (signaturePad) signaturePad.clear(); 
}

// --- RICERCA ARTICOLI (Come prima) ---
async function searchInDanea() {
    let input = document.getElementById('searchArticolo');
    let query = input.value.trim();
    let divRisultati = document.getElementById('risultatiRicerca');
    if (query.length < 2) { divRisultati.innerHTML = ""; return; }

    const { data, error } = await supabaseClient
        .from('articoli')
        .select('"Cod.", "Descrizione", "Immagine"')
        .or(`"Cod.".ilike.%${query}%,"Descrizione".ilike.%${query}%`)
        .limit(10);

    if (error) return;
    divRisultati.innerHTML = data.map(art => `
        <div class="item-ricerca" onclick="aggiungiArticolo('${art["Cod."]}', '${art["Descrizione"].replace(/'/g, "\\'")}')" style="padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
            <strong>${art["Cod."]}</strong> - ${art["Descrizione"]}
        </div>
    `).join('');
}

function aggiungiArticolo(cod, desc) {
    carrello.push({ cod, desc, qta: 1 });
    document.getElementById('risultatiRicerca').innerHTML = "";
    document.getElementById('searchArticolo').value = "";
    aggiornaCarrelloUI();
}

function aggiornaCarrelloUI() {
    const container = document.getElementById('carrelloMateriali');
    container.innerHTML = carrello.map((item, index) => `
        <div style="display:flex; justify-content:space-between; padding:10px; background:white; border-radius:8px; margin-bottom:5px; border:1px solid #ddd;">
            <span>${item.desc}</span>
            <button onclick="carrello.splice(${index}, 1); aggiornaCarrelloUI()" style="color:red; background:none; border:none;">❌</button>
        </div>
    `).join('');
}

// --- LOGICA PDF ---
async function generaEInviaPDF() {
    const btn = document.querySelector('.btn-send');
    const operatore = document.getElementById('operatore').value;
    const zona = document.getElementById('zona').value;
    
    if (!operatore || !zona) {
        alert("Inserisci Operatore e Zona!");
        return;
    }

    btn.disabled = true;
    btn.innerText = "⏳ Invio in corso...";

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Dati base
        doc.setFontSize(18);
        doc.text("RAPPORTO DI MANUTENZIONE", 20, 20);
        doc.setFontSize(12);
        doc.text(`Operatore: ${operatore}`, 20, 40);
        doc.text(`Zona: ${zona}`, 20, 50);
        doc.text(`Data: ${document.getElementById('dataIntervento').value}`, 20, 60);

        // Firma
        if (signaturePad && !signaturePad.isEmpty()) {
            doc.text("Firma Cliente:", 20, 150);
            doc.addImage(signaturePad.toDataURL(), 'PNG', 20, 155, 50, 20);
        }

        const pdfBlob = doc.output('blob');
        const fileName = `Rapp_${Date.now()}.pdf`;

        // 1. Upload Storage
        await supabaseClient.storage.from('carichi').upload(fileName, pdfBlob);
        
        // 2. Pubblicazione URL
        const { data: urlData } = supabaseClient.storage.from('carichi').getPublicUrl(fileName);

        // 3. Salvataggio DB
        await supabaseClient.from('rapportini').insert([{
            operatore, zona, data: document.getElementById('dataIntervento').value,
            descrizione: document.getElementById('descrizioneIntervento').value,
            materiali: carrello, pdf_url: urlData.publicUrl
        }]);

        // 4. Email (opzionale se la funzione non è pronta)
        await supabaseClient.functions.invoke('send-email-rapportino', {
            body: { operatore, zona, pdfUrl: urlData.publicUrl }
        }).catch(e => console.log("Email error skip"));

        alert("🚀 Inviato con successo!");
        location.reload();

    } catch (err) {
        alert("Errore: " + err.message);
        btn.disabled = false;
        btn.innerText = "🚀 INVIA RAPPORTO";
    }
}

function generaAnteprimaPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("ANTEPRIMA RAPPORTO", 20, 20);
    doc.text(`Zona: ${document.getElementById('zona').value}`, 20, 40);
    if (signaturePad && !signaturePad.isEmpty()) {
        doc.addImage(signaturePad.toDataURL(), 'PNG', 20, 60, 50, 20);
    }
    window.open(doc.output('bloburl'), '_blank');
}
