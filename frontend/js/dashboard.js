// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    const user = await checkAuth();
    if (!user) {
        window.location.href = '/Book-Express/frontend/login.html';
        return;
    }
    
    // Initialize dashboard with user data
    initializeDashboard(user);
    // Load dashboard statistics
    loadDashboardData();
    // Set up navigation
    setupNavigation();
    // Set up sidebar toggle for mobile
    setupSidebarToggle();
});

// ==================== INITIALIZATION FUNCTIONS ====================
function initializeDashboard(user) {
    const firstLetter = user.username ? user.username.charAt(0).toUpperCase() : 'U';
    const role = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User';
    
    // Update user profile display
    document.getElementById('userInitial').textContent = firstLetter;
    document.getElementById('userName').textContent = user.username;
    document.getElementById('userRole').textContent = role;
    // Update welcome message
    const welcomeMessage = document.getElementById('welcomeMessage');
    welcomeMessage.textContent = `Welcome back, ${user.username}! Select an option from the sidebar to manage your inventory, catalogue, imports, and more.`;
}

function setupNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // Skip default behavior for logout
            if (this.classList.contains('logout')) {
                return;
            }
            // For navigation, go to the href page
            if (this.getAttribute('href')) {
                window.location.href = this.getAttribute('href');
            }
            // Close sidebar on mobile after selection
            closeSidebarMobile();
        });
    });
}

// ==================== SIDEBAR TOGGLE ====================
function setupSidebarToggle() {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    const container = document.querySelector('.dashboard-container');
    
    if (!toggle) return;
    
    toggle.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
        container.classList.toggle('sidebar-open');
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.sidebar') && !e.target.closest('.sidebar-toggle')) {
            closeSidebarMobile();
        }
    });
    
    // Handle window resize - ensure sidebar is visible on large screens
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('collapsed');
            container.classList.remove('sidebar-open');
        }
    });
}

function closeSidebarMobile() {
    const sidebar = document.querySelector('.sidebar');
    const container = document.querySelector('.dashboard-container');
    
    // Only close on mobile screens
    if (window.innerWidth <= 768) {
        sidebar.classList.add('collapsed');
        container.classList.remove('sidebar-open');
    }
}

// ==================== DATA LOADING ====================
function loadDashboardData() {
    fetch('../backend/api/dashboard.php')
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('Error loading dashboard data:', data.error);
                return;
            }
            updateDashboardCards(data);
        })
        .catch(err => console.error('Failed to load dashboard data:', err));
}

function updateDashboardCards(data) {
    // Update total items
    document.getElementById('totalItems').textContent = data.totalItems || 0;
    
    // Update in/out of stock
    document.getElementById('stockStatus').textContent = `${data.inStock || 0} / ${data.outOfStock || 0}`;
    
    // Update low stock alerts
    document.getElementById('lowStockCount').textContent = data.lowStockCount || 0;
    
    // Update inventory value in JMD format
    const value = parseFloat(data.inventoryValue) || 0;
    const formatted = new Intl.NumberFormat('en-JM', { 
        style: 'currency', 
        currency: 'JMD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
    document.getElementById('inventoryValue').textContent = formatted;
}

// ==================== LOGOUT FUNCTION ====================
async function logout() {
    try {
        const response = await fetch('/Book-Express/backend/api/logout.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Redirect to login page
            window.location.href = '/Book-Express/frontend/login.html';
        } else {
            console.error('Logout failed:', data.error);
            alert('Logout failed. Please try again.');
        }
    } catch (error) {
        console.error('Error during logout:', error);
        alert('An error occurred during logout. Please try again.');
    }
}
