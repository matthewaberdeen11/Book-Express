// analytics.js — renders Analytics dashboard charts and metrics

let chartInstances = {};
let isLoading = false;

function destroyChart(id) {
  if (chartInstances[id]) {
    try { chartInstances[id].destroy(); } catch (e) {}
    chartInstances[id] = null;
  }
}

function loadAnalytics() {
  if (isLoading) return;
  isLoading = true;
  const period = document.getElementById('period').value;
  const metricsDiv = document.getElementById('metrics');
  const slowMovingList = document.getElementById('slowMoving');
  const errorDiv = document.getElementById('errorMessage');

  metricsDiv.innerHTML = '<div style="grid-column: span 4; text-align:center; padding:20px; color:#999;">Loading data...</div>';
  slowMovingList.innerHTML = '';
  errorDiv.style.display = 'none';

  const apiUrl = `../backend/api/analytics.php?action=analytics&period=${encodeURIComponent(period)}`;
  console.log('[ANALYTICS] Fetching from:', apiUrl, 'at:', new Date().toLocaleTimeString());
  fetch(apiUrl)
    .then(r => {
      if (!r.ok) throw new Error('Network response was not ok');
      return r.json();
    })
    .then(data => {
      console.debug('Analytics response:', data);
      if (data.error) throw data;
      renderRealData(data);
    })
    .catch((err) => {
      console.warn('analytics.php failed, falling back to inventory-based analytics', err);
      loadFromInventoryDeduction(period);
    })
    .finally(() => { isLoading = false; });
}

function loadFromInventoryDeduction(period) {
  if (isLoading) return;
  isLoading = true;
  const fallbackUrl = `../backend/api/fallback.php?period=${encodeURIComponent(period)}`;
  const chain = fetch(fallbackUrl)
    .then(r => {
      if (!r.ok) throw new Error('Fallback network response not ok');
      return r.json();
    })
    .then(data => renderRealData(data))
    .catch(() => {
      const errorDiv = document.getElementById('errorMessage');
      errorDiv.textContent = 'No sales data available. Please import sales data or check backend connectivity.';
      errorDiv.style.display = 'block';
      document.getElementById('metrics').innerHTML = '';
    })
    .finally(() => { isLoading = false; });
  return chain;
}

function ensureArrayLabelsDatasets(obj) {
  // normalize both analytics.php and fallback.php shapes
  if (!obj) return { labels: [], datasets: [{ data: [] }] };
  if (Array.isArray(obj)) {
    // array of {title, quantity} → convert
    return { labels: obj.map(x => x.title || ''), datasets: [{ data: obj.map(x => x.quantity || 0) }] };
  }
  if (obj.labels && obj.datasets) return obj;
  // try to interpret keyed object
  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    const vals = keys.map(k => obj[k]);
    return { labels: keys, datasets: [{ data: vals }] };
  }
  return { labels: [], datasets: [{ data: [] }] };
}

function renderRealData(data) {
  const metricsDiv = document.getElementById('metrics');
  const slowMovingList = document.getElementById('slowMoving');
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.style.display = 'none';

  console.debug('Rendering analytics:', data);
  // Metrics
  const totalItems = data.totalItems ?? 0;
  const totalValue = data.totalValue ?? 0;
  const inStock = data.inStock ?? 0;
  const outOfStock = data.outOfStock ?? 0;
  const lowStock = data.lowStockAlerts ?? 0;

  metricsDiv.innerHTML = '';
  const cards = [
    { title: 'Total Items', value: totalItems },
    { title: 'Total Value', value: `$${Number(totalValue).toFixed(2)}` },
    { title: 'In Stock', value: inStock },
    { title: 'Out Of Stock', value: outOfStock },
    { title: 'Low Stock Alerts', value: lowStock }
  ];

  cards.forEach(c => {
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.innerHTML = `<h3>${c.title}</h3><div class="value">${c.value}</div>`;
    metricsDiv.appendChild(card);
  });

  // Charts
  // Top sellers
  const top = ensureArrayLabelsDatasets(data.topSellers || data.top_sellers || []);
  console.debug('Top sellers labels:', top.labels.length, 'data:', top.datasets[0].data);
  createBarChart('topChart', top.labels, top.datasets[0].data || [], 'Quantity Sold', 'rgba(28, 200, 138, 0.8)');

  // Grade sales
  const grade = ensureArrayLabelsDatasets(data.gradeSales || data.grade_sales || []);
  console.debug('Grade labels:', grade.labels.length, 'data:', grade.datasets[0].data);
  // Use a larger height for doughnut charts so they are more prominent
  const largeDoughnutHeight = Math.max(320, Math.floor(window.innerHeight * 0.42));
  createDoughnutChart('gradeChart', grade.labels, grade.datasets[0].data || [], 'Sales by Grade', largeDoughnutHeight);

  // Subject sales
  const subject = ensureArrayLabelsDatasets(data.subjectSales || data.subject_sales || []);
  console.debug('Subject labels:', subject.labels.length, 'data:', subject.datasets[0].data);
  // Use same larger height for subject doughnut so it's visually balanced with grade chart
  createDoughnutChart('subjectChart', subject.labels, subject.datasets[0].data || [], 'Sales by Subject', largeDoughnutHeight);

  // Slow moving
  slowMovingList.innerHTML = '';
  const slow = data.slowMoving || data.slow_moving || [];
  if (Array.isArray(slow) && slow.length > 0) {
    slow.forEach(item => {
      const li = document.createElement('li');
      const title = item.title || item.name || 'Unknown';
      const qty = item.quantity ?? item.qty ?? 0;
      li.textContent = `${title} — ${qty} in stock`;
      slowMovingList.appendChild(li);
    });
  } else {
    const li = document.createElement('li');
    li.textContent = 'No slow-moving items detected';
    slowMovingList.appendChild(li);
  }
}

function createBarChart(canvasId, labels, dataPoints, labelText, bgColor) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  prepareCanvas(canvasId);
  const ctx = canvas.getContext('2d');
  // Precompute wrapped labels (Chart.js supports multi-line labels by returning arrays)
  const wrapLabel = (s, maxLen = 30) => {
    try {
      const str = String(s || '');
      if (str.length <= maxLen) return [str];
      const words = str.split(' ');
      const lines = [];
      let line = '';
      words.forEach(w => {
        if ((line + ' ' + w).trim().length <= maxLen) {
          line = (line + ' ' + w).trim();
        } else {
          if (line) lines.push(line);
          line = w;
        }
      });
      if (line) lines.push(line);
      return lines;
    } catch (e) {
      return [String(s)];
    }
  };
  const wrappedLabels = labels.map(l => wrapLabel(l, 30));
  const maxLines = wrappedLabels.reduce((m, a) => Math.max(m, Array.isArray(a) ? a.length : 1), 1);
  const bottomPadding = Math.min(220, Math.max(28, 16 * maxLines + 8));
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: labelText,
        data: dataPoints,
        backgroundColor: Array.isArray(bgColor) ? bgColor : bgColor,
        borderColor: Array.isArray(bgColor) ? bgColor : bgColor,
        borderWidth: 1
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      animation: false,
      animations: { tension: { duration: 0 } },
      hover: { animationDuration: 0 },
      plugins: {
        legend: { display: false },
        filler: { propagate: true }
      },
      interaction: { intersect: false, mode: 'index' },
      layout: { padding: { left: 12, right: 12, top: 8, bottom: bottomPadding } },
      scales: {
        x: {
          // force labels to come from chart.data.labels and wrap them for readability
          ticks: {
            padding: 8,
            maxRotation: 0,
            minRotation: 0,
            autoSkip: false,
            callback: function(_, index) {
              try {
                return wrappedLabels[index] || (this.chart.data.labels && [this.chart.data.labels[index]] ) || [''];
              } catch (e) { return ['']; }
            }
          },
          grid: { display: false },
          // prevent bars touching edges
          offset: true
        },
        y: {
          beginAtZero: true,
          ticks: { padding: 6 }
        }
      },
      datasets: {
        bar: { maxBarThickness: 48, barPercentage: 0.7, categoryPercentage: 0.8 }
      },
      events: []
    }
  });
}

function createDoughnutChart(canvasId, labels, dataPoints, labelText, heightOverride) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  prepareCanvas(canvasId, heightOverride);
  const ctx = canvas.getContext('2d');
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        label: labelText,
        data: dataPoints,
        backgroundColor: generatePalette(dataPoints.length),
        borderColor: '#1f2a44',
        borderWidth: 1
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      animation: false,
      animations: { tension: { duration: 0 } },
      hover: { animationDuration: 0 },
      plugins: {
        legend: { position: 'right', display: true },
        tooltip: { padding: 8 }
      },
      layout: { padding: { left: 8, right: 8, top: 8, bottom: 8 } },
      cutout: '45%',
      interaction: { intersect: false },
      events: []
    }
  });
}

// Diagnostics: fetch both analytics endpoints and show headers + JSON
function runDiagnostics() {
  const endpoints = [
    { name: 'analytics', url: `../backend/api/analytics.php?action=analytics&period=${encodeURIComponent(document.getElementById('period').value)}` },
    { name: 'fallback', url: `../backend/api/fallback.php?period=${encodeURIComponent(document.getElementById('period').value)}` }
  ];

  const resultsDiv = document.getElementById('diagResults');
  resultsDiv.textContent = 'Running diagnostics...';

  Promise.all(endpoints.map(ep => fetch(ep.url).then(async r => {
    const status = r.status;
    let bodyText = '';
    try { bodyText = await r.text(); } catch (e) { bodyText = ''; }
    return { name: ep.name, url: ep.url, status, rawBody: bodyText };
  }).catch(err => ({ name: ep.name, url: ep.url, status: 'network-error', rawBody: '' })) )).then(resArr => {
    // Render a concise summary only
    resultsDiv.innerHTML = '';
    resArr.forEach(r => {
      const title = document.createElement('div');
      title.style.fontWeight = '700';
      title.style.marginBottom = '6px';
      title.textContent = `${r.name.toUpperCase()} — ${r.status}`;
      resultsDiv.appendChild(title);

      let parsed = null;
      try { parsed = JSON.parse(r.rawBody); } catch (e) { parsed = null; }

      if (parsed) {
        // Metrics line
        if (parsed.totalItems !== undefined || parsed.totalValue !== undefined) {
          const m = document.createElement('div');
          m.textContent = `Metrics: Total Items: ${parsed.totalItems ?? '-'}   Total Value: $${Number(parsed.totalValue ?? 0).toFixed(2)}   In Stock: ${parsed.inStock ?? '-'}   Out: ${parsed.outOfStock ?? '-'} `;
          m.style.marginBottom = '6px';
          resultsDiv.appendChild(m);
        }

        // Top sellers
        if (parsed.topSellers) {
          const ts = parsed.topSellers.labels ? parsed.topSellers : parsed.top_sellers || parsed.topSellers;
          const labels = ts.labels || [];
          const data = (ts.datasets && ts.datasets[0] && ts.datasets[0].data) || [];
          if (labels.length) {
            const header = document.createElement('div'); header.textContent = 'Top Sellers:'; header.style.fontWeight = '600'; header.style.marginTop = '6px'; resultsDiv.appendChild(header);
            const ol = document.createElement('ol'); ol.style.margin = '6px 0 8px 18px';
            for (let i = 0; i < labels.length && i < 10; i++) {
              const li = document.createElement('li'); li.textContent = `${labels[i]} — ${data[i] ?? 0}`; li.style.fontSize = '13px'; ol.appendChild(li);
            }
            resultsDiv.appendChild(ol);
          }
        }

        // Grade and subject
        if (parsed.gradeSales) {
          const gLabels = parsed.gradeSales.labels || [];
          const gData = (parsed.gradeSales.datasets && parsed.gradeSales.datasets[0] && parsed.gradeSales.datasets[0].data) || [];
          const gd = document.createElement('div'); gd.textContent = 'Grade breakdown: ' + gLabels.map((lab,i) => `${lab}: ${gData[i] ?? 0}`).join(' | '); gd.style.marginBottom = '6px'; resultsDiv.appendChild(gd);
        }
        if (parsed.subjectSales) {
          const sLabels = parsed.subjectSales.labels || [];
          const sData = (parsed.subjectSales.datasets && parsed.subjectSales.datasets[0] && parsed.subjectSales.datasets[0].data) || [];
          const sd = document.createElement('div'); sd.textContent = 'Subject breakdown: ' + sLabels.map((lab,i) => `${lab}: ${sData[i] ?? 0}`).join(' | '); sd.style.marginBottom = '6px'; resultsDiv.appendChild(sd);
        }
      } else {
        const nojson = document.createElement('div'); nojson.textContent = '(response not JSON)'; nojson.style.opacity = '0.85'; resultsDiv.appendChild(nojson);
      }

      // small spacer
      const spacer = document.createElement('div'); spacer.style.height = '8px'; resultsDiv.appendChild(spacer);
    });

  }).catch(e => {
    resultsDiv.textContent = 'Diagnostics failed: ' + e;
  });
}

function prepareCanvas(canvasId, heightOverride) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const container = canvas.parentElement;
  
  // Compute fixed height based on container; do NOT use responsive width/height to avoid resize loops
  let height = container.clientHeight;
  // Allow explicit override for small charts (e.g., doughnuts)
  if (heightOverride && Number.isFinite(heightOverride)) {
    height = heightOverride;
  }
  if (!height || height < 100) {
    // compute 45vh in pixels as fallback
    height = Math.max(window.innerHeight * 0.45, 260);
  }
  
  // Leave some padding for title and chart padding
  const padding = 60;
  const canvasHeight = Math.max(160, Math.floor(height - padding));
  
  // Set fixed CSS size (do NOT set style.width to 100% as it triggers responsive resize loops)
  // Calculate available width subtracting container paddings/borders so canvas doesn't overflow
  const cs = window.getComputedStyle(container);
  const paddingLeft = parseFloat(cs.paddingLeft) || 0;
  const paddingRight = parseFloat(cs.paddingRight) || 0;
  const borderLeft = parseFloat(cs.borderLeftWidth) || 0;
  const borderRight = parseFloat(cs.borderRightWidth) || 0;
  const containerWidth = Math.max(320, Math.floor(container.clientWidth - paddingLeft - paddingRight - borderLeft - borderRight));
  // leave a small gap for layout padding so chart elements don't touch border
  const layoutGap = 24;
  const canvasCssWidth = Math.max(300, containerWidth - layoutGap);
  canvas.style.height = canvasHeight + 'px';
  canvas.style.width = canvasCssWidth + 'px';
  
  // Set drawing buffer in device pixels
  const dpr = window.devicePixelRatio || 1;
  // Set backing store size (actual pixels)
  canvas.height = Math.floor(canvasHeight * dpr);
  canvas.width = Math.floor(canvasCssWidth * dpr);

  // Ensure CSS box-sizing doesn't cause visual mismatch
  canvas.style.boxSizing = 'content-box';

  // Scale the drawing context so 1 unit = 1 CSS pixel.
  // Use setTransform to reset any previous transform and apply DPR scaling.
  try {
    const ctx = canvas.getContext('2d');
    if (ctx && ctx.setTransform) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  } catch (e) {
    // ignore if context transform not supported
  }
}

function generatePalette(n) {
  const base = [
    'rgba(54, 162, 235, 0.85)',
    'rgba(255, 159, 64, 0.85)',
    'rgba(255, 99, 132, 0.85)',
    'rgba(75, 192, 192, 0.85)',
    'rgba(153, 102, 255, 0.85)',
    'rgba(201, 203, 207, 0.85)'
  ];
  const out = [];
  for (let i = 0; i < n; i++) out.push(base[i % base.length]);
  return out;
}

// Initialize on DOM ready: load analytics and bind buttons (single listener, no duplicates)
window.addEventListener('DOMContentLoaded', async () => {
  // Check authentication first
  const user = await checkAuth();
  if (!user) {
    console.log('[ANALYTICS] User not authenticated, redirecting to login');
    window.location.href = '/Book-Express/frontend/login.html';
    return;
  }
  
  console.log('[ANALYTICS] DOMContentLoaded fired. Current URL:', window.location.href);

  // Log page load server-side for diagnosis (non-blocking)
  try {
    fetch('../backend/api/track_hit.php?event=analytics_page_load').catch(() => {});
  } catch (e) {
    // swallow
  }
  
  // Bind diagnostics button
  const diagBtn = document.getElementById('runDiagnosticsBtn');
  if (diagBtn) diagBtn.addEventListener('click', runDiagnostics);
  
  // Load analytics on page open
  loadAnalytics();
});