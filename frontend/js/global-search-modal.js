// File: js/global-search-modal.js
class GlobalSearchModal {
    constructor() {
        this.isOpen = false;
        this.init();
    }
    
    init() {
        // Create modal HTML dynamically
        this.createModal();
        
        // Add keyboard shortcut (Ctrl+K or Cmd+K)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.toggleModal();
            }
            
            // Escape to close
            if (e.key === 'Escape' && this.isOpen) {
                this.closeModal();
            }
        });
        
        // Add search icon to existing topbar
        this.addSearchIcon();
    }
    
    createModal() {
        // Create modal container
        this.modal = document.createElement('div');
        this.modal.className = 'global-search-modal';
        this.modal.innerHTML = `
            <div class="search-modal-overlay"></div>
            <div class="search-modal-content">
                <div class="search-modal-header">
                    <div class="search-input-group">
                        <i class="fas fa-search search-icon"></i>
                        <input 
                            type="text" 
                            id="modalSearchInput" 
                            placeholder="Search by Item ID, Title, ISBN, Publisher, Grade Level, or Subject..."
                            autocomplete="off"
                        >
                        <button id="modalSearchButton" class="btn-search">
                            <i class="fas fa-search"></i>
                        </button>
                        <button class="btn-close-modal">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="search-modal-body">
                    <div id="modalSearchResults" class="search-results">
                        <div class="search-tips">
                            <h4><i class="fas fa-lightbulb"></i> Search Tips</h4>
                            <ul>
                                <li>Search by <strong>Item ID</strong> (exact match)</li>
                                <li>Search by <strong>Title</strong> (partial match)</li>
                                <li>Search by <strong>ISBN</strong> (exact or partial)</li>
                                <li>Search by <strong>Publisher</strong> or <strong>Author</strong></li>
                                <li>Press <kbd>Ctrl+K</kbd> to open search anytime</li>
                            </ul>
                        </div>
                    </div>
                </div>
                <div class="search-modal-footer">
                    <div class="quick-filters">
                        <select id="modalGradeFilter">
                            <option value="">All Grades</option>
                        </select>
                        <select id="modalSubjectFilter">
                            <option value="">All Subjects</option>
                        </select>
                        <label>
                            <input type="checkbox" id="modalInStockOnly">
                            In Stock Only
                        </label>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.modal);
        
        // Add event listeners
        this.setupEventListeners();
    }
    
    addSearchIcon() {
        // Find existing topbar-right and add search icon before user profile
        const topbarRight = document.querySelector('.topbar-right');
        if (!topbarRight) return;
        
        const searchIcon = document.createElement('div');
        searchIcon.className = 'global-search-icon';
        searchIcon.innerHTML = '<i class="fas fa-search"></i>';
        searchIcon.title = 'Search (Ctrl+K)';
        searchIcon.style.cssText = `
            margin-right: 15px;
            cursor: pointer;
            font-size: 18px;
            color: #666;
            padding: 8px;
            border-radius: 50%;
            transition: all 0.2s;
        `;
        
        searchIcon.addEventListener('mouseenter', () => {
            searchIcon.style.background = '#f5f5f5';
            searchIcon.style.color = '#4a90e2';
        });
        
        searchIcon.addEventListener('mouseleave', () => {
            searchIcon.style.background = 'transparent';
            searchIcon.style.color = '#666';
        });
        
        searchIcon.addEventListener('click', () => this.toggleModal());
        
        // Insert before user profile
        topbarRight.insertBefore(searchIcon, topbarRight.firstChild);
    }
    
    setupEventListeners() {
        const overlay = this.modal.querySelector('.search-modal-overlay');
        const closeBtn = this.modal.querySelector('.btn-close-modal');
        const searchInput = this.modal.querySelector('#modalSearchInput');
        const searchButton = this.modal.querySelector('#modalSearchButton');
        
        overlay.addEventListener('click', () => this.closeModal());
        closeBtn.addEventListener('click', () => this.closeModal());
        
        searchButton.addEventListener('click', () => this.performSearch());
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });
        
        // Real-time search
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            const term = searchInput.value.trim();
            
            if (term.length >= 2) {
                searchTimeout = setTimeout(() => {
                    this.performSearch(term);
                }, 500);
            }
        });
        
        // Focus input when modal opens
        this.modal.addEventListener('transitionend', () => {
            if (this.isOpen) searchInput.focus();
        });
    }
    
    toggleModal() {
        if (this.isOpen) {
            this.closeModal();
        } else {
            this.openModal();
        }
    }
    
    openModal() {
        this.modal.classList.add('active');
        this.isOpen = true;
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }
    
    closeModal() {
        this.modal.classList.remove('active');
        this.isOpen = false;
        document.body.style.overflow = '';
    }
    
    async performSearch(term = null) {
        const searchInput = this.modal.querySelector('#modalSearchInput');
        const searchTerm = term || searchInput.value.trim();
        const resultsContainer = this.modal.querySelector('#modalSearchResults');
        
        if (!searchTerm) return;
        
        try {
            resultsContainer.innerHTML = `
                <div class="loading">
                    <i class="fas fa-spinner fa-spin fa-2x"></i>
                    <p>Searching inventory...</p>
                </div>
            `;
            
            const response = await fetch(`../backend/api/search.php?action=search&q=${encodeURIComponent(searchTerm)}&limit=20`, {
                credentials: 'same-origin'
            });
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            this.displayResults(data.results, searchTerm, data.total);
            
        } catch (error) {
            resultsContainer.innerHTML = `
                <div class="error">
                    <i class="fas fa-exclamation-circle fa-2x"></i>
                    <p>Error: ${error.message}</p>
                </div>
            `;
        }
    }
    
    displayResults(results, searchTerm, total) {
        const resultsContainer = this.modal.querySelector('#modalSearchResults');
        
        if (!results || results.length === 0) {
            resultsContainer.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search fa-2x"></i>
                    <h3>No items found for "${searchTerm}"</h3>
                    <p>Try different keywords or check your spelling.</p>
                </div>
            `;
            return;
        }
        
        let html = `
            <div class="results-summary">
                <h4>Found ${total} items for "${searchTerm}"</h4>
                <a href="search.html?q=${encodeURIComponent(searchTerm)}" class="view-all-link">
                    <i class="fas fa-external-link-alt"></i> Open in full search page
                </a>
            </div>
            <div class="results-grid">
        `;
        
        results.forEach(item => {
            const stockClass = item.quantity > 0 ? 'in-stock' : 'out-of-stock';
            const stockText = item.quantity > 0 ? 'In Stock' : 'Out of Stock';
            
            html += `
                <div class="result-card" onclick="window.location.href='item-details.html?id=${item.item_id}'">
                    <div class="result-card-header">
                        <h5>${this.escapeHtml(item.item_name)}</h5>
                        <span class="stock-badge ${stockClass}">${stockText}</span>
                    </div>
                    <div class="result-card-body">
                        <p><i class="fas fa-barcode"></i> ${this.escapeHtml(item.item_id)}</p>
                        ${item.grade_level ? `<p><i class="fas fa-graduation-cap"></i> ${this.escapeHtml(item.grade_level)}</p>` : ''}
                        ${item.subject_category ? `<p><i class="fas fa-book-open"></i> ${this.escapeHtml(item.subject_category)}</p>` : ''}
                        <p><i class="fas fa-box"></i> ${item.quantity} units</p>
                        <p><i class="fas fa-tag"></i> ${item.rate}</p>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        resultsContainer.innerHTML = html;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new GlobalSearchModal();
});
