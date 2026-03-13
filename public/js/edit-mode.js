/**
 * EDIT MODE PAYLOAD
 * This script is injected into the website iframe to enable live editing.
 * It communicates with the parent (site-editor.js).
 */

let isEditMode = true;
let selectedElement = null;
let hoverElement = null;

// 1. INITIALIZATION
window.addEventListener('message', (event) => {
    const { type, data } = event.data;

    if (type === 'SET_MODE') {
        setEditMode(data === 'edit');
    } else if (type === 'APPLY_STYLE') {
        if (selectedElement) {
            selectedElement.style[data.property] = data.value;
        }
    } else if (type === 'AI_UPDATE') {
        handleAIUpdate(data);
    }
});

function setEditMode(active) {
    isEditMode = active;
    document.body.classList.toggle('builder-active', active);
    if (!active) {
        clearSelection();
        removeHoverHighlight();
    }
}

// 2. DRAG & DROP + SNAPPING ENGINE
// We'll load SortableJS dynamically inside the iframe
const sortableScript = document.createElement('script');
sortableScript.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.min.js';
document.head.appendChild(sortableScript);

sortableScript.onload = () => {
    initSortables();
};

function initSortables() {
    // 1. Make sections reorderable
    new Sortable(document.body, {
        animation: 150,
        handle: '.section-handle',
        draggable: 'section',
        ghostClass: 'sortable-ghost',
        onEnd: () => window.parent.postMessage({ type: 'LAYOUT_UPDATED' }, '*')
    });

    // 2. Make certain containers (like grids/columns) reorderable
    document.querySelectorAll('.about-grid, .stories-grid, .impact-grid, .movement-cards').forEach(container => {
        new Sortable(container, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: () => window.parent.postMessage({ type: 'LAYOUT_UPDATED' }, '*')
        });
    });
}

// 3. SNAPPING & ALIGNMENT HELPERS
// This is triggered when an element is active or being manually positioned
function showAlignmentGuides(el) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Send center values to parent to show guides on the overlay
    window.parent.postMessage({
        type: 'SHOW_GUIDES',
        data: { x: centerX, y: centerY, rect: rect }
    }, '*');
}

// 4. INTERACTION ENGINE
document.addEventListener('mouseover', (e) => {
    if (!isEditMode) return;
    const target = e.target.closest('section, div, p, h1, h2, h3, h4, h5, img, button');
    if (target && target !== hoverElement) {
        highlightHover(target);
    }
});

document.addEventListener('click', (e) => {
    if (!isEditMode) return;

    // Prevent default actions (links, etc) while in edit mode
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
    }
    e.stopPropagation();

    const target = e.target.closest('section, div, p, h1, h2, h3, h4, h5, img, button');
    if (target) {
        selectElement(target);
        showAlignmentGuides(target);
    } else {
        clearSelection();
    }
});

function highlightHover(el) {
    removeHoverHighlight();
    hoverElement = el;
    el.style.outline = '2px dashed #3b82f6';
    el.style.outlineOffset = '-2px';

    // Add a drag handle if it's a section
    if (el.tagName === 'SECTION') {
        let handle = el.querySelector('.section-handle');
        if (!handle) {
            handle = document.createElement('div');
            handle.className = 'section-handle';
            handle.innerHTML = '<i class="fas fa-arrows-alt"></i>';
            handle.style.cssText = "position:absolute; top:10px; right:10px; background:#2563eb; color:white; padding:5px; border-radius:4px; z-index:100; cursor:grab;";
            el.style.position = 'relative';
            el.appendChild(handle);
        }
    }
}

function removeHoverHighlight() {
    if (hoverElement) {
        hoverElement.style.outline = '';
        const handle = hoverElement.querySelector('.section-handle');
        if (handle) handle.remove();
    }
}

function selectElement(el) {
    clearSelection();
    selectedElement = el;
    el.style.outline = '2px solid #2563eb';
    el.style.outlineOffset = '-2px';

    // Enable inline editing for text elements
    if (['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'SPAN'].includes(el.tagName)) {
        el.contentEditable = 'true';
        el.focus();
    }

    // Send element data to parent to update property panel
    const styles = window.getComputedStyle(el);
    window.parent.postMessage({
        type: 'ELEMENT_SELECTED',
        data: {
            tagName: el.tagName,
            text: el.innerText,
            styles: {
                fontSize: styles.fontSize,
                color: rgbToHex(styles.color),
                backgroundColor: rgbToHex(styles.backgroundColor),
                paddingTop: styles.paddingTop,
                paddingBottom: styles.paddingBottom,
                textAlign: styles.textAlign,
                borderRadius: styles.borderRadius,
                opacity: styles.opacity
            }
        }
    }, '*');
}

function clearSelection() {
    if (selectedElement) {
        selectedElement.style.outline = '';
        selectedElement.contentEditable = 'false';
    }
    selectedElement = null;
    window.parent.postMessage({ type: 'SELECTION_CLEARED' }, '*');
}

// 3. UTILITIES
function rgbToHex(rgb) {
    if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#000000';
    const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!match) return rgb;
    function hex(x) { return ("0" + parseInt(x).toString(16)).slice(-2); }
    return "#" + hex(match[1]) + hex(match[2]) + hex(match[3]);
}

function handleAIUpdate(data) {
    if (!selectedElement) return;
    if (data.type === 'text') {
        selectedElement.innerText = data.value;
    } else if (data.type === 'style') {
        Object.assign(selectedElement.style, data.value);
    }
}

// Inject CSS helpers
const style = document.createElement('style');
style.innerHTML = `
    .builder-active { cursor: crosshair !important; }
    .builder-active a { cursor: crosshair !important; pointer-events: none; }
`;
document.head.appendChild(style);
