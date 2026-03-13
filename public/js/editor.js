// VISUAL EDITOR V2 (CANVA-STYLE)
// Injected only for admins to provide a seamless visual editing experience.

console.log("Visual Editor V2 Initialized");

// 1. STYLES
const style = document.createElement('style');
style.textContent = `
    .cms-editable {
        outline: 2px dashed rgba(37, 99, 235, 0.1);
        cursor: text;
        transition: all 0.2s;
        position: relative;
    }
    .cms-editable:hover {
        outline: 2px dashed #2563eb;
        background: rgba(37, 99, 235, 0.02);
    }
    .cms-editable:focus {
        outline: 2px solid #2563eb;
        background: rgba(37, 99, 235, 0.05);
        box-shadow: 0 0 15px rgba(37, 99, 235, 0.1);
    }
    .cms-img-editable {
        cursor: pointer;
        position: relative;
    }
    .cms-img-editable:after {
        content: '📸 Change Image';
        position: absolute;
        top: 10px; right: 10px;
        background: rgba(0,0,0,0.7); color: white;
        padding: 4px 10px; border-radius: 4px;
        font-size: 10px; font-weight: bold;
        opacity: 0; transition: opacity 0.2s;
    }
    .cms-img-editable:hover:after { opacity: 1; }
    
    .cms-toolbar {
        position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
        background: #1e293b; color: white; padding: 12px 24px;
        border-radius: 100px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        z-index: 10001; display: flex; gap: 20px; align-items: center;
        font-family: 'Montserrat', sans-serif; backdrop-filter: blur(8px);
    }
    .cms-badge { background: #3b82f6; padding: 2px 8px; border-radius: 4px; font-size: 10px; text-transform: uppercase; }
    .cms-btn {
        background: #2563eb; border: none; color: white; padding: 8px 18px;
        border-radius: 50px; cursor: pointer; font-weight: 700; font-size: 0.85rem;
        transition: all 0.2s;
    }
    .cms-btn:hover { transform: scale(1.05); background: #1d4ed8; }
    .cms-btn.save { background: #10b981; }
    .cms-btn.cancel { background: #64748b; }
    .cms-unsaved { outline: 2px solid #f59e0b !important; }
`;
document.head.appendChild(style);

// 2. TOOLBAR
const toolbar = document.createElement('div');
toolbar.className = 'cms-toolbar';
toolbar.innerHTML = `
    <span class="cms-badge">Visual Editor</span>
    <button class="cms-btn save" onclick="saveAllChanges()">Push Changes Live</button>
    <button class="cms-btn cancel" onclick="location.reload()">Discard</button>
    <div style="width: 1px; height: 20px; background: #334155;"></div>
    <a href="admin.html" style="color:white; text-decoration:none; font-size: 0.8rem; font-weight: 600;">Go to Dashboard <i class="fas fa-arrow-right"></i></a>
`;
document.body.appendChild(toolbar);

// 3. EDITABLE LOGIC
const pendingChanges = {};
const editableElements = document.querySelectorAll('[data-cms-id]');

editableElements.forEach(el => {
    const key = el.getAttribute('data-cms-id');

    if (el.tagName === 'IMG') {
        el.classList.add('cms-img-editable');
        el.onclick = () => triggerImageUpload(key, el);
    } else {
        el.classList.add('cms-editable');
        el.contentEditable = true;
        el.oninput = () => {
            el.classList.add('cms-unsaved');
            queueChange(key, el.innerHTML, 'text');
        };
        if (el.tagName === 'A') el.onclick = (e) => e.preventDefault();
    }
});

function queueChange(key, content, type) {
    pendingChanges[key] = { key, content, type, updated_at: new Date() };
}

// 4. IMAGE HANDLER
function triggerImageUpload(key, imgEl) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        imgEl.style.opacity = '0.5';
        const path = `cms/${Date.now()}-${file.name}`;
        const { data, error } = await window.supabaseClient.storage.from('media').upload(path, file);

        if (error) { alert(error.message); imgEl.style.opacity = '1'; return; }

        const { data: { publicUrl } } = window.supabaseClient.storage.from('media').getPublicUrl(path);
        imgEl.src = publicUrl;
        imgEl.style.opacity = '1';
        imgEl.classList.add('cms-unsaved');
        queueChange(key, publicUrl, 'image');
    };
    input.click();
}

// 5. SAVE ALL
window.saveAllChanges = async function () {
    const btn = document.querySelector('.cms-btn.save');
    const originalText = btn.textContent;
    const updates = Object.values(pendingChanges);

    if (updates.length === 0) return alert("No changes detected.");

    btn.textContent = "Publishing...";
    btn.disabled = true;

    try {
        const { error } = await window.supabaseClient.from('site_content').upsert(updates);
        if (error) throw error;
        alert("Your changes are now LIVE on the website! 🎉");
        location.reload();
    } catch (err) {
        alert("Failed to publish: " + err.message);
        btn.textContent = originalText;
        btn.disabled = false;
    }
};
