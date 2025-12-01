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
    
    // Set up navigation
    setupNavigation();
    
    // Load dashboard data
    loadDashboardData();
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
    welcomeMessage.textContent = `Welcome back, ${user.username}! Here's a summary of what's happening today.`;
}

function setupNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // Skip default behavior for logout
            if (this.classList.contains('logout')) {
                return;
            }
            
            e.preventDefault();
            
            const section = this.getAttribute('data-section');
            if (!section) return;
            
            // Remove active class from all menu items
            menuItems.forEach(el => el.classList.remove('active'));
            
            // Add active class to clicked item
            this.classList.add('active');
            
            // Hide all sections
            const sections = document.querySelectorAll('.content-section');
            sections.forEach(s => s.classList.remove('active'));
            
            // Show selected section
            const targetSection = document.getElementById(`${section}-section`);
            if (targetSection) {
                targetSection.classList.add('active');
            }
        });
    });
}

// ==================== DATA LOADING ====================
function loadDashboardData() {
    // These are placeholder values - replace with actual API calls
    updateDashboardCards();
}

function updateDashboardCards() {
    // Placeholder data - replace with real API calls to backend
    const totalItems = 15230;
    const inStock = 14800;
    const outOfStock = 430;
    const lowStockAlerts = 15;
    const inventoryValue = 185450.75;
    
    // Update card values
    document.getElementById('totalItems').textContent = totalItems.toLocaleString();
    document.getElementById('stockStatus').textContent = `${inStock.toLocaleString()} / ${outOfStock.toLocaleString()}`;
    document.getElementById('lowStockCount').textContent = lowStockAlerts;
    document.getElementById('inventoryValue').textContent = `$${inventoryValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
