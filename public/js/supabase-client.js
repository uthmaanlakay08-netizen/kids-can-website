// Initialize Supabase Client
// Ensure the Supabase JS library is loaded before this script
const SUPABASE_URL = 'https://jdysabfogmtcrqojrliu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_GF5VN8iXgC-Ejl6E7x0PuQ_Crk8KIk0';

// Check if supabase object exists (from CDN)
if (typeof supabase === 'undefined') {
    console.error('Supabase client library not loaded! Make sure to include the CDN script.');
} else {
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('Supabase client initialized');
}
