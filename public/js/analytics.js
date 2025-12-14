let charts = { yearly: null, common: null, score: null, borough: null, cuisine: null, comments: null };

document.addEventListener('DOMContentLoaded', () => {
    loadRatingsAnalytics();
    loadRatingsBreakdown();
    loadViolationAnalytics();
    loadCommentAnalytics();
    
    document.getElementById('applyFilters')?.addEventListener('click', () => {
        loadRatingsAnalytics();
        loadRatingsBreakdown();
        loadViolationAnalytics();
        loadCommentAnalytics();
    });
});

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
            showMessage('ratingsTableContainer', 'No ratings data available for selected filters.');
        }
    } catch (error) {
        console.error('Ratings error:', error);
        showMessage('ratingsTableContainer', 'Failed to load ratings: ' + error.message, 'error');
    }
}

async function loadViolationAnalytics() {
    try {
        showLoading('gradeTrendContainer', 'Loading violations...');
        const borough = document.getElementById('boroughFilter')?.value || '';
        const cuisine = document.getElementById('cuisineFilter')?.value || '';
        const params = new URLSearchParams();
        if (borough) params.append('borough', borough);
        if (cuisine) params.append('cuisine', cuisine);

        const res = await fetch(`/analytics/violations?${params}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Failed to load violations');

        const { yearlyViolations, commonViolations, scoreTrend, gradeTrend } = result.data;
        
        if (yearlyViolations.length > 0) {
            createChart('yearlyViolationsChart', 'line', yearlyViolations.map(d => d.year), yearlyViolations.map(d => d.violations), 'Total Violations', '#e74c3c', 'yearly');
        }
        if (commonViolations.length > 0) {
            createChart('commonViolationsChart', 'bar', commonViolations.map(d => d.code), commonViolations.map(d => d.count), 'Violations', '#e67e22', 'common', true);
        }
        if (scoreTrend.length > 0) {
            createScoreChart(scoreTrend);
        }
        if (gradeTrend.length > 0) {
            createGradeTrend(gradeTrend);
        }
    } catch (error) {
        console.error('Violations error:', error);
        showMessage('gradeTrendContainer', 'Failed to load violations: ' + error.message, 'error');
    }
}

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

function createChart(id, type, labels, data, label, color, chartKey, horizontal = false, isRatingChart = false) {
    const ctx = document.getElementById(id);
    if (!ctx || !data || data.length === 0) return;

    if (charts[chartKey]) charts[chartKey].destroy();

    const isBarChart = type === 'bar';
    const maxValue = Math.max(...data.filter(d => typeof d === 'number'), isRatingChart ? 5 : undefined);
    const numericData = data.map(d => typeof d === 'number' ? d : parseFloat(d) || 0);

    charts[chartKey] = new Chart(ctx, {
        type,
        data: {
            labels,
            datasets: [{
                label,
                data: numericData,
                borderColor: color,
                backgroundColor: isBarChart ? color : `${color}33`,
                borderWidth: isBarChart ? 0 : 2,
                fill: type === 'line',
                borderRadius: isBarChart ? 4 : 0,
                barThickness: horizontal ? 'flex' : undefined
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: horizontal ? 'y' : 'x',
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed[horizontal ? 'x' : 'y'];
                            return `${label}: ${typeof value === 'number' ? value.toFixed(2) : value}`;
                        }
                    }
                }
            },
            scales: {
                [horizontal ? 'x' : 'y']: {
                    beginAtZero: !isRatingChart,
                    min: isRatingChart && isBarChart ? 2.5 : undefined,
                    max: isRatingChart && isBarChart && maxValue <= 5 ? 5 : undefined,
                    ticks: {
                        precision: isRatingChart ? 2 : 0,
                        stepSize: isRatingChart ? 0.1 : undefined
                    }
                },
                [horizontal ? 'y' : 'x']: {
                    ticks: {
                        maxRotation: horizontal ? 0 : 45,
                        minRotation: horizontal ? 0 : 45
                    }
                }
            }
        }
    });
}

function createScoreChart(data) {
    if (!data || data.length === 0) return;
    
    const yearly = {};
    data.forEach(d => {
        if (!yearly[d.year]) yearly[d.year] = { total: 0, count: 0 };
        yearly[d.year].total += d.avgScore * d.count;
        yearly[d.year].count += d.count;
    });

    const chartData = Object.keys(yearly)
        .map(year => ({ year: +year, avg: yearly[year].total / yearly[year].count }))
        .sort((a, b) => a.year - b.year);

    if (chartData.length > 0) {
        createChart('scoreTrendChart', 'line', chartData.map(d => d.year), chartData.map(d => d.avg), 'Avg Score', '#9b59b6', 'score');
    }
}

function createGradeTrend(data) {
    const container = document.getElementById('gradeTrendContainer');
    if (!container || data.length === 0) {
        if (container) container.innerHTML = '<p class="no-data-message">No grade trend data available for selected filters.</p>';
        return;
    }

    const sortedData = [...data].sort((a, b) => b.year - a.year);
    let html = '<div class="grade-trend-grid">';
    sortedData.forEach(d => {
        html += `<div class="grade-trend-card">`;
        html += `<div class="grade-trend-year">${d.year}</div>`;
        html += `<div class="grade-trend-total">Total: ${d.total.toLocaleString()}</div>`;
        html += `<div class="grade-trend-badges">`;
        html += `<span class="grade-badge grade-a">A: ${d.grades.A || 0}%</span>`;
        html += `<span class="grade-badge grade-b">B: ${d.grades.B || 0}%</span>`;
        html += `<span class="grade-badge grade-c">C: ${d.grades.C || 0}%</span>`;
        html += `</div></div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

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

async function loadRatingsBreakdown() {
    try {
        const borough = document.getElementById('boroughFilter')?.value || '';
        const cuisine = document.getElementById('cuisineFilter')?.value || '';
        const params = new URLSearchParams();
        if (borough) params.append('borough', borough);
        if (cuisine) params.append('cuisine', cuisine);

        const res = await fetch(`/analytics/ratings-breakdown?${params}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Failed to load breakdown');

        const { byBorough, byCuisine } = result.data;
        const boroughContainer = document.querySelector('#boroughRatingsChart')?.parentElement || document.querySelector('.breakdown-grid')?.children[0];
        const cuisineContainer = document.querySelector('#cuisineRatingsChart')?.parentElement || document.querySelector('.breakdown-grid')?.children[1];

        if (byBorough && byBorough.length > 0) {
            if (!document.getElementById('boroughRatingsChart') && boroughContainer) {
                boroughContainer.innerHTML = '<h4>Average Rating by Borough</h4><canvas id="boroughRatingsChart"></canvas>';
            }
            setTimeout(() => {
                const ctx = document.getElementById('boroughRatingsChart');
                if (ctx) createChart('boroughRatingsChart', 'bar', byBorough.map(d => d.borough), byBorough.map(d => d.avgRating), 'Average Rating', '#3498db', 'borough', true, true);
            }, 100);
        } else if (boroughContainer) {
            boroughContainer.innerHTML = '<h4>Average Rating by Borough</h4><p class="no-data-message">No borough data available.</p>';
        }

        if (byCuisine && byCuisine.length > 0) {
            if (!document.getElementById('cuisineRatingsChart') && cuisineContainer) {
                cuisineContainer.innerHTML = '<h4>Average Rating by Cuisine (Top 15)</h4><canvas id="cuisineRatingsChart"></canvas>';
            }
            setTimeout(() => {
                const ctx = document.getElementById('cuisineRatingsChart');
                if (ctx) createChart('cuisineRatingsChart', 'bar', byCuisine.map(d => d.cuisine), byCuisine.map(d => d.avgRating), 'Average Rating', '#9b59b6', 'cuisine', true, true);
            }, 150);
        } else if (cuisineContainer) {
            cuisineContainer.innerHTML = '<h4>Average Rating by Cuisine (Top 15)</h4><p class="no-data-message">No cuisine data available.</p>';
        }
    } catch (error) {
        console.error('Breakdown error:', error);
        const boroughContainer = document.querySelector('#boroughRatingsChart')?.parentElement || document.querySelector('.breakdown-grid')?.children[0];
        const cuisineContainer = document.querySelector('#cuisineRatingsChart')?.parentElement || document.querySelector('.breakdown-grid')?.children[1];
        if (boroughContainer) boroughContainer.innerHTML = '<h4>Average Rating by Borough</h4><p class="error-message">Failed to load borough data.</p>';
        if (cuisineContainer) cuisineContainer.innerHTML = '<h4>Average Rating by Cuisine (Top 15)</h4><p class="error-message">Failed to load cuisine data.</p>';
    }
}

async function loadCommentAnalytics() {
    try {
        const container = document.getElementById('commentsContainer');
        if (!container) return;

        const borough = document.getElementById('boroughFilter')?.value || '';
        const cuisine = document.getElementById('cuisineFilter')?.value || '';
        const params = new URLSearchParams();
        if (borough) params.append('borough', borough);
        if (cuisine) params.append('cuisine', cuisine);

        const res = await fetch(`/analytics/comments?${params}`);
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Server returned non-JSON response');
        }
        
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Failed to load comments');

        const totalComments = result.data?.totalComments || 0;
        if (totalComments === 0) {
            container.innerHTML = '<p class="no-data-message">No comment data available yet.</p>';
            return;
        }

        const { commentsPerReview, commentsOverTime } = result.data || {};
        let html = '<div class="comments-stats">';
        html += `<p><strong>Total Comments:</strong> ${totalComments.toLocaleString()}</p>`;
        
        if (commentsPerReview) {
            html += `<p><strong>Average Comments per Review:</strong> ${commentsPerReview.avg.toFixed(2)}</p>`;
            html += `<p><strong>Max Comments on a Review:</strong> ${commentsPerReview.max}</p>`;
        }

        if (commentsOverTime.length > 0) {
            html += '<h3>Comments Over Time</h3>';
            html += '<div class="chart-item" style="height: 400px;"><canvas id="commentsOverTimeChart"></canvas></div>';
        }

        html += '</div>';
        
        if (charts.comments) {
            charts.comments.destroy();
            delete charts.comments;
        }
        
        container.innerHTML = html;

        if (commentsOverTime.length > 0) {
            const yearly = {};
            commentsOverTime.forEach(d => {
                if (!yearly[d.year]) yearly[d.year] = 0;
                yearly[d.year] += d.count;
            });

            const chartData = Object.keys(yearly)
                .map(year => ({ year: +year, count: yearly[year] }))
                .sort((a, b) => a.year - b.year);

            setTimeout(() => {
                const canvas = document.getElementById('commentsOverTimeChart');
                if (canvas) {
                    createChart('commentsOverTimeChart', 'line', chartData.map(d => d.year), chartData.map(d => d.count), 'Comments', '#e74c3c', 'comments');
                }
            }, 150);
        }
    } catch (error) {
        console.error('Comments error:', error);
        showMessage('commentsContainer', 'Failed to load comment analytics: ' + error.message, 'error');
    }
}
