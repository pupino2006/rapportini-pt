<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>App Rapportini</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/signature_pad@4.0.0/dist/signature_pad.umd.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <link rel="stylesheet" href="style.css">
</head>
<body>

<div id="home-screen">
    <div style="text-align: center; padding: 40px 20px;">
        <img src="logoapp.png" style="width: 150px; margin-bottom: 30px;" onerror="this.style.display='none'">
        <h2 style="color: #004a99;">Gestione Interventi</h2>
        <button onclick="mostraApp()" class="btn-main-menu">➕ NUOVO RAPPORTO</button>
        <button onclick="caricaStorico()" class="btn-main-menu" style="background: #6c757d;">📂 STORICO RAPPORTI</button>
    </div>
</div>

<div id="tab-storico" style="display:none; padding: 20px;">
    <button onclick="tornaAllaHome()" class="btn-back">🏠 Torna alla Home</button>
    <h3 style="color:#004a99;">Storico Rapportini</h3>
    <div id="lista-rapportini"></div>
</div>

<div id="app-interface" style="display:none;">
    <div class="header-logo" style="text-align:center; padding:10px;">
        <img src="logo lungo.png" style="max-width:200px;" onerror="this.style.display='none'">
    </div>
    <nav class="tabs">
        <button class="tab-btn active" onclick="openTab(event, 'tab1')">📋 DATI</button>
        <button class="tab-btn" onclick="openTab(event, 'tab2')">📦 MAT.</button>
        <button class="tab-btn" onclick="openTab(event, 'tab3')">✍️ FIRMA</button>
    </nav>

    <section id="tab1" class="tab-content" style="padding:15px;">
        <div class="input-group">
            <label>Zona di Intervento</label><input type="text" id="zona" placeholder="Zona...">
            <label>Operatore</label><input type="text" id="operatore" placeholder="Nome...">
            <label>Data</label><input type="date" id="dataIntervento">
            <label>Descrizione Lavoro</label>
            <textarea id="descrizioneIntervento" rows="5" placeholder="Descrizione..."></textarea>
        </div>
    </section>

    <section id="tab2" class="tab-content" style="display:none; padding:15px;">
        <input type="text" id="searchArticolo" onkeyup="searchInDanea()" placeholder="Cerca articolo...">
        <div id="risultatiRicerca" style="background:#f9f9f9;"></div>
        <h3>Materiali Selezionati:</h3>
        <div id="carrelloMateriali"></div>
    </section>

    <section id="tab3" class="tab-content" style="display:none; padding:15px;">
        <label>Firma Cliente</label>
        <div class="canvas-wrapper" style="border:2px solid #004a99; background:#fff; margin-bottom:10px;">
            <canvas id="signature-pad" style="width:100%; height:200px;"></canvas>
        </div>
        <button class="btn-clear" onclick="signaturePad.clear()">Cancella Firma</button>
        
        <div style="margin-top:20px;">
            <label>Allega Foto Intervento</label>
            <input type="file" id="fotoInput" accept="image/*" multiple style="margin-bottom:20px;">
            <button class="btn-preview" onclick="generaAnteprimaPDF()">👁️ ANTEPRIMA</button>
            <button class="btn-send" onclick="generaEInviaPDF()">🚀 INVIA RAPPORTO</button>
        </div>
    </section>
</div>

<script src="script.js"></script>
</body>
</html>
