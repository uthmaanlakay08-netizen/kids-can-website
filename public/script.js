document.addEventListener('DOMContentLoaded', () => {
    // Mobile Menu Toggle
    const mobileMenu = document.getElementById('mobile-menu');
    const navMenu = document.querySelector('.nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');

    mobileMenu.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        mobileMenu.classList.toggle('is-active');
    });

    // Close menu when clicking a link
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            mobileMenu.classList.remove('is-active');
        });
    });

    // Smooth Scrolling for anchor links (polyfill support not strict for modern browsers but good practice)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();

            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const headerOffset = 80;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });
            }
        });
    });

    // Donation Buttons Selection
    const donateButtons = document.querySelectorAll('.donate-amount');

    donateButtons.forEach(button => {
        button.addEventListener('click', function () {
            // Remove active class from all buttons
            donateButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
        });
    });

    // Simple Animation on Scroll (Intersection Observer)
    const elementsToAnimate = document.querySelectorAll('.story-card, .impact-item, .section-title');

    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in-up');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    elementsToAnimate.forEach(el => {
        el.style.opacity = "0";
        el.style.transform = "translateY(20px)";
        el.style.transition = "opacity 0.6s ease-out, transform 0.6s ease-out";
        observer.observe(el);
    });

    // Add the class for the transition in CSS dynamically if preferred, 
    // but here we just used inline styles for the initial state and will toggle a class or styles.
    // Let's actually add a stylesheet rule for .fade-in-up or manage it here.


    // Better approach: Add class via JS
    const style = document.createElement('style');
    style.innerHTML = `
        .fade-in-up {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    `;
    document.head.appendChild(style);

    // Fetch Home Heroes
    fetchHomeHeroes();
});

async function fetchHomeHeroes() {
    const grid = document.getElementById('homeHeroesGrid');
    if (!grid) return;

    if (!window.supabaseClient) {
        grid.innerHTML = '<p>Error: Supabase client not initialized.</p>';
        return;
    }

    // Fetch with timeout
    const fetchPromise = window.supabaseClient
        .from('heroes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);
        
    const timeoutPromise = new Promise(r => setTimeout(() => r({ timeout: true }), 5000));
    const result = await Promise.race([fetchPromise, timeoutPromise]);

    if (result.timeout) {
        console.warn('Home Heroes: Fetch timed out.');
        grid.innerHTML = '<p>Latest stories are taking a while. Please refresh or check back later.</p>';
        return;
    }

    const { data: heroes, error } = result;

    if (error) {
        console.error('Error loading home heroes', error);
        grid.innerHTML = '<p>Could not load heroes.</p>';
        return;
    }

    grid.innerHTML = '';

    if (heroes.length === 0) {
        grid.innerHTML = '<p>No stories yet.</p>';
        return;
    }

    heroes.forEach(hero => {
        const div = document.createElement('div');
        div.className = 'story-card';
        div.innerHTML = `
            <div class="story-img-container">
                <img src="${hero.image_url || 'hero-center-logo.jpg'}" alt="${hero.name}" loading="lazy">
            </div>
            <div class="story-content">
                <h3>${hero.name}, ${hero.age || ''}</h3>
                <p class="story-summary">${hero.story || ''}</p>
                <a href="stories.html" class="read-more">Read Full Story <i class="fas fa-arrow-right"></i></a>
            </div>
        `;
        grid.appendChild(div);
    });
}

// --- Facebook Feed Integration ---
async function fetchFacebookUpdates() {
    const feedContainer = document.getElementById('facebook-feed');
    if (!feedContainer) return;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch('/api/social/facebook', { signal: controller.signal });
        clearTimeout(timeoutId);
        const posts = await response.json();

        if (posts.error || !Array.isArray(posts) || posts.length === 0) {
            // Show helpful message
            if (posts.error && posts.error.includes('credentials')) {
                feedContainer.innerHTML = '<p class="text-center w-100 text-muted">Facebook feed not yet configured. Please add Page ID and Token.</p>';
            } else {
                feedContainer.innerHTML = '<p class="text-center w-100 text-muted">No recent updates found on the Facebook page.</p>';
            }
            return;
        }

        feedContainer.innerHTML = '';
        posts.slice(0, 3).forEach(post => {
            const date = new Date(post.created_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const imageUrl = post.full_picture || 'hero-center-logo.jpg';
            const message = post.message ? (post.message.length > 120 ? post.message.substring(0, 117) + '...' : post.message) : 'View post on Facebook';

            const card = document.createElement('div');
            card.className = 'update-card';
            card.innerHTML = `
                <div class="update-img-container">
                    <img src="${imageUrl}" alt="Kids-Can Update" loading="lazy">
                </div>
                <div class="update-content">
                    <span class="update-date">${date}</span>
                    <p class="update-text">${message}</p>
                    <a href="${post.permalink_url}" target="_blank" class="update-link">Read Full Post <i class="fas fa-external-link-alt"></i></a>
                </div>
            `;
            feedContainer.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading Facebook feed:', error);
        feedContainer.innerHTML = '<p class="text-center w-100 text-muted">Unable to load updates. Please check your connection.</p>';
    }
}

// Initialize Feed
document.addEventListener('DOMContentLoaded', fetchFacebookUpdates);
