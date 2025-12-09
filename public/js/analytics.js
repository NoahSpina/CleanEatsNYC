// Analytics Dashboard JavaScript

let yearlyViolationsChart = null;
let commonViolationsChart = null;
let scoreTrendChart = null;

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    loadRatingsAnalytics();
    loadViolationAnalytics();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    const applyFiltersBtn = document.getElementById('applyFilters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', function() {
            loadRatingsAnalytics();
        });
    }
}

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
        
        // Populate filter dropdowns if they're empty
        populateFilters(result.filters);
        
        if (result.hasData && result.data.length > 0) {
            // Create ratings table
            createRatingsTable(result.data);
        } else {
            // Show no data message
            showNoDataMessage('ratingsTableContainer', 'No ratings data available. Reviews are needed to generate analytics.');
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
            option.value = sanitizeText(borough);
            option.textContent = sanitizeText(borough);
            boroughSelect.appendChild(option);
        });
    }
    
    if (cuisineSelect && cuisineSelect.children.length === 1) {
        filters.cuisines.forEach(cuisine => {
            const option = document.createElement('option');
            option.value = sanitizeText(cuisine);
            option.textContent = sanitizeText(cuisine);
            cuisineSelect.appendChild(option);
        });
    }
}


// Create ratings table
function createRatingsTable(data) {
    const container = document.getElementById('ratingsTableContainer');
    if (!container) return;
    
    if (data.length === 0) {
        container.innerHTML = '<p>No ratings data available for the selected filters.</p>';
        return;
    }
    
    // Create table wrapper for better styling
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'table-wrapper';
    
    const table = document.createElement('table');
    table.className = 'ratings-table sortable-table';
    table.id = 'ratingsTable';
    
    // Create header
    const header = table.createTHead();
    const headerRow = header.insertRow();
    
    const columns = [
        { key: 'restaurantName', label: 'Restaurant Name', sortable: true },
        { key: 'avgRating', label: 'Avg Rating', sortable: true },
        { key: 'totalReviews', label: 'Total Reviews', sortable: true },
        { key: 'latestGrade', label: 'Latest Grade', sortable: true },
        { key: 'latestInspectionDate', label: 'Latest Inspection', sortable: true },
        { key: 'borough', label: 'Borough', sortable: true },
        { key: 'cuisine', label: 'Cuisine', sortable: true }
    ];
    
    columns.forEach((col, index) => {
        const th = document.createElement('th');
        th.textContent = col.label;
        th.className = col.sortable ? 'sortable' : '';
        th.dataset.column = col.key;
        th.dataset.sort = 'none';
        
        if (col.sortable) {
            th.style.cursor = 'pointer';
            th.addEventListener('click', () => sortTable(index, col.key));
        }
        
        headerRow.appendChild(th);
    });
    
    // Create body
    const tbody = table.createTBody();
    tbody.id = 'ratingsTableBody';
    
    // Populate table with data
    populateTableRows(tbody, data);
    
    tableWrapper.appendChild(table);
    container.innerHTML = '';
    container.appendChild(tableWrapper);
}

// Populate table rows
function populateTableRows(tbody, data) {
    tbody.innerHTML = '';
    
    data.forEach(restaurant => {
        const row = tbody.insertRow();
        
        // Restaurant name
        const nameCell = row.insertCell();
        nameCell.textContent = sanitizeText(restaurant.restaurantName);
        nameCell.className = 'restaurant-name';
        
        // Average rating
        const ratingCell = row.insertCell();
        const ratingBadge = document.createElement('span');
        ratingBadge.className = `rating-badge ${getRatingClass(restaurant.avgRating)}`;
        ratingBadge.textContent = restaurant.avgRating.toFixed(1);
        ratingCell.appendChild(ratingBadge);
        ratingCell.dataset.value = restaurant.avgRating;
        
        // Total reviews
        const reviewsCell = row.insertCell();
        reviewsCell.textContent = restaurant.totalReviews;
        reviewsCell.dataset.value = restaurant.totalReviews;
        
        // Latest grade
        const gradeCell = row.insertCell();
        const gradeBadge = document.createElement('span');
        gradeBadge.className = `grade-badge grade-${(restaurant.latestGrade || 'N/A').toLowerCase()}`;
        gradeBadge.textContent = restaurant.latestGrade || 'N/A';
        gradeCell.appendChild(gradeBadge);
        gradeCell.dataset.value = restaurant.latestGrade || 'Z'; // Z for sorting N/A to end
        
        // Latest inspection date
        const dateCell = row.insertCell();
        if (restaurant.latestInspectionDate) {
            const date = new Date(restaurant.latestInspectionDate);
            dateCell.textContent = date.toLocaleDateString();
            dateCell.dataset.value = date.getTime();
        } else {
            dateCell.textContent = 'N/A';
            dateCell.dataset.value = 0;
        }
        
        // Borough
        const boroughCell = row.insertCell();
        boroughCell.textContent = sanitizeText(restaurant.borough);
        
        // Cuisine
        const cuisineCell = row.insertCell();
        cuisineCell.textContent = sanitizeText(restaurant.cuisine);
    });
}

// Sort table function
function sortTable(columnIndex, columnKey) {
    const table = document.getElementById('ratingsTable');
    const tbody = document.getElementById('ratingsTableBody');
    const header = table.querySelector('th[data-column="' + columnKey + '"]');
    
    if (!tbody || !header) return;
    
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const currentSort = header.dataset.sort;
    const newSort = currentSort === 'asc' ? 'desc' : 'asc';
    
    // Clear all sort indicators
    table.querySelectorAll('th[data-sort]').forEach(th => {
        th.dataset.sort = 'none';
        th.classList.remove('sort-asc', 'sort-desc');
    });
    
    // Set new sort indicator
    header.dataset.sort = newSort;
    header.classList.add(`sort-${newSort}`);
    
    // Sort rows
    rows.sort((a, b) => {
        const aCell = a.cells[columnIndex];
        const bCell = b.cells[columnIndex];
        
        let aValue, bValue;
        
        // Use data-value if available, otherwise use text content
        if (aCell.dataset.value !== undefined) {
            aValue = isNaN(aCell.dataset.value) ? aCell.dataset.value : parseFloat(aCell.dataset.value);
            bValue = isNaN(bCell.dataset.value) ? bCell.dataset.value : parseFloat(bCell.dataset.value);
        } else {
            aValue = aCell.textContent.trim();
            bValue = bCell.textContent.trim();
        }
        
        let comparison = 0;
        if (aValue < bValue) comparison = -1;
        if (aValue > bValue) comparison = 1;
        
        return newSort === 'asc' ? comparison : -comparison;
    });
    
    // Re-append sorted rows
    rows.forEach(row => tbody.appendChild(row));
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
                borderColor: 'rgba(231, 76, 60, 1)',
                backgroundColor: 'rgba(231, 76, 60, 0.1)',
                borderWidth: 2,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Violations'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Year'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
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
            labels: data.map(item => sanitizeText(item.code)),
            datasets: [{
                label: 'Violation Count',
                data: data.map(item => item.count),
                backgroundColor: 'rgba(230, 126, 34, 0.8)',
                borderColor: 'rgba(230, 126, 34, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Violations'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const item = data[context.dataIndex];
                            return `Description: ${sanitizeText(item.description)}`;
                        }
                    }
                }
            }
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
    
    // Group by year and calculate yearly averages
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
                borderColor: 'rgba(155, 89, 182, 1)',
                backgroundColor: 'rgba(155, 89, 182, 0.1)',
                borderWidth: 2,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Average Inspection Score'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Year'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Create grade trend display
function createGradeTrend(data) {
    const container = document.getElementById('gradeTrendContainer');
    if (!container) return;
    
    if (data.length === 0) {
        container.innerHTML = '<p>No grade trend data available.</p>';
        return;
    }
    
    const timeline = document.createElement('div');
    timeline.className = 'grade-timeline';
    
    data.forEach(yearData => {
        const yearDiv = document.createElement('div');
        yearDiv.className = 'grade-year';
        
        const yearTitle = document.createElement('h4');
        yearTitle.textContent = yearData.year;
        yearDiv.appendChild(yearTitle);
        
        const totalText = document.createElement('p');
        totalText.textContent = `Total Inspections: ${yearData.total}`;
        totalText.style.fontSize = '0.9rem';
        totalText.style.color = '#7f8c8d';
        yearDiv.appendChild(totalText);
        
        const badgesDiv = document.createElement('div');
        badgesDiv.className = 'grade-badges';
        
        ['A', 'B', 'C'].forEach(grade => {
            const badge = document.createElement('div');
            badge.className = `grade-badge grade-${grade.toLowerCase()}`;
            badge.textContent = `${grade}: ${yearData.grades[grade]}%`;
            badgesDiv.appendChild(badge);
        });
        
        yearDiv.appendChild(badgesDiv);
        timeline.appendChild(yearDiv);
    });
    
    container.innerHTML = '';
    container.appendChild(timeline);
}

// Helper functions
function getRatingClass(rating) {
    if (rating >= 4.5) return 'rating-excellent';
    if (rating >= 3.5) return 'rating-good';
    if (rating >= 2.5) return 'rating-fair';
    return 'rating-poor';
}

function sanitizeText(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoading(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<div class="loading">${sanitizeText(message)}</div>`;
    }
}

function showError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<div class="error-message">${sanitizeText(message)}</div>`;
    }
}

function showNoDataMessage(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<div class="no-data-message">${sanitizeText(message)}</div>`;
    }
}

