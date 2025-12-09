// Analytics Dashboard
let charts = { yearly: null, common: null, score: null };

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadRatingsAnalytics();
    loadViolationAnalytics();
    document.getElementById('applyFilters')?.addEventListener('click', loadRatingsAnalytics);
});

// Load ratings data
async function loadRatingsAnalytics() {
    try {
        showLoading('ratingsTableContainer', 'Loading ratings...');

        const borough = document.getElementById('boroughFilter')?.value || '';
        const cuisine = document.getElementById('cuisineFilter')?.value || '';
        const params = new URLSearchParams();
        if (borough) params.append('borough', borough);
        if (cuisine) params.append('cuisine', cuisine);

        const res = await fetch(`/analytics/ratings?${params}`);
        const result = await res.json();

        if (!result.success) throw new Error(result.error || 'Failed to load ratings');

        populateFilters(result.filters);
        
        if (result.hasData && result.data.length > 0) {
            createRatingsTable(result.data);
        } else {
            showMessage('ratingsTableContainer', 'No ratings data available.');
        }
    } catch (error) {
        console.error('Ratings error:', error);
        showMessage('ratingsTableContainer', 'Failed to load ratings: ' + error.message, 'error');
    }
}

// Load violation data
async function loadViolationAnalytics() {
    try {
        showLoading('gradeTrendContainer', 'Loading violations...');

        const res = await fetch('/analytics/violations');
        const result = await res.json();

        if (!result.success) throw new Error(result.error || 'Failed to load violations');

        const { yearlyViolations, commonViolations, scoreTrend, gradeTrend } = result.data;
        createChart('yearlyViolationsChart', 'line', yearlyViolations.map(d => d.year), yearlyViolations.map(d => d.violations), 'Total Violations', '#e74c3c', 'yearly');
        createChart('commonViolationsChart', 'bar', commonViolations.map(d => d.code), commonViolations.map(d => d.count), 'Violations', '#e67e22', 'common', true);
        createScoreChart(scoreTrend);
        createGradeTrend(gradeTrend);
    } catch (error) {
        console.error('Violations error:', error);
        showMessage('gradeTrendContainer', 'Failed to load violations: ' + error.message, 'error');
    }
}

// Populate filter dropdowns
function populateFilters(filters) {
    const boroughSelect = document.getElementById('boroughFilter');
    const cuisineSelect = document.getElementById('cuisineFilter');

    if (boroughSelect?.children.length === 1) {
        filters.boroughs.forEach(b => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = b;
            boroughSelect.appendChild(opt);
        });
    }

    if (cuisineSelect?.children.length === 1) {
        filters.cuisines.forEach(c => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = c;
            cuisineSelect.appendChild(opt);
        });
    }
}

// Create ratings table
function createRatingsTable(data) {
    const container = document.getElementById('ratingsTableContainer');
    if (!container) return;

    let html = '<table class="ratings-table"><thead><tr>';
    html += '<th>Restaurant</th><th>Rating</th><th>Reviews</th><th>Grade</th><th>Inspection</th><th>Borough</th><th>Cuisine</th>';
    html += '</tr></thead><tbody>';

    data.forEach(r => {
        html += '<tr>';
        html += `<td>${esc(r.restaurantName)}</td>`;
        html += `<td><span class="rating-badge ${getRatingClass(r.avgRating)}">${r.avgRating.toFixed(1)}</span></td>`;
        html += `<td>${r.totalReviews}</td>`;
        html += `<td><span class="grade-badge grade-${(r.latestGrade || 'n/a').toLowerCase()}">${r.latestGrade || 'N/A'}</span></td>`;
        html += `<td>${r.latestInspectionDate ? new Date(r.latestInspectionDate).toLocaleDateString() : 'N/A'}</td>`;
        html += `<td>${esc(r.borough)}</td>`;
        html += `<td>${esc(r.cuisine)}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// Create chart
function createChart(id, type, labels, data, label, color, chartKey, horizontal = false) {
    const ctx = document.getElementById(id);
    if (!ctx) return;

    if (charts[chartKey]) charts[chartKey].destroy();

    charts[chartKey] = new Chart(ctx, {
        type,
        data: {
            labels,
            datasets: [{
                label,
                data,
                borderColor: color,
                backgroundColor: type === 'line' ? `${color}33` : color,
                borderWidth: type === 'line' ? 2 : 1,
                fill: type === 'line'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: horizontal ? 'y' : 'x',
            plugins: { legend: { display: false } }
        }
    });
}

// Create score trend chart
function createScoreChart(data) {
    const yearly = {};
    data.forEach(d => {
        if (!yearly[d.year]) yearly[d.year] = { total: 0, count: 0 };
        yearly[d.year].total += d.avgScore * d.count;
        yearly[d.year].count += d.count;
    });

    const chartData = Object.keys(yearly)
        .map(year => ({ year: +year, avg: yearly[year].total / yearly[year].count }))
        .sort((a, b) => a.year - b.year);

    createChart('scoreTrendChart', 'line', chartData.map(d => d.year), chartData.map(d => d.avg), 'Avg Score', '#9b59b6', 'score');
}

// Create grade trend display
function createGradeTrend(data) {
    const container = document.getElementById('gradeTrendContainer');
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = '<p>No grade trend data.</p>';
        return;
    }

    let html = '<div style="display: flex; gap: 1rem; flex-wrap: wrap;">';
    data.forEach(d => {
        html += `<div style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 1rem; min-width: 150px; text-align: center;">`;
        html += `<h4>${d.year}</h4><p style="font-size: 0.9rem; color: #666;">Total: ${d.total}</p>`;
        html += `<div style="display: flex; justify-content: space-around; margin-top: 0.5rem;">`;
        html += `<span class="grade-badge grade-a">A: ${d.grades.A}%</span>`;
        html += `<span class="grade-badge grade-b">B: ${d.grades.B}%</span>`;
        html += `<span class="grade-badge grade-c">C: ${d.grades.C}%</span>`;
        html += `</div></div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

// Helpers
function getRatingClass(rating) {
    if (rating >= 4.5) return 'rating-excellent';
    if (rating >= 3.5) return 'rating-good';
    if (rating >= 2.5) return 'rating-fair';
    return 'rating-poor';
}

function esc(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoading(id, msg) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<div class="loading">${esc(msg)}</div>`;
}

function showMessage(id, msg, type = 'info') {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<div class="${type === 'error' ? 'error-message' : 'no-data-message'}">${esc(msg)}</div>`;
}