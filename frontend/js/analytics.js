// ==================== ANALYTICS MODULE ====================

let analyticsCharts = {
    stockStatus: null,
    stockByGrade: null
};

// Initialize analytics page
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupEventListeners();
    setupSidebarToggle();
    updateAnalytics();
});

// Setup event listeners
function setupEventListeners() {
    document.getElementById('timeRangeSelector').addEventListener('change', function() {
        if (this.value === 'custom') {
            document.getElementById('customDateRange').style.display = 'block';
        } else {
            document.getElementById('customDateRange').style.display = 'none';
        }
    });
}

// Update all analytics
function updateAnalytics() {
    loadStockStatus();
    loadStockByGrade();
}

// Refresh analytics
function refreshAnalytics() {
    updateAnalytics();
}

// 1. LOAD STOCK LEVEL BY GRADE LEVEL
function loadStockByGrade() {
    fetch(`../backend/api/dashboard/analytics.php?metric=stock_by_grade`)
        .then(async response => {
            const text = await response.text();
            try { return JSON.parse(text); } catch (e) { return { success: false, error: text, data: {} }; }
        })
        .then(data => {
            if (data.success && data.data.stock_by_grade) {
                displayStockByGrade(data.data.stock_by_grade);
            } else {
                console.error('Error loading stock by grade:', data.error);
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

// Display stock by grade level
function displayStockByGrade(grades) {
    if (!grades || grades.length === 0) {
        createStockByGradeChart([]);
        return;
    }
    
    // Update chart
    createStockByGradeChart(grades);
}

// Create stock by grade chart
function createStockByGradeChart(grades) {
    const ctx = document.getElementById('stockByGradeChart')?.getContext('2d');
    if (!ctx) return;
    
    if (analyticsCharts.stockByGrade) {
        analyticsCharts.stockByGrade.destroy();
    }
    
    const colors = [
        'rgba(59, 130, 246, 0.7)',
        'rgba(16, 185, 129, 0.7)',
        'rgba(139, 92, 246, 0.7)',
        'rgba(245, 158, 11, 0.7)',
        'rgba(239, 68, 68, 0.7)',
        'rgba(236, 72, 153, 0.7)',
        'rgba(14, 165, 233, 0.7)',
        'rgba(34, 197, 94, 0.7)',
        'rgba(168, 85, 247, 0.7)',
        'rgba(249, 115, 22, 0.7)'
    ];
    
    const chartData = {
        labels: grades.map(g => g.grade_level || 'Ungraded'),
        datasets: [{
            label: 'Quantity in Stock',
            data: grades.map(g => g.total_quantity || 0),
            backgroundColor: colors.slice(0, grades.length),
            borderColor: colors.slice(0, grades.length).map(c => c.replace('0.7', '1')),
            borderWidth: 1
        }]
    };
    
    analyticsCharts.stockByGrade = new Chart(ctx, {
        type: 'doughnut',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 15
                    }
                }
            }
        }
    });
}

// 2. LOAD STOCK STATUS - Uses data from dashboard overview
function loadStockStatus() {
    fetch(`../backend/api/dashboard/analytics.php?metric=overview`)
        .then(async response => {
            const text = await response.text();
            try { return JSON.parse(text); } catch (e) { return { success: false, error: text, data: {} }; }
        })
        .then(data => {
            if (data.success && data.data && data.data.overview) {
                displayStockStatus(data.data.overview);
            } else {
                console.error('Error loading stock status:', data.error);
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

// Display stock status pie chart
function displayStockStatus(overview) {
    if (!overview) return;
    
    createStockStatusChart(overview);
}

// Create stock status pie chart using dashboard overview data
function createStockStatusChart(overview) {
    const ctx = document.getElementById('stockStatusChart')?.getContext('2d');
    if (!ctx) return;
    
    if (analyticsCharts.stockStatus) {
        analyticsCharts.stockStatus.destroy();
    }
    
    const chartData = {
        labels: ['In Stock', 'Out of Stock'],
        datasets: [{
            data: [
                overview.in_stock || 0,
                overview.out_of_stock || 0
            ],
            backgroundColor: [
                'rgba(16, 185, 129, 0.7)',      // Green for in stock
                'rgba(239, 68, 68, 0.7)'        // Red for out of stock
            ],
            borderColor: [
                'rgba(16, 185, 129, 1)',
                'rgba(239, 68, 68, 1)'
            ],
            borderWidth: 1
        }]
    };
    
    analyticsCharts.stockStatus = new Chart(ctx, {
        type: 'pie',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 15
                    }
                }
            }
        }
    });
}

// Sidebar toggle for mobile
function setupSidebarToggle() {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    const container = document.querySelector('.dashboard-container');
    
    if (toggle) {
        toggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            container.classList.toggle('sidebar-open');
        });
    }
    
    // Close sidebar on mobile when clicking a link
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', closeSidebarMobile);
    });
}

function closeSidebarMobile() {
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        const container = document.querySelector('.dashboard-container');
        sidebar.classList.add('collapsed');
        container.classList.remove('sidebar-open');
    }
}

// Check authentication
async function checkAuth() {
    try {
        const response = await fetch('/Book-Express/backend/api/user.php');
        const data = await response.json();
        
        if (!data.success || !data.user) {
            window.location.href = '/Book-Express/frontend/login.html';
            return null;
        }
        
        // Update user profile
        const firstLetter = data.user.username ? data.user.username.charAt(0).toUpperCase() : 'U';
        const role = data.user.role ? data.user.role.charAt(0).toUpperCase() + data.user.role.slice(1) : 'User';
        
        document.getElementById('userInitial').textContent = firstLetter;
        document.getElementById('userName').textContent = data.user.username;
        document.getElementById('userRole').textContent = role;
        
        return data.user;
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/Book-Express/frontend/login.html';
        return null;
    }
}

// Logout function
async function logout() {
    try {
        const response = await fetch('/Book-Express/backend/api/logout.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (data.success) {
            window.location.href = '/Book-Express/frontend/login.html';
        }
    } catch (error) {
        console.error('Logout failed:', error);
        alert('Logout failed. Please try again.');
    }
}

// Utility function
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
