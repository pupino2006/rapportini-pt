const SB_URL = "https://vnzrewcbnoqbqvzckome.supabase.co";
const SB_KEY = "sb_publishable_Sq9txbu-PmKdbxETSx2cjw_WqWEFBPO";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let carrello = [];
let signaturePad;

// --- FUNZIONI DI NAVIGAZIONE ---
function mostraApp() {
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('app-interface').style.display = 'block';
    document.getElementById('tab-storico').style.display = 'none';
    // Reset dei campi per un nuovo inserimento
    document.getElementById('zona').value = '';
    document.getElementById('descrizioneIntervento').value = '';
    carrello = [];
    aggiornaCarrelloUI();
    if(signaturePad) signaturePad.clear();
    openTab(null, 'tab1');
}

function caricaStorico() {
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('app-interface').style.display = 'none';
    document.getElementById('tab-storico').style.display = 'block';
    fetchStorico(); // Carica i dati reali da Supabase
}

function tornaAllaHome() {
    document.getElementById('home-screen').style.display = 'block';
    document.getElementById('app-interface').style.display = 'none';
    document.getElementById('tab-storico').style.display = 'none';
}

function openTab(evt, tabId) {
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(tab => tab.style.display = 'none');
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).style.display = 'block';
    if(evt) evt.currentTarget.classList.add('active');
    else {
        // Se evt è null (chiamata da mostraApp), attiva il primo bottone manualmente
        document.querySelector('.tab-btn').classList.add('active');
    }

    if (tabId === 'tab3') {
        setTimeout(resizeCanvas, 100);
    }
}

// --- INIZIALIZZAZIONE ---
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

// --- LOGICA ARCHIVIO (STORICO) ---
// --- VISUALIZZAZIONE ARCHIVIO CON SPUNTA ---
async function fetchStorico() {
    const listaDiv = document.getElementById('lista-rapportini');
    listaDiv.innerHTML = '<p style="padding:20px;">🔄 Aggiornamento archivio...</p>';
    
    try {
        const { data, error } = await supabaseClient
            .from('rapportini')
            .select('*')
            .order('data', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            listaDiv.innerHTML = '<p style="padding:20px;">Nessun rapporto trovato.</p>';
            return;
        }

        listaDiv.innerHTML = data.map(r => `
            <div style="padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; background: ${r.completato ? '#e8f5e9' : 'white'}; margin-bottom:5px; border-radius:8px; transition: 0.3s;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <input type="checkbox" 
                           ${r.completato ? 'checked' : ''} 
                           onchange="toggleCompletato(${r.id}, this.checked)" 
                           style="width: 20px; height: 20px; cursor: pointer;">
                    
                    <div style="opacity: ${r.completato ? '0.6' : '1'}">
                        <strong style="color:#004a99;">${r.zona || 'N.D.'}</strong><br>
                        <small>${r.data} - ${r.operatore || 'N.D.'}</small>
                    </div>
                </div>
                
                <div>
                    ${r.pdf_url ? `<a href="${r.pdf_url}" target="_blank" style="text-decoration:none; font-size: 24px;">📄</a>` : '⚠️'}
                </div>
            </div>
        `).join('');

    } catch (err) {
        listaDiv.innerHTML = `<p style="padding:20px; color:red;">Errore: ${err.message}</p>`;
    }
}

// --- FUNZIONE PER AGGIORNARE LO STATO "FATTO" ---
async function toggleCompletato(id, stato) {
    try {
        const { error } = await supabaseClient
            .from('rapportini')
            .update({ completato: stato })
            .eq('id', id);

        if (error) throw error;
        
        // Ricarichiamo la lista per aggiornare i colori (opzionale, o puoi farlo via JS)
        fetchStorico();
    } catch (err) {
        alert("Errore nell'aggiornamento: " + err.message);
    }
}
// --- RICERCA ARTICOLI ---
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
        .select('"Cod.", "Descrizione", "Immagine"')
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
        let imgUrl = art["Immagine"] ? art["Immagine"] : 'https://via.placeholder.com/50?text=No+Img';

        p.innerHTML = `
            <div style="display: flex; align-items: center; padding: 10px; border-bottom: 1px solid #eee; cursor:pointer;">
                <img src="${imgUrl}" style="width:50px; height:50px; object-fit:cover; border-radius:5px; margin-right:15px; border: 1px solid #ddd;">
                <div>
                    <strong style="color: #005aab;">${art["Cod."]}</strong><br>
                    <small style="color: #333;">${art["Descrizione"]}</small>
                </div>
            </div>
        `;
        
        p.onclick = () => {
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
    if (!container) return;
    container.innerHTML = carrello.map((item, index) => `
        <div class="card-materiale" style="border:1px solid #ddd; padding:10px; margin:5px 0; border-radius:8px; display:flex; justify-content:space-between; align-items:center; background:white;">
            <div><b>${item.cod}</b><br><small>${item.desc}</small></div>
            <div style="display:flex; gap:10px;">
                <input type="number" value="${item.qta}" style="width:40px" onchange="carrello[${index}].qta=this.value">
                <button onclick="carrello.splice(${index}, 1); aggiornaCarrelloUI()" style="color:red; background:none; border:none; cursor:pointer;">❌</button>
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

// --- GENERAZIONE E INVIO ---
async function generaEInviaPDF() {
    const btnInvia = document.getElementById('btnInvia');
    if(btnInvia) {
        btnInvia.disabled = true;
        btnInvia.innerText = "Invio in corso...";
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const operatore = document.getElementById('operatore').value;
        const zona = document.getElementById('zona').value;
        const dataInt = document.getElementById('dataIntervento').value;
        const descrizione = document.getElementById('descrizioneIntervento').value;

        if (!operatore || !zona) {
            alert("⚠️ Inserisci Operatore e Zona!");
            if(btnInvia) { btnInvia.disabled = false; btnInvia.innerText = "🚀 INVIA E SALVA RAPPORTO"; }
            return;
        }

        const imgLogo = document.querySelector('.header-logo img');
        if (imgLogo) {
            try { doc.addImage(imgLogo, 'PNG', 10, 10, 50, 18); } catch(e) { console.log("Logo skip"); }
        }
        
        doc.setFontSize(18);
        doc.setTextColor(0, 74, 153);
        doc.text("RAPPORTO DI MANUTENZIONE", 70, 22);
        
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text(`Operatore: ${operatore}`, 10, 45);
        doc.text(`Zona: ${zona}`, 10, 52);
        doc.text(`Data: ${dataInt}`, 10, 59);

        doc.setFont("helvetica", "bold");
        doc.text("Descrizione Intervento:", 10, 70);
        doc.setFont("helvetica", "normal");
        const splitDesc = doc.splitTextToSize(descrizione, 180);
        doc.text(splitDesc, 10, 77);
        
        let currentY = 77 + (splitDesc.length * 7);

        doc.setFont("helvetica", "bold");
        doc.text("Materiali utilizzati:", 10, currentY + 10);
        doc.setFont("helvetica", "normal");
        let y = currentY + 17;
        carrello.forEach((item) => {
            doc.text(`- [${item.qta}] ${item.cod}: ${item.desc}`, 15, y);
            y += 8;
        });

        let firmaData = "";
        if (!signaturePad.isEmpty()) {
            firmaData = signaturePad.toDataURL();
            doc.text("Firma Cliente:", 10, y + 10);
            doc.addImage(firmaData, 'PNG', 10, y + 15, 40, 15);
            y += 35;
        }

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

        const pdfBlob = doc.output('blob');
        const fileName = `${Date.now()}_Rapporto_${zona.replace(/\s+/g, '_')}.pdf`;

        // UPLOAD STORAGE
        const { data: storageData, error: storageError } = await supabaseClient
            .storage
            .from('rapportini-pdf')
            .upload(fileName, pdfBlob);

        if (storageError) throw new Error("Errore Storage: " + storageError.message);

        const { data: urlData } = supabaseClient.storage.from('rapportini-pdf').getPublicUrl(fileName);
        const pdfUrl = urlData.publicUrl;

        // SALVA DB
        const { error: dbError } = await supabaseClient
            .from('rapportini')
            .insert([{
                operatore: operatore,
                zona: zona,
                data: dataInt,
                descrizione: descrizione,
                materiali: carrello,
                firma: firmaData,
                pdf_url: pdfUrl
            }]);

        if (dbError) throw dbError;

        // EDGE FUNCTION EMAIL
        await supabaseClient.functions.invoke('send-email-rapportino', {
            body: { operatore, zona, dataInt, descrizione, pdfUrl, fileName }
        });

        alert("🚀 Rapporto salvato e inviato correttamente!");
        tornaAllaHome();

    } catch (err) {
        console.error(err);
        alert("❌ Errore: " + err.message);
    } finally {
        if(btnInvia) {
            btnInvia.disabled = false;
            btnInvia.innerText = "🚀 INVIA E SALVA RAPPORTO";
        }
    }
}

async function generaAnteprimaPDF() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const operatore = document.getElementById('operatore').value || "N.D.";
        const zona = document.getElementById('zona').value || "N.D.";
        const dataInt = document.getElementById('dataIntervento').value || "";
        const descrizione = document.getElementById('descrizioneIntervento').value || "";

        const imgLogo = document.querySelector('.header-logo img');
        if (imgLogo) {
            try { doc.addImage(imgLogo, 'PNG', 10, 10, 50, 18); } catch(e) {}
        }
        
        doc.setFontSize(18);
        doc.setTextColor(0, 74, 153);
        doc.text("ANTEPRIMA RAPPORTO", 70, 22);
        
        doc.setFontSize(11);
        doc.text(`Operatore: ${operatore}`, 10, 45);
        doc.text(`Zona: ${zona}`, 10, 52);
        doc.text(`Data: ${dataInt}`, 10, 59);

        doc.setFont("helvetica", "bold");
        doc.text("Descrizione Intervento:", 10, 70);
        doc.setFont("helvetica", "normal");
        const splitDesc = doc.splitTextToSize(descrizione, 180);
        doc.text(splitDesc, 10, 77);
        
        let currentY = 77 + (splitDesc.length * 7);

        doc.setFont("helvetica", "bold");
        doc.text("Materiali utilizzati:", 10, currentY + 10);
        doc.setFont("helvetica", "normal");
        let y = currentY + 17;
        carrello.forEach((item) => {
            doc.text(`- [${item.qta}] ${item.cod}: ${item.desc}`, 15, y);
            y += 8;
        });

        if (signaturePad && !signaturePad.isEmpty()) {
            const firmaData = signaturePad.toDataURL();
            doc.text("Firma Cliente:", 10, y + 10);
            doc.addImage(firmaData, 'PNG', 10, y + 15, 40, 15);
        }

        window.open(doc.output('bloburl'), '_blank');
    } catch (err) {
        alert("Errore anteprima: " + err.message);
    }
}


