// Wrap the entire application in an IIFE to avoid polluting the global scope.
(function() {
    'use strict';

    const GRADIENT_TYPES = new Set(['linear', 'radial', 'conic']);
    const HEX_COLOR_REGEX = /^#(?:[0-9a-f]{3}){1,2}$/i;
    const CUSTOM_PRESETS_STORAGE_KEY = 'custom-gradient-presets';
    const MAX_CUSTOM_PRESETS = 20;

    // ===================================================================
    // CONFIGURATION AND STATE
    // ===================================================================
    const gradient = createDefaultGradientState();
    
    let presets = [];
    let customPresets = [];
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
        paletteGrid: null,
        customPresetsGrid: null,
        customPresetsEmpty: null,
        savePresetBtn: null,
        savePresetModal: null,
        savePresetForm: null,
        savePresetNameInput: null,
        savePresetCancelBtn: null,
        savePresetConfirmBtn: null,
        closeSavePresetBtn: null,
        reverseStopsBtn: null,
        distributeStopsBtn: null
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
        els.customPresetsGrid = document.getElementById('custom-presets-grid');
        els.customPresetsEmpty = document.getElementById('custom-presets-empty');
        els.savePresetBtn = document.getElementById('save-preset-btn');
        els.savePresetModal = document.getElementById('save-preset-modal');
        els.savePresetForm = document.getElementById('save-preset-form');
        els.savePresetNameInput = document.getElementById('save-preset-name');
        els.savePresetCancelBtn = document.getElementById('cancel-save-preset-btn');
        els.savePresetConfirmBtn = document.getElementById('confirm-save-preset-btn');
        els.closeSavePresetBtn = document.getElementById('close-save-preset-btn');
        els.reverseStopsBtn = document.getElementById('reverse-stops-btn');
        els.distributeStopsBtn = document.getElementById('distribute-stops-btn');

        loadState();
        presets = getDefaultPresets();
        customPresets = loadCustomPresets();
        renderPresets();
        renderCustomPresets();
        renderPalettes(els.paletteSelect.value);
        bindUI();
        syncUIFromState();
        updatePreview();
    }

    // ===================================================================
    // UI RENDERING & UPDATES
    // ===================================================================
    function updatePreview() {
        const safeGradient = sanitizeGradientState(gradient);
        const css = generateGradientCSS(safeGradient);
        const bgValue = css.replace('background: ', '').slice(0, -1);

        els.previewEl.style.setProperty('--preview-bg', bgValue);
        els.previewEl.style.setProperty('--preview-filter', `blur(${safeGradient.blur}px)`);
        els.previewEl.style.setProperty('--preview-noise-opacity', safeGradient.noise / 100);

        els.cssOutputEl.textContent = css;
        ensureReadableTextColorOnPreview(safeGradient);
    }

    function syncUIFromState() {
        applySanitizedState(gradient, gradient);
        if (!Number.isInteger(activeStopIndex) || activeStopIndex < 0) {
            activeStopIndex = 0;
        }
        activeStopIndex = Math.min(activeStopIndex, gradient.stops.length - 1);

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
            stopRow.dataset.index = String(index);
            if (index === activeStopIndex) {
                stopRow.classList.add('active');
            }

            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.className = 'stop-color-input';
            colorInput.dataset.index = String(index);
            colorInput.value = stop.color;
            colorInput.setAttribute('aria-label', `Color picker for stop ${index + 1}`);

            const hexInput = document.createElement('input');
            hexInput.type = 'text';
            hexInput.className = 'stop-hex-input control-input';
            hexInput.dataset.index = String(index);
            hexInput.value = stop.color;
            hexInput.setAttribute('maxlength', '7');
            hexInput.setAttribute('spellcheck', 'false');
            hexInput.setAttribute('autocomplete', 'off');
            hexInput.setAttribute('aria-label', `Hex value for stop ${index + 1}`);

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.className = 'stop-pos-slider';
            slider.dataset.index = String(index);
            slider.min = '0';
            slider.max = '100';
            slider.value = stop.pos;

            const label = document.createElement('span');
            label.className = 'stop-pos-label';
            label.textContent = `${stop.pos}%`;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-remove-stop';
            removeBtn.dataset.index = String(index);
            removeBtn.setAttribute('aria-label', `Remove stop ${index + 1}`);
            removeBtn.type = 'button';
            removeBtn.textContent = '×';

            stopRow.append(colorInput, hexInput, slider, label, removeBtn);
            els.stopsContainer.appendChild(stopRow);
        });
    }

    function renderPresets() {
        els.presetsGrid.innerHTML = '';
        presets.forEach((preset, index) => {
            const card = document.createElement('button');
            card.className = 'preset-card';
            card.type = 'button';
            const css = generateGradientCSS(sanitizeGradientState(preset));
            card.style.background = css.replace('background: ', '').slice(0, -1);
            card.dataset.index = String(index);
            card.dataset.section = 'default';
            card.setAttribute('aria-label', `${preset.name} gradient preset`);
            card.title = `${preset.name} gradient preset`;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'preset-name';
            nameSpan.textContent = preset.name;
            card.appendChild(nameSpan);

            els.presetsGrid.appendChild(card);
        });
    }

    function renderCustomPresets() {
        if (!els.customPresetsGrid) {
            return;
        }

        els.customPresetsGrid.innerHTML = '';

        if (els.customPresetsEmpty) {
            els.customPresetsEmpty.hidden = customPresets.length > 0;
        }

        customPresets.forEach((preset, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'custom-preset-item';

            const card = document.createElement('button');
            card.className = 'preset-card';
            card.type = 'button';
            card.dataset.index = String(index);
            card.dataset.section = 'custom';
            const css = generateGradientCSS(sanitizeGradientState(preset));
            card.style.background = css.replace('background: ', '').slice(0, -1);
            const name = typeof preset.name === 'string' && preset.name.trim()
                ? preset.name.trim()
                : `Custom Preset ${index + 1}`;
            card.setAttribute('aria-label', `${name} custom gradient preset`);
            card.title = `${name} custom gradient preset`;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'preset-name';
            nameSpan.textContent = name;
            card.appendChild(nameSpan);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'preset-delete-btn';
            deleteBtn.type = 'button';
            deleteBtn.dataset.index = String(index);
            deleteBtn.textContent = 'Delete';
            deleteBtn.setAttribute('aria-label', `Delete custom preset ${name}`);

            wrapper.append(card, deleteBtn);
            els.customPresetsGrid.appendChild(wrapper);
        });
    }

    function renderPalettes(paletteName) {
        const palette = COLOR_PALETTES[paletteName];
        if (!palette) return;

        els.paletteGrid.innerHTML = '';
        els.paletteGrid.setAttribute('aria-label', `${paletteName} color palette`);
        for (const [name, color] of Object.entries(palette)) {
            const safeColor = sanitizeColor(color, null);
            if (!safeColor) {
                continue;
            }

            const swatch = document.createElement('div');
            swatch.className = 'palette-swatch';
            swatch.tabIndex = 0;
            swatch.setAttribute('role', 'button');
            swatch.setAttribute('aria-label', `${name} color swatch`);
            swatch.title = `${name} (${safeColor})`;
            swatch.style.backgroundColor = safeColor;
            swatch.dataset.color = safeColor;
            swatch.dataset.tooltip = name;
            els.paletteGrid.appendChild(swatch);
        }
    }

    function applyPaletteSwatchToGradient(swatch) {
        if (!swatch || !gradient.stops.length) {
            return;
        }

        const color = sanitizeColor(swatch.dataset.color, null);
        if (!color) {
            return;
        }

        const index = Math.min(Math.max(activeStopIndex, 0), gradient.stops.length - 1);
        gradient.stops[index].color = color;
        renderStops();
        updatePreview();
        saveState();
    }

    function showToast(message, timeout = 2000) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.setAttribute('role', 'alert');
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
            const tab = e.target.closest('.tab-btn');
            if (!tab) {
                return;
            }

            const newType = tab.id.replace('type-', '');
            if (!GRADIENT_TYPES.has(newType)) {
                return;
            }

            gradient.type = newType;
            if (newType !== 'radial') {
                gradient.shape = 'ellipse';
            }
            activeStopIndex = 0;
            syncUIFromState();
            updatePreview();
            saveState();
        });

        // Angle controls
        els.angleSlider.addEventListener('input', () => {
            const value = clampNumber(els.angleSlider.value, 0, 360, gradient.angle);
            gradient.angle = value;
            const normalized = String(value);
            els.angleSlider.value = normalized;
            els.angleInput.value = normalized;
            updatePreview();
            debouncedSave();
        });

        els.angleInput.addEventListener('input', () => {
            const value = clampNumber(els.angleInput.value, 0, 360, null);
            if (value === null) {
                els.angleInput.value = String(gradient.angle);
                return;
            }
            gradient.angle = value;
            const normalized = String(value);
            els.angleSlider.value = normalized;
            els.angleInput.value = normalized;
            updatePreview();
            debouncedSave();
        });

        // Effect controls
        els.blurSlider.addEventListener('input', () => {
            const value = clampNumber(els.blurSlider.value, 0, 40, gradient.blur);
            gradient.blur = value;
            const normalized = String(value);
            els.blurSlider.value = normalized;
            els.blurInput.value = normalized;
            updatePreview();
            debouncedSave();
        });

        els.blurInput.addEventListener('input', () => {
            const value = clampNumber(els.blurInput.value, 0, 40, null);
            if (value === null) {
                els.blurInput.value = String(gradient.blur);
                return;
            }
            gradient.blur = value;
            const normalized = String(value);
            els.blurSlider.value = normalized;
            els.blurInput.value = normalized;
            updatePreview();
            debouncedSave();
        });

        els.noiseSlider.addEventListener('input', () => {
            const value = clampNumber(els.noiseSlider.value, 0, 100, gradient.noise);
            gradient.noise = value;
            const normalized = String(value);
            els.noiseSlider.value = normalized;
            els.noiseInput.value = normalized;
            updatePreview();
            debouncedSave();
        });

        els.noiseInput.addEventListener('input', () => {
            const value = clampNumber(els.noiseInput.value, 0, 100, null);
            if (value === null) {
                els.noiseInput.value = String(gradient.noise);
                return;
            }
            gradient.noise = value;
            const normalized = String(value);
            els.noiseSlider.value = normalized;
            els.noiseInput.value = normalized;
            updatePreview();
            debouncedSave();
        });

        // Stops management
        if (els.distributeStopsBtn) {
            els.distributeStopsBtn.addEventListener('click', () => {
                distributeStopsEvenly();
            });
        }

        if (els.reverseStopsBtn) {
            els.reverseStopsBtn.addEventListener('click', () => {
                reverseGradientStops();
            });
        }

        els.addStopBtn.addEventListener('click', addStop);

        els.stopsContainer.addEventListener('input', e => {
            const target = e.target;
            if (!target || !target.classList) {
                return;
            }

            const index = Number.parseInt(target.dataset.index, 10);
            if (!Number.isInteger(index) || !gradient.stops[index]) {
                return;
            }

            activeStopIndex = index;
            const parentRow = target.closest('.stop-row');

            if (target.classList.contains('stop-color-input')) {
                const sanitizedColor = sanitizeColor(target.value, gradient.stops[index].color);
                gradient.stops[index].color = sanitizedColor;
                if (parentRow) {
                    const hexInput = parentRow.querySelector('.stop-hex-input');
                    if (hexInput) {
                        hexInput.value = sanitizedColor;
                        hexInput.classList.remove('invalid');
                        hexInput.removeAttribute('aria-invalid');
                    }
                }
                updatePreview();
                debouncedSave();
            } else if (target.classList.contains('stop-hex-input')) {
                const sanitizedHex = sanitizeColor(target.value, null);
                if (!sanitizedHex) {
                    target.classList.add('invalid');
                    target.setAttribute('aria-invalid', 'true');
                    return;
                }
                gradient.stops[index].color = sanitizedHex;
                target.value = sanitizedHex;
                target.classList.remove('invalid');
                target.removeAttribute('aria-invalid');
                if (parentRow) {
                    const colorInput = parentRow.querySelector('.stop-color-input');
                    if (colorInput) {
                        colorInput.value = sanitizedHex;
                    }
                }
                updatePreview();
                debouncedSave();
            } else if (target.classList.contains('stop-pos-slider')) {
                const sanitizedPos = clampNumber(target.value, 0, 100, gradient.stops[index].pos);
                gradient.stops[index].pos = sanitizedPos;
                target.value = String(sanitizedPos);
                if (parentRow) {
                    const label = parentRow.querySelector('.stop-pos-label');
                    if (label) {
                        label.textContent = `${sanitizedPos}%`;
                    }
                }
                updatePreview();
                debouncedReorderRenderSave();
            }
        });

        els.stopsContainer.addEventListener('click', e => {
            const row = e.target.closest('.stop-row');
            if (!row) {
                return;
            }

            const index = Number.parseInt(row.dataset.index, 10);
            if (!Number.isInteger(index) || !gradient.stops[index]) {
                return;
            }

            if (e.target.closest('.btn-remove-stop')) {
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
            const swatch = e.target.closest('.palette-swatch');
            applyPaletteSwatchToGradient(swatch);
        });

        els.paletteGrid.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                const swatch = e.target.closest('.palette-swatch');
                if (!swatch) {
                    return;
                }
                e.preventDefault();
                applyPaletteSwatchToGradient(swatch);
            }
        });

        // Presets
        els.presetsGrid.addEventListener('click', e => {
            const card = e.target.closest('.preset-card');
            if (!card) {
                return;
            }

            const presetIndex = Number.parseInt(card.dataset.index, 10);
            if (Number.isNaN(presetIndex)) {
                return;
            }

            applyPreset(presetIndex);
        });

        if (els.customPresetsGrid) {
            els.customPresetsGrid.addEventListener('click', e => {
                const targetButton = e.target.closest('button');
                if (!targetButton) {
                    return;
                }

                const index = Number.parseInt(targetButton.dataset.index, 10);
                if (!Number.isInteger(index)) {
                    return;
                }

                if (targetButton.classList.contains('preset-delete-btn')) {
                    deleteCustomPreset(index);
                } else if (targetButton.classList.contains('preset-card')) {
                    applyPreset(index, customPresets);
                }
            });
        }

        if (els.savePresetBtn && els.savePresetModal && els.savePresetForm && els.savePresetNameInput) {
            els.savePresetBtn.addEventListener('click', () => {
                openSavePresetModal();
            });

            els.savePresetForm.addEventListener('submit', e => {
                e.preventDefault();
                handleSavePresetSubmission();
            });

            if (els.savePresetCancelBtn) {
                els.savePresetCancelBtn.addEventListener('click', () => {
                    closeSavePresetModal();
                });
            }

            if (els.closeSavePresetBtn) {
                els.closeSavePresetBtn.addEventListener('click', () => {
                    closeSavePresetModal();
                });
            }

            els.savePresetModal.addEventListener('cancel', () => {
                closeSavePresetModal();
            });
        }

        // Action buttons
        els.randomizeBtn.addEventListener('click', randomizeGradient);
        els.copyCssBtn.addEventListener('click', () => copyToClipboard(els.cssOutputEl.textContent || ''));
        els.exportCssBtn.addEventListener('click', exportCssFile);
        els.saveImageBtn.addEventListener('click', () => {
            if (typeof els.exportModal.showModal === 'function') {
                els.exportModal.showModal();
            }
        });

        // Modal
        els.closeModalBtn.addEventListener('click', () => els.exportModal.close());
        els.cancelExportBtn.addEventListener('click', () => els.exportModal.close());
        els.confirmExportBtn.addEventListener('click', () => {
            const formatInput = els.exportModal.querySelector('input[name="format"]:checked');
            const resolutionInput = els.exportModal.querySelector('input[name="resolution"]:checked');
            if (!formatInput || !resolutionInput) {
                return;
            }

            const format = formatInput.value;
            const resolution = RESOLUTIONS[resolutionInput.value];
            if (!resolution) {
                return;
            }

            if (format === 'svg') {
                exportAsSVG(resolution.width, resolution.height);
            } else if (format === 'png' || format === 'jpg') {
                exportAsRaster(format, resolution.width, resolution.height);
            }

            els.exportModal.close();
        });
    }

    // ===================================================================
    // CORE LOGIC & ACTIONS
    // ===================================================================
    function saveState() {
        try {
            const safeGradient = sanitizeGradientState(gradient);
            localStorage.setItem('gradient-state', JSON.stringify(safeGradient));
        } catch (e) {
            console.error('Error saving state:', e);
        }
    }

    function loadState() {
        const saved = localStorage.getItem('gradient-state');
        if (!saved) {
            return;
        }

        try {
            const parsed = JSON.parse(saved);
            applySanitizedState(gradient, parsed);
            activeStopIndex = Math.min(activeStopIndex, gradient.stops.length - 1);
        } catch (e) {
            console.error('Error loading state:', e);
        }
    }

    function loadCustomPresets() {
        const stored = localStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY);
        if (!stored) {
            return [];
        }

        try {
            const parsed = JSON.parse(stored);
            if (!Array.isArray(parsed)) {
                return [];
            }

            const seenNames = new Set();

            return parsed
                .map((entry, index) => {
                    if (!entry || typeof entry !== 'object') {
                        return null;
                    }

                    const fallbackName = `Custom Preset ${index + 1}`;
                    let sanitizedName = sanitizePresetName(entry.name) || fallbackName;
                    const baseName = sanitizedName;
                    let suffix = 2;
                    while (seenNames.has(sanitizedName.toLowerCase())) {
                        sanitizedName = `${baseName} ${suffix}`;
                        suffix += 1;
                    }
                    seenNames.add(sanitizedName.toLowerCase());

                    const sanitizedGradient = sanitizeGradientState(entry);
                    return { ...sanitizedGradient, name: sanitizedName };
                })
                .filter(Boolean)
                .slice(0, MAX_CUSTOM_PRESETS);
        } catch (error) {
            console.error('Error loading custom presets:', error);
            return [];
        }
    }

    function saveCustomPresets() {
        try {
            const payload = customPresets.map(preset => ({
                name: preset.name,
                type: preset.type,
                angle: preset.angle,
                shape: preset.shape,
                stops: preset.stops.map(stop => ({ ...stop })),
                blur: preset.blur,
                noise: preset.noise
            }));
            localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(payload));
            return true;
        } catch (error) {
            console.error('Error saving custom presets:', error);
            return false;
        }
    }

    function applyPreset(index, collection = presets) {
        const source = Array.isArray(collection) ? collection : presets;
        const preset = source[index];
        if (!preset) {
            return;
        }

        const sanitizedPreset = sanitizeGradientState(preset);
        if (source === presets) {
            sanitizedPreset.blur = 0;
            sanitizedPreset.noise = 0;
        }

        applySanitizedState(gradient, sanitizedPreset);
        activeStopIndex = 0;
        syncUIFromState();
        updatePreview();
        saveState();

        if (source === customPresets) {
            showToast('Custom preset applied!');
        }
    }

    function randomizeGradient() {
        const types = Array.from(GRADIENT_TYPES);
        const randomType = types[Math.floor(Math.random() * types.length)] || 'linear';
        const count = Math.floor(Math.random() * 3) + 3;
        const stops = Array.from({ length: count }, (_, i) => ({
            color: `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0').toUpperCase()}`,
            pos: Math.round((i / Math.max(count - 1, 1)) * 100)
        }));

        applySanitizedState(gradient, {
            type: randomType,
            angle: Math.floor(Math.random() * 361),
            shape: 'ellipse',
            stops,
            blur: 0,
            noise: 0
        });
        activeStopIndex = 0;

        syncUIFromState();
        updatePreview();
        saveState();
        showToast('Gradient Randomized!');
    }

    function addStop() {
        const newStop = { color: '#FFFFFF', pos: 50 };
        gradient.stops.push(newStop);
        reorderStops();
        activeStopIndex = gradient.stops.indexOf(newStop);
        if (activeStopIndex === -1) {
            activeStopIndex = gradient.stops.length - 1;
        }
        renderStops();
        updatePreview();
        saveState();
    }

    function removeStop(index) {
        if (!Number.isInteger(index) || index < 0 || index >= gradient.stops.length) {
            return;
        }

        if (gradient.stops.length <= 2) {
            showToast('Minimum of 2 stops is required.');
            return;
        }

        gradient.stops.splice(index, 1);
        if (activeStopIndex >= gradient.stops.length) {
            activeStopIndex = gradient.stops.length - 1;
        } else if (activeStopIndex > index) {
            activeStopIndex -= 1;
        }
        activeStopIndex = Math.max(0, activeStopIndex);

        renderStops();
        updatePreview();
        saveState();
    }

    function reverseGradientStops() {
        const sanitized = sanitizeGradientState(gradient);
        if (sanitized.stops.length < 2) {
            showToast('Add at least two stops to reverse.');
            return;
        }

        const previousIndex = Math.min(Math.max(activeStopIndex, 0), sanitized.stops.length - 1);
        const reversedStops = sanitized.stops
            .slice()
            .reverse()
            .map(stop => ({
                color: stop.color,
                pos: 100 - stop.pos
            }))
            .sort((a, b) => a.pos - b.pos);

        applySanitizedState(gradient, sanitized);
        gradient.stops = reversedStops;
        const totalStops = gradient.stops.length;
        activeStopIndex = Math.max(0, totalStops - 1 - previousIndex);

        renderStops();
        updatePreview();
        saveState();
        showToast('Gradient reversed.');
    }

    function distributeStopsEvenly() {
        const sanitized = sanitizeGradientState(gradient);
        if (sanitized.stops.length < 2) {
            showToast('Add at least two stops to distribute.');
            return;
        }

        applySanitizedState(gradient, sanitized);
        const segments = gradient.stops.length - 1;
        if (segments <= 0) {
            return;
        }

        gradient.stops.forEach((stop, index) => {
            stop.pos = Math.round((index / segments) * 100);
        });

        renderStops();
        updatePreview();
        saveState();
        showToast('Stops distributed evenly.');
    }

    function reorderStops() {
        gradient.stops.forEach(stop => {
            stop.color = sanitizeColor(stop.color, '#FFFFFF') || '#FFFFFF';
            stop.pos = clampNumber(stop.pos, 0, 100, 0);
        });
        gradient.stops.sort((a, b) => a.pos - b.pos);
    }

    // ===================================================================
    // CUSTOM PRESETS
    // ===================================================================
    function openSavePresetModal() {
        if (!els.savePresetModal || typeof els.savePresetModal.showModal !== 'function') {
            return;
        }

        if (els.savePresetNameInput) {
            const suggestion = generateSuggestedPresetName();
            els.savePresetNameInput.value = suggestion;
            els.savePresetNameInput.classList.remove('invalid');
            els.savePresetNameInput.removeAttribute('aria-invalid');
            setTimeout(() => {
                els.savePresetNameInput.focus();
                els.savePresetNameInput.select();
            }, 50);
        }

        els.savePresetModal.showModal();
    }

    function closeSavePresetModal() {
        if (els.savePresetModal && typeof els.savePresetModal.close === 'function' && els.savePresetModal.open) {
            els.savePresetModal.close();
        }

        if (els.savePresetNameInput) {
            els.savePresetNameInput.value = '';
            els.savePresetNameInput.classList.remove('invalid');
            els.savePresetNameInput.removeAttribute('aria-invalid');
        }
    }

    function handleSavePresetSubmission() {
        if (!els.savePresetNameInput) {
            return;
        }

        els.savePresetNameInput.classList.remove('invalid');
        els.savePresetNameInput.removeAttribute('aria-invalid');

        const sanitizedName = sanitizePresetName(els.savePresetNameInput.value);
        if (!sanitizedName) {
            els.savePresetNameInput.classList.add('invalid');
            els.savePresetNameInput.setAttribute('aria-invalid', 'true');
            els.savePresetNameInput.focus();
            return;
        }

        const uniqueName = ensureUniquePresetName(sanitizedName);
        const preset = createCustomPreset(uniqueName, gradient);
        if (!preset) {
            els.savePresetNameInput.classList.add('invalid');
            els.savePresetNameInput.setAttribute('aria-invalid', 'true');
            return;
        }

        customPresets.unshift(preset);
        while (customPresets.length > MAX_CUSTOM_PRESETS) {
            customPresets.pop();
        }

        const persisted = saveCustomPresets();
        renderCustomPresets();
        closeSavePresetModal();
        showToast(persisted ? 'Preset saved to this device.' : 'Preset saved for now (storage unavailable).');
    }

    function createCustomPreset(name, sourceGradient) {
        const sanitizedName = sanitizePresetName(name);
        if (!sanitizedName) {
            return null;
        }

        const sanitizedGradient = sanitizeGradientState(sourceGradient);
        return {
            ...sanitizedGradient,
            name: sanitizedName
        };
    }

    function ensureUniquePresetName(baseName) {
        const normalized = baseName.trim();
        if (!normalized) {
            return generateSuggestedPresetName();
        }

        const existingNames = new Set(customPresets.map(preset => (
            typeof preset.name === 'string' ? preset.name.toLowerCase() : ''
        )));

        if (!existingNames.has(normalized.toLowerCase())) {
            return normalized;
        }

        let counter = 2;
        let candidate = `${normalized} ${counter}`;
        while (existingNames.has(candidate.toLowerCase())) {
            counter += 1;
            candidate = `${normalized} ${counter}`;
        }
        return candidate;
    }

    function generateSuggestedPresetName() {
        const base = 'Custom Preset';
        const existingNames = new Set(customPresets.map(preset => (
            typeof preset.name === 'string' ? preset.name.toLowerCase() : ''
        )));

        let counter = customPresets.length + 1;
        let candidate = `${base} ${counter}`;
        while (existingNames.has(candidate.toLowerCase())) {
            counter += 1;
            candidate = `${base} ${counter}`;
        }
        return candidate;
    }

    function deleteCustomPreset(index) {
        if (!Number.isInteger(index) || index < 0 || index >= customPresets.length) {
            return;
        }

        customPresets.splice(index, 1);
        const persisted = saveCustomPresets();
        renderCustomPresets();
        showToast(persisted ? 'Preset removed.' : 'Preset removed (storage unavailable).');
    }

    // ===================================================================
    // GENERATION & EXPORT
    // ===================================================================
    function generateGradientCSS(g) {
        const safeGradient = sanitizeGradientState(g);
        const stopsStr = safeGradient.stops.map(s => `${s.color} ${s.pos}%`).join(', ');

        switch (safeGradient.type) {
            case 'radial':
                return `background: radial-gradient(${safeGradient.shape}, ${stopsStr});`;
            case 'conic':
                return `background: conic-gradient(from ${safeGradient.angle}deg, ${stopsStr});`;
            default:
                return `background: linear-gradient(${safeGradient.angle}deg, ${stopsStr});`;
        }
    }

    function generateSVGString(g, w, h) {
        const safeGradient = sanitizeGradientState(g);
        const widthValue = toSafeDimension(w, 1920);
        const heightValue = toSafeDimension(h, 1080);
        const stopsSVG = safeGradient.stops.map(s =>
            `<stop offset="${s.pos}%" stop-color="${s.color}" />`
        ).join('');

        let gradientTag;
        if (safeGradient.type === 'linear') {
            gradientTag = `<linearGradient id="g" gradientTransform="rotate(${safeGradient.angle - 90})">${stopsSVG}</linearGradient>`;
        } else if (safeGradient.type === 'radial') {
            gradientTag = `<radialGradient id="g" cx="50%" cy="50%" r="50%">${stopsSVG}</radialGradient>`;
        } else {
            // Conic gradient approximation for SVG
            gradientTag = `<linearGradient id="g">${stopsSVG}</linearGradient>`;
        }

        return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthValue}" height="${heightValue}" viewBox="0 0 ${widthValue} ${heightValue}">
            <defs>${gradientTag}</defs>
            <rect width="${widthValue}" height="${heightValue}" fill="url(#g)" />
        </svg>`;
    }

    function exportAsSVG(width, height) {
        const svgString = generateSVGString(gradient, width, height);
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);

        triggerDownload(url, 'gradient.svg');
        URL.revokeObjectURL(url);
        showToast('Image exported as SVG!');
    }

    function exportAsRaster(format, width, height) {
        const safeFormat = format === 'jpg' ? 'jpg' : 'png';
        const safeGradient = sanitizeGradientState(gradient);
        const widthValue = toSafeDimension(width, RESOLUTIONS['1080p'].width);
        const heightValue = toSafeDimension(height, RESOLUTIONS['1080p'].height);
        const svgString = generateSVGString(safeGradient, widthValue, heightValue);
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);

        const canvas = document.createElement('canvas');
        canvas.width = widthValue;
        canvas.height = heightValue;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            URL.revokeObjectURL(url);
            showToast('Canvas not supported in this browser.');
            return;
        }

        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
            if (safeGradient.blur > 0) {
                ctx.filter = `blur(${safeGradient.blur}px)`;
            }

            ctx.drawImage(img, 0, 0, widthValue, heightValue);
            ctx.filter = 'none';

            URL.revokeObjectURL(url);

            if (safeGradient.noise > 0) {
                drawNoise(ctx, widthValue, heightValue, safeGradient.noise);
            }

            const mime = safeFormat === 'jpg' ? 'image/jpeg' : 'image/png';
            const quality = safeFormat === 'jpg' ? 0.9 : 1.0;

            const finalizeDownload = (data, isObjectUrl) => {
                triggerDownload(data, `gradient.${safeFormat}`);
                if (isObjectUrl) {
                    URL.revokeObjectURL(data);
                }
                showToast(`Image exported as ${safeFormat.toUpperCase()}!`);
            };

            if (canvas.toBlob) {
                canvas.toBlob(result => {
                    if (result) {
                        const objectUrl = URL.createObjectURL(result);
                        finalizeDownload(objectUrl, true);
                    } else {
                        finalizeDownload(canvas.toDataURL(mime, quality), false);
                    }
                }, mime, quality);
            } else {
                finalizeDownload(canvas.toDataURL(mime, quality), false);
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            showToast('Error creating image.');
        };

        img.src = url;
    }

    function drawNoise(ctx, w, h, opacity) {
        const safeOpacity = clampNumber(opacity, 0, 100, 0);
        if (safeOpacity <= 0) {
            return;
        }

        const noiseCanvas = document.createElement('canvas');
        noiseCanvas.width = 100;
        noiseCanvas.height = 100;
        const noiseCtx = noiseCanvas.getContext('2d');
        if (!noiseCtx) {
            return;
        }

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

        const pattern = ctx.createPattern(noiseCanvas, 'repeat');
        if (!pattern) {
            return;
        }

        ctx.save();
        ctx.globalAlpha = safeOpacity / 100;
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }

    async function copyToClipboard(text) {
        const safeText = typeof text === 'string' ? text : '';
        if (!safeText) {
            showToast('Nothing to copy.');
            return;
        }

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(safeText);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = safeText;
                textarea.setAttribute('readonly', '');
                textarea.style.position = 'absolute';
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
            showToast('CSS copied!');
        } catch (err) {
            console.error('Clipboard error:', err);
            showToast('Failed to copy.');
        }
    }

    function exportCssFile() {
        const safeGradient = sanitizeGradientState(gradient);
        const content = `.generated-gradient {\n    ${generateGradientCSS(safeGradient)}\n}`;
        const blob = new Blob([content], { type: 'text/css' });
        const url = URL.createObjectURL(blob);

        triggerDownload(url, 'gradient.css');
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
        const presetsList = [
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
                    { color: '#A1C4FD', pos: 0 },
                    { color: '#C2E9FB', pos: 100 }
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

        return presetsList.map(preset => sanitizeGradientState(preset));
    }

    function ensureReadableTextColorOnPreview(currentGradient = gradient) {
        if (!currentGradient || !Array.isArray(currentGradient.stops) || !currentGradient.stops.length) {
            return;
        }

        const stops = currentGradient.stops;
        const midStop = stops[Math.floor(stops.length / 2)];
        if (!midStop) {
            return;
        }

        const sanitizedColor = sanitizeColor(midStop.color, null);
        if (!sanitizedColor) {
            return;
        }

        const bgColor = hexToRgb(sanitizedColor);
        if (!bgColor) {
            return;
        }

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

    // ===================================================================
    // SANITIZATION & DOWNLOAD HELPERS
    // ===================================================================
    function createDefaultGradientState() {
        return {
            type: 'linear',
            angle: 90,
            shape: 'ellipse',
            stops: [
                { color: '#2B8EFB', pos: 0 },
                { color: '#1FC8A1', pos: 100 }
            ],
            blur: 0,
            noise: 0
        };
    }

    function normalizeHex(value) {
        if (typeof value !== 'string') {
            return null;
        }

        let normalized = value.trim();
        if (!normalized) {
            return null;
        }

        if (!normalized.startsWith('#')) {
            normalized = `#${normalized}`;
        }

        if (!HEX_COLOR_REGEX.test(normalized)) {
            return null;
        }

        if (normalized.length === 4) {
            normalized = `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
        }

        return normalized.toUpperCase();
    }

    function sanitizeColor(value, fallback = null) {
        return normalizeHex(value) ?? normalizeHex(fallback);
    }

    function sanitizePresetName(value) {
        if (typeof value !== 'string') {
            return null;
        }

        let normalized = value.trim();
        if (!normalized) {
            return null;
        }

        try {
            normalized = normalized.normalize('NFKC');
        } catch (error) {
            // Ignore environments that do not support String.normalize
        }

        normalized = normalized
            .replace(/[^\p{L}\p{N}\s\-_]/gu, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (!normalized) {
            return null;
        }

        return normalized.slice(0, 40);
    }

    function clampNumber(value, min, max, fallback = null) {
        if (typeof value === 'string' && value.trim() === '') {
            return fallback;
        }

        const num = Number(value);
        if (!Number.isFinite(num)) {
            return fallback;
        }

        const clamped = Math.min(max, Math.max(min, num));
        return Math.round(clamped);
    }

    function sanitizeStop(stop, fallbackStop) {
        const baseStop = fallbackStop || { color: '#FFFFFF', pos: 0 };
        if (!stop || typeof stop !== 'object') {
            return { color: baseStop.color, pos: baseStop.pos };
        }

        const color = sanitizeColor(stop.color, baseStop.color) || baseStop.color;
        const pos = clampNumber(stop.pos, 0, 100, baseStop.pos);
        return { color, pos };
    }

    function sanitizeGradientState(state) {
        const base = createDefaultGradientState();
        if (!state || typeof state !== 'object') {
            return createDefaultGradientState();
        }

        const sanitized = {
            type: GRADIENT_TYPES.has(state.type) ? state.type : base.type,
            angle: clampNumber(state.angle, 0, 360, base.angle),
            shape: base.shape,
            stops: [],
            blur: clampNumber(state.blur, 0, 40, base.blur),
            noise: clampNumber(state.noise, 0, 100, base.noise)
        };

        if (sanitized.type === 'radial' && state.shape === 'circle') {
            sanitized.shape = 'circle';
        }

        const stopsSource = Array.isArray(state.stops) ? state.stops : [];
        sanitized.stops = stopsSource
            .map((stop, index) => sanitizeStop(stop, base.stops[index % base.stops.length]))
            .filter(Boolean);

        if (sanitized.stops.length < 2) {
            sanitized.stops = base.stops.map(stop => ({ ...stop }));
        }

        sanitized.stops.sort((a, b) => a.pos - b.pos);

        return sanitized;
    }

    function applySanitizedState(target, rawState) {
        const sanitized = sanitizeGradientState(rawState);
        target.type = sanitized.type;
        target.angle = sanitized.angle;
        target.shape = sanitized.shape;
        target.stops = sanitized.stops.map(stop => ({ ...stop }));
        target.blur = sanitized.blur;
        target.noise = sanitized.noise;
        return target;
    }

    function toSafeDimension(value, fallback) {
        const num = Number(value);
        if (Number.isFinite(num) && num > 0) {
            return Math.min(10000, Math.round(num));
        }
        const fallbackNum = Number(fallback);
        if (Number.isFinite(fallbackNum) && fallbackNum > 0) {
            return Math.min(10000, Math.round(fallbackNum));
        }
        return 1000;
    }

    function triggerDownload(url, filename) {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.rel = 'noopener noreferrer';
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
    }

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', init);
})();
