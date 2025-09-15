// Wrap the entire application in an IIFE to avoid polluting the global scope.
(function() {
    'use strict';

    // ===================================================================
    // CONFIGURATION AND STATE
    // ===================================================================
    const gradient = {
        type: 'linear', 
        angle: 90, 
        shape: 'ellipse',
        stops: [
            { color: '#2b8efb', pos: 0 }, 
            { color: '#1fc8a1', pos: 100 }
        ],
        blur: 0, 
        noise: 0
    };
    
    let presets = [];
    let activeStopIndex = 0;

    const COLOR_PALETTES = {
        tailwind: { 
            "Slate": "#64748b", "Gray": "#6b7280", "Red": "#ef4444", "Orange": "#f97316", 
            "Amber": "#f59e0b", "Yellow": "#eab308", "Lime": "#84cc16", "Green": "#22c55e", 
            "Emerald": "#10b981", "Teal": "#14b8a6", "Cyan": "#06b6d4", "Sky": "#0ea5e9", 
            "Blue": "#3b82f6", "Indigo": "#6366f1", "Violet": "#8b5cf6", "Purple": "#a855f7", 
            "Fuchsia": "#d946ef", "Pink": "#ec4899", "Rose": "#f43f5e" 
        },
        material: { 
            "Red": "#f44336", "Pink": "#e91e63", "Purple": "#9c27b0", "Deep Purple": "#673ab7", 
            "Indigo": "#3f51b5", "Blue": "#2196f3", "Light Blue": "#03a9f4", "Cyan": "#00bcd4", 
            "Teal": "#009688", "Green": "#4caf50", "Light Green": "#8bc34a", "Lime": "#cddc39", 
            "Yellow": "#ffeb3b", "Amber": "#ffc107", "Orange": "#ff9800", "Deep Orange": "#ff5722", 
            "Brown": "#795548", "Blue Gray": "#607d8b" 
        }
    };

    const RESOLUTIONS = { 
        '1080p': { width: 1920, height: 1080 }, 
        '4k': { width: 3840, height: 2160 } 
    };

    // DOM Elements
    const els = {
        previewEl: null,
        previewLabel: null,
        cssOutputEl: null,
        typeTabs: null,
        angleSlider: null,
        angleInput: null,
        angleControlGroup: null,
        stopsContainer: null,
        addStopBtn: null,
        presetsGrid: null,
        toastContainer: null,
        copyCssBtn: null,
        exportCssBtn: null,
        randomizeBtn: null,
        saveImageBtn: null,
        exportModal: null,
        closeModalBtn: null,
        cancelExportBtn: null,
        confirmExportBtn: null,
        blurSlider: null,
        blurInput: null,
        noiseSlider: null,
        noiseInput: null,
        paletteSelect: null,
        paletteGrid: null
    };

    // ===================================================================
    // INITIALIZATION
    // ===================================================================
    function init() {
        // Initialize DOM elements
        els.previewEl = document.getElementById('gradient-preview');
        els.previewLabel = document.querySelector('.preview-label');
        els.cssOutputEl = document.getElementById('css-output');
        els.typeTabs = document.querySelector('.gradient-type-tabs');
        els.angleSlider = document.getElementById('angle-slider');
        els.angleInput = document.getElementById('angle-input');
        els.angleControlGroup = document.getElementById('angle-control-group');
        els.stopsContainer = document.getElementById('stops-container');
        els.addStopBtn = document.getElementById('add-stop-btn');
        els.presetsGrid = document.querySelector('.presets-grid');
        els.toastContainer = document.getElementById('toast-container');
        els.copyCssBtn = document.getElementById('copy-css-btn');
        els.exportCssBtn = document.getElementById('export-css-btn');
        els.randomizeBtn = document.getElementById('randomize-btn');
        els.saveImageBtn = document.getElementById('save-image-btn');
        els.exportModal = document.getElementById('export-modal');
        els.closeModalBtn = document.getElementById('close-modal-btn');
        els.cancelExportBtn = document.getElementById('cancel-export-btn');
        els.confirmExportBtn = document.getElementById('confirm-export-btn');
        els.blurSlider = document.getElementById('blur-slider');
        els.blurInput = document.getElementById('blur-input');
        els.noiseSlider = document.getElementById('noise-slider');
        els.noiseInput = document.getElementById('noise-input');
        els.paletteSelect = document.getElementById('palette-select');
        els.paletteGrid = document.getElementById('palette-grid');

        loadState();
        presets = getDefaultPresets();
        renderPresets();
        renderPalettes(els.paletteSelect.value);
        bindUI();
        syncUIFromState();
        updatePreview();
    }

    // ===================================================================
    // UI RENDERING & UPDATES
    // ===================================================================
    function updatePreview() {
        const css = generateGradientCSS(gradient);
        const bgValue = css.replace('background: ', '').slice(0, -1);
        
        els.previewEl.style.setProperty('--preview-bg', bgValue);
        els.previewEl.style.setProperty('--preview-filter', `blur(${gradient.blur}px)`);
        els.previewEl.style.setProperty('--preview-noise-opacity', gradient.noise / 100);
        
        els.cssOutputEl.textContent = css;
        ensureReadableTextColorOnPreview();
    }

    function syncUIFromState() {
        // Update type tabs
        els.typeTabs.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.id === `type-${gradient.type}`);
        });
        
        // Update angle controls
        els.angleControlGroup.style.display = gradient.type === 'radial' ? 'none' : 'block';
        els.angleSlider.value = gradient.angle;
        els.angleInput.value = gradient.angle;
        
        // Update effect controls
        els.blurSlider.value = gradient.blur;
        els.blurInput.value = gradient.blur;
        els.noiseSlider.value = gradient.noise;
        els.noiseInput.value = gradient.noise;
        
        renderStops();
    }

    function renderStops() {
        els.stopsContainer.innerHTML = '';
        gradient.stops.forEach((stop, index) => {
            const stopRow = document.createElement('div');
            stopRow.className = 'stop-row';
            stopRow.classList.toggle('active', index === activeStopIndex);
            stopRow.dataset.index = index;
            stopRow.innerHTML = `
                <input type="color" class="stop-color-input" data-index="${index}" value="${stop.color}">
                <input type="text" class="stop-hex-input control-input" data-index="${index}" value="${stop.color}">
                <input type="range" class="stop-pos-slider" data-index="${index}" min="0" max="100" value="${stop.pos}">
                <span class="stop-pos-label">${stop.pos}%</span>
                <button class="btn-remove-stop" data-index="${index}" aria-label="Remove stop ${index + 1}">&times;</button>
            `;
            els.stopsContainer.appendChild(stopRow);
        });
    }

    function renderPresets() {
        els.presetsGrid.innerHTML = '';
        presets.forEach((preset, index) => {
            const card = document.createElement('button');
            card.className = 'preset-card';
            const css = generateGradientCSS(preset);
            card.style.background = css.replace('background: ', '').slice(0, -1);
            card.dataset.index = index;
            card.innerHTML = `<span class="preset-name">${preset.name}</span>`;
            els.presetsGrid.appendChild(card);
        });
    }

    function renderPalettes(paletteName) {
        const palette = COLOR_PALETTES[paletteName];
        if (!palette) return;
        
        els.paletteGrid.innerHTML = '';
        for (const [name, color] of Object.entries(palette)) {
            const swatch = document.createElement('div');
            swatch.className = 'palette-swatch';
            swatch.style.backgroundColor = color;
            swatch.dataset.color = color;
            swatch.dataset.tooltip = name;
            els.paletteGrid.appendChild(swatch);
        }
    }

    function showToast(message, timeout = 2000) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        els.toastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, timeout);
    }

    // ===================================================================
    // EVENT BINDING
    // ===================================================================
    function bindUI() {
        const debouncedSave = debounce(saveState, 200);
        const debouncedReorderRenderSave = debounce(() => {
            reorderStops();
            renderStops();
            updatePreview();
            saveState();
        }, 100);

        // Type tabs
        els.typeTabs.addEventListener('click', e => {
            if (e.target.matches('.tab-btn')) {
                gradient.type = e.target.id.replace('type-', '');
                activeStopIndex = 0;
                syncUIFromState();
                updatePreview();
                saveState();
            }
        });

        // Angle controls
        els.angleSlider.addEventListener('input', () => {
            gradient.angle = els.angleSlider.value;
            els.angleInput.value = els.angleSlider.value;
            updatePreview();
            debouncedSave();
        });

        els.angleInput.addEventListener('input', () => {
            gradient.angle = els.angleInput.value;
            els.angleSlider.value = els.angleInput.value;
            updatePreview();
            debouncedSave();
        });

        // Effect controls
        els.blurSlider.addEventListener('input', () => {
            gradient.blur = els.blurSlider.value;
            els.blurInput.value = els.blurSlider.value;
            updatePreview();
            debouncedSave();
        });

        els.blurInput.addEventListener('input', () => {
            gradient.blur = els.blurInput.value;
            els.blurSlider.value = els.blurInput.value;
            updatePreview();
            debouncedSave();
        });

        els.noiseSlider.addEventListener('input', () => {
            gradient.noise = els.noiseSlider.value;
            els.noiseInput.value = els.noiseSlider.value;
            updatePreview();
            debouncedSave();
        });

        els.noiseInput.addEventListener('input', () => {
            gradient.noise = els.noiseInput.value;
            els.noiseSlider.value = els.noiseInput.value;
            updatePreview();
            debouncedSave();
        });

        // Stops management
        els.addStopBtn.addEventListener('click', addStop);

        els.stopsContainer.addEventListener('input', e => {
            const index = parseInt(e.target.dataset.index);
            if (isNaN(index)) return;
            
            activeStopIndex = index;
            
            if (e.target.matches('.stop-color-input, .stop-hex-input')) {
                gradient.stops[index].color = e.target.value;
                
                // Sync color and hex inputs
                const colorInput = e.target.matches('.stop-color-input') ? 
                    e.target : e.target.previousElementSibling;
                const hexInput = e.target.matches('.stop-hex-input') ? 
                    e.target : e.target.nextElementSibling;
                    
                colorInput.value = e.target.value;
                hexInput.value = e.target.value;
                
                updatePreview();
                debouncedSave();
            } else if (e.target.matches('.stop-pos-slider')) {
                gradient.stops[index].pos = parseInt(e.target.value);
                e.target.nextElementSibling.textContent = `${e.target.value}%`;
                updatePreview();
                debouncedReorderRenderSave();
            }
        });

        els.stopsContainer.addEventListener('click', e => {
            const row = e.target.closest('.stop-row');
            if (!row) return;
            
            const index = parseInt(row.dataset.index);
            if (e.target.matches('.btn-remove-stop')) {
                removeStop(index);
            } else if (activeStopIndex !== index) {
                activeStopIndex = index;
                renderStops();
            }
        });

        // Palette
        els.paletteSelect.addEventListener('change', () => {
            renderPalettes(els.paletteSelect.value);
        });

        els.paletteGrid.addEventListener('click', e => {
            if (e.target.matches('.palette-swatch')) {
                gradient.stops[activeStopIndex].color = e.target.dataset.color;
                renderStops();
                updatePreview();
                saveState();
            }
        });

        // Presets
        els.presetsGrid.addEventListener('click', e => {
            const card = e.target.closest('.preset-card');
            if (card) applyPreset(card.dataset.index);
        });

        // Action buttons
        els.randomizeBtn.addEventListener('click', randomizeGradient);
        els.copyCssBtn.addEventListener('click', () => copyToClipboard(els.cssOutputEl.textContent));
        els.exportCssBtn.addEventListener('click', exportCssFile);
        els.saveImageBtn.addEventListener('click', () => els.exportModal.showModal());

        // Modal
        els.closeModalBtn.addEventListener('click', () => els.exportModal.close());
        els.cancelExportBtn.addEventListener('click', () => els.exportModal.close());
        els.confirmExportBtn.addEventListener('click', () => {
            const format = els.exportModal.querySelector('input[name="format"]:checked').value;
            const resKey = els.exportModal.querySelector('input[name="resolution"]:checked').value;
            const { width, height } = RESOLUTIONS[resKey];
            
            if (format === 'svg') {
                exportAsSVG(width, height);
            } else {
                exportAsRaster(format, width, height);
            }
            
            els.exportModal.close();
        });
    }

    // ===================================================================
    // CORE LOGIC & ACTIONS
    // ===================================================================
    function saveState() {
        try {
            localStorage.setItem('gradient-state', JSON.stringify(gradient));
        } catch (e) {
            console.error("Error saving state:", e);
        }
    }

    function loadState() {
        const saved = localStorage.getItem('gradient-state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed && parsed.stops) {
                    Object.assign(gradient, parsed);
                }
            } catch (e) {
                console.error("Error loading state:", e);
            }
        }
    }

    function applyPreset(index) {
        const preset = JSON.parse(JSON.stringify(presets[index]));
        if (preset) {
            gradient.type = preset.type || 'linear';
            gradient.angle = preset.angle || 90;
            gradient.shape = preset.shape || 'ellipse';
            gradient.stops = preset.stops || [];
            gradient.blur = 0;
            gradient.noise = 0;
            activeStopIndex = 0;
            syncUIFromState();
            updatePreview();
            saveState();
        }
    }

    function randomizeGradient() {
        gradient.type = ['linear', 'radial', 'conic'][Math.floor(Math.random() * 3)];
        gradient.angle = Math.floor(Math.random() * 361);
        
        const count = Math.floor(Math.random() * 3) + 3;
        gradient.stops = Array.from({ length: count }, (_, i) => ({
            color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
            pos: Math.round((i / (count - 1)) * 100)
        }));
        
        gradient.blur = 0;
        gradient.noise = 0;
        activeStopIndex = 0;
        
        syncUIFromState();
        updatePreview();
        saveState();
        showToast("Gradient Randomized!");
    }

    function addStop() {
        gradient.stops.push({ color: '#ffffff', pos: 50 });
        reorderStops();
        activeStopIndex = gradient.stops.length - 1;
        renderStops();
        updatePreview();
        saveState();
    }

    function removeStop(index) {
        if (gradient.stops.length <= 2) {
            showToast("Minimum of 2 stops is required.");
            return;
        }
        
        gradient.stops.splice(index, 1);
        if (activeStopIndex >= index) {
            activeStopIndex = Math.max(0, activeStopIndex - 1);
        }
        
        renderStops();
        updatePreview();
        saveState();
    }

    function reorderStops() {
        gradient.stops.sort((a, b) => a.pos - b.pos);
    }

    // ===================================================================
    // GENERATION & EXPORT
    // ===================================================================
    function generateGradientCSS(g) {
        const stopsStr = g.stops.map(s => `${s.color} ${s.pos}%`).join(', ');
        
        switch (g.type) {
            case 'radial':
                return `background: radial-gradient(${g.shape}, ${stopsStr});`;
            case 'conic':
                return `background: conic-gradient(from ${g.angle}deg, ${stopsStr});`;
            default:
                return `background: linear-gradient(${g.angle}deg, ${stopsStr});`;
        }
    }

    function generateSVGString(g, w, h) {
        const stopsSVG = g.stops.map(s => 
            `<stop offset="${s.pos}%" stop-color="${s.color}" />`
        ).join('');
        
        let gradientTag;
        if (g.type === 'linear') {
            gradientTag = `<linearGradient id="g" gradientTransform="rotate(${g.angle - 90})">${stopsSVG}</linearGradient>`;
        } else if (g.type === 'radial') {
            gradientTag = `<radialGradient id="g" cx="50%" cy="50%" r="50%">${stopsSVG}</radialGradient>`;
        } else {
            // Conic gradient approximation for SVG
            gradientTag = `<linearGradient id="g">${stopsSVG}</linearGradient>`;
        }
        
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
            <defs>${gradientTag}</defs>
            <rect width="${w}" height="${h}" fill="url(#g)" />
        </svg>`;
    }

    function exportAsSVG(width, height) {
        const svgString = generateSVGString(gradient, width, height);
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'gradient.svg';
        a.click();
        
        URL.revokeObjectURL(url);
        showToast('Image exported as SVG!');
    }

    function exportAsRaster(format, width, height) {
        const svgString = generateSVGString(gradient, width, height);
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        const img = new Image();
        img.onload = () => {
            // Apply blur if needed
            if (gradient.blur > 0) {
                ctx.filter = `blur(${gradient.blur}px)`;
            }
            
            ctx.drawImage(img, 0, 0, width, height);
            ctx.filter = 'none';
            
            URL.revokeObjectURL(url);
            
            // Apply noise if needed
            if (gradient.noise > 0) {
                drawNoise(ctx, width, height, gradient.noise);
            }
            
            // Convert to desired format
            canvas.toBlob(blob => {
                const dataUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = dataUrl;
                a.download = `gradient.${format}`;
                a.click();
                URL.revokeObjectURL(dataUrl);
                showToast(`Image exported as ${format.toUpperCase()}!`);
            }, `image/${format}`, format === 'jpg' ? 0.9 : 1.0);
        };
        
        img.onerror = () => {
            URL.revokeObjectURL(url);
            showToast("Error creating image.");
        };
        
        img.src = url;
    }

    function drawNoise(ctx, w, h, opacity) {
        const noiseCanvas = document.createElement('canvas');
        noiseCanvas.width = 100;
        noiseCanvas.height = 100;
        const noiseCtx = noiseCanvas.getContext('2d');
        
        const imageData = noiseCtx.createImageData(100, 100);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const val = Math.floor(Math.random() * 255);
            data[i] = val;
            data[i + 1] = val;
            data[i + 2] = val;
            data[i + 3] = 255;
        }
        
        noiseCtx.putImageData(imageData, 0, 0);
        
        ctx.globalAlpha = opacity / 100;
        ctx.fillStyle = ctx.createPattern(noiseCanvas, 'repeat');
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1.0;
    }

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            showToast('CSS copied!');
        } catch (err) {
            showToast('Failed to copy.');
        }
    }

    function exportCssFile() {
        const content = `.generated-gradient {\n    ${generateGradientCSS(gradient)}\n}`;
        const blob = new Blob([content], { type: 'text/css' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'gradient.css';
        a.click();
        
        URL.revokeObjectURL(url);
        showToast('CSS file exported!');
    }

    // ===================================================================
    // UTILITY FUNCTIONS
    // ===================================================================
    function debounce(fn, ms) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), ms);
        };
    }

    function getDefaultPresets() {
        return [
            {
                name: 'Ocean Blue',
                type: 'linear',
                angle: 90,
                stops: [
                    { color: '#2E3192', pos: 0 },
                    { color: '#1BFFFF', pos: 100 }
                ]
            },
            {
                name: 'Sunset',
                type: 'linear',
                angle: 120,
                stops: [
                    { color: '#FF6B6B', pos: 0 },
                    { color: '#FFD93D', pos: 50 },
                    { color: '#6A1B9A', pos: 100 }
                ]
            },
            {
                name: 'Mint',
                type: 'radial',
                shape: 'circle',
                stops: [
                    { color: '#D4FFEC', pos: 0 },
                    { color: '#57F2CC', pos: 50 },
                    { color: '#45969B', pos: 100 }
                ]
            },
            {
                name: 'Royal',
                type: 'linear',
                angle: 45,
                stops: [
                    { color: '#8E2DE2', pos: 0 },
                    { color: '#4A00E0', pos: 100 }
                ]
            },
            {
                name: 'Pastel',
                type: 'conic',
                angle: 180,
                stops: [
                    { color: '#a1c4fd', pos: 0 },
                    { color: '#c2e9fb', pos: 100 }
                ]
            },
            {
                name: 'Fire',
                type: 'radial',
                shape: 'ellipse',
                stops: [
                    { color: '#F96400', pos: 0 },
                    { color: '#E42200', pos: 50 },
                    { color: '#830000', pos: 100 }
                ]
            }
        ];
    }

    function ensureReadableTextColorOnPreview() {
        const midStop = gradient.stops[Math.floor(gradient.stops.length / 2)];
        if (!midStop) return;
        
        const bgColor = hexToRgb(midStop.color);
        if (!bgColor) return;
        
        const lum = relativeLuminance(bgColor);
        els.previewLabel.style.color = (lum > 0.4) ? '#000000' : '#FFFFFF';
    }

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    function relativeLuminance({r, g, b}) {
        const a = [r, g, b].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', init);
})();