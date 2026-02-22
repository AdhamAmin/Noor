// settings.js

class NoorSettings {
    constructor() {
        this.storageKey = 'noor_prayer_settings';

        // Default config
        this.config = {
            theme: 'theme-dark',
            sound: false,
            celebration: true,
            madfaa: true,
            method: 5,   // Egyptian General Authority
            madhab: 0    // Standard (Shafi, Hanbali, Maliki)
        };

        this.init();
        this.bindEvents();
    }

    init() {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            try {
                this.config = { ...this.config, ...JSON.parse(saved) };
            } catch (e) {
                console.error("Failed to parse settings", e);
            }
        }
        this.applyTheme(this.config.theme);
        this.syncUI();
    }

    save() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.config));
        // Dispatch event so main app knows settings changed (like API reload needed)
        window.dispatchEvent(new CustomEvent('noorSettingsChanged', { detail: this.config }));
    }

    // Update a specific key
    update(key, value) {
        if (this.config[key] !== value) {
            this.config[key] = value;
            this.save();
        }
    }

    applyTheme(theme) {
        document.body.classList.remove('theme-dark', 'theme-light', 'theme-ramadan');
        document.body.classList.add(theme);
        this.config.theme = theme;

        // Manage ramadan exclusive settings UI
        const madfaaGroup = document.getElementById('madfaa-setting-group');
        if (theme === 'theme-ramadan') {
            madfaaGroup.classList.remove('hidden');
        } else {
            madfaaGroup.classList.add('hidden');
        }
        this.save();
    }

    syncUI() {
        // Sync Themes
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === this.config.theme);
        });

        // Sync Toggles
        if (document.getElementById('setting-sound')) {
            document.getElementById('setting-sound').checked = this.config.sound;
            document.getElementById('setting-celebration').checked = this.config.celebration;
            document.getElementById('setting-madfaa').checked = this.config.madfaa;
        }

        // Sync Selects
        if (document.getElementById('setting-method')) {
            document.getElementById('setting-method').value = this.config.method;
            document.getElementById('setting-madhab').value = this.config.madhab;
        }
    }

    bindEvents() {
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const theme = e.target.dataset.theme;
                this.applyTheme(theme);
                this.syncUI();
            });
        });

        document.getElementById('setting-sound')?.addEventListener('change', (e) => this.update('sound', e.target.checked));
        document.getElementById('setting-celebration')?.addEventListener('change', (e) => this.update('celebration', e.target.checked));
        document.getElementById('setting-madfaa')?.addEventListener('change', (e) => this.update('madfaa', e.target.checked));

        document.getElementById('setting-method')?.addEventListener('change', (e) => this.update('method', parseInt(e.target.value)));
        document.getElementById('setting-madhab')?.addEventListener('change', (e) => this.update('madhab', parseInt(e.target.value)));

        // Modal behavior
        const modal = document.getElementById('settings-modal');
        document.getElementById('open-settings-btn')?.addEventListener('click', () => {
            modal.classList.remove('hidden');
        });
        document.getElementById('close-settings-btn')?.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
        modal?.querySelector('.modal-backdrop').addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }
}

const settings = new NoorSettings();
window.NoorSettings = settings;
