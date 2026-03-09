const SB_URL = "https://vnzrewcbnoqbqvzckome.supabase.co";
const SB_KEY = "sb_publishable_Sq9txbu-PmKdbxETSx2cjw_WqWEFBPO";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let carrello = [];
let signaturePad;

// --- 1. NAVIGAZIONE ---

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
    nascondiTutto();
    document.getElementById('home-screen').style.display = 'block';
}

function openTab(evt, tabId) {
    const sections = ['tab1', 'tab2', 'tab3'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    const target = document.getElementById(tabId);
    if (target) {
        target.style.display = 'block';
        if (evt) {
            evt.currentTarget.classList.add('active');
        } else {
            const btn = document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
            if(btn) btn.classList.add('active');
        }
    }

    if (tabId === 'tab3') {
        setTimeout(resizeCanvas, 150);
    }
}

// --- 2. GESTIONE STORICO (Allineata allo schema SQL) ---

async function caricaStorico() {
    nascondiTutto();
    const lista = document.getElementById('lista-rapportini');
    document.getElementById('tab-storico').style.display = 'block';
    
    lista.innerHTML = "<p style='text-align:center;'>Caricamento in corso...</p>";

    try {
        const { data, error } = await supabaseClient
            .from('rapportini')
            .select('*')
            .order('data', { ascending: false }); // <--- CORRETTO: Usiamo 'data' invece di 'created_at'

        if (error) throw error;

        if (!data || data.length === 0) {
            lista.innerHTML = "<p style='text-align:center; padding: 20px;'>Nessun rapporto trovato in archivio.</p>";
            return;
        }

        lista.innerHTML = data.map(rap => `
            <div class="card-rapportino" style="border-left: 6px solid ${rap.completato ? '#27ae60' : '#f39c12'}; margin-bottom:15px; background:white; padding:15px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom:10px;">
                    <strong style="font-size:1.1rem;">${rap.zona || 'Senza Zona'}</strong>
                    <input type="checkbox" style="transform: scale(1.3);" ${rap.completato ? 'checked' : ''} onchange="aggiornaStato(${rap.id}, this.checked)">
                </div>
                <div style="font-size: 0.85rem; color: #666; margin-bottom: 10px;">
                    📅 ${rap.data} | 👷 ${rap.operatore || 'N.D.'}
                </div>
                <div style="font-size: 0.9rem; margin-bottom: 10px; color: #333;">
                    ${rap.descrizione ? rap.descrizione.substring(0, 50) + '...' : 'Nessuna descrizione'}
                </div>
                <div class="azioni-storico" style="display: flex; gap: 8px;">
                    ${rap.pdf_url ? `<button onclick="window.open('${rap.pdf_url}', '_blank')" style="flex:1; padding:8px; background:#004a99; color:white; border:none; border-radius:4px; cursor:pointer;">👁️ PDF</button>` : ''}
                    <button onclick="eliminaRapporto(${rap.id})" style="padding:8px; background:#e74c3c; color:white; border:none; border-radius:4px; cursor:pointer;">🗑️</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error("Errore completo:", err);
        lista.innerHTML = `<p style="color:red; text-align:center; padding:20px;">Errore caricamento: ${err.message}</p>`;
    }
}

// --- 3. LOGICA DATABASE ---

async function aggiornaStato(id, completato) {
    const { error } = await supabaseClient
        .from('rapportini')
        .update({ completato: completato })
        .eq('id', id);
    
    if (error) {
        alert("Errore nell'aggiornamento dello stato");
        console.error(error);
    }
}

async function eliminaRapporto(id) {
    if (!confirm("Vuoi eliminare definitivamente questo rapporto?")) return;
    
    const { error } = await supabaseClient
        .from('rapportini')
        .delete()
        .eq('id', id);
    
    if (error) {
        alert("Errore durante l'eliminazione");
    } else {
        caricaStorico(); // Ricarica la lista
    }
}

// --- 4. RICERCA E CARRELLO ---

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

    if (error) return;

    divRisultati.innerHTML = data.map(art => `
        <div class="item-ricerca" onclick="aggiungiAlCarrello('${art["Cod."]}', '${art["Descrizione"].replace(/'/g, "\\'")}')" style="display: flex; align-items: center; padding: 10px; border-bottom: 1px solid #eee; cursor:pointer; background:white;">
            <img src="${art["Immagine"] || 'https://via.placeholder.com/50'}" style="width:40px; height:40px; margin-right:10px; object-fit:cover;">
            <div><strong>${art["Cod."]}</strong><br><small>${art["Descrizione"]}</small></div>
        </div>
    `).join('');
}

function aggiungiAlCarrello(cod, desc) {
    carrello.push({ cod, desc, qta: 1 });
    document.getElementById('risultatiRicerca').innerHTML = "";
    document.getElementById('searchArticolo').value = "";
    aggiornaCarrelloUI();
}

function aggiornaCarrelloUI() {
    const container = document.getElementById('carrelloMateriali');
    container.innerHTML = carrello.map((item, index) => `
        <div class="card-materiale" style="background:white; padding:10px; border-radius:8px; margin-bottom:5px; border:1px solid #ddd; display:flex; justify-content:space-between; align-items:center;">
            <div><b>${item.cod}</b><br><small>${item.desc}</small></div>
            <div style="display:flex; gap:10px; align-items:center;">
                <input type="number" value="${item.qta}" style="width:50px; padding:5px;" onchange="carrello[${index}].qta=this.value">
                <button onclick="carrello.splice(${index}, 1); aggiornaCarrelloUI()" style="color:red; border:none; background:none; font-size:1.2rem; cursor:pointer;">❌</button>
            </div>
        </div>
    `).join('');
}

// --- 5. INIZIALIZZAZIONE ---

window.onload = () => {
    const canvas = document.getElementById('signature-pad');
    if (canvas) {
        signaturePad = new SignaturePad(canvas, { backgroundColor: 'rgb(255, 255, 255)' });
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
}

window.addEventListener("resize", resizeCanvas);
// --- 6. GENERAZIONE PDF E INVIO ---

async function generaEInviaPDF() {
    const btn = document.querySelector('.btn-send');
    btn.disabled = true;
    btn.innerText = "Invio in corso...";

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Recupero dati dai campi
        const zona = document.getElementById('zona').value;
        const operatore = document.getElementById('operatore').value;
        const dataInt = document.getElementById('dataIntervento').value;
        const descrizione = document.getElementById('descrizioneIntervento').value;

        // Validazione minima
        if (!zona || !operatore) {
            alert("Inserisci almeno Zona e Operatore!");
            btn.disabled = false;
            btn.innerText = "🚀 INVIA RAPPORTO";
            return;
        }

        // Costruzione semplice del PDF
        doc.setFontSize(18);
        doc.text("RAPPORTO DI INTERVENTO", 105, 20, { align: "center" });
        doc.setFontSize(12);
        doc.text(`Data: ${dataInt}`, 20, 40);
        doc.text(`Operatore: ${operatore}`, 20, 50);
        doc.text(`Zona: ${zona}`, 20, 60);
        doc.text("Descrizione Lavoro:", 20, 80);
        doc.text(doc.splitTextToSize(descrizione, 170), 20, 90);

        // Aggiunta materiali dal carrello
        doc.text("Materiali utilizzati:", 20, 140);
        let y = 150;
        carrello.forEach(item => {
            doc.text(`- ${item.cod}: ${item.desc} (Q.tà: ${item.qta})`, 25, y);
            y += 10;
        });

        // Firma
        if (!signaturePad.isEmpty()) {
            const firmaImg = signaturePad.toDataURL();
            doc.addPage();
            doc.text("Firma del Cliente:", 20, 20);
            doc.addImage(firmaImg, 'PNG', 20, 30, 100, 50);
        }

        // 1. Trasformazione in Blob
        const pdfBlob = doc.output('blob');
        const nomeFile = `Rapporto_${zona}_${Date.now()}.pdf`.replace(/\s+/g, '_');

        // 2. Caricamento su Supabase Storage (Bucket: carichi)
        const { data: uploadData, error: uploadError } = await supabaseClient
            .storage
            .from('carichi')
            .upload(nomeFile, pdfBlob);

        if (uploadError) throw uploadError;

        // 3. Recupero URL Pubblico
        const { data: urlData } = supabaseClient
            .storage
            .from('carichi')
            .getPublicUrl(nomeFile);

        const pdfUrl = urlData.publicUrl;

        // 4. Salvataggio nel Database (Tabella: rapportini)
        const { error: dbError } = await supabaseClient
            .from('rapportini')
            .insert([{
                data: dataInt,
                operatore: operatore,
                zona: zona,
                descrizione: descrizione,
                materiali: carrello,
                pdf_url: pdfUrl,
                completato: false
            }]);

        if (dbError) throw dbError;

        // 5. CHIAMATA ALLA EDGE FUNCTION (Invio Mail)
        // Usiamo i nomi dei campi che la tua Edge Function si aspetta
        await fetch("https://vnzrewcbnoqbqvzckome.supabase.co/functions/v1/invio-rapportini", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                operatore: operatore,
                zona: zona,
                dataInt: dataInt,
                descrizione: descrizione,
                pdfUrl: pdfUrl // La "U" maiuscola come abbiamo visto nel debug!
            })
        });

        alert("Rapporto inviato e archiviato con successo!");
        tornaAllaHome();

    } catch (err) {
        console.error(err);
        alert("Errore durante l'invio: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "🚀 INVIA RAPPORTO";
    }
}

function generaAnteprimaPDF() {
    // Versione semplificata per l'anteprima locale
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("ANTEPRIMA RAPPORTO", 20, 20);
    doc.text(`Zona: ${document.getElementById('zona').value}`, 20, 40);
    doc.text(`Descrizione: ${document.getElementById('descrizioneIntervento').value}`, 20, 50);
    
    window.open(doc.output('bloburl'), '_blank');
}


