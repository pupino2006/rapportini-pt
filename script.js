const SB_URL = "https://vnzrewcbnoqbqvzckome.supabase.co";
const SB_KEY = "sb_publishable_Sq9txbu-PmKdbxETSx2cjw_WqWEFBPO";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let carrello = [];
let signaturePad;

function openTab(evt, tabId) {
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(tab => tab.style.display = 'none');
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).style.display = 'block';
    if(evt) evt.currentTarget.classList.add('active');

    if (tabId === 'tab3') {
        setTimeout(resizeCanvas, 100);
    }
}

window.onload = () => {
    const canvas = document.getElementById('signature-pad');
    if (canvas) {
        signaturePad = new SignaturePad(canvas, {
            backgroundColor: 'rgb(255, 255, 255)',
            penColor: 'rgb(0, 0, 0)',
            velocityFilterWeight: 0.7
        });
        resizeCanvas();
    }
    if(document.getElementById('dataIntervento')) {
        document.getElementById('dataIntervento').valueAsDate = new Date();
    }
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

window.addEventListener("resize", resizeCanvas);

async function searchInDanea() {
    let input = document.getElementById('searchArticolo');
    let query = input.value.trim();
    let divRisultati = document.getElementById('risultatiRicerca');
    
    // Se la query è troppo corta, pulisci i risultati e ferma la funzione
    if (query.length < 2) { 
        divRisultati.innerHTML = ""; 
        return; 
    }

    // Cerchiamo nella tabella 'articoli' (il tuo magazzino)
    const { data, error } = await supabaseClient
        .from('articoli')
        .select('"Cod.", "Descrizione", "Immagine"') // Prendiamo anche la colonna Immagine
        .or(`"Cod.".ilike.%${query}%,"Descrizione".ilike.%${query}%`)
        .limit(10);

    if (error) {
        console.error("Errore ricerca:", error);
        return;
    }

    divRisultati.innerHTML = "";
    
    data.forEach(art => {
        let p = document.createElement('div');
        p.className = "item-ricerca";
        
        // Se la colonna 'Immagine' è vuota, usiamo un'icona di default
        let imgUrl = art["Immagine"] ? art["Immagine"] : 'https://via.placeholder.com/50?text=No+Img';

        // Costruiamo la riga del risultato con l'anteprima
        p.innerHTML = `
            <div style="display: flex; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
                <img src="${imgUrl}" style="width:50px; height:50px; object-fit:cover; border-radius:5px; margin-right:15px; border: 1px solid #ddd;">
                <div>
                    <strong style="color: #005aab;">${art["Cod."]}</strong><br>
                    <small style="color: #333;">${art["Descrizione"]}</small>
                </div>
            </div>
        `;
        
        p.onclick = () => {
            // Aggiungiamo al carrello dei materiali
            carrello.push({ cod: art["Cod."], desc: art["Descrizione"], qta: 1 });
            aggiornaCarrelloUI();
            divRisultati.innerHTML = "";
            input.value = "";
        };
        divRisultati.appendChild(p);
    });
}

function aggiornaCarrelloUI() {
    const container = document.getElementById('carrelloMateriali');
    container.innerHTML = carrello.map((item, index) => `
        <div class="card-materiale" style="border:1px solid #ddd; padding:10px; margin:5px 0; border-radius:8px; display:flex; justify-content:space-between; align-items:center; background:white;">
            <div><b>${item.cod}</b><br><small>${item.desc}</small></div>
            <div style="display:flex; gap:10px;">
                <input type="number" value="${item.qta}" style="width:40px" onchange="carrello[${index}].qta=this.value">
                <button onclick="carrello.splice(${index}, 1); aggiornaCarrelloUI()" style="color:red; background:none; border:none;">❌</button>
            </div>
        </div>
    `).join('');
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// --- MODIFICA: GENERAZIONE PDF CON DESCRIZIONE INTERVENTO ---
async function generaEInviaPDF() {
    console.log("Inizio procedura...");
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const operatore = document.getElementById('operatore').value;
        const zona = document.getElementById('zona').value;
        const dataInt = document.getElementById('dataIntervento').value;
        const descrizione = document.getElementById('descrizioneIntervento').value; // Recupero descrizione

        if (!operatore || !zona) {
            alert("⚠️ Inserisci Operatore e Zona!");
            return;
        }

        // --- PDF: INTESTAZIONE ---
        const imgLogo = document.querySelector('.header-logo img');
        if (imgLogo) {
            try { doc.addImage(imgLogo, 'PNG', 10, 10, 50, 18); } catch(e) { console.log("Logo non caricato"); }
        }
        
        doc.setFontSize(18);
        doc.setTextColor(0, 74, 153);
        doc.text("RAPPORTO DI MANUTENZIONE", 70, 22);
        
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text(`Operatore: ${operatore}`, 10, 45);
        doc.text(`Zona: ${zona}`, 10, 52);
        doc.text(`Data: ${dataInt}`, 10, 59);

        // --- SEZIONE DESCRIZIONE INTERVENTO ---
        doc.setFont("helvetica", "bold");
        doc.text("Descrizione Intervento:", 10, 70);
        doc.setFont("helvetica", "normal");
        const splitDesc = doc.splitTextToSize(descrizione, 180); // Manda a capo il testo lungo
        doc.text(splitDesc, 10, 77);
        
        let currentY = 77 + (splitDesc.length * 7);

        // --- PDF: MATERIALI ---
        doc.setFont("helvetica", "bold");
        doc.text("Materiali utilizzati:", 10, currentY + 10);
        doc.setFont("helvetica", "normal");
        let y = currentY + 17;
        carrello.forEach((item) => {
            doc.text(`- [${item.qta}] ${item.cod}: ${item.desc}`, 15, y);
            y += 8;
        });

        // --- PDF: FIRMA ---
        let firmaData = "";
        if (!signaturePad.isEmpty()) {
            firmaData = signaturePad.toDataURL();
            doc.text("Firma Cliente:", 10, y + 10);
            doc.addImage(firmaData, 'PNG', 10, y + 15, 40, 15);
            y += 35;
        }

        // --- PDF: FOTO ---
        const fotoFiles = document.getElementById('fotoInput').files;
        if (fotoFiles.length > 0) {
            doc.addPage();
            doc.text("ALLEGATI FOTOGRAFICI", 10, 20);
            let yFoto = 30;
            for (let i = 0; i < fotoFiles.length; i++) {
                const imgData = await readFileAsDataURL(fotoFiles[i]);
                doc.addImage(imgData, 'JPEG', 10, yFoto, 90, 65);
                yFoto += 75;
                if (yFoto > 220 && i < fotoFiles.length - 1) {
                    doc.addPage();
                    yFoto = 20;
                }
            }
        }

        const pdfBase64 = doc.output('datauristring');

        // --- SALVATAGGIO SUPABASE (con colonna descrizione) ---
        const { error: dbError } = await supabaseClient
            .from('rapportini')
            .insert([{
                operatore: operatore,
                zona: zona,
                data: dataInt,
                descrizione: descrizione, // Assicurati che la colonna esista su Supabase
                materiali: carrello,
                firma: firmaData
            }]);

        if (dbError) throw dbError;

        // --- INVIO RESEND ---
        const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer re_9vyoQUPF_AGCtEg6ALeFDzcyavtiKz4iq'
            },
            body: JSON.stringify({
                from: 'Rapportini <invio@pannellitermici.it>',
                to: ['l.damario@pannellitermici.it'],
                cc: ['l.ripa@pannellitermici.it'],
                subject: `Rapporto ${dataInt} - ${operatore} (${zona})`,
                html: `
                    <p>Intervento eseguito da <b>${operatore}</b> a <b>${zona}</b>.</p>
                    <p><b>Descrizione:</b> ${descrizione}</p>
                `,
                attachments: [{
                    filename: `Rapporto_${zona}.pdf`,
                    content: pdfBase64.split(',')[1]
                }]
            })
        });

        if (emailRes.ok) {
            alert("✅ Rapporto inviato e salvato!");
            doc.save(`Rapporto_${zona}.pdf`);
        } else {
            alert("⚠️ Salvato nel Cloud, ma errore invio Email.");
        }

    } catch (err) {
        console.error(err);
        alert("❌ Errore: " + err.message);
    }
}
