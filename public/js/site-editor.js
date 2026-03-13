/**
 * SITE EDITOR CORE
 * Controls the parent UI, iframe management, and design logic.
 */

let currentView = 'desktop';
let currentMode = 'edit';
let isGridVisible = false;
let isSnapEnabled = true;
let selectedPage = 'index.html';

const iframe = document.getElementById('site-iframe');

// 1. IFRAME MANAGEMENT
iframe.onload = () => {
    console.log("Editor: Iframe loaded, injecting edit-mode script...");
    injectEditScript();
    loadInitialDraft();
};

async function loadInitialDraft() {
    // Initialize Sidebar Click Handlers (Moved outside of data check)
    document.querySelectorAll('.component-tile').forEach(tile => {
        tile.addEventListener('click', () => {
            const type = tile.getAttribute('data-type');
            addSection(type);
        });
    });

    if (!supabase) return;
    const { data, error } = await supabase
        .from('site_drafts')
        .select('layout_json')
        .eq('page_path', selectedPage)
        .single();

    if (data && data.layout_json) {
        const layout = JSON.parse(data.layout_json);
        if (layout.body) {
            iframe.contentDocument.body.innerHTML = layout.body;
            console.log("Editor: Initial draft loaded into iframe.");
        }
    }
}

function addSection(type) {
    const template = sectionTemplates[type];
    if (template) {
        const frameDoc = iframe.contentDocument;
        const div = frameDoc.createElement('div');
        div.innerHTML = template;
        frameDoc.body.appendChild(div.firstElementChild);
        saveDraft(true); // Auto-save after adding section
    }
}

const sectionTemplates = {
    hero: `<section class="hero" style="min-height:60vh; display:flex; align-items:center; justify-content:center; background:#2563eb; color:white; text-align:center; padding:40px;">
        <div>
            <h1 style="font-size:3rem; margin-bottom:20px;">New Hero Banner</h1>
            <p style="font-size:1.2rem;">Click here to edit this subtext and change the background color.</p>
        </div>
    </section>`,
    stories: `<section class="stories" style="padding:60px 20px; background:#f8fafc;">
        <h2 style="text-align:center; margin-bottom:40px;">Brave Heroes</h2>
        <div class="stories-grid" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:20px; max-width:1200px; margin:0 auto;">
            <div style="background:white; padding:20px; border-radius:12px; box-shadow:0 4px 6px rgba(0,0,0,0.05); text-align:center;">
                <div style="width:100%; height:150px; background:#e2e8f0; border-radius:8px; margin-bottom:15px;"></div>
                <h4>Hero Name</h4>
                <p style="font-size:0.8rem; color:#64748b;">Short bio goes here.</p>
            </div>
        </div>
    </section>`,
    donate: `<section class="donate" style="padding:40px; background:#fbbf24; text-align:center; border-radius:15px; margin:20px;">
        <h2 style="margin-bottom:15px;">Support Our Mission</h2>
        <button style="background:black; color:white; padding:12px 24px; border-radius:8px; border:none; font-weight:700;">DONATE NOW</button>
    </section>`
};

function injectEditScript() {
    const frameWin = iframe.contentWindow;
    const frameDoc = iframe.contentDocument;

    // Inject the script file
    const script = frameDoc.createElement('script');
    script.src = 'js/edit-mode.js';
    frameDoc.head.appendChild(script);

    // Sync current mode to the iframe
    syncModeToIframe();
}

function loadPage(page) {
    selectedPage = page;
    iframe.src = page;
}

// 2. TOOLBAR CONTROLS
function setView(view) {
    currentView = view;
    const container = document.getElementById('editor-frame-container');

    // Reset classes
    container.className = '';
    container.classList.add(`canvas-${view}`);

    // Update button states
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
}

function setMode(mode) {
    currentMode = mode;
    document.getElementById('mode-edit').classList.toggle('active', mode === 'edit');
    document.getElementById('mode-preview').classList.toggle('active', mode === 'preview');
    syncModeToIframe();
}

function syncModeToIframe() {
    iframe.contentWindow.postMessage({ type: 'SET_MODE', data: currentMode }, '*');
}

function toggleGrid() {
    isGridVisible = !isGridVisible;
    document.getElementById('grid-overlay').style.display = isGridVisible ? 'block' : 'none';
    document.getElementById('gridToggle').classList.toggle('active', isGridVisible);
}

function updateGridSize(size) {
    const grid = document.getElementById('grid-overlay');
    grid.style.backgroundSize = `${size}px ${size}px`;
}

function toggleSnap() {
    isSnapEnabled = !isSnapEnabled;
    document.getElementById('snapToggle').classList.toggle('active', isSnapEnabled);
}

// 3. SELECTION & STYLING
window.addEventListener('message', (event) => {
    const { type, data } = event.data;

    if (type === 'ELEMENT_SELECTED') {
        showStyleControls(data);
    } else if (type === 'SELECTION_CLEARED') {
        hideStyleControls();
    } else if (type === 'SHOW_GUIDES') {
        renderGuides(data);
    } else if (type === 'LAYOUT_UPDATED') {
        saveDraft(true); // Auto-save on layout change
    }
});

function renderGuides(data) {
    if (!isSnapEnabled && !isGridVisible) return;
    const overlay = document.getElementById('grid-overlay');
    overlay.innerHTML = ''; // Clear previous

    if (isSnapEnabled) {
        // Horizontal Snap Line (Center of element)
        const vLine = document.createElement('div');
        vLine.style.cssText = `position:absolute; left:${data.x}px; top:0; bottom:0; width:1px; background:rgba(37, 99, 235, 0.4); z-index:100;`;
        overlay.appendChild(vLine);

        // Vertical Snap Line (Center of element)
        const hLine = document.createElement('div');
        hLine.style.cssText = `position:absolute; top:${data.y}px; left:0; right:0; height:1px; background:rgba(37, 99, 235, 0.4); z-index:100;`;
        overlay.appendChild(hLine);

        // Spacing/Coordinate Badge
        const badge = document.createElement('div');
        badge.style.cssText = `position:absolute; left:${data.x + 10}px; top:${data.y - 25}px; background:#2563eb; color:white; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; z-index:101;`;
        badge.innerText = `X: ${Math.round(data.x)} Y: ${Math.round(data.y)}`;
        overlay.appendChild(badge);
    }
}

function showStyleControls(elementData) {
    document.getElementById('no-selection-msg').classList.add('hidden');
    document.getElementById('style-controls').classList.remove('hidden');

    // Populate inputs with current styles
    document.getElementById('style-font-size').value = elementData.styles.fontSize;
    document.getElementById('style-color').value = elementData.styles.color;
    document.getElementById('style-bg-color').value = elementData.styles.backgroundColor;
    document.getElementById('style-padding-top').value = elementData.styles.paddingTop;
    document.getElementById('style-padding-bottom').value = elementData.styles.paddingBottom;
    document.getElementById('style-text-align').value = elementData.styles.textAlign;
    document.getElementById('style-radius').value = elementData.styles.borderRadius;
    document.getElementById('style-opacity').value = elementData.styles.opacity;

    // Store current selection for AI context
    window.currentSelection = elementData;
}

function hideStyleControls() {
    document.getElementById('no-selection-msg').classList.remove('hidden');
    document.getElementById('style-controls').classList.add('hidden');
    window.currentSelection = null;
}

function applyStyle(property, value) {
    iframe.contentWindow.postMessage({
        type: 'APPLY_STYLE',
        data: { property, value }
    }, '*');
}

// 4. RIGHT PANEL NAVIGATION
function switchRightTab(tab) {
    document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    const tabBtn = document.querySelector(`.panel-tab[onclick*="${tab}"]`);
    const content = document.getElementById(`${tab}-tab-content`);

    if (tabBtn && content) {
        tabBtn.classList.add('active');
        content.classList.add('active');
    }
}

// 5. AI ASSISTANT LOGIC
async function askAI() {
    const input = document.getElementById('aiInput');
    const prompt = input.value.trim();
    if (!prompt) return;

    const chat = document.getElementById('aiChat');
    const userMsg = document.createElement('div');
    userMsg.style.cssText = "align-self: flex-end; background: #2563eb; color: white; padding: 0.75rem; border-radius: 12px; font-size: 0.85rem; max-width: 80%;";
    userMsg.innerText = prompt;
    chat.appendChild(userMsg);

    input.value = '';
    chat.scrollTop = chat.scrollHeight;

    // Simulate AI Response based on selection
    setTimeout(() => {
        const response = generateAIResponse(prompt, window.currentSelection);
        const aiMsg = document.createElement('div');
        aiMsg.style.cssText = "background: rgba(255,255,255,0.05); padding: 0.75rem; border-radius: 12px; font-size: 0.85rem; max-width: 80%;";
        aiMsg.innerHTML = `
            ${response.message}
            ${response.action ? `<button class="btn btn-primary" style="margin-top:0.5rem; padding:4px 8px; font-size:10px;" onclick="${response.action}">Apply Changes</button>` : ''}
        `;
        chat.appendChild(aiMsg);
        chat.scrollTop = chat.scrollHeight;
    }, 1000);
}

function generateAIResponse(prompt, selection) {
    const p = prompt.toLowerCase();

    if (!selection) {
        return { message: "I'm ready to help! Please select an element on the page so I have some context to work with." };
    }

    if (p.includes('headline') || p.includes('rewrite') || p.includes('better')) {
        return {
            message: `I see you've selected a **${selection.tagName}**. I can rewrite this to be more emotional. How about: *"Giving hope to every child battling cancer"*?`,
            action: `iframe.contentWindow.postMessage({type: 'AI_UPDATE', data: {type: 'text', value: 'Giving hope to every child battling cancer'}}, '*')`
        };
    }

    if (p.includes('color') || p.includes('style')) {
        return {
            message: "I recommend a softer blue for the background to improve readability. Should I apply it?",
            action: `iframe.contentWindow.postMessage({type: 'AI_UPDATE', data: {type: 'style', value: {backgroundColor: '#dbeafe', color: '#1e40af'}}}, '*')`
        };
    }

    return { message: "I've analyzed that section! I can help you with styling, text refinement, or even spacing adjustments. What would you like to do?" };
}

// 6. PERSISTENCE (Supabase Integration)
const supabaseUrl = 'https://jdysabfogmtcrqojrliu.supabase.co';
const supabaseKey = 'sb_publishable_GF5VN8iXgC-Ejl6E7x0PuQ_Crk8KIk0';
const supabase = window.supabase?.createClient ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;

async function saveDraft(isAutoSave = false) {
    if (!supabase) {
        console.warn("Supabase not initialized. Simulation mode.");
        if (!isAutoSave) alert("Draft saved (Simulation Mode)");
        return;
    }

    try {
        const frameDoc = iframe.contentDocument;
        // Clean up editor artifacts before saving (handles, outlines)
        const cleanHtml = frameDoc.body.innerHTML
            .replace(/style="outline:[^;]+;"/g, '')
            .replace(/contenteditable="true"/g, 'contenteditable="false"')
            .replace(/<div class="section-handle">.*?<\/div>/g, '');

        const { data, error } = await supabase
            .from('site_drafts')
            .upsert({
                page_path: selectedPage,
                layout_json: JSON.stringify({ body: cleanHtml }),
                updated_at: new Date().toISOString()
            }, { onConflict: 'page_path' });

        if (error) throw error;
        console.log(`Draft ${isAutoSave ? 'auto-saved' : 'saved'} successfully.`);
        if (!isAutoSave) alert("Draft saved successfully! ✨");
    } catch (err) {
        console.error("Error saving draft:", err);
        if (!isAutoSave) alert("Failed to save draft. Check console.");
    }
}

async function publishLive() {
    if (!confirm("Are you sure you want to publish these changes? This will overwrite the live website.")) return;

    try {
        const frameDoc = iframe.contentDocument;
        const cleanHtml = frameDoc.body.innerHTML
            .replace(/style="outline:[^;]+;"/g, '')
            .replace(/contenteditable="true"/g, 'contenteditable="false"')
            .replace(/<div class="section-handle">.*?<\/div>/g, '');

        // 1. Save to site_content (the live data map used by cms.js)
        const { error: contentError } = await supabase
            .from('site_content')
            .upsert({
                key: 'main_layout',
                content: JSON.stringify([cleanHtml]),
                type: 'layout'
            }, { onConflict: 'key' });

        if (contentError) throw contentError;

        // 2. Log version history
        await supabase
            .from('site_versions')
            .insert({
                page_path: selectedPage,
                layout_json: { body: cleanHtml },
                version_label: `Published ${new Date().toLocaleString()}`
            });

        alert("Changes are now LIVE! 🚀 Syncing with production...");
    } catch (err) {
        console.error("Error publishing:", err);
        alert("Failed to publish. Check console.");
    }
}
