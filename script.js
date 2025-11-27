// REGISTRASI PLUGIN DATALABELS
if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

function parseCSV(text) {
    const rows = [];
    let cur = [];
    let field = '';
    let inQuotes = false;
    let i = 0;
    if (!text) return [];
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    while (i < text.length) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i+1] === '"') { field += '"'; i += 2; continue; }
                inQuotes = false; i++; continue;
            } else { field += ch; i++; continue; }
        } else {
            if (ch === '"') { inQuotes = true; i++; continue; }
            if (ch === ',') { cur.push(field); field = ''; i++; continue; }
            if (ch === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; i++; continue; }
            field += ch; i++;
        }
    }
    if (field !== '' || inQuotes || cur.length > 0) {
        cur.push(field);
        rows.push(cur);
    }
    return rows.map(r => r.map(c => c.trim()));
}

function findHeaderIndex(header, keys) {
    keys = Array.isArray(keys) ? keys : [keys];
    const lower = header.map(h => h.toLowerCase());
    for (let k of keys) {
        const kl = k.toLowerCase();
        for (let i=0;i<lower.length;i++) if (lower[i]===kl) return i;
    }
    for (let k of keys) {
        const kl = k.toLowerCase();
        for (let i=0;i<lower.length;i++) if (lower[i].includes(kl) || kl.includes(lower[i])) return i;
    }
    return -1;
}

function loadDataFromCSV(raw) {
    const rows = parseCSV(raw).filter(r => r.length > 1);
    if (rows.length === 0) return { header: [], rows: [] };
    const header = rows.shift().map(h => h.replace(/\s+/g,' ').trim());
    return { header, rows };
}

function rowsToRecords(header, rows) {
    return rows.map(r => {
        const rec = {};
        for (let i=0;i<header.length;i++) rec[header[i]] = (i < r.length ? r[i] : '');
        return rec;
    });
}

function detectFieldIndices(header) {
    return {
        timestamp: findHeaderIndex(header, ['timestamp','time','waktu']),
        name: findHeaderIndex(header, ['nama lengkap','name','nama']),
        kampus: findHeaderIndex(header, ['nama kampus','kampus','university']),
        angkatan: findHeaderIndex(header, ['angkatan','angkatan anda','tahun','angkatan anda ']),
        ipk: findHeaderIndex(header, ['ipk','rentang ipk','rentang ipk anda saat ini','rentang ipk anda']),
        chatgpt: findHeaderIndex(header, ['chatgpt','apakah anda menggunakan chatgpt?','apakah anda menggunakan chatgpt']),
        gemini: findHeaderIndex(header, ['gemini','google gemini','apakah anda menggunakan google gemini?']),
        blackbox: findHeaderIndex(header, ['blackbox','apakah anda menggunakan blackbox?']),
        deepseek: findHeaderIndex(header, ['deepseek','apakah anda menggunakan deepseek?']),
        usedCount: findHeaderIndex(header, ['berapa banyak ai','berapa banyak ai yang anda gunakan','jumlah ai']),
        freq: findHeaderIndex(header, ['seberapa sering','frekuensi','seberapa sering anda menggunakan ai']),
        produktivitas: findHeaderIndex(header, ['seberapa besar ai membantu produktivitas','produktivit']),
        privasi: findHeaderIndex(header, ['privasi','kekhawatiran','apakah anda memiliki kekhawatiran terkait privasi'])
    };
}

function summarizeData(parsed, indices) {
    const rows = parsed.rows;
    const header = parsed.header;
    // counters
    let total = rows.length;
    let nA=0,nB=0,nC=0,nD=0,noAI=0;
    let AB=0,AC=0,AD=0,BC=0,BD=0,CD=0;
    let ABC=0,ABD=0,ACD=0,BCD=0,ABCD=0;
    const angkatanCount = {};
    const ipkCount = {};
    let ipkNumericSum=0, ipkNumericCount=0;

    rows.forEach(r => {
        const get = i => (i >= 0 && i < r.length) ? r[i].trim() : '';
        const A = (indices.chatgpt>=0) ? (/^iya$/i.test(get(indices.chatgpt)) || /^yes$/i.test(get(indices.chatgpt))) : false;
        const B = (indices.gemini>=0) ? (/^iya$/i.test(get(indices.gemini)) || /^yes$/i.test(get(indices.gemini))) : false;
        const C = (indices.blackbox>=0) ? (/^iya$/i.test(get(indices.blackbox)) || /^yes$/i.test(get(indices.blackbox))) : false;
        const D = (indices.deepseek>=0) ? (/^iya$/i.test(get(indices.deepseek)) || /^yes$/i.test(get(indices.deepseek))) : false;

        if (A) nA++; if (B) nB++; if (C) nC++; if (D) nD++;
        if (!A && !B && !C && !D) noAI++;
        if (A && B) AB++; if (A && C) AC++; if (A && D) AD++;
        if (B && C) BC++; if (B && D) BD++; if (C && D) CD++;
        if (A && B && C) ABC++; if (A && B && D) ABD++; if (A && C && D) ACD++; if (B && C && D) BCD++;
        if (A && B && C && D) ABCD++;

        // angkatan
        if (indices.angkatan >= 0) {
            const ag = get(indices.angkatan) || '(kosong)';
            angkatanCount[ag] = (angkatanCount[ag] || 0) + 1;
        }

        // ipk
        if (indices.ipk >= 0) {
            const ipkRaw = get(indices.ipk);
            const num = parseFloat(ipkRaw.replace(/[^0-9.-]+/g,''));
            if (!isNaN(num) && /^[0-9]/.test(ipkRaw.trim())) {
                ipkNumericSum += num; ipkNumericCount++;
                ipkCount[ipkRaw] = (ipkCount[ipkRaw] || 0) + 1;
            } else if (ipkRaw !== '') {
                ipkCount[ipkRaw] = (ipkCount[ipkRaw] || 0) + 1;
            } else {
                ipkCount['(kosong)'] = (ipkCount['(kosong)'] || 0) + 1;
            }
        }
    });

    return {
        total, nA,nB,nC,nD,noAI,
        // Kirim data irisan individu agar bisa ditampilkan
        AB, AC, AD, BC, BD, CD,
        ABC, ABD, ACD, BCD,
        ABCD,
        pairs: AB+AC+AD+BC+BD+CD,
        triples: ABC+ABD+ACD+BCD,
        quad: ABCD,
        singles: nA+nB+nC+nD,
        angkatanCount,
        ipkCount,
        ipkNumericSum, ipkNumericCount
    };
}

function renderDashboard(parsed, indices, containerPrefix = '') {
    const s = summarizeData(parsed, indices);

    if (document.getElementById('totalResp')) document.getElementById('totalResp').innerText = s.total;
    if (document.getElementById('unionCount')) document.getElementById('unionCount').innerText = (s.total - s.noAI);
    if (document.getElementById('noAiCount')) document.getElementById('noAiCount').innerText = s.noAI;
    if (document.getElementById('pairCount')) document.getElementById('pairCount').innerText = s.pairs;
    if (document.getElementById('tripleCount')) document.getElementById('tripleCount').innerText = s.triples;
    if (document.getElementById('quadCount')) document.getElementById('quadCount').innerText = s.quad;

    // --- DETAIL MATEMATIKA ---
    if (document.getElementById('mathDetail')) {
        const calcUnion = s.singles - s.pairs + s.triples - s.quad;
        document.getElementById('mathDetail').innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; font-family: 'Courier New', monospace; font-size: 0.9rem;">
                <!-- SINGLE SETS -->
                <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px;">
                    <div style="color: #00d4ff; font-weight: bold; border-bottom: 1px solid #00d4ff; margin-bottom: 5px; padding-bottom: 2px;">SINGLE SETS</div>
                    n(A) = ${s.nA}<br>
                    n(B) = ${s.nB}<br>
                    n(C) = ${s.nC}<br>
                    n(D) = ${s.nD}<br>
                    <div style="border-top: 1px dashed #666; margin-top: 5px; padding-top: 3px; color: #fff;">Σ Single = ${s.singles}</div>
                </div>

                <!-- PAIRS -->
                <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px;">
                    <div style="color: #ff007f; font-weight: bold; border-bottom: 1px solid #ff007f; margin-bottom: 5px; padding-bottom: 2px;">PAIRS (2)</div>
                    n(A∩B) = ${s.AB}<br>
                    n(A∩C) = ${s.AC}<br>
                    n(A∩D) = ${s.AD}<br>
                    n(B∩C) = ${s.BC}<br>
                    n(B∩D) = ${s.BD}<br>
                    n(C∩D) = ${s.CD}<br>
                    <div style="border-top: 1px dashed #666; margin-top: 5px; padding-top: 3px; color: #fff;">Σ Pairs = ${s.pairs}</div>
                </div>

                <!-- TRIPLES -->
                <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px;">
                    <div style="color: #00ff88; font-weight: bold; border-bottom: 1px solid #00ff88; margin-bottom: 5px; padding-bottom: 2px;">TRIPLES (3)</div>
                    n(A∩B∩C) = ${s.ABC}<br>
                    n(A∩B∩D) = ${s.ABD}<br>
                    n(A∩C∩D) = ${s.ACD}<br>
                    n(B∩C∩D) = ${s.BCD}<br>
                    <div style="border-top: 1px dashed #666; margin-top: 5px; padding-top: 3px; color: #fff;">Σ Triples = ${s.triples}</div>
                </div>

                <!-- QUAD -->
                <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px;">
                    <div style="color: #9d4edd; font-weight: bold; border-bottom: 1px solid #9d4edd; margin-bottom: 5px; padding-bottom: 2px;">QUAD (4)</div>
                    n(A∩B∩C∩D) = ${s.ABCD}<br>
                    <div style="border-top: 1px dashed #666; margin-top: 5px; padding-top: 3px; color: #fff;">Quad = ${s.quad}</div>
                </div>
            </div>

            <!-- RUMUS & HASIL AKHIR -->
            <div style="border-top: 2px solid rgba(255,255,255,0.1); padding-top: 15px; margin-top: 10px;">
                <div style="color: #00d4ff; font-weight: bold; font-size: 1.1em; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                    <span>🧮</span> PEMBUKTIAN INKLUSI - EKSKLUSI
                </div>
                <div style="font-family: 'Courier New', monospace; color: #aaa; font-size: 0.9em; letter-spacing: 0.5px; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; margin-bottom: 10px;">
                    |A∪B∪C∪D| = Σ(Single) - Σ(Pairs) + Σ(Triples) - |Quad|
                </div>
                <div style="font-family: 'Courier New', monospace; font-size: 1.1em;">
                    ${s.singles} - ${s.pairs} + ${s.triples} - ${s.quad} = <strong style="color: #00ff88; font-size: 1.3em;">${calcUnion}</strong>
                </div>
            </div>`;
    }

    // --- KONFIGURASI TOOLTIP (Persentase saat Hover) ---
    const percentageTooltip = {
        backgroundColor: 'rgba(20, 20, 30, 0.9)',
        titleColor: '#fff',
        bodyColor: '#ccc',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 10,
        displayColors: false,
        callbacks: {
            label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                    label += ': ';
                }
                let value = context.raw;
                let sum = 0;
                context.chart.data.datasets[0].data.forEach(v => sum += v);
                
                let percentage = (value / sum * 100).toFixed(1) + "%";
                return `${label}${value} (${percentage})`;
            }
        }
    };

    // --- 1. CHART ANGKATAN ---
    if (document.getElementById('angkatanChart')) {
        const angkatanCtx = document.getElementById('angkatanChart').getContext('2d');
        const angkatanKeys = Object.keys(s.angkatanCount).sort();
        const angkatanVals = angkatanKeys.map(k => s.angkatanCount[k]);

        const angkatanColors = [
            'rgba(0, 212, 255, 0.8)',   // Cyan
            'rgba(157, 78, 221, 0.8)',  // Purple
            'rgba(255, 0, 128, 0.8)',   // Pink
            'rgba(0, 255, 136, 0.8)',   // Green
            'rgba(255, 205, 86, 0.8)'   // Yellow
        ];
        const angkatanBorders = [
            '#00d4ff', '#9d4edd', '#ff0080', '#00ff88', '#ffcd56'
        ];

        if (window._angkatanChart) window._angkatanChart.destroy();
        window._angkatanChart = new Chart(angkatanCtx, {
            type: 'bar',
            data: {
                labels: angkatanKeys,
                datasets: [{
                    label: 'Jumlah Responden',
                    data: angkatanVals,
                    backgroundColor: angkatanKeys.map((_, i) => angkatanColors[i % angkatanColors.length]),
                    borderColor: angkatanKeys.map((_, i) => angkatanBorders[i % angkatanBorders.length]),
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false,
                    barPercentage: 0.6 
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    datalabels: { display: false }, 
                    tooltip: percentageTooltip 
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#aaa', font: { family: 'Poppins' } } },
                    x: { grid: { display: false }, ticks: { color: '#e0e0e0', font: { family: 'Poppins', weight: '600' } } }
                },
                animation: { duration: 1500, easing: 'easeOutQuart' }
            }
        });
    }

    // --- 2. CHART DISTRIBUSI IPK (BATANG) ---
    if (document.getElementById('ipkBarChart')) {
        const ipkBarCtx = document.getElementById('ipkBarChart').getContext('2d');
        const ipkKeys = Object.keys(s.ipkCount).sort();
        const ipkVals = ipkKeys.map(k => s.ipkCount[k]);

        const ipkColors = [
            'rgba(255, 205, 86, 0.8)',  // Yellow
            'rgba(255, 159, 64, 0.8)',  // Orange
            'rgba(255, 99, 132, 0.8)',  // Red
            'rgba(153, 102, 255, 0.8)', // Purple
            'rgba(54, 162, 235, 0.8)'   // Blue
        ];
        const ipkBorders = [
            '#ffcd56', '#ff9f40', '#ff6384', '#9966ff', '#36a2eb'
        ];

        if (window._ipkBarChart) window._ipkBarChart.destroy();
        window._ipkBarChart = new Chart(ipkBarCtx, {
            type: 'bar',
            data: {
                labels: ipkKeys,
                datasets: [{
                    label: 'Jumlah Responden',
                    data: ipkVals,
                    backgroundColor: ipkKeys.map((_, i) => ipkColors[i % ipkColors.length]),
                    borderColor: ipkKeys.map((_, i) => ipkBorders[i % ipkBorders.length]),
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false,
                    barPercentage: 0.6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    datalabels: { display: false }, 
                    tooltip: percentageTooltip 
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#aaa', font: { family: 'Poppins' } } },
                    x: { grid: { display: false }, ticks: { color: '#e0e0e0', font: { family: 'Poppins', weight: '600' } } }
                },
                animation: { duration: 1500, easing: 'easeOutQuart' }
            }
        });
    }

    // --- CHART UTAMA (PLATFORM AI) ---
    if (document.getElementById('mainChart')) {
        const ctx = document.getElementById('mainChart').getContext('2d');
        
        const gradChat = ctx.createLinearGradient(0, 0, 0, 400);
        gradChat.addColorStop(0, 'rgba(0, 212, 255, 0.9)');
        gradChat.addColorStop(1, 'rgba(0, 212, 255, 0.1)');

        const gradGem = ctx.createLinearGradient(0, 0, 0, 400);
        gradGem.addColorStop(0, 'rgba(0, 255, 136, 0.9)');
        gradGem.addColorStop(1, 'rgba(0, 255, 136, 0.1)');

        const gradBB = ctx.createLinearGradient(0, 0, 0, 400);
        gradBB.addColorStop(0, 'rgba(255, 0, 128, 0.9)');
        gradBB.addColorStop(1, 'rgba(255, 0, 128, 0.1)');

        const gradDS = ctx.createLinearGradient(0, 0, 0, 400);
        gradDS.addColorStop(0, 'rgba(157, 78, 221, 0.9)');
        gradDS.addColorStop(1, 'rgba(157, 78, 221, 0.1)');

        if (window._mainChart) window._mainChart.destroy();
        
        window._mainChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['ChatGPT', 'Gemini', 'Blackbox', 'DeepSeek'],
                datasets: [{
                    label: 'Jumlah Pengguna',
                    data: [s.nA, s.nB, s.nC, s.nD],
                    backgroundColor: [gradChat, gradGem, gradBB, gradDS],
                    borderColor: ['#00d4ff', '#00ff88', '#ff0080', '#9d4edd'],
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false,
                    barPercentage: 0.6,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#e0e0e0', font: { family: 'Poppins', size: 12 } } },
                    datalabels: { display: false }, 
                    tooltip: {
                        backgroundColor: 'rgba(20, 20, 30, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#ccc',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                let value = context.raw;
                                // Persentase AI dihitung dari TOTAL RESPONDEN
                                let percentage = (value / s.total * 100).toFixed(1) + "%";
                                return `${label}${value} (${percentage})`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)', borderDash: [5, 5] },
                        ticks: { color: '#aaa', font: { family: 'Poppins' } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#fff', font: { family: 'Poppins', weight: '600' } }
                    }
                },
                animation: { duration: 1500, easing: 'easeOutQuart' }
            }
        });
    }

    // --- CHART DONUT (SEBARAN IPK) ---
    if (document.getElementById('ipkChart')) {
        const keys = Object.keys(s.ipkCount).sort();
        const vals = keys.map(k => s.ipkCount[k]);
        const ctxI = document.getElementById('ipkChart').getContext('2d');
        
        const pieColors = ['rgba(0, 212, 255, 0.8)', 'rgba(157, 78, 221, 0.8)', 'rgba(0, 255, 136, 0.8)', 'rgba(255, 0, 128, 0.8)', 'rgba(255, 159, 64, 0.8)', 'rgba(255, 205, 86, 0.8)'];

        if (window._ipkChart) window._ipkChart.destroy();
        window._ipkChart = new Chart(ctxI, {
            type: 'doughnut',
            data: { 
                labels: keys, 
                datasets: [{ 
                    data: vals,
                    backgroundColor: pieColors,
                    borderColor: '#0f0f0f',
                    borderWidth: 2,
                    hoverOffset: 10
                }] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { 
                    legend: { 
                        position: 'bottom',
                        labels: { color: '#ccc', font: { family: 'Poppins', size: 11 }, padding: 20 }
                    },
                    datalabels: { display: false }, 
                    tooltip: percentageTooltip 
                },
                cutout: '60%'
            }
        });

        if (document.getElementById('ipkAverage')) {
            if (s.ipkNumericCount > 0 && s.ipkNumericCount === vals.reduce((a,b)=>a+b,0)) {
                const avg = s.ipkNumericSum / s.ipkNumericCount;
                document.getElementById('ipkAverage').innerText = avg.toFixed(2);
                document.getElementById('ipkDesc').innerText = `${s.ipkNumericCount} responden (rata-rata)`;
            } else {
                document.getElementById('ipkAverage').innerText = ' ';
                let html = '';
                keys.forEach(k => html += `${k}: <strong>${s.ipkCount[k] || s.ipkCount[k]}</strong><br>`);
                if (document.getElementById('ipkDesc')) document.getElementById('ipkDesc').innerHTML = html;
            }
        }
    }
}

function renderRespondents(parsed, indices) {
    const rows = parsed.rows;
    const header = parsed.header;
    const records = rowsToRecords(header, rows);

    const container = document.getElementById('respondentsContainer');
    if (!container) return;

    const filterArea = document.getElementById('respondentsFilters');
    filterArea.innerHTML = `
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <input id="searchBox" placeholder="Cari nama / kampus / NIM ..." style="padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:transparent;color:#e0e0e0;min-width:220px;">
            <select id="filterAngkatan"><option value="">Semua Angkatan</option></select>
            <select id="filterIPK"><option value="">Semua IPK</option></select>
            <select id="filterAI"><option value="">Semua AI</option><option value="ChatGPT">ChatGPT</option><option value="Gemini">Gemini</option><option value="BlackBox">BlackBox</option><option value="DeepSeek">DeepSeek</option></select>
            <button id="exportCSVBtn" class="btn">Export CSV</button>
        </div>
        <div style="height:8px"></div>
    `;

    const angkatanSet = new Set();
    const ipkSet = new Set();
    records.forEach(rec => {
        const ang = Object.keys(rec).find(k => k.toLowerCase().includes('angkatan')) || Object.keys(rec).find(k=>k.toLowerCase().includes('tahun'));
        const ipkKey = Object.keys(rec).find(k => k.toLowerCase().includes('ipk')) || Object.keys(rec).find(k=>k.toLowerCase().includes('rentang'));
        const angVal = ang ? (rec[ang] || '') : '';
        const ipkVal = ipkKey ? (rec[ipkKey] || '') : '';
        if (angVal) angkatanSet.add(angVal);
        if (ipkVal) ipkSet.add(ipkVal);
    });

    const angSel = document.getElementById('filterAngkatan');
    Array.from(angkatanSet).sort().forEach(a => {
        const opt = document.createElement('option'); opt.value = a; opt.text = a; angSel.appendChild(opt);
    });
    const ipkSel = document.getElementById('filterIPK');
    Array.from(ipkSet).sort().forEach(a => {
        const opt = document.createElement('option'); opt.value = a; opt.text = a; ipkSel.appendChild(opt);
    });

    const tblContainer = document.getElementById('respondentsTable');
    tblContainer.innerHTML = '';
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.id = 'resTable';
    const displayCols = [];
    ['nama','nim','nama kampus','kelas','usia','angkatan','ipk','chatgpt','gemini','blackbox','deepseek'].forEach(key => {
        const found = header.find(h => h.toLowerCase().includes(key));
        if (found && !displayCols.includes(found)) displayCols.push(found);
    });
    if (displayCols.length === 0) displayCols.push(...header.slice(0,8));

    const thead = document.createElement('thead');
    const thr = document.createElement('tr');
    displayCols.forEach(col => {
        const th = document.createElement('th');
        th.innerText = col;
        th.style.padding = '10px';
        th.style.textAlign = 'left';
        th.style.cursor = 'pointer';
        th.style.borderBottom = '1px solid rgba(255,255,255,0.06)';
        th.onclick = () => sortTableByColumn(col);
        thr.appendChild(th);
    });
    thead.appendChild(thr); table.appendChild(thead);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    tblContainer.appendChild(table);

    let currentRecords = records.slice();

    function renderRows(list) {
        tbody.innerHTML = '';
        list.forEach(rec => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
            displayCols.forEach(col => {
                const td = document.createElement('td');
                td.style.padding = '10px';
                
                let text = rec[col] || '';
                if (col.toLowerCase().includes('nama') && !col.toLowerCase().includes('kampus')) {
                    text = text.replace(/\b(\w)(\w+)/g, (match, firstChar, rest) => {
                        return firstChar + '*'.repeat(rest.length);
                    });
                }

                td.innerText = text;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    function applyFilters() {
        const q = (document.getElementById('searchBox').value || '').toLowerCase();
        const ang = document.getElementById('filterAngkatan').value;
        const ipk = document.getElementById('filterIPK').value;
        const ai = document.getElementById('filterAI').value;

        currentRecords = records.filter(rec => {
            const matchesQ = q === '' || displayCols.some(c => (rec[c]||'').toLowerCase().includes(q));
            if (!matchesQ) return false;
            if (ang && !Object.values(rec).some(v => (v||'') === ang)) return false;
            if (ipk && !Object.values(rec).some(v => (v||'') === ipk)) return false;
            if (ai) {
                const found = Object.keys(rec).find(k => k.toLowerCase().includes(ai.toLowerCase()));
                if (!found) return false;
                if (!/^iya$/i.test(rec[found] || '')) return false;
            }
            return true;
        });
        renderRows(currentRecords);
    }

    let sortState = {col:null, asc:true};
    function sortTableByColumn(col) {
        if (sortState.col === col) sortState.asc = !sortState.asc; else { sortState.col = col; sortState.asc = true; }
        currentRecords.sort((a,b) => {
            const va = (a[col]||'').toString().toLowerCase();
            const vb = (b[col]||'').toString().toLowerCase();
            if (va < vb) return sortState.asc ? -1 : 1;
            if (va > vb) return sortState.asc ? 1 : -1;
            return 0;
        });
        renderRows(currentRecords);
    }

    document.getElementById('searchBox').addEventListener('input', applyFilters);
    document.getElementById('filterAngkatan').addEventListener('change', applyFilters);
    document.getElementById('filterIPK').addEventListener('change', applyFilters);
    document.getElementById('filterAI').addEventListener('change', applyFilters);

    
    document.getElementById('exportCSVBtn').addEventListener('click', ()=> {
        const csvRows = [];
        csvRows.push(displayCols.join(','));
        currentRecords.forEach(rec => {
            const row = displayCols.map(c => {
                const v = rec[c] || '';
                if (v.includes(',') || v.includes('"')) return `"${v.replace(/"/g,'""')}"`;
                return v;
            }).join(',');
            csvRows.push(row);
        });
        const blob = new Blob([csvRows.join('\n')], {type: 'text/csv;charset=utf-8;'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'responden_export.csv'; a.click();
        URL.revokeObjectURL(url);
    });

    currentRecords = records.slice();
    renderRows(currentRecords);
}

function initShared() {
    if (typeof dataMentah === 'undefined') {
        console.warn('database.js tidak ditemukan atau tidak mendefinisikan dataMentah');
        return;
    }
    const parsed = loadDataFromCSV(dataMentah);
    const indices = detectFieldIndices(parsed.header);

    window._parsedData = parsed;
    window._parsedIndices = indices;

    const path = window.location.pathname.split('/').pop().toLowerCase();
    if (path === '' || path === 'index.html' || path === 'home.html') {
        const summary = summarizeData(parsed, indices);
        const preview = document.getElementById('indexPreview');
        if (preview) {
            preview.innerHTML = `<div style="display:flex;gap:12px;flex-wrap:wrap;">
                <div class="card" style="padding:12px;border-radius:8px;"><div style="font-size:20px">${summary.total}</div></div>
            </div>`;
        }
    } else if (path === 'dashboard.html') {
        renderDashboard(parsed, indices);
        // PANGGIL FUNGSI UNTUK MERENDER TABEL DI DASHBOARD
        renderDashboardRespondents(parsed, indices);
        
        const filterArea = document.getElementById('dashboardFilters');
        if (filterArea) {
            const angSel = document.createElement('select');
            angSel.id = 'dashFilterAngkatan';
            angSel.style.marginRight = '8px';
            angSel.innerHTML = `<option value="">Semua Angkatan</option>`;
            const angSet = new Set();
            parsed.rows.forEach(r => {
                const hdr = parsed.header;
                const idx = indices.angkatan;
                if (idx>=0 && idx < r.length) angSet.add(r[idx].trim());
            });
            Array.from(angSet).sort().forEach(a => { const o = document.createElement('option'); o.value = a; o.text = a; angSel.appendChild(o); });
            filterArea.appendChild(angSel);

            const ipkSel = document.createElement('select');
            ipkSel.id = 'dashFilterIPK';
            ipkSel.style.marginRight = '8px';
            ipkSel.innerHTML = `<option value="">Semua IPK</option>`;
            const ipkSet = new Set();
            parsed.rows.forEach(r => {
                const idx = indices.ipk;
                if (idx>=0 && idx < r.length) ipkSet.add(r[idx].trim());
            });
            Array.from(ipkSet).sort().forEach(a => { const o = document.createElement('option'); o.value = a; o.text = a; ipkSel.appendChild(o); });
            filterArea.appendChild(ipkSel);

            
            const btn = document.createElement('button'); btn.innerText = 'Terapkan Filter'; btn.className='btn';
            btn.onclick = ()=> {
                const ang = document.getElementById('dashFilterAngkatan').value;
                const ipk = document.getElementById('dashFilterIPK').value;
                
                const filteredRows = parsed.rows.filter(row => {
                    let ok = true;
                    if (ang) {
                        const v = (indices.angkatan>=0 && indices.angkatan < row.length) ? row[indices.angkatan].trim() : '';
                        if (v !== ang) ok = false;
                    }
                    if (ok && ipk) {
                        const v = (indices.ipk>=0 && indices.ipk < row.length) ? row[indices.ipk].trim() : '';
                        if (v !== ipk) ok = false;
                    }
                    return ok;
                });
                const subParsed = { header: parsed.header, rows: filteredRows };
                renderDashboard(subParsed, indices);
            };
            filterArea.appendChild(btn);
            
            const expXl = document.createElement('button'); expXl.innerText='Export Excel'; expXl.className='btn'; expXl.style.marginLeft='8px';
            expXl.onclick = ()=> {
                const csvRows = [];
                csvRows.push(parsed.header.join(','));
                parsed.rows.forEach(r => csvRows.push(r.map(c=> (c.includes(',')||c.includes('"')) ? `"${c.replace(/"/g,'""')}"` : c).join(',')));
                const blob = new Blob([csvRows.join('\n')], {type:'text/csv;charset=utf-8;'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href=url; a.download='data_export.csv'; a.click(); URL.revokeObjectURL(url);
            };
            filterArea.appendChild(expXl);

        }
    } else if (path === 'responden.html') {
        const container = document.getElementById('respondentsContainer');
        if (container) {
            container.innerHTML = `
                <div id="respondentsFilters"></div>
                <div id="respondentsTable" style="margin-top:12px"></div>
            `;
            renderRespondents(parsed, indices);
        }
    }
}

document.addEventListener('DOMContentLoaded', initShared);