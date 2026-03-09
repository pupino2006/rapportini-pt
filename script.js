const SB_URL = "https://vnzrewcbnoqbqvzckome.supabase.co";
const SB_KEY = "sb_publishable_Sq9txbu-PmKdbxETSx2cjw_WqWEFBPO";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let carrello = [];
let signaturePad;

// Navigazione
function mostraApp() {
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('app-interface').style.display = 'block';
    setTimeout(resizeCanvas, 200);
}

function tornaAllaHome() {
    location.reload();
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

// Inizializzazione
window.onload = () => {
    const canvas = document.getElementById('signature-pad');
    signaturePad = new SignaturePad(canvas, { backgroundColor: 'rgb(255, 255, 255)' });
    document.getElementById('dataIntervento').valueAsDate = new Date();
    window.addEventListener("resize", resizeCanvas);
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

// Ricerca Articoli
async function searchInDanea() {
    let query = document.getElementById('searchArticolo').value.trim();
    if (query.length < 2) return;
    const { data } = await supabaseClient.from('articoli').select('*')
        .or(`"Cod.".ilike.%${query}%,"Descrizione".ilike.%${query}%`).limit(10);
    
    let div = document.getElementById('risultatiRicerca');
    div.innerHTML = data.map(art => `
        <div onclick="aggiungi('${art["Cod."]}', '${art.Descrizione.replace(/'/g, "\\'")}')" style="padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
            <b>${art["Cod."]}</b> - ${art.Descrizione}
        </div>
    `).join('');
}

function aggiungi(cod, desc) {
    carrello.push({ cod, desc, qta: 1 });
    document.getElementById('risultatiRicerca').innerHTML = "";
    document.getElementById('searchArticolo').value = "";
    aggiornaUI();
}

function aggiornaUI() {
    document.getElementById('carrelloMateriali').innerHTML = carrello.map((i, index) => `
        <div style="display:flex; justify-content:space-between; margin: 5px 0; padding: 5px; border: 1px solid #ddd; border-radius: 5px;">
            <span>${i.desc}</span>
            <button onclick="carrello.splice(${index},1); aggiornaUI()" style="color:red; border:none; background:none; cursor:pointer;">❌</button>
        </div>
    `).join('');
}

// PDF LOGIC
async function preparaPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const operatore = document.getElementById('operatore').value;
    const zona = document.getElementById('zona').value;
    const dataInt = document.getElementById('dataIntervento').value;
    const descrizione = document.getElementById('descrizioneIntervento').value;

    // Header con Logo
    const logoImg = document.getElementById('img-logo-pdf');
    if (logoImg) {
        try { doc.addImage(logoImg, 'PNG', 10, 10, 50, 18); } catch(e) {}
    }

    doc.setFontSize(18);
    doc.setTextColor(0, 74, 153);
    doc.text("RAPPORTO DI MANUTENZIONE", 70, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Operatore: ${operatore || '---'}`, 10, 45);
    doc.text(`Zona: ${zona || '---'}`, 10, 52);
    doc.text(`Data: ${dataInt || '---'}`, 10, 59);

    doc.setFont("helvetica", "bold");
    doc.text("Descrizione Intervento:", 10, 70);
    doc.setFont("helvetica", "normal");
    const splitDesc = doc.splitTextToSize(descrizione, 180);
    doc.text(splitDesc, 10, 77);
    
    let y = 77 + (splitDesc.length * 7);

    doc.setFont("helvetica", "bold");
    doc.text("Materiali utilizzati:", 10, y + 10);
    y += 17;
    carrello.forEach(item => {
        doc.text(`- [${item.qta}] ${item.cod}: ${item.desc}`, 15, y);
        y += 7;
    });

    if (!signaturePad.isEmpty()) {
        doc.text("Firma Cliente:", 10, y + 10);
        doc.addImage(signaturePad.toDataURL(), 'PNG', 10, y + 15, 50, 20);
        y += 40;
    }

    // Foto Allegati
    const fotoFiles = document.getElementById('fotoInput').files;
    if (fotoFiles.length > 0) {
        doc.addPage();
        doc.text("ALLEGATI FOTOGRAFICI", 10, 20);
        let yFoto = 30;
        for (let i = 0; i < fotoFiles.length; i++) {
            const imgData = await new Promise(res => {
                const reader = new FileReader();
                reader.onload = () => res(reader.result);
                reader.readAsDataURL(fotoFiles[i]);
            });
            doc.addImage(imgData, 'JPEG', 10, yFoto, 90, 60);
            yFoto += 70;
            if (yFoto > 240 && i < fotoFiles.length - 1) { doc.addPage(); yFoto = 20; }
        }
    }
    return doc;
}

async function generaAnteprimaPDF() {
    const doc = await preparaPDF();
    window.open(doc.output('bloburl'), '_blank');
}

async function generaEInviaPDF() {
    const btn = document.getElementById('btnInvia');
    const operatore = document.getElementById('operatore').value;
    const zona = document.getElementById('zona').value;
    
    if (!operatore || !zona) return alert("Inserisci almeno Operatore e Zona!");

    btn.disabled = true;
    btn.innerText = "⏳ Invio in corso...";

    try {
        const doc = await preparaPDF();
        const pdfBlob = doc.output('blob');
        const fileName = `Rapp_${Date.now()}.pdf`;

        // 1. Upload Storage
        await supabaseClient.storage.from('rapportini-pdf').upload(fileName, pdfBlob);
        const { data: urlData } = supabaseClient.storage.from('rapportini-pdf').getPublicUrl(fileName);

        // 2. Insert Database
        await supabaseClient.from('rapportini').insert([{
            operatore, zona, data: document.getElementById('dataIntervento').value,
            pdf_url: urlData.publicUrl, materiali: carrello
        }]);

        // 3. Email Function
        await supabaseClient.functions.invoke('send-email-rapportino', {
            body: { operatore, zona, pdfUrl: urlData.publicUrl, fileName }
        });

        alert("🚀 Rapporto inviato con successo!");
        tornaAllaHome();
    } catch (err) {
        alert("Errore: " + err.message);
        btn.disabled = false;
        btn.innerText = "🚀 INVIA E SALVA RAPPORTO";
    }
}
