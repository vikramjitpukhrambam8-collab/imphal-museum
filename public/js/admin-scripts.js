// ==========================================
// Admin-Specific Scripts
// ==========================================

// Check authentication on page load
window.addEventListener('DOMContentLoaded', () => {
    if (isLoggedIn()) {
        showAdminDashboard();
    }
});

// Show admin dashboard
function showAdminDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
    
    const user = getUser();
    if (user) {
        document.getElementById('adminUserName').textContent = user.name;
    }
    
    loadAdminStats();
    
    // Handle navigation from URL hash
    const hash = window.location.hash.substring(1) || 'dashboard';
    showAdminPage(hash);
}

// Show specific admin page
function showAdminPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.admin-page').forEach(page => {
        page.style.display = 'none';
    });
    
    // Remove active class from all nav links
    document.querySelectorAll('.admin-nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show selected page
    const pageElement = document.getElementById(pageName + 'Page');
    if (pageElement) {
        pageElement.style.display = 'block';
    }
    
    // Add active class to current nav link
    const activeLink = document.querySelector(`[data-page="${pageName}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    // Load page-specific data
    if (pageName === 'collections') {
        loadAdminCollections();
    } else if (pageName === 'dashboard') {
        loadAdminStats();
    } else if (pageName === 'exhibitions') {
        loadAdminExhibitions();
    } else if (pageName === 'events') {
        loadAdminEvents();
    }
    
    // Update URL hash
    window.location.hash = pageName;
}

// Add event listeners to admin navigation
document.querySelectorAll('.admin-nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const pageName = link.dataset.page;
        if (pageName) {
            showAdminPage(pageName);
        }
    });
});

// Show add collection form
function showAddCollectionForm() {
    document.querySelectorAll('.admin-page').forEach(page => {
        page.style.display = 'none';
    });
    document.getElementById('addCollectionForm').style.display = 'block';
}

// Handle collection form submission
document.getElementById('collectionForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    try {
        const response = await apiFetch('/api/admin/collections', {
            method: 'POST',
            body: data
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Collection created successfully!', 'success');
            e.target.reset();
            showAdminPage('collections');
        } else {
            showNotification(result.message || 'Failed to create collection', 'error');
        }
    } catch (error) {
        console.error('Error creating collection:', error);
        showNotification('Error creating collection', 'error');
    }
});

// Helper to wait for image URL validation to finish
function waitForImageUrlValidation(inputEl, timeout = 3000) {
    return new Promise((resolve) => {
        if (!inputEl) return resolve(true);
        const url = inputEl.value.trim();
        if (!url) return resolve(true);
        if (inputEl.dataset.valid === 'true') return resolve(true);
        if (inputEl.dataset.valid === 'false') return resolve(false);

        const start = Date.now();
        const iv = setInterval(() => {
            if (inputEl.dataset.valid === 'true') {
                clearInterval(iv);
                return resolve(true);
            }
            if (inputEl.dataset.valid === 'false') {
                clearInterval(iv);
                return resolve(false);
            }
            if (Date.now() - start > timeout) {
                clearInterval(iv);
                return resolve(false);
            }
        }, 100);
    });
}

// Handle exhibition form submission
document.getElementById('exhibitionForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fileInput = e.target.querySelector('input[type="file"][name="image"]');

    try {
        let result;

        if (!isLoggedIn()) {
            showNotification('You must be logged in to perform this action', 'error');
            return;
        }

        if (fileInput && fileInput.files && fileInput.files.length > 0) {
            const form = new FormData(e.target);
            result = await addExhibition(form);
        } else {
            const obj = Object.fromEntries(new FormData(e.target).entries());
            if (obj.imageUrl) {
                const ok = await waitForImageUrlValidation(_exUrlInput, 4000);
                if (!ok) {
                    showNotification('Please provide a valid image URL or upload an image file', 'error');
                    return;
                }
                obj.image = obj.imageUrl;
            }
            delete obj.imageUrl;
            result = await addExhibition(obj);
        }

        if (result && result.success) {
            showNotification('Exhibition created successfully!', 'success');
            e.target.reset();
            hideExhibitionPreview();
            showAdminPage('exhibitions');
        } else {
            showNotification(result?.message || 'Failed to create exhibition', 'error');
        }
    } catch (error) {
        const server = error?.response;
        if (server?.errors && Array.isArray(server.errors)) {
            showNotification(server.errors[0], 'error');
        } else if (server?.message) {
            showNotification(server.message, 'error');
        } else {
            showNotification(error.message || 'Error creating exhibition', 'error');
        }
    }
});

// Show add exhibition form
function showAddExhibitionForm() {
    hideExhibitionPreview();
    document.querySelectorAll('.admin-page').forEach(page => {
        page.style.display = 'none';
    });
    document.getElementById('addExhibitionForm').style.display = 'block';
}

// Image preview helpers for exhibitions
function hideExhibitionPreview() {
    const preview = document.getElementById('exhibitionImagePreview');
    const fileInput = document.querySelector('#exhibitionForm input[type="file"][name="image"]');
    const urlInput = document.querySelector('#exhibitionForm input[name="imageUrl"]');

    if (preview) {
        preview.src = '';
        preview.style.display = 'none';
    }
    if (fileInput) fileInput.value = '';
    if (urlInput) {
        urlInput.value = '';
        urlInput.dataset.valid = 'false';
    }
    const msg = document.getElementById('imageUrlMessage');
    if (msg) {
        msg.textContent = '';
        msg.style.display = 'none';
    }
}

function showExhibitionPreviewFromFile(file) {
    const preview = document.getElementById('exhibitionImagePreview');
    if (!preview || !file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        preview.src = ev.target.result;
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

// Wire file input and image URL preview behavior
const _exFileInput = document.querySelector('#exhibitionForm input[type="file"][name="image"]');
const _exUrlInput = document.querySelector('#exhibitionForm input[name="imageUrl"]');
if (_exFileInput) {
    _exFileInput.addEventListener('change', (ev) => {
        const file = ev.target.files && ev.target.files[0];
        if (file) {
            showExhibitionPreviewFromFile(file);
        } else {
            if (_exUrlInput && _exUrlInput.value) {
                const preview = document.getElementById('exhibitionImagePreview');
                preview.src = _exUrlInput.value;
                preview.style.display = 'block';
            } else {
                hideExhibitionPreview();
            }
        }
    });
}

if (_exUrlInput) {
    const _imageUrlMsg = document.getElementById('imageUrlMessage');
    let _urlCheckToken = 0;
    _exUrlInput.addEventListener('input', (ev) => {
        const url = ev.target.value.trim();
        const preview = document.getElementById('exhibitionImagePreview');
        const fileInput = document.querySelector('#exhibitionForm input[type="file"][name="image"]');
        _exUrlInput.dataset.valid = 'false';
        _imageUrlMsg.style.display = 'none';

        if (url && fileInput && fileInput.files && fileInput.files.length === 0) {
            const token = ++_urlCheckToken;
            const img = new Image();
            img.onload = () => {
                if (token !== _urlCheckToken) return;
                preview.src = url;
                preview.style.display = 'block';
                _exUrlInput.dataset.valid = 'true';
                _imageUrlMsg.style.display = 'none';
            };
            img.onerror = () => {
                if (token !== _urlCheckToken) return;
                preview.src = '';
                preview.style.display = 'none';
                _exUrlInput.dataset.valid = 'false';
                _imageUrlMsg.textContent = 'Image could not be loaded from the provided URL.';
                _imageUrlMsg.style.display = 'block';
            };
            img.src = url;
        } else if (!url && (!fileInput || fileInput.files.length === 0)) {
            hideExhibitionPreview();
        }
    });
}

document.getElementById('exhibitionForm')?.addEventListener('reset', () => hideExhibitionPreview());

// Show add event form
function showAddEventForm() {
    hideEventPreview();
    document.querySelectorAll('.admin-page').forEach(page => {
        page.style.display = 'none';
    });
    document.getElementById('addEventForm').style.display = 'block';
}

// Event preview helpers
function hideEventPreview() {
    const preview = document.getElementById('eventImagePreview');
    const fileInput = document.querySelector('#eventForm input[type="file"][name="image"]');
    const urlInput = document.querySelector('#eventForm input[name="imageUrl"]');
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    if (fileInput) fileInput.value = '';
    if (urlInput) { urlInput.value = ''; urlInput.dataset.valid = 'false'; }
    const msg = document.getElementById('eventImageUrlMessage');
    if (msg) { msg.textContent = ''; msg.style.display = 'none'; }
}

function showEventPreviewFromFile(file) {
    const preview = document.getElementById('eventImagePreview');
    if (!preview || !file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { preview.src = ev.target.result; preview.style.display = 'block'; };
    reader.readAsDataURL(file);
}

// Wire event form preview behavior
const _evFileInput = document.querySelector('#eventForm input[type="file"][name="image"]');
const _evUrlInput = document.querySelector('#eventForm input[name="imageUrl"]');
if (_evFileInput) {
    _evFileInput.addEventListener('change', (ev) => {
        const file = ev.target.files && ev.target.files[0];
        if (file) { showEventPreviewFromFile(file); } else {
            if (_evUrlInput && _evUrlInput.value) {
                const preview = document.getElementById('eventImagePreview');
                preview.src = _evUrlInput.value;
                preview.style.display = 'block';
            } else { hideEventPreview(); }
        }
    });
}

if (_evUrlInput) {
    const _evMsg = document.getElementById('eventImageUrlMessage');
    let _evToken = 0;
    _evUrlInput.addEventListener('input', (ev) => {
        const url = ev.target.value.trim();
        const preview = document.getElementById('eventImagePreview');
        const fileInput = document.querySelector('#eventForm input[type="file"][name="image"]');
        _evUrlInput.dataset.valid = 'false';
        _evMsg.style.display = 'none';
        if (url && fileInput && fileInput.files && fileInput.files.length === 0) {
            const token = ++_evToken;
            const img = new Image();
            img.onload = () => {
                if (token !== _evToken) return;
                preview.src = url;
                preview.style.display = 'block';
                _evUrlInput.dataset.valid = 'true';
                _evMsg.style.display = 'none';
            };
            img.onerror = () => {
                if (token !== _evToken) return;
                preview.src = '';
                preview.style.display = 'none';
                _evUrlInput.dataset.valid = 'false';
                _evMsg.textContent = 'Image could not be loaded from the provided URL.';
                _evMsg.style.display = 'block';
            };
            img.src = url;
        } else if (!url && (!fileInput || fileInput.files.length === 0)) {
            hideEventPreview();
        }
    });
}

// Handle event form submission
document.getElementById('eventForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!isLoggedIn()) {
        showNotification('You must be logged in to perform this action', 'error');
        return;
    }

    const title = e.target.title.value.trim();
    const description = e.target.description.value.trim();
    const dateVal = e.target.date.value;
    const locationVal = e.target.location.value.trim();

    if (!title) { showNotification('Title is required', 'error'); return; }
    if (!description) { showNotification('Description is required', 'error'); return; }
    if (!dateVal || isNaN(Date.parse(dateVal))) { showNotification('Please provide a valid date', 'error'); return; }
    if (!locationVal) { showNotification('Location is required', 'error'); return; }

    const fileInput = e.target.querySelector('input[type="file"][name="image"]');

    try {
        let result;
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
            const form = new FormData(e.target);
            result = await addEvent(form);
        } else {
            const obj = Object.fromEntries(new FormData(e.target).entries());
            if (obj.imageUrl) {
                const ok = await waitForImageUrlValidation(_evUrlInput, 4000);
                if (!ok) {
                    showNotification('Please provide a valid image URL or upload an image file', 'error');
                    return;
                }
                obj.image = obj.imageUrl;
            }
            delete obj.imageUrl;
            result = await addEvent(obj);
        }

        if (result && result.success) {
            showNotification('Event created successfully!', 'success');
            e.target.reset();
            hideEventPreview();
            showAdminPage('events');
        } else {
            showNotification(result?.message || 'Failed to create event', 'error');
        }
    } catch (error) {
        const server = error?.response;
        if (server?.errors && Array.isArray(server.errors)) {
            showNotification(server.errors[0], 'error');
        } else if (server?.message) {
            showNotification(server.message, 'error');
        } else {
            showNotification(error.message || 'Error creating event', 'error');
        }
    }
});

// Show add news form
function showAddNewsForm() {
    document.querySelectorAll('.admin-page').forEach(page => {
        page.style.display = 'none';
    });
    const form = document.getElementById('newsForm');
    if (form) form.reset();
    document.getElementById('addNewsForm').style.display = 'block';
}

// Handle news form submission
document.getElementById('newsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!isLoggedIn()) {
        showNotification('You must be logged in to perform this action', 'error');
        return;
    }

    const title = e.target.title.value.trim();
    const excerpt = e.target.excerpt.value.trim();
    const content = e.target.content.value.trim();
    const imageUrl = e.target.imageUrl.value.trim();

    if (!title) { showNotification('Title is required', 'error'); return; }
    if (!excerpt) { showNotification('Excerpt is required', 'error'); return; }
    if (!content) { showNotification('Content is required', 'error'); return; }

    try {
        const payload = { title, excerpt, content };
        if (imageUrl) payload.image = imageUrl;

        const result = await addNews(payload);

        if (result && result.success) {
            showNotification('News created successfully!', 'success');
            e.target.reset();
            showAdminPage('news');
        } else {
            showNotification(result?.message || 'Failed to create news', 'error');
        }
    } catch (error) {
        const server = error?.response;
        if (server?.errors && Array.isArray(server.errors)) {
            showNotification(server.errors[0], 'error');
        } else if (server?.message) {
            showNotification(server.message, 'error');
        } else {
            showNotification(error.message || 'Error creating news', 'error');
        }
    }
});