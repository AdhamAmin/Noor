// settings.js - Comprehensive Settings & Theme Management for Noor

class NoorSettings {
  constructor() {
    this.storageKey = 'noor_prayer_settings';

    // Default configuration
    this.config = {
      theme: 'theme-dark',            // theme-dark (Emerald), theme-light (Pearl), theme-ramadan (Gold), theme-sapphire (Sapphire)
      sound: false,                   // Adhan playback
      adhanVoice: 'default',          // default, makkah, madinah
      celebration: true,              // Particle / confetti celebrations
      madfaa: true,                   // Ramadan madfaa transition
      method: 5,                      // 5 = Egyptian General Authority
      madhab: 0,                      // 0 = Standard, 1 = Hanafi
      quranFontSize: 28,              // Quran font size in px
      quranFont: 'Amiri',             // Amiri, Scheherazade New
      quranMode: 'mushaf',            // 'mushaf' (continuous flow) or 'ayah' (verse-by-verse)
      tasbeehSound: true,             // Click audio for masbaha
      tasbeehVibration: true,         // Haptic vibration
      khatmahDailyGoal: 4,            // Daily pages target (e.g., 4 pages = 1 Khatmah every 5 months)
      language: 'ar'                  // 'ar' or 'en'
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

    // Language preference
    const savedLang = localStorage.getItem('noor_lang');
    if (savedLang) {
      this.config.language = savedLang;
    }

    this.applyTheme(this.config.theme, false);
    this.applyQuranStyles();
    this.syncUI();
  }

  save() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.config));
    window.dispatchEvent(new CustomEvent('noorSettingsChanged', { detail: this.config }));
  }

  update(key, value) {
    if (this.config[key] !== value) {
      this.config[key] = value;
      this.save();
    }
  }

  applyTheme(theme, persist = true) {
    document.body.classList.remove('theme-dark', 'theme-light', 'theme-ramadan', 'theme-sapphire', 'theme-emerald', 'theme-navy');
    document.body.classList.add(theme);
    this.config.theme = theme;

    // Manage Ramadan-exclusive decor visibility
    const ramadanDecor = document.querySelector('.ramadan-decorations');
    if (ramadanDecor) {
      ramadanDecor.style.display = (theme === 'theme-ramadan') ? 'block' : 'none';
    }

    const madfaaGroup = document.getElementById('madfaa-setting-group');
    if (madfaaGroup) {
      if (theme === 'theme-ramadan') {
        madfaaGroup.classList.remove('hidden');
      } else {
        madfaaGroup.classList.add('hidden');
      }
    }

    // Update active state on theme buttons
    document.querySelectorAll('[data-theme]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });

    if (persist) this.save();
  }

  applyQuranStyles() {
    document.documentElement.style.setProperty('--quran-font-size', `${this.config.quranFontSize}px`);
    document.documentElement.style.setProperty('--font-arabic', `'${this.config.quranFont}', serif`);
  }

  syncUI() {
    // Theme buttons
    document.querySelectorAll('[data-theme]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === this.config.theme);
    });

    // Checkboxes
    const toggles = {
      'setting-sound': 'sound',
      'setting-celebration': 'celebration',
      'setting-madfaa': 'madfaa',
      'setting-tasbeeh-sound': 'tasbeehSound',
      'setting-tasbeeh-vibrate': 'tasbeehVibration'
    };

    for (const [id, key] of Object.entries(toggles)) {
      const el = document.getElementById(id);
      if (el) el.checked = !!this.config[key];
    }

    // Selects
    const selects = {
      'setting-method': 'method',
      'setting-madhab': 'madhab',
      'setting-quran-font': 'quranFont',
      'setting-quran-mode': 'quranMode'
    };

    for (const [id, key] of Object.entries(selects)) {
      const el = document.getElementById(id);
      if (el) el.value = String(this.config[key]);
    }

    // Font size display
    const fontSizeLabel = document.getElementById('quran-font-size-val');
    if (fontSizeLabel) fontSizeLabel.innerText = `${this.config.quranFontSize}px`;
  }

  bindEvents() {
    // Theme Buttons
    document.querySelectorAll('[data-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.applyTheme(btn.dataset.theme);
      });
    });

    // Toggles
    const toggleMap = [
      { id: 'setting-sound', key: 'sound' },
      { id: 'setting-celebration', key: 'celebration' },
      { id: 'setting-madfaa', key: 'madfaa' },
      { id: 'setting-tasbeeh-sound', key: 'tasbeehSound' },
      { id: 'setting-tasbeeh-vibrate', key: 'tasbeehVibration' }
    ];

    toggleMap.forEach(({ id, key }) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => this.update(key, el.checked));
      }
    });

    // Selects
    const selectMap = [
      { id: 'setting-method', key: 'method', isNum: true },
      { id: 'setting-madhab', key: 'madhab', isNum: true },
      { id: 'setting-quran-font', key: 'quranFont', isNum: false, onChange: () => this.applyQuranStyles() },
      { id: 'setting-quran-mode', key: 'quranMode', isNum: false }
    ];

    selectMap.forEach(({ id, key, isNum, onChange }) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => {
          this.update(key, isNum ? parseInt(el.value, 10) : el.value);
          if (onChange) onChange();
        });
      }
    });

    // Font size controls
    const incBtn = document.getElementById('quran-font-inc');
    const decBtn = document.getElementById('quran-font-dec');
    if (incBtn) {
      incBtn.addEventListener('click', () => {
        if (this.config.quranFontSize < 44) {
          this.update('quranFontSize', this.config.quranFontSize + 2);
          this.applyQuranStyles();
          this.syncUI();
        }
      });
    }
    if (decBtn) {
      decBtn.addEventListener('click', () => {
        if (this.config.quranFontSize > 20) {
          this.update('quranFontSize', this.config.quranFontSize - 2);
          this.applyQuranStyles();
          this.syncUI();
        }
      });
    }

    // Close settings modal
    const closeBtn = document.getElementById('close-settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    if (closeBtn && settingsModal) {
      closeBtn.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
      });
      const backdrop = settingsModal.querySelector('.modal-backdrop');
      if (backdrop) {
        backdrop.addEventListener('click', () => {
          settingsModal.classList.add('hidden');
        });
      }
    }

    // Open settings button
    const openBtn = document.getElementById('open-settings-btn');
    if (openBtn && settingsModal) {
      openBtn.addEventListener('click', () => {
        this.syncUI();
        settingsModal.classList.remove('hidden');
      });
    }
  }
}

const settings = new NoorSettings();
window.NoorSettings = settings;
