const SB_URL = "https://vnzrewcbnoqbqvzckome.supabase.co";
const SB_KEY = "sb_publishable_Sq9txbu-PmKdbxETSx2cjw_WqWEFBPO";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let carrello = [];
let signaturePad;

// --- NAVIGAZIONE ---
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

function tornaAllaHome() { location.reload(); }

function openTab(evt, tabId) {
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(c => c.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';
    
    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach(b => b.classList.remove('active'));
    if(evt) evt.currentTarget.classList.add('active');

    if (tabId === 'tab3') setTimeout(resizeCanvas, 200);
}

// --- LOGICA PDF ---
async function creaDocumentoPDF(isAnteprima = false) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const zona = document.getElementById('zona').value || "N.D.";
    const operatore = document.getElementById('operatore').value || "N.D.";
    const dataInt = document.getElementById('dataIntervento').value || "";
    const descrizione = document.getElementById('descrizioneIntervento').value || "";

    // Logo e Intestazione 
    const logoImg = document.getElementById('logo-pdf');
    if (logoImg) doc.addImage(logoImg, 'PNG', 10, 10, 50, 15);
    
    doc.setFontSize(18);
    doc.setTextColor(0, 74, 153);
    doc.text("RAPPORTO DI MANUTENZIONE", 70, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Operatore: ${operatore}`, 10, 40); [cite: 4]
    doc.text(`Zona: ${zona}`, 10, 47); [cite: 5]
    doc.text(`Data: ${dataInt}`, 10, 54); [cite: 6]

    doc.setFont("helvetica", "bold");
    doc.text("Descrizione Intervento:", 10, 65); [cite: 7]
    doc.setFont("helvetica", "normal");
    const splitDesc = doc.splitTextToSize(descrizione, 180); [cite: 8]
    doc.text(splitDesc, 10, 72);
    
    let y = 72 + (splitDesc.length * 7);

    // Materiali [cite: 9]
    doc.setFont("helvetica", "bold");
    doc.text("Materiali utilizzati:", 10, y + 10);
    y += 17;
    carrello.forEach(item => {
        doc.text(`- [${item.qta}] ${item.cod}: ${item.desc}`, 15, y);
        y += 7;
    });

    // Firma [cite: 10]
    if (!signaturePad.isEmpty()) {
        doc.text("Firma Cliente:", 10, y + 10);
        doc.addImage(signaturePad.toDataURL(), 'PNG', 10, y + 15, 50, 20);
        y += 40;
    }

    // Foto [cite: 11]
    const files = document.getElementById('fotoInput').files;
    if (files.length > 0 && !isAnteprima) {
        doc.addPage();
        doc.text("ALLEGATI FOTOGRAFICI", 10, 20);
        let yFoto = 30;
        for (let file of files) {
            const imgData = await new Promise(res => {
                const r = new FileReader();
                r.onload = () => res(r.result);
                r.readAsDataURL(file);
            });
            doc.addImage(imgData, 'JPEG', 10, yFoto, 90, 60);
            yFoto += 70;
            if (yFoto > 220) { doc.addPage(); yFoto = 20; }
        }
    }

    return doc;
}

async function generaAnteprimaPDF() {
    const doc = await creaDocumentoPDF(true);
    window.open(doc.output('bloburl'), '_blank');
}

async function generaEInviaPDF() {
    const btn = document.querySelector('.btn-send');
    btn.disabled = true; btn.innerText = "⏳ Invio...";
    
    try {
        const doc = await creaDocumentoPDF(false);
        const pdfBlob = doc.output('blob');
        const fileName = `Rapp_${Date.now()}.pdf`;

        const { error: upErr } = await supabaseClient.storage.from('rapportini-pdf').upload(fileName, pdfBlob);
        if (upErr) throw upErr;

        const { data: urlData } = supabaseClient.storage.from('rapportini-pdf').getPublicUrl(fileName);

        await supabaseClient.from('rapportini').insert([{
            operatore: document.getElementById('operatore').value,
            zona: document.getElementById('zona').value,
            data: document.getElementById('dataIntervento').value,
            pdf_url: urlData.publicUrl
        }]);

        alert("🚀 Rapporto inviato!");
        tornaAllaHome();
    } catch (err) {
        alert("Errore: " + err.message);
        btn.disabled = false; btn.innerText = "🚀 INVIA RAPPORTO";
    }
}

// --- INIZIALIZZAZIONE ---
window.onload = () => {
    signaturePad = new SignaturePad(document.getElementById('signature-pad'));
    document.getElementById('dataIntervento').valueAsDate = new Date();
};

function resizeCanvas() {
    const canvas = document.getElementById('signature-pad');
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
}
