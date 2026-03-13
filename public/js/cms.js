// CMS LOADER
// Fetches content from Supabase and populates elements with [data-cms-id]

document.addEventListener('DOMContentLoaded', async () => {
    await loadContent();
});

async function loadContent() {
    // 1. Find all editable elements
    const elements = document.querySelectorAll('[data-cms-id]');
    if (elements.length === 0) return;

    // 2. Fetch all content from DB
    // Optimization: We could fetch only needed keys, but fetching all is easier for now.
    const { data: contentMap, error } = await window.supabaseClient
        .from('site_content')
        .select('key, content, type');

    if (error) {
        console.error("CMS: Failed to load content", error);
        return;
    }

    // 3. Apply content
    const contentDict = {};
    contentMap.forEach(item => contentDict[item.key] = item);

    elements.forEach(el => {
        const key = el.getAttribute('data-cms-id');
        const item = contentDict[key];

        if (item && item.content) {
            if (item.type === 'image' && el.tagName === 'IMG') {
                el.src = item.content;
            } else {
                el.innerHTML = item.content; // Use innerHTML to preserve formatting
            }
        }
    });

    // 4. Handle Dynamic Layout Override
    const dynamicContainer = document.getElementById('dynamic-layout');
    if (dynamicContainer) {
        const layoutItem = contentMap.find(item => item.key === 'main_layout');
        if (layoutItem && layoutItem.content) {
            try {
                const layoutSections = JSON.parse(layoutItem.content);
                if (Array.isArray(layoutSections) && layoutSections.length > 0) {
                    console.log("CMS: Applying dynamic layout override");
                    dynamicContainer.innerHTML = layoutSections.join('');

                    // Re-run element population for the newly injected elements
                    elements.forEach(el => {
                        const key = el.getAttribute('data-cms-id');
                        const item = contentDict[key];
                        if (item && item.content) {
                            if (item.type === 'image' && el.tagName === 'IMG') el.src = item.content;
                            else el.innerHTML = item.content;
                        }
                    });
                }
            } catch (e) {
                console.error("CMS: Failed to parse dynamic layout", e);
            }
        }
    }

    // 5. Initialize Editor if Admin
    checkEditorAccess();
}

async function checkEditorAccess() {
    console.log("CMS: Checking editor access...");
    const { data: { session } } = await window.supabaseClient.auth.getSession();

    if (session) {
        console.log("CMS: Session found for", session.user.email);

        // Check if admin
        const { data: userRole, error } = await window.supabaseClient
            .from('admin_users')
            .select('role')
            .eq('email', session.user.email)
            .single();

        if (error) {
            console.error("CMS: Error fetching role", error);
        }

        if (userRole) {
            console.log("CMS: User is admin, loading editor...");
            // Load Editor Script dynamically
            const script = document.createElement('script');
            script.src = 'js/editor.js';
            script.onload = () => console.log("CMS: Editor script loaded.");
            script.onerror = () => console.error("CMS: Failed to load editor.js");
            document.body.appendChild(script);
        } else {
            console.log("CMS: User is not in admin_users table.");
        }
    } else {
        console.log("CMS: No session found.");
    }
}
