// Simple Analytics Dashboard JavaScript

let yearlyViolationsChart = null;
let commonViolationsChart = null;
let scoreTrendChart = null;

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    loadRatingsAnalytics();
    loadViolationAnalytics();
    
    // Setup filter button
    const applyFiltersBtn = document.getElementById('applyFilters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', loadRatingsAnalytics);
    }
});

// Load and display ratings analytics
async function loadRatingsAnalytics() {
    try {
        showLoading('ratingsTableContainer', 'Loading ratings data...');
        
        const borough = document.getElementById('boroughFilter')?.value || '';
        const cuisine = document.getElementById('cuisineFilter')?.value || '';
        
        const params = new URLSearchParams();
        if (borough) params.append('borough', borough);
        if (cuisine) params.append('cuisine', cuisine);
        
        const response = await fetch(`/analytics/ratings?${params.toString()}`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to load ratings data');
        }
        
        // Populate filter dropdowns
        populateFilters(result.filters);
        
        if (result.hasData && result.data.length > 0) {
            createRatingsTable(result.data);
        } else {
            showNoDataMessage('ratingsTableContainer', 'No ratings data available.');
        }
        
    } catch (error) {
        console.error('Error loading ratings analytics:', error);
        showError('ratingsTableContainer', 'Failed to load ratings data: ' + error.message);
    }
}

// Load and display violation analytics
async function loadViolationAnalytics() {
    try {
        showLoading('gradeTrendContainer', 'Loading violation data...');
        
        const response = await fetch('/analytics/violations');
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to load violation data');
        }
        
        const data = result.data;
        
        // Create violation charts
        createYearlyViolationsChart(data.yearlyViolations);
        createCommonViolationsChart(data.commonViolations);
        createScoreTrendChart(data.scoreTrend);
        createGradeTrend(data.gradeTrend);
        
    } catch (error) {
        console.error('Error loading violation analytics:', error);
        showError('gradeTrendContainer', 'Failed to load violation data: ' + error.message);
    }
}

// Populate filter dropdowns
function populateFilters(filters) {
    const boroughSelect = document.getElementById('boroughFilter');
    const cuisineSelect = document.getElementById('cuisineFilter');
    
    if (boroughSelect && boroughSelect.children.length === 1) {
        filters.boroughs.forEach(borough => {
            const option = document.createElement('option');
            option.value = borough;
            option.textContent = borough;
            boroughSelect.appendChild(option);
        });
    }
    
    if (cuisineSelect && cuisineSelect.children.length === 1) {
        filters.cuisines.forEach(cuisine => {
            const option = document.createElement('option');
            option.value = cuisine;
            option.textContent = cuisine;
            cuisineSelect.appendChild(option);
        });
    }
}

// Create simple ratings table
function createRatingsTable(data) {
    const container = document.getElementById('ratingsTableContainer');
    if (!container) return;
    
    if (data.length === 0) {
        container.innerHTML = '<p>No ratings data available for the selected filters.</p>';
        return;
    }
    
    let html = '<table class="ratings-table"><thead><tr>';
    html += '<th>Restaurant Name</th>';
    html += '<th>Avg Rating</th>';
    html += '<th>Total Reviews</th>';
    html += '<th>Latest Grade</th>';
    html += '<th>Latest Inspection</th>';
    html += '<th>Borough</th>';
    html += '<th>Cuisine</th>';
    html += '</tr></thead><tbody>';
    
    data.forEach(restaurant => {
        html += '<tr>';
        html += `<td>${escapeHtml(restaurant.restaurantName)}</td>`;
        html += `<td><span class="rating-badge ${getRatingClass(restaurant.avgRating)}">${restaurant.avgRating.toFixed(1)}</span></td>`;
        html += `<td>${restaurant.totalReviews}</td>`;
        html += `<td><span class="grade-badge grade-${(restaurant.latestGrade || 'n/a').toLowerCase()}">${restaurant.latestGrade || 'N/A'}</span></td>`;
        html += `<td>${restaurant.latestInspectionDate ? new Date(restaurant.latestInspectionDate).toLocaleDateString() : 'N/A'}</td>`;
        html += `<td>${escapeHtml(restaurant.borough)}</td>`;
        html += `<td>${escapeHtml(restaurant.cuisine)}</td>`;
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

// Create yearly violations chart
function createYearlyViolationsChart(data) {
    const ctx = document.getElementById('yearlyViolationsChart');
    if (!ctx) return;
    
    if (yearlyViolationsChart) {
        yearlyViolationsChart.destroy();
    }
    
    yearlyViolationsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(item => item.year),
            datasets: [{
                label: 'Total Violations',
                data: data.map(item => item.violations),
                borderColor: '#e74c3c',
                backgroundColor: 'rgba(231, 76, 60, 0.1)',
                borderWidth: 2,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

// Create common violations chart
function createCommonViolationsChart(data) {
    const ctx = document.getElementById('commonViolationsChart');
    if (!ctx) return;
    
    if (commonViolationsChart) {
        commonViolationsChart.destroy();
    }
    
    commonViolationsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(item => item.code),
            datasets: [{
                label: 'Violation Count',
                data: data.map(item => item.count),
                backgroundColor: '#e67e22',
                borderColor: '#d35400',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: { legend: { display: false } }
        }
    });
}

// Create score trend chart
function createScoreTrendChart(data) {
    const ctx = document.getElementById('scoreTrendChart');
    if (!ctx) return;
    
    if (scoreTrendChart) {
        scoreTrendChart.destroy();
    }
    
    // Simple yearly average
    const yearlyData = {};
    data.forEach(item => {
        if (!yearlyData[item.year]) {
            yearlyData[item.year] = { totalScore: 0, count: 0 };
        }
        yearlyData[item.year].totalScore += item.avgScore * item.count;
        yearlyData[item.year].count += item.count;
    });
    
    const chartData = Object.keys(yearlyData).map(year => ({
        year: parseInt(year),
        avgScore: yearlyData[year].totalScore / yearlyData[year].count
    })).sort((a, b) => a.year - b.year);
    
    scoreTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.map(item => item.year),
            datasets: [{
                label: 'Average Score',
                data: chartData.map(item => item.avgScore),
                borderColor: '#9b59b6',
                backgroundColor: 'rgba(155, 89, 182, 0.1)',
                borderWidth: 2,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

// Create simple grade trend display
function createGradeTrend(data) {
    const container = document.getElementById('gradeTrendContainer');
    if (!container) return;
    
    if (data.length === 0) {
        container.innerHTML = '<p>No grade trend data available.</p>';
        return;
    }
    
    let html = '<div style="display: flex; gap: 1rem; flex-wrap: wrap;">';
    
    data.forEach(yearData => {
        html += `<div style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 1rem; min-width: 150px; text-align: center;">`;
        html += `<h4>${yearData.year}</h4>`;
        html += `<p style="font-size: 0.9rem; color: #666;">Total: ${yearData.total}</p>`;
        html += `<div style="display: flex; justify-content: space-around; margin-top: 0.5rem;">`;
        html += `<span class="grade-badge grade-a">A: ${yearData.grades.A}%</span>`;
        html += `<span class="grade-badge grade-b">B: ${yearData.grades.B}%</span>`;
        html += `<span class="grade-badge grade-c">C: ${yearData.grades.C}%</span>`;
        html += `</div></div>`;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Helper functions
function getRatingClass(rating) {
    if (rating >= 4.5) return 'rating-excellent';
    if (rating >= 3.5) return 'rating-good';
    if (rating >= 2.5) return 'rating-fair';
    return 'rating-poor';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoading(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<div class="loading">${escapeHtml(message)}</div>`;
    }
}

function showError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<div class="error-message">${escapeHtml(message)}</div>`;
    }
}

function showNoDataMessage(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<div class="no-data-message">${escapeHtml(message)}</div>`;
    }
}