const SB_URL = "https://vnzrewcbnoqbqvzckome.supabase.co";
const SB_KEY = "sb_publishable_Sq9txbu-PmKdbxETSx2cjw_WqWEFBPO"; // Sostituisci con la tua chiave se diversa
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let carrello = [];
let signaturePad;

// --- NAVIGAZIONE ---
// Funzione per mostrare il modulo "Nuovo Rapporto"
function mostraApp() {
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('app-interface').style.display = 'block';
    document.getElementById('tab-storico').style.display = 'none';
    // Reset dei campi per un nuovo inserimento
    document.getElementById('zona').value = '';
    document.getElementById('descrizioneIntervento').value = '';
    carrello = [];
    if(signaturePad) signaturePad.clear();
    openTab(null, 'tab1');
}

// Funzione per mostrare l'Archivio
function caricaStorico() {
    console.log("Caricamento archivio...");
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('app-interface').style.display = 'none';
    document.getElementById('tab-storico').style.display = 'block';
    fetchStorico(); // Carica i dati reali
}

// Funzione per tornare alla Home
function tornaAllaHome() {
    document.getElementById('home-screen').style.display = 'block';
    document.getElementById('app-interface').style.display = 'none';
    document.getElementById('tab-storico').style.display = 'none';
}

// Caricamento dati dall'Archivio (Supabase)
async function fetchStorico() {
    const listaDiv = document.getElementById('lista-rapportini');
    try {
        const { data, error } = await supabaseClient
            .from('rapportini')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            listaDiv.innerHTML = '<p style="padding:20px;">Nessun rapporto trovato.</p>';
            return;
        }

        listaDiv.innerHTML = data.map(r => `
            <div style="padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color:#004a99;">${r.zona}</strong><br>
                    <small>${new Date(r.created_at).toLocaleDateString()} - ${r.operatore}</small>
                </div>
                <a href="${r.pdf_url}" target="_blank" style="text-decoration: none; font-size: 20px;">📄</a>
            </div>
        `).join('');

    } catch (err) {
        console.error("Errore archivio:", err);
        listaDiv.innerHTML = '<p style="padding:20px; color:red;">Errore nel caricamento dei dati.</p>';
    }
}

function openTab(evt, tabId) {
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(c => c.classList.remove('active'));
    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach(b => b.classList.remove('active'));

    document.getElementById(tabId).classList.add('active');
    evt.currentTarget.classList.add('active');

    if (tabId === 'tab3') setTimeout(resizeCanvas, 200);
}

// --- LOGICA FIRMA ---
window.onload = () => {
    const canvas = document.getElementById('signature-pad');
    signaturePad = new SignaturePad(canvas, { backgroundColor: 'rgb(255, 255, 255)' });
    document.getElementById('dataIntervento').valueAsDate = new Date();
};

function resizeCanvas() {
    const canvas = document.getElementById('signature-pad');
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
    signaturePad.clear();
}

// --- PDF E INVIO ---
async function preparaPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const operatore = document.getElementById('operatore').value || "N.D.";
    const zona = document.getElementById('zona').value || "N.D.";
    const dataInt = document.getElementById('dataIntervento').value;
    const desc = document.getElementById('descrizioneIntervento').value;

    doc.setFontSize(18);
    doc.text("RAPPORTO DI INTERVENTO", 10, 20);
    doc.setFontSize(12);
    doc.text(`Operatore: ${operatore}`, 10, 35);
    doc.text(`Zona: ${zona}`, 10, 42);
    doc.text(`Data: ${dataInt}`, 10, 49);
    
    doc.text("Descrizione:", 10, 60);
    const splitText = doc.splitTextToSize(desc, 180);
    doc.text(splitText, 10, 67);

    if (!signaturePad.isEmpty()) {
        doc.text("Firma:", 10, 150);
        doc.addImage(signaturePad.toDataURL(), 'PNG', 10, 155, 50, 25);
    }
    
    return doc;
}

async function generaAnteprimaPDF() {
    const doc = await preparaPDF();
    window.open(doc.output('bloburl'), '_blank');
}

async function generaEInviaPDF() {
    const btn = document.getElementById('btnInvia');
    btn.disabled = true;
    btn.innerText = "Invio in corso...";

    try {
        const doc = await preparaPDF();
        const pdfBlob = doc.output('blob');
        const fileName = `Rapporto_${Date.now()}.pdf`;

        // Upload su Supabase Storage
        const { data, error } = await supabaseClient.storage
            .from('rapportini-pdf')
            .upload(fileName, pdfBlob);

        if (error) throw error;

        alert("✅ Rapporto inviato e salvato!");
        tornaAllaHome();
    } catch (err) {
        alert("Errore: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "🚀 INVIA E SALVA";
    }
}

// --- STORICO ---
async function fetchStorico() {
    const { data, error } = await supabaseClient.from('rapportini').select('*').order('created_at', { ascending: false });
    const lista = document.getElementById('lista-rapportini');
    if (error) { lista.innerHTML = "Errore caricamento"; return; }
    
    lista.innerHTML = data.map(r => `
        <div style="border-bottom: 1px solid #ddd; padding: 10px;">
            <b>${r.data}</b> - ${r.zona} (${r.operatore})
        </div>
    `).join('');
}

