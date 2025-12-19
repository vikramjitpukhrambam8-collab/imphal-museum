// ==========================================
// Manipur State Museum - Main JavaScript
// ==========================================

// Mobile Menu Toggle
document.addEventListener('DOMContentLoaded', () => {
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const navLinks = document.getElementById('navLinks');
    
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.nav-wrapper')) {
                navLinks.classList.remove('active');
            }
        });
    }
    
    // Set active nav link based on current page
    setActiveNavLink();
});

// Set active navigation link
function setActiveNavLink() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-links a');
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (currentPath === href || (currentPath === '/' && href === '/')) {
            link.classList.add('active');
        }
    });
}

// ==========================================
// API Helper Functions
// ==========================================

const API_BASE_URL = '';

// Get token from localStorage
function getToken() {
    return localStorage.getItem('museum_token');
}

// Set token in localStorage
function setToken(token) {
    localStorage.setItem('museum_token', token);
}

// Remove token from localStorage
function removeToken() {
    localStorage.removeItem('museum_token');
    localStorage.removeItem('museum_user');
}

// Get user from localStorage
function getUser() {
    const userStr = localStorage.getItem('museum_user');
    return userStr ? JSON.parse(userStr) : null;
}

// Set user in localStorage
function setUser(user) {
    localStorage.setItem('museum_user', JSON.stringify(user));
}

// API fetch with authentication
async function apiFetch(url, options = {}) {
    const token = getToken();
    
    // Clone options so we don't mutate caller's object
    const opts = { ...options };

    // If method is GET/HEAD, remove body (fetch will error otherwise)
    if (opts.method && ['GET', 'HEAD'].includes(opts.method.toUpperCase())) {
        delete opts.body;
    }

    // If caller passed a plain object as body, stringify it and set JSON header
    if (opts.body && !(opts.body instanceof FormData) && typeof opts.body === 'object') {
        opts.body = JSON.stringify(opts.body);
        opts.headers = { ...(opts.headers || {}), 'Content-Type': 'application/json' };
    }

    // Default headers. Do not set Content-Type if body is FormData —
    // the browser will add correct multipart boundary.
    const headers = new Headers(opts.headers || {});
    
    if (token) headers.set('Authorization', `Bearer ${token}`);

    let response;
    try {
        response = await fetch(API_BASE_URL + url, {
            ...opts,
            headers
        });
    } catch (err) {
        console.error('Network error during apiFetch', err, url, opts);
        throw err;
    }
    
    if (response.status === 401) {
        // Token expired or invalid
        removeToken();
        if (window.location.pathname.includes('/admin')) {
            window.location.href = '/admin';
        }
    }
    
    return response;
}

// Show notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Format date
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// Format time
function formatTime(dateString) {
    const options = { hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleTimeString('en-US', options);
}

// ==========================================
// Collections Page Functions
// ==========================================

async function loadCollections(category = 'All', search = '') {
    try {
        const queryParams = new URLSearchParams();
        if (category && category !== 'All') queryParams.append('category', category);
        if (search) queryParams.append('search', search);
        
        const response = await fetch(`/api/collections?${queryParams}`);
        const data = await response.json();
        
        const container = document.getElementById('collectionsContainer');
        
        if (data.success && data.data.length > 0) {
            container.innerHTML = data.data.map(collection => `
                <div class="collection-card">
                    <div class="collection-image" style="background-image: url('${collection.image || '/images/placeholder.jpg'}')"></div>
                    <div class="collection-content">
                        <span class="collection-category">${collection.category}</span>
                        <h3>${collection.title}</h3>
                        <p class="collection-period">${collection.period}</p>
                        <p>${collection.description.substring(0, 120)}...</p>
                        <div style="margin-top: 1rem;">
                            <strong>Origin:</strong> ${collection.origin}<br>
                            ${collection.material ? `<strong>Material:</strong> ${collection.material}` : ''}
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p class="no-data">No collections found</p>';
        }
    } catch (error) {
        console.error('Error loading collections:', error);
        document.getElementById('collectionsContainer').innerHTML = '<p class="error">Error loading collections</p>';
    }
}

// Filter collections
function setupCollectionFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const searchInput = document.getElementById('searchInput');
    
    if (filterButtons.length > 0) {
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                const category = button.dataset.category;
                const search = searchInput ? searchInput.value : '';
                loadCollections(category, search);
            });
        });
    }
    
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const activeFilter = document.querySelector('.filter-btn.active');
                const category = activeFilter ? activeFilter.dataset.category : 'All';
                loadCollections(category, searchInput.value);
            }, 500);
        });
    }
}

// ==========================================
// Exhibitions Page Functions
// ==========================================

async function loadExhibitions() {
    try {
        const response = await fetch('/api/exhibitions');
        const data = await response.json();
        
        if (data.success && data.data.length > 0) {
            const types = ['Permanent', 'Temporary', 'Special'];
            let html = '';
            
            types.forEach(type => {
                const exhibitions = data.data.filter(ex => ex.type === type);
                if (exhibitions.length > 0) {
                    html += `<h2 class="section-title">${type} Exhibitions</h2>`;
                    html += '<div class="collections-grid">';
                    exhibitions.forEach(ex => {
                        const statusClass = ex.status === 'active' ? 'success' : 
                                          ex.status === 'upcoming' ? 'warning' : 'error';
                        html += `
                            <div class="collection-card">
                                <div class="collection-image" style="background-image: url('${ex.image || '/images/placeholder.jpg'}')"></div>
                                <div class="collection-content">
                                    <span class="collection-category" style="background: var(--${statusClass})">${ex.status}</span>
                                    <h3>${ex.title}</h3>
                                    <p>${ex.description}</p>
                                    <div style="margin-top: 1rem; color: var(--text-light); font-size: 0.875rem;">
                                        <p>📅 ${formatDate(ex.startDate)} ${ex.endDate ? '- ' + formatDate(ex.endDate) : '- Ongoing'}</p>
                                        ${ex.location ? `<p>📍 ${ex.location}</p>` : ''}
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                    html += '</div>';
                }
            });
            
            document.getElementById('exhibitionsContainer').innerHTML = html;
        } else {
            document.getElementById('exhibitionsContainer').innerHTML = '<p class="no-data">No exhibitions available</p>';
        }
    } catch (error) {
        console.error('Error loading exhibitions:', error);
        document.getElementById('exhibitionsContainer').innerHTML = '<p class="error">Error loading exhibitions</p>';
    }
}

// ==========================================
// Events Page Functions
// ==========================================

async function loadEvents() {
    try {
        const response = await fetch('/api/events');
        const data = await response.json();
        
        const container = document.getElementById('eventsContainer');
        
        if (data.success && data.data.length > 0) {
            // Separate upcoming and past events
            const today = new Date();
            const upcoming = data.data.filter(e => new Date(e.date) >= today);
            const past = data.data.filter(e => new Date(e.date) < today);
            
            let html = '';
            
            if (upcoming.length > 0) {
                html += '<h2 class="section-title">Upcoming Events</h2>';
                html += '<div class="events-grid">';
                upcoming.forEach(event => {
                    const eventDate = new Date(event.date);
                    html += `
                        <div class="event-card">
                            <div class="event-date">
                                <span class="event-day">${eventDate.getDate()}</span>
                                <span class="event-month">${eventDate.toLocaleString('default', { month: 'short' })}</span>
                            </div>
                            <div class="event-content">
                                <h3>${event.title}</h3>
                                <p>${event.description}</p>
                                <p class="event-time">⏰ ${event.time}</p>
                                <p class="event-location">📍 ${event.location}</p>
                                ${event.category ? `<p style="margin-top: 0.5rem;"><span class="collection-category">${event.category}</span></p>` : ''}
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
            }
            
            if (past.length > 0) {
                html += '<h2 class="section-title" style="margin-top: 3rem;">Past Events</h2>';
                html += '<div class="events-grid" style="opacity: 0.7;">';
                past.slice(0, 6).forEach(event => {
                    const eventDate = new Date(event.date);
                    html += `
                        <div class="event-card">
                            <div class="event-date" style="background: var(--text-light);">
                                <span class="event-day">${eventDate.getDate()}</span>
                                <span class="event-month">${eventDate.toLocaleString('default', { month: 'short' })}</span>
                            </div>
                            <div class="event-content">
                                <h3>${event.title}</h3>
                                <p class="event-time">⏰ ${event.time}</p>
                                <p class="event-location">📍 ${event.location}</p>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
            }
            
            container.innerHTML = html || '<p class="no-data">No events available</p>';
        } else {
            container.innerHTML = '<p class="no-data">No events available</p>';
        }
    } catch (error) {
        console.error('Error loading events:', error);
        document.getElementById('eventsContainer').innerHTML = '<p class="error">Error loading events</p>';
    }
}

// ==========================================
// News Page Functions
// ==========================================

async function loadNews() {
    try {
        const response = await fetch('/api/news');
        const data = await response.json();
        
        const container = document.getElementById('newsContainer');
        
        if (data.success && data.data.length > 0) {
            container.innerHTML = data.data.map(news => `
                <div class="card" style="margin-bottom: 2rem;">
                    ${news.image ? `<img src="${news.image}" alt="${news.title}" style="width: 100%; height: 300px; object-fit: cover; border-radius: 8px; margin-bottom: 1rem;">` : ''}
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h2 style="margin: 0;">${news.title}</h2>
                        <span style="color: var(--text-light); font-size: 0.875rem;">${formatDate(news.publishDate)}</span>
                    </div>
                    <p style="color: var(--text-light); font-size: 1.125rem; margin-bottom: 1rem;">${news.excerpt}</p>
                    <p>${news.content}</p>
                    ${news.views ? `<p style="margin-top: 1rem; color: var(--text-light); font-size: 0.875rem;">👁️ ${news.views} views</p>` : ''}
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p class="no-data">No news available</p>';
        }
    } catch (error) {
        console.error('Error loading news:', error);
        document.getElementById('newsContainer').innerHTML = '<p class="error">Error loading news</p>';
    }
}

// ==========================================
// Contact Form
// ==========================================

async function handleContactForm(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = {
        name: form.name.value,
        email: form.email.value,
        subject: form.subject.value,
        message: form.message.value
    };
    
    try {
        const response = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Message sent successfully!', 'success');
            form.reset();
        } else {
            showNotification('Failed to send message', 'error');
        }
    } catch (error) {
        console.error('Error submitting form:', error);
        showNotification('Error sending message', 'error');
    }
}

// ==========================================
// Admin Authentication
// ==========================================

async function handleAdminLogin(event) {
    event.preventDefault();
    
    const form = event.target;
    const credentials = {
        email: form.email.value,
        password: form.password.value
    };
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });
        
        const data = await response.json();
        
        if (data.success) {
            setToken(data.token);
            setUser(data.user);
            showNotification('Login successful!', 'success');
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = '/admin#dashboard';
                location.reload();
            }, 1000);
        } else {
            showNotification(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Login failed', 'error');
    }
}

function handleAdminLogout() {
    removeToken();
    showNotification('Logged out successfully', 'success');
    setTimeout(() => {
        window.location.href = '/admin';
        location.reload();
    }, 1000);
}

// Check if user is logged in
function isLoggedIn() {
    return !!getToken();
}

// ==========================================
// Admin Dashboard Functions
// ==========================================

async function loadAdminStats() {
    try {
        const response = await apiFetch('/api/admin/stats');
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('statCollections').textContent = data.data.collections;
            document.getElementById('statExhibitions').textContent = data.data.exhibitions;
            document.getElementById('statEvents').textContent = data.data.events;
            document.getElementById('statNews').textContent = data.data.news;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadAdminCollections() {
    try {
        const response = await apiFetch('/api/collections');
        const data = await response.json();
        
        const tbody = document.getElementById('adminCollectionsTable');
        
        if (data.success && data.data.length > 0) {
            tbody.innerHTML = data.data.map(collection => `
                <tr>
                    <td>${collection.title}</td>
                    <td>${collection.category}</td>
                    <td>${collection.period}</td>
                    <td><span class="collection-category">${collection.status}</span></td>
                    <td>
                        <button class="btn btn-sm" onclick="editCollection('${collection._id}')">Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteCollection('${collection._id}')">Delete</button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No collections found</td></tr>';
        }
    } catch (error) {
        console.error('Error loading collections:', error);
    }
}

// Load exhibitions for admin management
async function loadAdminExhibitions() {
    try {
        const response = await apiFetch('/api/exhibitions');
        const data = await response.json();

        const container = document.getElementById('exhibitionsPage');

        if (data.success && data.data.length > 0) {
            let html = '<div class="table-container"><table><thead><tr><th>Image</th><th>Title</th><th>Type</th><th>Start Date</th><th>End Date</th><th>Actions</th></tr></thead><tbody>';
            html += data.data.map(ex => `
                <tr>
                    <td><img src="${ex.image || '/images/placeholder.jpg'}" alt="${ex.title}" style="width:80px; height:60px; object-fit:cover; border-radius:6px;"></td>
                    <td>${ex.title}</td>
                    <td>${ex.type}</td>
                    <td>${ex.startDate ? formatDate(ex.startDate) : '-'}</td>
                    <td>${ex.endDate ? formatDate(ex.endDate) : '-'}</td>
                    <td>
                        <button class="btn btn-sm" onclick="editExhibition('${ex._id}')">Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteExhibition('${ex._id}')">Delete</button>
                    </td>
                </tr>
            `).join('');
            html += '</tbody></table></div>';

            container.querySelector('.card')?.remove();
            container.innerHTML = `<div class="admin-header"><h1>Manage Exhibitions</h1><button class="btn btn-primary" onclick="showAddExhibitionForm()">➕ Add Exhibition</button></div>${html}`;
        } else {
            container.innerHTML = '<div class="admin-header"><h1>Manage Exhibitions</h1><button class="btn btn-primary" onclick="showAddExhibitionForm()">➕ Add Exhibition</button></div><div class="card"><p>No exhibitions found</p></div>';
        }
    } catch (error) {
        console.error('Error loading admin exhibitions:', error);
    }
}

// Load events for admin management
async function loadAdminEvents() {
    try {
        const response = await apiFetch('/api/events');
        const data = await response.json();

        const container = document.getElementById('eventsPage');

        if (data.success && data.data.length > 0) {
            let html = '<div class="table-container"><table><thead><tr><th>Image</th><th>Title</th><th>Date</th><th>Location</th><th>Actions</th></tr></thead><tbody>';
            html += data.data.map(ev => `
                <tr>
                    <td><img src="${ev.image || '/images/placeholder.jpg'}" alt="${ev.title}" style="width:80px; height:60px; object-fit:cover; border-radius:6px;"></td>
                    <td>${ev.title}</td>
                    <td>${ev.date ? formatDate(ev.date) : '-'}</td>
                    <td>${ev.location || '-'}</td>
                    <td>
                        <button class="btn btn-sm" onclick="editEvent('${ev._id}')">Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteEvent('${ev._id}')">Delete</button>
                    </td>
                </tr>
            `).join('');
            html += '</tbody></table></div>';

            container.querySelector('.card')?.remove();
            container.innerHTML = `<div class="admin-header"><h1>Manage Events</h1><button class="btn btn-primary" onclick="showAddEventForm()">➕ Add Event</button></div>${html}`;
        } else {
            container.innerHTML = '<div class="admin-header"><h1>Manage Events</h1><button class="btn btn-primary" onclick="showAddEventForm()">➕ Add Event</button></div><div class="card"><p>No events found</p></div>';
        }
    } catch (error) {
        console.error('Error loading admin events:', error);
    }
}

function editEvent(id) {
    showNotification('Edit functionality - Coming soon!', 'success');
}

async function deleteEvent(id) {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
        const response = await apiFetch(`/api/admin/events/${id}`, { method: 'DELETE' });
        const data = await response.json();
        if (data.success) {
            showNotification('Event deleted successfully', 'success');
            loadAdminEvents();
        } else {
            showNotification('Failed to delete event', 'error');
        }
    } catch (error) {
        console.error('Error deleting event:', error);
        showNotification('Error deleting event', 'error');
    }
}

// Create or upload an event. Accepts either a Plain Object (JSON) or FormData
async function addEvent(payload) {
    const options = { method: 'POST' };

    if (payload instanceof FormData) {
        options.body = payload;
    } else if (payload && typeof payload === 'object') {
        options.body = JSON.stringify(payload);
    } else {
        throw new Error('Invalid payload for addEvent');
    }

    const response = await apiFetch('/api/admin/events', options);
    let data;
    try {
        data = await response.json();
    } catch (e) {
        const text = await response.text();
        console.debug('addEvent received non-JSON response:', response.status, text);
        const err = new Error('Server returned non-JSON response');
        err.response = { status: response.status, text };
        throw err;
    }
    if (!response.ok) {
        console.debug('addEvent failed:', response.status, data);
        const err = new Error(data?.message || 'Failed to create event');
        err.response = data;
        throw err;
    }
    return data;
}

function editExhibition(id) {
    showNotification('Edit functionality - Coming soon!', 'success');
}

async function deleteExhibition(id) {
    if (!confirm('Are you sure you want to delete this exhibition?')) return;
    try {
        const response = await apiFetch(`/api/admin/exhibitions/${id}`, { method: 'DELETE' });
        const data = await response.json();
        if (data.success) {
            showNotification('Exhibition deleted successfully', 'success');
            loadAdminExhibitions();
        } else {
            showNotification('Failed to delete exhibition', 'error');
        }
    } catch (error) {
        console.error('Error deleting exhibition:', error);
        showNotification('Error deleting exhibition', 'error');
    }
}

// Create or upload an exhibition. Accepts either a Plain Object
// (will be sent as JSON) or a FormData instance (for file uploads).
async function addExhibition(payload) {
    const options = { method: 'POST' };

    if (payload instanceof FormData) {
        options.body = payload;
    } else if (payload && typeof payload === 'object') {
        options.body = JSON.stringify(payload);
    } else {
        throw new Error('Invalid payload for addExhibition');
    }

    const response = await apiFetch('/api/admin/exhibitions', options);
    const data = await response.json();
    if (!response.ok) {
        const err = new Error(data?.message || 'Failed to create exhibition');
        err.response = data;
        throw err;
    }
    return data;
}

async function deleteCollection(id) {
    if (!confirm('Are you sure you want to delete this collection?')) return;
    
    try {
        const response = await apiFetch(`/api/admin/collections/${id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Collection deleted successfully', 'success');
            loadAdminCollections();
        } else {
            showNotification('Failed to delete collection', 'error');
        }
    } catch (error) {
        console.error('Error deleting collection:', error);
        showNotification('Error deleting collection', 'error');
    }
}

// ==========================================
// Initialize Page-Specific Functions
// ==========================================

window.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    
    // Collections page
    if (path === '/collections') {
        setupCollectionFilters();
        loadCollections();
    }
    
    // Exhibitions page
    if (path === '/exhibitions') {
        loadExhibitions();
    }
    
    // Events page
    if (path === '/events') {
        loadEvents();
    }
    
    // News page
    if (path === '/news') {
        loadNews();
    }
    
    // Contact form
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', handleContactForm);
    }
    
    // Admin login form
    const adminLoginForm = document.getElementById('adminLoginForm');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', handleAdminLogin);
    }
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .btn-sm {
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
    }
`;
document.head.appendChild(style);