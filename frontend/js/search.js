// File: search.js
document.addEventListener('DOMContentLoaded', async function () {
    // Check authentication
    const user = await checkAuth();
    if (!user) {
        window.location.href = '/Book-Express/frontend/login.html';
        return;
    }
    
    // Initialize user profile
    initializeUserProfile(user);
    
    // Set up sidebar toggle
    setupSidebarToggle();
    setupNavigation();
    
    // Initialize search functionality
    initializeSearch();
    
    // Set up logout
    document.querySelectorAll('.logout').forEach(link => {
        link.addEventListener('click', logout);
    });
});

function initializeUserProfile(user) {
    const firstLetter = user.username ? user.username.charAt(0).toUpperCase() : 'U';
    const role = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User';
    
    document.getElementById('userInitial').textContent = firstLetter;
    document.getElementById('userName').textContent = user.username;
    document.getElementById('userRole').textContent = role;
}

function setupSidebarToggle() {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    const container = document.querySelector('.dashboard-container');
    
    if (!toggle) return;
    
    toggle.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
        container.classList.toggle('sidebar-open');
    });
    
    // Close sidebar on mobile when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.sidebar') && !e.target.closest('.sidebar-toggle')) {
            closeSidebarMobile();
        }
    });
}

function closeSidebarMobile() {
    const sidebar = document.querySelector('.sidebar');
    const container = document.querySelector('.dashboard-container');
    
    if (window.innerWidth <= 768) {
        sidebar.classList.add('collapsed');
        container.classList.remove('sidebar-open');
    }
}

function setupNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            if (this.classList.contains('logout')) return;
            if (this.getAttribute('href')) {
                window.location.href = this.getAttribute('href');
            }
            closeSidebarMobile();
        });
    });
}

function initializeSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const gradeFilter = document.getElementById('gradeFilter');
    const subjectFilter = document.getElementById('subjectFilter');
    const inStockOnly = document.getElementById('inStockOnly');
    
    let currentPage = 1;
    let currentSearchParams = {};
    
    // Load filter options
    loadFilterOptions();
    
    // Search on button click
    searchButton.addEventListener('click', performSearch);
    
    // Search on Enter key
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    // Search on filter change
    gradeFilter.addEventListener('change', performSearch);
    subjectFilter.addEventListener('change', performSearch);
    inStockOnly.addEventListener('change', performSearch);
    
    // Initialize modal
    initializeModal();
    
    async function loadFilterOptions() {
        try {
            const response = await fetch('../backend/api/search.php?action=search&limit=1', {
                credentials: 'same-origin'
            });
            const data = await response.json();
            
            if (data.filters) {
                // Populate grade levels
                data.filters.grade_levels.forEach(grade => {
                    const option = document.createElement('option');
                    option.value = grade;
                    option.textContent = grade;
                    gradeFilter.appendChild(option);
                });
                
                // Populate subjects
                data.filters.subjects.forEach(subject => {
                    const option = document.createElement('option');
                    option.value = subject;
                    option.textContent = subject;
                    subjectFilter.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading filter options:', error);
        }
    }
    
    async function performSearch() {
        const searchQuery = searchInput.value.trim();
        const grade = gradeFilter.value;
        const subject = subjectFilter.value;
        const inStock = inStockOnly.checked;
        
        // Build search parameters
        const params = new URLSearchParams();
        if (searchQuery) params.append('q', searchQuery);
        if (grade) params.append('grade_level', grade);
        if (subject) params.append('subject', subject);
        if (inStock) params.append('in_stock_only', 'true');
        params.append('page', currentPage);
        params.append('limit', 50);
        
        currentSearchParams = {
            searchQuery, grade, subject, inStock
        };
        
        try {
            // Show loading state
            document.getElementById('searchResults').innerHTML = `
                <div class="loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Searching inventory...</p>
                </div>
            `;
            
            const response = await fetch(`../backend/api/search.php?action=search&${params.toString()}`, {
                credentials: 'same-origin'
            });
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Update results count
            document.getElementById('resultsCount').textContent = data.total;
            
            // Display results
            displaySearchResults(data.results);
            
            // Display pagination
            displayPagination(data.total, data.page, data.limit);
            
            // Test AC-002.4: Real-time updates
            setupRealTimeUpdates();
            
        } catch (error) {
            console.error('Search error:', error);
            document.getElementById('searchResults').innerHTML = `
                <div class="error">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Error searching inventory: ${error.message}</p>
                </div>
            `;
        }
    }
    
    function displaySearchResults(results) {
        const resultsContainer = document.getElementById('searchResults');
        
        if (!results || results.length === 0) {
            resultsContainer.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search fa-2x"></i>
                    <p>No items found matching your search criteria</p>
                    <p class="suggestion">Try a different search term or adjust your filters</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        results.forEach(item => {
            const stockClass = item.quantity > 0 ? 'in-stock' : 'out-of-stock';
            const stockText = item.quantity > 0 ? 'In Stock' : 'Out of Stock';
            const stockIcon = item.quantity > 0 ? 'fa-check-circle' : 'fa-times-circle';
            
            // Format price
            const price = parseFloat(item.rate.replace(/[^\d.]/g, '')) || 0;
            const formattedPrice = new Intl.NumberFormat('en-JM', {
                style: 'currency',
                currency: 'JMD'
            }).format(price);
            
            html += `
                <div class="result-item ${stockClass}" data-item-id="${item.item_id}">
                    <div class="result-icon">
                        <i class="fas ${stockIcon}"></i>
                    </div>
                    <div class="result-content">
                        <h4 class="item-title">${escapeHtml(item.item_name)}</h4>
                        <div class="item-meta">
                            <span class="item-id"><i class="fas fa-barcode"></i> ${escapeHtml(item.item_id)}</span>
                            ${item.grade_level ? `<span class="item-grade"><i class="fas fa-graduation-cap"></i> ${escapeHtml(item.grade_level)}</span>` : ''}
                            ${item.subject_category ? `<span class="item-subject"><i class="fas fa-book-open"></i> ${escapeHtml(item.subject_category)}</span>` : ''}
                            <span class="item-price"><i class="fas fa-tag"></i> ${formattedPrice}</span>
                        </div>
                    </div>
                    <div class="result-stock">
                        <div class="stock-quantity ${stockClass}">
                            <i class="fas fa-box"></i> ${item.quantity} units
                        </div>
                        <div class="stock-status ${stockClass}">
                            ${stockText}
                        </div>
                    </div>
                    <div class="result-actions">
                        <button class="btn-view-details" onclick="viewItemDetails('${escapeHtml(item.item_id)}')">
                            <i class="fas fa-eye"></i> Details
                        </button>
                    </div>
                </div>
            `;
        });
        
        resultsContainer.innerHTML = html;
        
        // Add click handlers to view details
        document.querySelectorAll('.result-item').forEach(item => {
            item.addEventListener('dblclick', function() {
                const itemId = this.getAttribute('data-item-id');
                viewItemDetails(itemId);
            });
        });
    }
    
    function displayPagination(total, page, limit) {
        const pagination = document.getElementById('pagination');
        const totalPages = Math.ceil(total / limit);
        
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }
        
        let html = `
            <div class="pagination-controls">
                <button class="pagination-btn ${page <= 1 ? 'disabled' : ''}" 
                        ${page > 1 ? `onclick="goToPage(${page - 1})"` : ''}>
                    <i class="fas fa-chevron-left"></i> Previous
                </button>
                
                <div class="page-numbers">
        `;
        
        // Show page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
                html += `
                    <button class="page-number ${i === page ? 'active' : ''}" 
                            onclick="goToPage(${i})">
                        ${i}
                    </button>
                `;
            } else if (i === page - 3 || i === page + 3) {
                html += `<span class="page-dots">...</span>`;
            }
        }
        
        html += `
                </div>
                
                <button class="pagination-btn ${page >= totalPages ? 'disabled' : ''}" 
                        ${page < totalPages ? `onclick="goToPage(${page + 1})"` : ''}>
                    Next <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;
        
        pagination.innerHTML = html;
    }
    
    // Global function for pagination
    window.goToPage = function(page) {
        currentPage = page;
        performSearch();
        // Scroll to top of results
        document.querySelector('.search-results-container').scrollIntoView({ 
            behavior: 'smooth' 
        });
    };
    
    function setupRealTimeUpdates() {
        // Set up WebSocket or polling for real-time updates (AC-002.4)
        // For now, we'll use polling every 30 seconds
        setInterval(async () => {
            if (currentSearchParams.searchQuery || currentSearchParams.grade || currentSearchParams.subject) {
                await performSearch();
            }
        }, 30000); // Update every 30 seconds
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

function initializeModal() {
    const modal = document.getElementById('itemModal');
    const closeBtn = document.querySelector('.close-modal');
    
    // Close modal when clicking X
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Add escape key to close modal
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.style.display === 'block') {
            modal.style.display = 'none';
        }
    });
}

// Global function to view item details
window.viewItemDetails = async function(itemId) {
    const modal = document.getElementById('itemModal');
    const modalBody = document.getElementById('itemDetails');
    
    try {
        // Show loading
        modalBody.innerHTML = `
            <div class="modal-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading item details...</p>
            </div>
        `;
        
        modal.style.display = 'block';
        
        // Fetch item details
        const response = await fetch(`../backend/api/search.php?action=getItemDetails&item_id=${encodeURIComponent(itemId)}`, {
            credentials: 'same-origin'
        });
        
        const item = await response.json();
        
        if (item.error) {
            throw new Error(item.error);
        }
        
        // Fetch adjustment history
        const historyResponse = await fetch(`../backend/api/search.php?action=getAdjustmentHistory&item_id=${encodeURIComponent(itemId)}&limit=10`, {
            credentials: 'same-origin'
        });
        
        const history = await historyResponse.json();
        
        // Format price
        const price = parseFloat(item.rate.replace(/[^\d.]/g, '')) || 0;
    }