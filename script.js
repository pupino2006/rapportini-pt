// 1. CONFIGURAZIONE SUPABASE
const SB_URL = "https://vnzrewcbnoqbqvzckome.supabase.co";
const SB_KEY = "sb_publishable_Sq9txbu-PmKdbxETSx2cjw_WqWEFBPO";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let carrello = [];
let signaturePad;

// Navigazione tra le schede
function openTab(evt, tabId) {
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(tab => tab.style.display = 'none');
    
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).style.display = 'block';
    if(evt) evt.currentTarget.classList.add('active');

    // Se apri la scheda firma, ricalcola le dimensioni del canvas
    if (tabId === 'tab3') {
        setTimeout(resizeCanvas, 50); // Piccolo ritardo per permettere al browser di mostrare il tab
    }
}

window.onload = () => {
    // 2. INIZIALIZZA FIRMA
    const canvas = document.getElementById('signature-pad');
    if (canvas) {
        signaturePad = new SignaturePad(canvas, {
            backgroundColor: 'rgb(255, 255, 255)',
            penColor: 'rgb(0, 0, 0)',
            velocityFilterWeight: 0.7
        });
        resizeCanvas();
    }
    
    // Imposta la data di oggi in automatico
    if(document.getElementById('dataIntervento')) {
        document.getElementById('dataIntervento').valueAsDate = new Date();
    }
    
    console.log("Sistema pronto e connesso a Supabase");
};

// Funzione globale per il ridimensionamento del canvas
function resizeCanvas() {
    const canvas = document.getElementById('signature-pad');
    if (!canvas) return;
    
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
    
    if (signaturePad) signaturePad.clear(); 
}

window.addEventListener("resize", resizeCanvas);

// 3. RICERCA NEL CLOUD
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
        .select('"Cod.", "Descrizione"')
        .or(`"Cod.".ilike.%${query}%,"Descrizione".ilike.%${query}%`)
        .limit(15);

    if (error) {
        console.error("Errore Supabase:", error.message);
        return;
    }

    divRisultati.innerHTML = "";

    if (!data || data.length === 0) {
        divRisultati.innerHTML = "<div style='padding:10px; color:orange;'>Nessun articolo trovato</div>";
        return;
    }

    data.forEach(art => {
        let p = document.createElement('div');
        p.className = "item-ricerca";
        p.style = "padding:15px; border-bottom:1px solid #eee; background:white; cursor:pointer; color:black; text-align:left;";
        
        let c = art["Cod."]; 
        let d = art["Descrizione"];
        
        p.innerHTML = `<strong>${c}</strong> - ${d}`;
        p.onclick = () => {
            aggiungiAlCarrello(c, d);
            divRisultati.innerHTML = "";
            input.value = "";
        };
        divRisultati.appendChild(p);
    });
}

function aggiungiAlCarrello(cod, desc) {
    carrello.push({ cod: cod, desc: desc, qta: 1 });
    aggiornaCarrelloUI();
}

function aggiornaCarrelloUI() {
    const container = document.getElementById('carrelloMateriali');
    container.innerHTML = carrello.map((item, index) => `
        <div class="card-materiale" style="border:1px solid #ddd; padding:10px; margin:10px 0; border-radius:8px; display:flex; justify-content:space-between; align-items:center; background:white;">
            <div style="flex:1">
                <b style="color:#004a99">${item.cod}</b><br>
                <small>${item.desc}</small>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <input type="number" value="${item.qta}" style="width:50px; padding:5px;" onchange="carrello[${index}].qta=this.value">
                <button onclick="carrello.splice(${index}, 1); aggiornaCarrelloUI()" style="border:none; background:none; font-size:1.2em; color:red;">❌</button>
            </div>
        </div>
    `).join('');
}

// 4. GENERAZIONE PDF PROFESSIONALE
async function generaPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const img = document.querySelector('.header-logo img');
    if (img) {
        // Parametri: immagine, formato, x, y, larghezza, altezza
        doc.addImage(img, 'PNG', 10, 10, 60, 25);
    }

    doc.setFontSize(18);
    doc.setTextColor(0, 74, 153); // Blu Danea
    doc.text("RAPPORTO DI MANUTENZIONE", 80, 25);
    
    doc.setDrawColor(0, 74, 153);
    doc.line(10, 40, 200, 40); // Linea estetica

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Operatore: ${document.getElementById('operatore').value}`, 10, 50);
    doc.text(`Zona: ${document.getElementById('zona').value}`, 10, 60);
    doc.text(`Data: ${document.getElementById('dataIntervento').value}`, 10, 70);

    doc.setFont("helvetica", "bold");
    doc.text("Materiali utilizzati:", 10, 90);
    doc.setFont("helvetica", "normal");
    
    let y = 100;
    carrello.forEach((item) => {
        doc.text(`- [${item.qta}] ${item.cod}: ${item.desc}`, 15, y);
        y += 10;
        if (y > 270) { doc.addPage(); y = 20; }
    });

    if (signaturePad && !signaturePad.isEmpty()) {
        const firmaData = signaturePad.toDataURL();
        doc.text("Firma Cliente:", 10, y + 20);
        doc.addImage(firmaData, 'PNG', 10, y + 25, 50, 25);
    }

    doc.save(`Rapportino_${document.getElementById('zona').value || 'Intervento'}.pdf`);
}