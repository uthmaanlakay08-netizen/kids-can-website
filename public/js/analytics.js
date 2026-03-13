
// Simple Analytics Tracker
(async function () {
    console.log("Analytics: Initializing...");

    if (typeof window.supabaseClient === 'undefined') {
        console.warn("Analytics: Supabase client not found. Skipping tracking.");
        return;
    }

    try {
        const { error } = await window.supabaseClient.from('page_views').insert([{
            path: window.location.pathname,
            user_agent: navigator.userAgent
        }]);

        if (error) {
            console.error("Analytics: Failed to track view", error);
        } else {
            console.log("Analytics: Page view recorded for", window.location.pathname);
        }
    } catch (err) {
        console.error("Analytics: Error", err);
    }
})();
