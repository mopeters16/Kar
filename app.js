// Map Elements
let map;
let startMarker;
let destinationMarker;
let routeControl;
let geocoder;

// DOM Elements
const elements = {
    themeToggle: document.getElementById("theme-toggle"),
    startAddress: document.getElementById("start-address"),
    destinationAddress: document.getElementById("destination-address"),
    detectLocation: document.getElementById("detect-location"),
    findRide: document.getElementById("find-ride"),
    offerRide: document.getElementById("offer-ride"),
    status: document.getElementById("status"),
    eta: document.getElementById("eta"),
    price: document.getElementById("price"),
    navItems: document.querySelectorAll(".nav-item"),
    pages: document.querySelectorAll(".page"),
    bookRideBtn: document.querySelector(".book-ride-btn")
};

// Initialize Map (only when booking page is loaded)
function initMap() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const tileUrl = isDark 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    
    map = L.map('map').setView([40.7128, -74.0060], 13);
    
    L.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(map);
    
    // Initialize geocoder
    geocoder = L.Control.Geocoder.nominatim();
    
    // Setup event listeners for booking page
    setupBookingPageListeners();
}

// Setup all event listeners
function setupEventListeners() {
    // Theme toggle
    elements.themeToggle.addEventListener('click', toggleTheme);
    
    // Navigation items
    elements.navItems.forEach(item => {
        item.addEventListener('click', () => switchPage(item.dataset.page));
    });
    
    // Book ride button on home page
    elements.bookRideBtn.addEventListener('click', () => switchPage('book'));
}
// Add this near your other event listeners
function setupPWAInstallPrompt() {
  let deferredPrompt;

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    
    // Show your custom install button/prompt
    showInstallButton();
  });

  function showInstallButton() {
    const installBtn = document.createElement('button');
    installBtn.id = 'install-btn';
    installBtn.innerHTML = '<i class="fas fa-download"></i> Install App';
    installBtn.className = 'primary-btn';
    installBtn.style.position = 'fixed';
    installBtn.style.bottom = '20px';
    installBtn.style.right = '20px';
    installBtn.style.zIndex = '1000';
    
    installBtn.addEventListener('click', () => {
      // Hide our user interface
      installBtn.style.display = 'none';
      // Show the install prompt
      deferredPrompt.prompt();
      // Wait for the user to respond to the prompt
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted install');
        } else {
          console.log('User dismissed install');
        }
        deferredPrompt = null;
      });
    });

    document.body.appendChild(installBtn);
  }
}

// Call this in your initApp function
function initApp() {
  loadTheme();
  setupEventListeners();
  setupPWAInstallPrompt();  
  switchPage('home');
}
// Setup booking page specific listeners
function setupBookingPageListeners() {
    // Current location button
    elements.detectLocation.addEventListener('click', getCurrentLocation);
    
    // Address search inputs
    elements.startAddress.addEventListener('input', debounce(() => handleAddressInput('start')));
    elements.destinationAddress.addEventListener('input', debounce(() => handleAddressInput('destination')));
    
    // Find ride button
    elements.findRide.addEventListener('click', findRide);
    
    // Offer ride button
    elements.offerRide.addEventListener('click', () => {
        showAlert('Driver mode coming soon!');
    });
}

// Switch between pages
function switchPage(pageId) {
    // Get current and new pages
    const currentPage = document.querySelector('.page.active');
    const newPage = document.getElementById(`${pageId}-page`);
    
    if (!newPage || currentPage === newPage) return;
    
    // Update active nav item
    elements.navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageId);
    });
    
    // Start transition
    currentPage.classList.remove('active');
    
    // Wait for fade out before showing new page
    setTimeout(() => {
        newPage.classList.add('active');
        
        // Initialize map if booking page is shown
        if (pageId === 'book' && !map) {
            initMap();
        }
        
        // Resize map when booking page is shown
        if (pageId === 'book' && map) {
            setTimeout(() => {
                map.invalidateSize();
            }, 300);
        }
    }, 300);
}

// Handle address input with debounce
function handleAddressInput(type) {
    const input = type === 'start' ? elements.startAddress : elements.destinationAddress;
    const query = input.value.trim();
    
    if (query.length > 2) {
        searchAddress(query, type);
    }
}

// Search address using geocoder
function searchAddress(query, type) {
    geocoder.geocode(query, (results) => {
        if (results.length > 0) {
            const location = results[0].center;
            const address = results[0].name;
            
            if (type === 'start') {
                setStartLocation(location, address);
            } else {
                setDestination(location, address);
            }
        }
    });
}

// Set start location on map
function setStartLocation(latLng, address) {
    if (startMarker) map.removeLayer(startMarker);
    
    startMarker = L.marker(latLng, {
        icon: L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
            iconSize: [32, 32],
            iconAnchor: [16, 32]
        }),
        zIndexOffset: 1000
    }).addTo(map).bindPopup(`Start: ${address}`);
    
    map.setView(latLng, 15);
    updateStatus('Start location set', 'success');
    
    // If destination exists, calculate route
    if (destinationMarker) {
        calculateRoute(latLng, destinationMarker.getLatLng());
    }
}

// Set destination on map
function setDestination(latLng, address) {
    if (destinationMarker) map.removeLayer(destinationMarker);
    
    destinationMarker = L.marker(latLng, {
        icon: L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            className: 'destination-marker'
        }),
        zIndexOffset: 900
    }).addTo(map).bindPopup(`Destination: ${address}`);
    
    updateStatus('Destination set', 'success');
    
    // If start location exists, calculate route
    if (startMarker) {
        calculateRoute(startMarker.getLatLng(), latLng);
    }
}

// Get current GPS location with enhanced error handling
function getCurrentLocation() {
    updateStatus('Detecting your location...', 'loading');
    
    if (!navigator.geolocation) {
        updateStatus('Geolocation not supported', 'error');
        showAlert('Your browser does not support location detection');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        position => {
            const latLng = L.latLng(position.coords.latitude, position.coords.longitude);
            updateStatus('Location found! Getting address...', 'loading');
            
            // Add temporary marker while geocoding
            const tempMarker = L.marker(latLng, {
                icon: L.icon({
                    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
                    iconSize: [32, 32],
                    iconAnchor: [16, 32]
                }),
                zIndexOffset: 1000
            }).addTo(map).bindPopup('Your location');
            
            map.setView(latLng, 15);
            
            // Reverse geocode with error handling
            reverseGeocode(latLng, 'start').then(() => {
                map.removeLayer(tempMarker);
            }).catch(err => {
                updateStatus('Found location but could not get address', 'error');
                console.error('Geocoding error:', err);
                showAlert('We found your location but could not get the address. Please enter it manually.');
                // Fallback - show coordinates if address lookup fails
                elements.startAddress.value = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
                setStartLocation(latLng, 'Your current location');
            });
        },
        error => {
            let errorMessage = 'Could not determine your location.';
            let suggestion = '';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Location access was denied.';
                    suggestion = 'Please enable location permissions in your browser settings.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Location detection failed.';
                    suggestion = 'Please check your network/GPS connection or try again later.';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Location request timed out.';
                    suggestion = 'Please ensure you have a stable internet connection.';
                    break;
                default:
                    errorMessage = 'An unknown error occurred while getting your location.';
            }
            
            updateStatus(`${errorMessage} ${suggestion}`, 'error');
            showAlert(`${errorMessage} ${suggestion}`);
        },
        {
            enableHighAccuracy: true,
            timeout: 15000, // 15 seconds timeout
            maximumAge: 0 // Don't use cached position
        }
    );
}

// Convert coordinates to address with retry logic
function reverseGeocode(latLng, type) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 2;
        
        function attemptGeocode() {
            geocoder.reverse(latLng, map.getZoom(), (results) => {
                if (results && results.length > 0) {
                    const address = results[0].name;
                    const input = type === 'start' ? elements.startAddress : elements.destinationAddress;
                    input.value = address;
                    
                    if (type === 'start') {
                        setStartLocation(latLng, address);
                    } else {
                        setDestination(latLng, address);
                    }
                    resolve();
                } else if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(attemptGeocode, 1000);
                } else {
                    reject(new Error('No results found after multiple attempts'));
                }
            });
        }
        
        attemptGeocode();
    });
}

// Calculate route between points
function calculateRoute(start, end) {
    if (routeControl) {
        map.removeControl(routeControl);
    }
    
    routeControl = L.Routing.control({
        waypoints: [start, end],
        routeWhileDragging: true,
        showAlternatives: false,
        fitSelectedRoutes: true,
        lineOptions: {
            styles: [{color: '#6366f1', opacity: 0.8, weight: 5}]
        }
    }).addTo(map);
    
    routeControl.on('routesfound', (e) => {
        const route = e.routes[0].summary;
        const distance = (route.totalDistance / 1000).toFixed(1);
        const time = Math.ceil(route.totalTime / 60);
        const price = (time * 1.5).toFixed(2);
        
        elements.eta.textContent = `${time} min (${distance} km)`;
        elements.price.textContent = `$${price}`;
        updateStatus('Route calculated', 'success');
    });
}

// Find ride handler
function findRide() {
    if (!startMarker) {
        showAlert('Please set your starting location');
        return;
    }
    
    if (!destinationMarker) {
        showAlert('Please set a destination');
        return;
    }
    
    updateStatus('Finding available rides...', 'loading');
    
    // Simulate finding a driver
    setTimeout(() => {
        updateStatus('Driver found!', 'success');
    }, 1500);
}

// Theme toggle
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    elements.themeToggle.innerHTML = newTheme === 'dark' 
        ? '<i class="fas fa-sun"></i>' 
        : '<i class="fas fa-moon"></i>';
    
    // Update map tiles if map exists
    if (map) {
        const tileUrl = newTheme === 'dark'
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        
        map.eachLayer(layer => {
            if (layer instanceof L.TileLayer) {
                layer.setUrl(tileUrl);
            }
        });
    }
    
    localStorage.setItem('theme', newTheme);
}

// Load saved theme
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    elements.themeToggle.innerHTML = savedTheme === 'dark' 
        ? '<i class="fas fa-sun"></i>' 
        : '<i class="fas fa-moon"></i>';
}

// Update status display
function updateStatus(message, type = 'info') {
    elements.status.textContent = message;
    elements.status.style.color = {
        'info': 'var(--text)',
        'loading': 'var(--primary)',
        'success': '#10b981',
        'error': '#ef4444'
    }[type];
}

// Show alert notification
function showAlert(message) {
    const alert = document.createElement('div');
    alert.className = 'alert-notification';
    alert.innerHTML = `
        <div class="alert-content">
            <i class="fas fa-info-circle"></i>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(alert);
    
    setTimeout(() => {
        alert.classList.add('show');
        setTimeout(() => {
            alert.classList.remove('show');
            setTimeout(() => alert.remove(), 300);
        }, 3000);
    }, 10);
}

// Debounce function
function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}
// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registered');
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registered');
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}