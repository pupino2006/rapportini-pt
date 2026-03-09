const SB_URL = "https://vnzrewcbnoqbqvzckome.supabase.co";
const SB_KEY = "sb_publishable_Sq9txbu-PmKdbxETSx2cjw_WqWEFBPO";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let carrello = [];
let signaturePad;

// 1. GESTIONE TAB
function openTab(evt, tabId) {
    console.log("Apertura tab:", tabId);
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(tab => tab.classList.remove('active'));
    
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    if(evt) evt.currentTarget.classList.add('active');

    if (tabId === 'tab3') {
        setTimeout(resizeCanvas, 200);
    }
}

// 2. INIZIALIZZAZIONE
window.onload = () => {
    console.log("App caricata correttamente");
    const canvas = document.getElementById('signature-pad');
    if (canvas) {
        signaturePad = new SignaturePad(canvas, {
            backgroundColor: 'rgb(255, 255, 255)'
        });
    }
    document.getElementById('dataIntervento').valueAsDate = new Date();
};

function resizeCanvas() {
    const canvas = document.getElementById('signature-pad');
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
}

// 3. ANTEPRIMA (CORRETTA)
async function generaAnteprimaPDF() {
    console.log("Pulsante Anteprima premuto");
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.text("ANTEPRIMA RAPPORTO", 20, 20);
        doc.setFontSize(12);
        doc.text(`Zona: ${document.getElementById('zona').value || 'N.D.'}`, 20, 40);
        doc.text(`Operatore: ${document.getElementById('operatore').value || 'N.D.'}`, 20, 50);

        if (signaturePad && !signaturePad.isEmpty()) {
            doc.addImage(signaturePad.toDataURL(), 'PNG', 20, 70, 50, 25);
        }

        window.open(doc.output('bloburl'), '_blank');
    } catch (e) {
        console.error("Errore anteprima:", e);
        alert("Errore generazione anteprima: " + e.message);
    }
}

// 4. INVIO (CORRETTO)
async function generaEInviaPDF() {
    console.log("Pulsante Invia premuto");
    const btn = document.querySelector('.btn-send');
    const zona = document.getElementById('zona').value;
    const operatore = document.getElementById('operatore').value;

    if (!zona || !operatore) {
        alert("Inserisci Zona e Operatore!");
        return;
    }

    btn.disabled = true;
    btn.innerText = "⏳ Invio in corso...";

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text("RAPPORTO INTERVENTO", 20, 20);
        doc.text(`Zona: ${zona}`, 20, 40);
        doc.text(`Operatore: ${operatore}`, 20, 50);

        const pdfBlob = doc.output('blob');
        const fileName = `Rapp_${Date.now()}.pdf`;

        // Upload Storage
        const { error: upErr } = await supabaseClient.storage.from('rapportini-pdf').upload(fileName, pdfBlob);
        if (upErr) throw upErr;

        const { data: urlData } = supabaseClient.storage.from('rapportini-pdf').getPublicUrl(fileName);

        // Salvataggio Database
        const { error: dbErr } = await supabaseClient.from('rapportini').insert([{
            zona, operatore, data: document.getElementById('dataIntervento').value,
            pdf_url: urlData.publicUrl, materiali: carrello
        }]);
        if (dbErr) throw dbErr;

        alert("✅ Inviato con successo!");
        location.reload();
    } catch (err) {
        console.error("Errore invio:", err);
        alert("Errore: " + err.message);
        btn.disabled = false;
        btn.innerText = "🚀 INVIA RAPPORTO";
    }
}
