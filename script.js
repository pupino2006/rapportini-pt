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

function tornaAllaHome() {
    location.reload();
}

function openTab(evt, tabId) {
    const sections = ['tab1', 'tab2', 'tab3'];
    sections.forEach(id => document.getElementById(id).style.display = 'none');
    document.getElementById(tabId).style.display = 'block';
    
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    if(evt) evt.currentTarget.classList.add('active');

    if (tabId === 'tab3') setTimeout(resizeCanvas, 200);
}

// --- LOGICA MATERIALI ---
async function searchInDanea() {
    let query = document.getElementById('searchArticolo').value.trim();
    if (query.length < 2) return;
    const { data } = await supabaseClient.from('articoli').select('*')
        .or(`"Cod.".ilike.%${query}%,"Descrizione".ilike.%${query}%`).limit(10);
    
    document.getElementById('risultatiRicerca').innerHTML = data.map(art => `
        <div onclick="aggiungi('${art["Cod."]}', '${art.Descrizione.replace(/'/g, "\\'")}')" style="padding:10px; border-bottom:1px solid #ddd; cursor:pointer;">
            ${art["Cod."]} - ${art.Descrizione}
        </div>
    `).join('');
}

function aggiungi(cod, desc) {
    carrello.push({ cod, desc, qta: 1 });
    document.getElementById('searchArticolo').value = "";
    document.getElementById('risultatiRicerca').innerHTML = "";
    aggiornaUI();
}

function aggiornaUI() {
    document.getElementById('carrelloMateriali').innerHTML = carrello.map((i, index) => `
        <div style="display:flex; justify-content:space-between; padding:5px; border-bottom:1px solid #eee;">
            <span>${i.desc}</span>
            <button onclick="carrello.splice(${index},1); aggiornaUI()" style="color:red; background:none; border:none;">X</button>
        </div>
    `).join('');
}

// --- GENERAZIONE PDF E INVIO ---
async function generaEInviaPDF() {
    const btn = document.querySelector('.btn-send');
    const zona = document.getElementById('zona').value;
    const operatore = document.getElementById('operatore').value;
    const dataInt = document.getElementById('dataIntervento').value;
    const descrizione = document.getElementById('descrizioneIntervento').value;

    if (!zona || !operatore) return alert("Compila i campi obbligatori!");

    btn.disabled = true;
    btn.innerText = "⏳ Generazione PDF...";

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(20);
        doc.setTextColor(0, 74, 153);
        doc.text("RAPPORTO DI INTERVENTO", 105, 20, { align: "center" });
        
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Data: ${dataInt}`, 20, 40);
        doc.text(`Operatore: ${operatore}`, 20, 50);
        doc.text(`Zona: ${zona}`, 20, 60);
        
        doc.line(20, 65, 190, 65);
        
        doc.text("DESCRIZIONE LAVORO:", 20, 75);
        doc.setFontSize(10);
        const splitDesc = doc.splitTextToSize(descrizione, 170);
        doc.text(splitDesc, 20, 85);
        
        let yPos = 85 + (splitDesc.length * 7);
        
        // Materiali
        doc.setFontSize(12);
        doc.text("MATERIALI UTILIZZATI:", 20, yPos + 10);
        yPos += 20;
        carrello.forEach(item => {
            doc.text(`- ${item.cod}: ${item.desc}`, 25, yPos);
            yPos += 7;
        });

        // Firma
        if (!signaturePad.isEmpty()) {
            if (yPos > 240) doc.addPage();
            doc.text("FIRMA CLIENTE:", 20, yPos + 10);
            doc.addImage(signaturePad.toDataURL(), 'PNG', 20, yPos + 15, 60, 30);
        }

        const pdfBlob = doc.output('blob');
        const fileName = `Rapp_${zona.replace(/\s/g, '_')}_${Date.now()}.pdf`;

        // Upload Storage
        const { error: upErr } = await supabaseClient.storage.from('carichi').upload(fileName, pdfBlob);
        if (upErr) throw upErr;

        const { data: urlData } = supabaseClient.storage.from('carichi').getPublicUrl(fileName);
        const pdfUrl = urlData.publicUrl;

        // DB Insert
        await supabaseClient.from('rapportini').insert([{
            data: dataInt, operatore, zona, descrizione, materiali: carrello, pdf_url: pdfUrl
        }]);

        // Edge Function Mail
        await fetch("https://vnzrewcbnoqbqvzckome.supabase.co/functions/v1/invio-rapportini", {
            method: 'POST',
            body: JSON.stringify({ operatore, zona, dataInt, descrizione, pdfUrl })
        });

        alert("Rapporto inviato con successo!");
        tornaAllaHome();

    } catch (err) {
        alert("Errore: " + err.message);
        btn.disabled = false;
        btn.innerText = "🚀 INVIA RAPPORTO";
    }
}

function generaAnteprimaPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("ANTEPRIMA", 20, 20);
    doc.text(`Zona: ${document.getElementById('zona').value}`, 20, 30);
    if (!signaturePad.isEmpty()) doc.addImage(signaturePad.toDataURL(), 'PNG', 20, 40, 50, 25);
    window.open(doc.output('bloburl'), '_blank');
}

// --- INIZIALIZZAZIONE ---
window.onload = () => {
    const canvas = document.getElementById('signature-pad');
    signaturePad = new SignaturePad(canvas, { backgroundColor: 'rgb(255, 255, 255)' });
    resizeCanvas();
    document.getElementById('dataIntervento').valueAsDate = new Date();
};

function resizeCanvas() {
    const canvas = document.getElementById('signature-pad');
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
    signaturePad.clear(); // Reset firma al resize
}

window.addEventListener("resize", resizeCanvas);
