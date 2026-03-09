const SB_URL = "https://vnzrewcbnoqbqvzckome.supabase.co";
const SB_KEY = "sb_publishable_Sq9txbu-PmKdbxETSx2cjw_WqWEFBPO";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let carrello = [];
let signaturePad;

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
    if(tabId === 'tab3') setTimeout(resizeCanvas, 100);
}

async function searchInDanea() {
    let q = document.getElementById('searchArticolo').value;
    if (q.length < 2) return;
    const { data } = await supabaseClient.from('articoli').select('*').ilike('Descrizione', `%${q}%`).limit(5);
    document.getElementById('risultatiRicerca').innerHTML = data.map(a => `<div onclick="aggiungi('${a["Cod."]}','${a.Descrizione}')">${a.Descrizione}</div>`).join('');
}

function aggiungi(cod, desc) {
    carrello.push({cod, desc, qta:1});
    document.getElementById('carrelloMateriali').innerHTML = carrello.map(i => `<div>${i.desc}</div>`).join('');
}

async function generaEInviaPDF() {
    console.log("Inizio invio...");
    const btn = document.querySelector('.btn-send');
    btn.disabled = true;
    btn.innerText = "Invio...";

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const zona = document.getElementById('zona').value;
        const operatore = document.getElementById('operatore').value;
        const dataInt = document.getElementById('dataIntervento').value;
        const desc = document.getElementById('descrizioneIntervento').value;

        doc.text(`Rapporto: ${zona}`, 10, 10);
        doc.text(`Operatore: ${operatore}`, 10, 20);
        doc.text(`Lavoro: ${desc}`, 10, 30);

        const pdfBlob = doc.output('blob');
        const fileName = `Rapp_${Date.now()}.pdf`;

        const { error: upErr } = await supabaseClient.storage.from('carichi').upload(fileName, pdfBlob);
        if (upErr) throw upErr;

        const { data: urlData } = supabaseClient.storage.from('carichi').getPublicUrl(fileName);
        
        // Salvataggio DB
        await supabaseClient.from('rapportini').insert([{
            data: dataInt, operatore, zona, descrizione: desc, pdf_url: urlData.publicUrl
        }]);

        // Invio Mail
        await fetch("https://vnzrewcbnoqbqvzckome.supabase.co/functions/v1/invio-rapportini", {
            method: 'POST',
            body: JSON.stringify({ operatore, zona, dataInt, descrizione: desc, pdfUrl: urlData.publicUrl })
        });

        alert("Inviato con successo!");
        tornaAllaHome();
    } catch (e) {
        alert("Errore: " + e.message);
        btn.disabled = false;
        btn.innerText = "🚀 INVIA RAPPORTO";
    }
}

function generaAnteprimaPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("ANTEPRIMA", 10, 10);
    window.open(doc.output('bloburl'), '_blank');
}

window.onload = () => {
    const canvas = document.getElementById('signature-pad');
    signaturePad = new SignaturePad(canvas);
    document.getElementById('dataIntervento').valueAsDate = new Date();
};

function resizeCanvas() {
    const canvas = document.getElementById('signature-pad');
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
}

window.addEventListener("resize", resizeCanvas);
