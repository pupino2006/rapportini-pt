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

async function generaEInviaPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Recupero dati dai campi
    const operatore = document.getElementById('operatore').value;
    const zona = document.getElementById('zona').value;
    const dataInt = document.getElementById('dataIntervento').value;

    if (!operatore || !zona) {
        alert("Per favore, inserisci Operatore e Zona prima di inviare.");
        return;
    }

    // --- COSTRUZIONE PDF (come già facevi) ---
    const img = document.querySelector('.header-logo img');
    if (img) doc.addImage(img, 'PNG', 10, 10, 50, 20);
    doc.setFontSize(18);
    doc.text("RAPPORTO DI MANUTENZIONE", 70, 25);
    doc.setFontSize(12);
    doc.text(`Operatore: ${operatore}`, 10, 50);
    doc.text(`Zona: ${zona}`, 10, 60);
    doc.text(`Data: ${dataInt}`, 10, 70);

    doc.text("Materiali utilizzati:", 10, 90);
    let y = 100;
    carrello.forEach((item) => {
        doc.text(`- ${item.cod}: ${item.desc} (Q.tà: ${item.qta})`, 15, y);
        y += 10;
    });

    let firmaBase64 = "";
    if (!signaturePad.isEmpty()) {
        firmaBase64 = signaturePad.toDataURL();
        doc.text("Firma Cliente:", 10, y + 10);
        doc.addImage(firmaBase64, 'PNG', 10, y + 15, 50, 20);
    }

    // Trasformiamo il PDF in una stringa Base64 per l'invio via API
    const pdfBase64 = doc.output('datauristring');

    // --- STEP A: SALVATAGGIO SU SUPABASE ---
    console.log("Salvataggio nel database...");
    const { error: dbError } = await supabaseClient
        .from('rapportini')
        .insert([{
            operatore: operatore,
            zona: zona,
            data: dataInt,
            materiali: carrello,
            firma: firmaBase64
        }]);

    if (dbError) {
        alert("Errore salvataggio DB: " + dbError.message);
        return;
    }

    // --- STEP B: INVIO VIA RESEND ---
    console.log("Invio email tramite Resend...");
    
    // Usiamo l'API di Resend direttamente (Metodo veloce per il prototipo)
    const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer re_9vyoQUPF_AGCtEg6ALeFDzcyavtiKz4iq'
        },
        body: JSON.stringify({
            from: 'Rapportini <onboarding@resend.dev>',
            to: ['l.damario@pannellitermici.it'],
            cc: ['l.ripa@pannellitermici.it'],
            subject: `Rapporto di intervento del ${dataInt} - ${operatore}`,
            html: `<p>Nuovo rapporto di intervento caricato per la zona: <strong>${zona}</strong></p>`,
            attachments: [
                {
                    filename: `Rapporto_${zona}.pdf`,
                    content: pdfBase64.split(',')[1] // Rimuove l'intestazione data:application/pdf;base64,
                }
            ]
        })
    });

    if (emailRes.ok) {
        alert("✅ Rapporto inviato con successo a l.damario e salvato nel Cloud!");
        doc.save(`Rapportino_${zona}.pdf`); // Scarica comunque una copia locale
    } else {
        const errData = await emailRes.json();
        console.error(errData);
        alert("❌ Errore invio email: " + errData.message);
    }
}
