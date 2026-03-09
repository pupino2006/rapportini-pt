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
            <div style="display: flex; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
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

// --- GENERAZIONE E INVIO (VERSIONE SUPABASE) ---
async function generaEInviaPDF() {
    console.log("Inizio procedura Cloud...");
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const operatore = document.getElementById('operatore').value;
        const zona = document.getElementById('zona').value;
        const dataInt = document.getElementById('dataIntervento').value;
        const descrizione = document.getElementById('descrizioneIntervento').value;

        if (!operatore || !zona) {
            alert("⚠️ Inserisci Operatore e Zona!");
            return;
        }

        // --- COSTRUZIONE PDF ---
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

        // 1. TRASFORMA PDF IN BLOB PER UPLOAD
        const pdfBlob = doc.output('blob');
        const fileName = `${Date.now()}_Rapporto_${zona.replace(/\s+/g, '_')}.pdf`;

        // 2. UPLOAD SU SUPABASE STORAGE (Richiede bucket 'rapportini-pdf' pubblico)
        const { data: storageData, error: storageError } = await supabaseClient
            .storage
            .from('rapportini-pdf')
            .upload(fileName, pdfBlob);

        if (storageError) throw new Error("Errore Upload Storage: " + storageError.message);

        // 3. OTTIENI URL PUBBLICO
        const { data: urlData } = supabaseClient.storage.from('rapportini-pdf').getPublicUrl(fileName);
        const pdfUrl = urlData.publicUrl;

        // 4. SALVA NEL DATABASE
        const { error: dbError } = await supabaseClient
            .from('rapportini')
            .insert([{
                operatore: operatore,
                zona: zona,
                data: dataInt,
                descrizione: descrizione,
                materiali: carrello,
                firma: firmaData,
                pdf_url: pdfUrl // <--- Nuova colonna
            }]);

        if (dbError) throw dbError;

        // 5. INVOCA EDGE FUNCTION PER INVIO EMAIL
        // Invieremo i dati alla funzione che userà Resend lato server
        const { data: funcData, error: funcError } = await supabaseClient.functions.invoke('send-email-rapportino', {
            body: { 
                operatore, 
                zona, 
                dataInt, 
                descrizione, 
                pdfUrl,
                fileName
            }
        });

        if (funcError) {
            console.error("Errore funzione:", funcError);
            alert("✅ Rapporto salvato nel cloud, ma l'invio email automatico è in coda o ha avuto un intoppo.");
        } else {
            alert("🚀 Rapporto salvato e inviato correttamente!");
        }

        // Scarica comunque una copia locale per sicurezza
        doc.save(fileName);

    } catch (err) {
        console.error(err);
        alert("❌ Errore critico: " + err.message);
    }
}

async function generaAnteprimaPDF() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const operatore = document.getElementById('operatore').value || "NON SPECIFICATO";
        const zona = document.getElementById('zona').value || "NON SPECIFICATA";
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

        if (!signaturePad.isEmpty()) {
            const firmaData = signaturePad.toDataURL();
            doc.text("Firma Cliente (Anteprima):", 10, y + 10);
            doc.addImage(firmaData, 'PNG', 10, y + 15, 40, 15);
        }

        window.open(doc.output('bloburl'), '_blank');
    } catch (err) {
        console.error(err);
        alert("Errore anteprima: " + err.message);
    }
}