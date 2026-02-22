// main.js

class NoorApp {
    constructor() {
        this.api = window.NoorAPI;
        this.settings = window.NoorSettings;
        this.engine = window.NoorEngine;
        this.particles = window.NoorParticles;

        this.targetPrayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

        // Default location (Cairo)
        this.loc = { lat: 30.0444, lng: 31.2357, name: 'Cairo', country: 'Egypt' };

        this.timings = null;
        this.isRamadanMonth = false;
        this.currentPrayerIndex = -1;
        this.currentDate = null;
        this.clockInterval = null;
        this.azkarData = null;
        this.quranAudio = new Audio();
        this.adhanAudio = new Audio();
        this.reciters = [];
        this.currentSurahAudioList = [];
        this.currentAyahIndex = 0;
    }

    async init() {
        this.startClock();
        this.bindTabs();
        this.bindEvents();

        // Request notification permission so we can alert 5min before prayer
        this.requestNotificationPermission();

        // Load Azkar data in the background for the home view Doaa snippet
        this.loadAzkarData();

        try {
            await this.requestLocation();
        } catch (e) {
            console.warn("Location access denied or failed, using default (Cairo).");
        }

        await this.loadData();
        this.checkWelcomeFlow();
        this.hideSplash();
    }

    requestNotificationPermission() {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    bindEvents() {
        window.addEventListener('noorSettingsChanged', (e) => {
            // If method or madhab changes, reload API data
            this.loadData();
        });

        // Language Toggle - Arabic UI
        const langToggle = document.getElementById('setting-language-arabic');
        if (langToggle) {
            langToggle.addEventListener('change', () => {
                this.applyLanguage(langToggle.checked);
            });
        }
    }

    checkWelcomeFlow() {
        const hasVisited = localStorage.getItem('noor_first_visit');

        if (!hasVisited) {
            const modal = document.getElementById('welcome-modal');
            const step1 = document.getElementById('welcome-step-1');
            const step2 = document.getElementById('welcome-step-2');
            const nextBtn = document.getElementById('welcome-next-btn');
            const langEnBtn = document.getElementById('welcome-lang-en');
            const langArBtn = document.getElementById('welcome-lang-ar');
            const langToggle = document.getElementById('setting-language-arabic');

            if (modal) {
                modal.classList.remove('hidden');
            }

            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    step1.classList.add('hidden');
                    step2.classList.remove('hidden');
                });
            }

            const finishWelcome = (isArabic) => {
                localStorage.setItem('noor_lang', isArabic ? 'ar' : 'en');
                localStorage.setItem('noor_first_visit', 'true');
                if (langToggle) langToggle.checked = isArabic;
                this.applyLanguage(isArabic);
                if (modal) modal.classList.add('hidden');

                // Show PWA install modal after a short delay — but only once
                const alreadyShownInstall = localStorage.getItem('noor_install_shown');
                if (!alreadyShownInstall) {
                    setTimeout(() => {
                        const installModal = document.getElementById('install-modal');
                        if (installModal) {
                            if (isArabic) {
                                const title = document.getElementById('install-modal-title');
                                const body = document.getElementById('install-modal-body');
                                const btn = document.getElementById('install-modal-btn-text');
                                const later = document.getElementById('install-modal-later');
                                if (title) title.innerText = 'ثبّت تطبيق نور!';
                                if (body) body.innerText = 'أضف نور إلى شاشتك الرئيسية للحصول على أفضل تجربة — وصول فوري، دعم بدون إنترنت، وبدون شريط المتصفح!';
                                if (btn) btn.innerText = 'تثبيت التطبيق';
                                if (later) later.innerText = 'ربما لاحقاً';
                            }
                            installModal.classList.remove('hidden');
                            localStorage.setItem('noor_install_shown', 'true');
                        }
                    }, 500);
                }
            };

            if (langEnBtn) langEnBtn.addEventListener('click', () => finishWelcome(false));
            if (langArBtn) langArBtn.addEventListener('click', () => finishWelcome(true));

        } else {
            // Reapply saved language if existing user
            const savedLang = localStorage.getItem('noor_lang');
            if (savedLang === 'ar') {
                const langToggle = document.getElementById('setting-language-arabic');
                if (langToggle) langToggle.checked = true;
                this.applyLanguage(true);
            }
        }

        // Translate Welcome Modal strings dynamically based on current language
        const isArabic = localStorage.getItem('noor_lang') === 'ar';
        const modalHeader = document.querySelector('#welcome-modal .modal-header h2');
        if (modalHeader) modalHeader.innerText = isArabic ? 'مرحباً بك في نور!' : 'Welcome to Noor!';

        const step1P = document.querySelector('#welcome-step-1 p:first-child');
        if (step1P) step1P.innerText = isArabic ? 'شكراً لاستخدامك تطبيق نور لمواقيت الصلاة.' : 'Thank you for using the Noor Prayer app.';

        const designedBy = document.querySelector('.welcome-info-box p:first-child');
        if (designedBy) designedBy.innerText = isArabic ? 'تصميم: أدهم أمين' : 'Designed by Adham Amin';

        const nextBtnText = document.getElementById('welcome-next-btn');
        if (nextBtnText) {
            nextBtnText.innerHTML = isArabic
                ? `التالي <span class="material-symbols-rounded" style="vertical-align: middle; margin-right: 5px; transform: scaleX(-1);">arrow_forward</span>`
                : `Next <span class="material-symbols-rounded" style="vertical-align: middle; margin-left: 5px;">arrow_forward</span>`;
        }

        const step2P = document.querySelector('#welcome-step-2 p:first-child');
        if (step2P) step2P.innerText = isArabic ? 'أي لغة تفضل؟' : 'Which language do you prefer?';
    }

    applyLanguage(isArabic) {
        const translations = {
            // Header
            'app-title': { ar: 'نور', en: 'Noor' },
            'city-name': { ar: this.loc.name, en: this.loc.name },
            // Page headings
            'quran-page-title': { ar: 'القرآن الكريم', en: 'Quran' },
            'azkar-page-title': { ar: 'الأذكار والدعاء', en: 'Azkar' },
            // Home Dashboard
            'doaa-title-label': { ar: 'دعاء اليوم', en: 'Daily Doaa' },
            // Settings
            'setting-label-language': { ar: 'اللغة', en: 'Language' },
            'setting-label-arabic': { ar: 'واجهة عربية', en: 'Arabic UI' },
            'setting-label-prayercalc': { ar: 'حساب أوقات الصلاة', en: 'Prayer Calculation' },
        };

        for (const [id, val] of Object.entries(translations)) {
            const el = document.getElementById(id);
            if (el) el.innerText = isArabic ? val.ar : val.en;
        }

        // Nav item labels (they're spans inside nav-item buttons)
        const navLabels = document.querySelectorAll('.nav-item span:last-child');
        const navKeys = ['nav-home-label', 'nav-quran-label', 'nav-azkar-label'];
        const navEn = ['Home', 'Quran', 'Azkar'];
        const navAr = ['الرئيسية', 'القرآن', 'الأذكار'];
        navLabels.forEach((label, i) => {
            label.innerText = isArabic ? navAr[i] : navEn[i];
        });

        // Countdown label
        const cLabel = document.querySelector('.countdown-label');
        if (cLabel) cLabel.innerText = isArabic ? 'الوقت المتبقي' : 'Time Remaining';

        // Next Prayer label
        const npLabel = document.querySelector('.next-prayer-card .label');
        if (npLabel) npLabel.innerText = isArabic ? 'الصلاة القادمة' : 'Next Prayer';

        // Settings page heading
        const settingsH2 = document.querySelector('.modal-header h2');
        if (settingsH2) settingsH2.innerText = isArabic ? 'الإعدادات' : 'Settings';

        // Settings labels
        // Settings labels and categories
        const settingsGroups = document.querySelectorAll('.settings-group h3');
        const groupLabels = [
            { en: 'Theme', ar: 'المظهر' },
            { en: 'Experience', ar: 'التجربة' },
            { en: 'App', ar: 'التطبيق' },
            { en: 'Calculation Method', ar: 'طريقة الحساب' },
            { en: 'Ramadan Madfaa', ar: 'مدفع رمضان' },
            { en: 'Language', ar: 'اللغة' }
        ];

        settingsGroups.forEach((h3, i) => {
            if (groupLabels[i]) h3.innerText = isArabic ? groupLabels[i].ar : groupLabels[i].en;
        });

        const pwaInstallBtn = document.getElementById('install-app-btn');
        if (pwaInstallBtn) {
            pwaInstallBtn.innerHTML = isArabic
                ? `<span class="material-symbols-rounded" style="vertical-align: middle; margin-left: 8px;">download</span> تثبيت التطبيق`
                : `<span class="material-symbols-rounded" style="vertical-align: middle; margin-right: 8px;">download</span> Install App`;
        }

        const soundLabel = document.querySelector('#setting-sound + span');
        const soundLabelEl = document.querySelector('[for="setting-sound"]');
        const allToggles = document.querySelectorAll('.setting-toggle span:not(.toggle-slider)');
        const toggleLabels = [
            { en: 'Play Sound at Adhan', ar: 'تشغيل الأذان عند الصلاة' },
            { en: 'Visual Celebration', ar: 'احتفال مرئي' },
            { en: 'Enable Madfaa Transition', ar: 'تفعيل تأثير المدفع' },
            { en: 'Arabic UI', ar: 'واجهة عربية' },
        ];
        allToggles.forEach((el, i) => {
            if (toggleLabels[i]) el.innerText = isArabic ? toggleLabels[i].ar : toggleLabels[i].en;
        });

        const themeButtons = document.querySelectorAll('[data-theme]');
        const themeLabelAr = ['فاتح', 'رمضان'];
        const themeLabelEn = ['Light', 'Ramadan'];
        themeButtons.forEach((btn, i) => {
            btn.innerText = isArabic ? themeLabelAr[i] || btn.innerText : themeLabelEn[i] || btn.innerText;
        });
    }

    requestLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject('Not supported');
                return;
            }
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    this.loc.lat = pos.coords.latitude;
                    this.loc.lng = pos.coords.longitude;

                    try {
                        // Reverse Geocoding to get City/Country Name
                        const geoUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${this.loc.lat}&longitude=${this.loc.lng}&localityLanguage=en`;
                        const res = await fetch(geoUrl);
                        const data = await res.json();

                        this.loc.name = data.city || data.locality || 'Current Location';
                        this.loc.country = data.countryName || '';

                    } catch (e) {
                        console.warn("Reverse geocoding failed", e);
                        this.loc.name = 'Current Location';
                        this.loc.country = '';
                    }

                    document.getElementById('city-name').innerText = this.loc.name;
                    document.getElementById('country-name').innerText = this.loc.country;
                    resolve();
                },
                (err) => reject(err),
                { timeout: 5000 }
            );
        });
    }

    async loadData() {
        const data = await this.api.getTimingsByCoordinates(
            this.loc.lat,
            this.loc.lng,
            this.settings.config.method,
            this.settings.config.madhab
        );

        if (!data) return;

        this.isRamadanMonth = this.api.isRamadan(data);

        // If it's Ramadan month and Theme is "Ramadan Auto" or simply "Ramadan"
        if (this.isRamadanMonth && this.settings.config.theme !== 'theme-light') {
            if (this.settings.config.theme !== 'theme-ramadan') {
                this.settings.applyTheme('theme-ramadan');
            }
            if (this.particles && typeof this.particles.startRamadanBackground === 'function') {
                this.particles.startRamadanBackground();
            }
        } else if (this.settings.config.theme === 'theme-ramadan') {
            if (this.particles && typeof this.particles.startRamadanBackground === 'function') {
                this.particles.startRamadanBackground();
            }
        }

        this.currentDate = data.date;
        this.parseTimings(data.timings);
        this.renderTodayList();
        this.calculateNextPrayer();
    }

    parseTimings(rawTimings) {
        this.timings = [];
        const now = new Date();

        for (const p of this.targetPrayers) {
            if (rawTimings[p]) {
                // Extracts the time part "05:02" from "2026-02-22T05:02:00+02:00" safely 
                const timePart = rawTimings[p].split('T')[1].substring(0, 5);
                const [hours, minutes] = timePart.split(':').map(Number);
                const prayerDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);

                this.timings.push({
                    name: p,
                    date: prayerDate,
                    timeStr: this.formatTimeAMPM(hours, minutes)
                });
            }
        }

        // Sort array just in case
        this.timings.sort((a, b) => a.date - b.date);
    }

    formatTimeAMPM(h, m) {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hd = h % 12 || 12;
        const md = m < 10 ? '0' + m : m;
        return `${String(hd).padStart(2, '0')}:${md} ${ampm}`;
    }

    renderTodayList() {
        const listHtml = this.timings.map((t, index) => {
            // state classes applied in calculateNextPrayer
            return `
        <div class="prayer-row" id="prayer-row-${index}">
          <span class="row-name">${t.name}</span>
          <span class="row-time">${t.timeStr}</span>
        </div>
      `;
        }).join('');

        document.getElementById('prayers-list').innerHTML = listHtml;
    }

    calculateNextPrayer() {
        const now = new Date();
        let nextIndex = -1;
        let prevDate = null;

        for (let i = 0; i < this.timings.length; i++) {
            const p = this.timings[i];
            if (p.date > now) {
                nextIndex = i;
                prevDate = i > 0 ? this.timings[i - 1].date : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0); // start of day if Fajr is next
                break;
            }
        }

        // IF all prayers today have passed, NEXT is Fajr tomorrow
        let isTomorrow = false;
        if (nextIndex === -1) {
            nextIndex = 0;
            isTomorrow = true;
            // Retrieve tomorrow's Fajr date based off of today's Fajr (index 0)
            const tomorrowFajr = new Date(this.timings[0].date);
            tomorrowFajr.setDate(tomorrowFajr.getDate() + 1);

            this.timings[0].date = tomorrowFajr; // modify local copy for engine
            // Prev date is today's Isha (last item in timings)
            prevDate = this.timings[this.timings.length - 1].date;
        }

        this.currentPrayerIndex = nextIndex;
        const nextPrayer = this.timings[nextIndex];

        // Update UI Cards
        document.getElementById('next-prayer-name').innerText = nextPrayer.name;
        document.getElementById('next-prayer-time').innerText = nextPrayer.timeStr;

        // Update Gregorian and Hijri Dates
        if (this.currentDate) {
            const gregorian = this.currentDate.gregorian;
            const hijri = this.currentDate.hijri;

            document.getElementById('gregorian-date').innerText = `${gregorian.weekday.en}, ${gregorian.day} ${gregorian.month.en} ${gregorian.year}`;
            document.getElementById('hijri-date').innerText = `${hijri.weekday.ar}، ${hijri.day} ${hijri.month.ar} ${hijri.year}`;
        }

        // Update Today List styles
        this.timings.forEach((t, i) => {
            const row = document.getElementById(`prayer-row-${i}`);
            row.classList.remove('active', 'completed');

            if (isTomorrow) {
                row.classList.add('completed');
            } else {
                if (i < nextIndex) row.classList.add('completed');
                if (i === nextIndex) row.classList.add('active');
            }
        });

        // Start Engine
        const durationMs = nextPrayer.date.getTime() - prevDate.getTime();
        const durationSeconds = Math.floor(durationMs / 1000);

        this.engine.start(nextPrayer.date, durationSeconds, () => {
            this.handleCelebration(nextPrayer.name);
        });

        // Schedule a browser notification 5 minutes before this prayer
        this.scheduleNotification5Min(nextPrayer);
    }

    // Schedule a browser notification 5 minutes before a prayer
    scheduleNotification5Min(nextPrayer) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        // Clear previous scheduled notification if any
        if (this._notifTimeout) clearTimeout(this._notifTimeout);

        const now = Date.now();
        const prayerMs = nextPrayer.date.getTime();
        const msUntil5MinBefore = prayerMs - now - (5 * 60 * 1000);

        // Only schedule if more than 5 minutes away
        if (msUntil5MinBefore <= 0) return;

        const isArabic = localStorage.getItem('noor_lang') === 'ar';
        const prayerName = nextPrayer.name;

        const title = isArabic
            ? `🕔 تنبيه وقت الصلاة`
            : `🕔 Prayer Reminder`;

        const body = isArabic
            ? `تبقى 5 دقائق على أذان ${prayerName} — تهيّأ للصلاة.`
            : `${prayerName} is in 5 minutes — time to prepare.`;

        this._notifTimeout = setTimeout(() => {
            try {
                new Notification(title, {
                    body,
                    icon: './assets/icon.png',
                    badge: './assets/icon.png',
                    tag: 'noor-prayer-reminder',
                    renotify: true,
                    silent: false
                });
            } catch (e) {
                console.warn('Notification failed:', e);
            }
        }, msUntil5MinBefore);
    }

    // --- CLOCK & TABS ---
    startClock() {
        const desktopEl = document.getElementById('desktop-clock-display');
        const mobileEl = document.getElementById('mobile-clock-display');

        const updateTime = () => {
            const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (desktopEl) desktopEl.innerText = nowStr;
            if (mobileEl) mobileEl.innerText = nowStr;
        };

        if (this.clockInterval) clearInterval(this.clockInterval);
        this.clockInterval = setInterval(updateTime, 1000);
        updateTime();
    }

    bindTabs() {
        const navItems = document.querySelectorAll('.bottom-nav .nav-item');
        const views = document.querySelectorAll('.app-container .view');

        navItems.forEach(btn => {
            btn.addEventListener('click', () => {
                navItems.forEach(b => b.classList.remove('active'));
                views.forEach(v => v.classList.add('hidden'));
                views.forEach(v => v.classList.remove('active'));

                btn.classList.add('active');
                const targetId = btn.getAttribute('data-target');
                const targetView = document.getElementById(targetId);
                targetView.classList.remove('hidden');
                targetView.classList.add('active');

                if (targetId === 'view-quran') this.loadQuranData();
                if (targetId === 'view-azkar') this.loadAzkarData();
            });
        });
    }

    // --- QURAN LOGIC ---
    async loadQuranData() {
        const container = document.getElementById('quran-list');
        if (container.dataset.loaded) return;
        container.innerHTML = 'Loading Surahs...';

        const surahs = await this.api.getSurahs();
        if (surahs.length > 0) {
            container.classList.add('grid-list');
            container.innerHTML = surahs.map(s => `
        <div class="grid-card" style="cursor:pointer;" onclick="window.app.readSurah(${s.number}, '${s.name.replace(/'/g, "\\'")}')">
          <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.4rem;">${s.number}</div>
          <div class="row-time" style="font-family: var(--font-arabic); font-size: 1.4rem; margin-bottom: 0.25rem; color: var(--accent-color);">${s.name}</div>
          <div style="font-size: 1rem; font-weight: 700; color: var(--text-primary);">${s.englishName}</div>
        </div>
      `).join('');
            container.dataset.loaded = 'true';
        } else {
            container.innerHTML = 'Failed to load Quran data.';
        }
    }

    toArabicNumerals(num) {
        const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        return String(num).split('').map(char => arabicNumbers[char] || char).join('');
    }

    async readSurah(id, name) {
        const list = document.getElementById('quran-list');
        const reader = document.getElementById('quran-reader');
        list.classList.add('hidden');
        reader.classList.remove('hidden');
        document.body.classList.add('reading-quran');
        document.getElementById('app-content').classList.add('quran-reader-active');

        reader.innerHTML = `<h3 style="text-align:center;">Loading Text...</h3>`;

        // Fetch reciters if not already fetched
        if (this.reciters.length === 0) {
            this.reciters = await this.api.getReciters();
        }

        // Default to Alafasy (or the first if not found)
        const defaultReciter = this.reciters.find(r => r.identifier === 'ar.alafasy') || this.reciters[0];

        const surah = await this.api.getSurah(id, defaultReciter.identifier);
        if (surah) {
            this.currentSurahAudioList = surah.ayahs.map(a => a.audio);
            this.currentAyahIndex = 0;

            const bismillah = (id === 1 || id === 9) ? '' : 'بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

            // RTL means Next Surah (Id+1) goes to the Left side arrow, Previous (Id-1) goes to Right side arrow historically in mus'hafs
            const prevBtn = id > 1 ? `<button class="floating-nav-btn right-btn" onclick="window.app.readSurah(${id - 1}, '')" title="Previous Surah"><span class="material-symbols-rounded">chevron_right</span></button>` : '';
            const nextBtn = id < 114 ? `<button class="floating-nav-btn left-btn" onclick="window.app.readSurah(${id + 1}, '')" title="Next Surah"><span class="material-symbols-rounded">chevron_left</span></button>` : '';

            // Bookmark logic
            const savedBookmark = JSON.parse(localStorage.getItem('noor_quran_bookmark') || 'null');
            const hasBookmarkHere = savedBookmark && savedBookmark.surahId === id;

            let jumpToBookmarkBtn = '';
            if (hasBookmarkHere) {
                jumpToBookmarkBtn = `<button class="theme-btn" onclick="window.app.playAyah(${savedBookmark.ayahIndex}, true)" style="display: flex; align-items: center; gap: 0.5rem; background: var(--card-bg); color: var(--accent-color); font-size: 0.8rem; padding: 0.5rem 1rem;">
                <span class="material-symbols-rounded" style="font-size: 1.2rem;">bookmark</span> Go to Saved Ayah
             </button>`;
            }

            reader.innerHTML = `
        ${prevBtn}
        ${nextBtn}
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem; position: sticky; top:0; background: var(--bg-color); padding: 1rem 0; z-index: 10;">
            <!-- Left side controls (Play and Reciter) -->
            <div style="display:flex; align-items:center; gap: 0.5rem; flex-wrap: nowrap;">
                <button class="theme-btn" id="play-quran-btn" onclick="window.app.toggleQuranAudio()" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem;">
                   <span class="material-symbols-rounded">play_circle</span> <span class="hide-mobile-text">Play</span>
                </button>
                <select id="reciter-select" class="custom-select" style="max-width: 120px; text-overflow: ellipsis; padding: 0.5rem;" onchange="window.app.changeReciter(${id}, this.value)">
                    ${this.reciters.map(r => `<option value="${r.identifier}" ${r.identifier === defaultReciter.identifier ? 'selected' : ''}>${r.englishName}</option>`).join('')}
                </select>
            </div>

            <!-- Right Side controls (Bookmark, Jump, and Back) -->
            <div style="display:flex; align-items:center; gap: 1rem;">
                ${jumpToBookmarkBtn}
                <button id="bookmark-btn" class="icon-btn" onclick="window.app.saveBookmark(${id})" title="Bookmark current Ayah" style="color: var(--text-secondary);">
                   <span class="material-symbols-rounded">bookmark_add</span>
                </button>
                <div style="width: 1px; height: 24px; background: var(--border-color); opacity: 0.5;"></div>
                <button class="theme-btn" onclick="window.app.closeSurahReader()" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem;">
                   <span class="material-symbols-rounded">arrow_back</span> <span class="hide-mobile-text">Back</span>
                </button>
            </div>
        </div>
        
        <h3 style="text-align:center; font-family: var(--font-arabic); font-size: 3rem; color: var(--accent-color); margin-bottom: 1rem;">${surah.name}</h3>
        ${bismillah ? `<p style="text-align:center; font-family: var(--font-arabic); font-size: 2rem; margin-bottom: 2rem;">${bismillah}</p>` : ''}
        <div style="font-family: var(--font-arabic); font-size: 1.8rem; line-height: 2.5; text-align: justify; direction: rtl;" id="quran-text-container">
          ${surah.ayahs.map((a, idx) => `<span id="ayah-${idx}" style="transition: color 0.3s; cursor: pointer;" onclick="window.app.playAyah(${idx}, !window.app.quranAudio.paused)">${a.text.replace('بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ', '')} <span style="color:var(--accent-color); margin: 0 5px;">﴿${this.toArabicNumerals(a.numberInSurah)}﴾</span></span>`).join(' ')}
        </div>
      `;

            this.quranAudio.onended = () => {
                const prevAyah = document.getElementById(`ayah-${this.currentAyahIndex}`);
                if (prevAyah) prevAyah.style.color = '';

                this.currentAyahIndex++;
                if (this.currentAyahIndex < this.currentSurahAudioList.length) {
                    this.playAyah(this.currentAyahIndex);
                } else {
                    document.getElementById('play-quran-btn').innerHTML = '<span class="material-symbols-rounded" style="vertical-align: middle;">play_circle</span> <span class="hide-mobile-text">Play</span>';
                }
            };
        }
    }

    async changeReciter(surahId, editionId) {
        document.getElementById('quran-text-container').style.opacity = '0.5';
        const surah = await this.api.getSurah(surahId, editionId);
        if (surah) {
            this.currentSurahAudioList = surah.ayahs.map(a => a.audio);
            // If it was playing, stop and restart from current index
            if (!this.quranAudio.paused) {
                this.playAyah(this.currentAyahIndex);
            }
        }
        document.getElementById('quran-text-container').style.opacity = '1';
    }

    toggleQuranAudio() {
        const btn = document.getElementById('play-quran-btn');
        if (this.quranAudio.paused) {
            this.playAyah(this.currentAyahIndex);
            btn.innerHTML = '<span class="material-symbols-rounded" style="vertical-align: middle;">pause_circle</span> <span class="hide-mobile-text">Pause</span>';
        } else {
            this.quranAudio.pause();
            btn.innerHTML = '<span class="material-symbols-rounded" style="vertical-align: middle;">play_circle</span> <span class="hide-mobile-text">Play</span>';
        }
    }

    playAyah(index, autoPlay = true) {
        if (!this.currentSurahAudioList[index]) return;

        // Remove active class from all
        for (let i = 0; i < this.currentSurahAudioList.length; i++) {
            const el = document.getElementById(`ayah-${i}`);
            if (el) el.style.color = '';
        }

        this.currentAyahIndex = index;
        const currentAyahEl = document.getElementById(`ayah-${index}`);
        if (currentAyahEl) {
            currentAyahEl.style.color = 'var(--accent-color)';
            currentAyahEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Only play audio if requested (jumping to bookmark shouldn't auto-play by default)
        if (autoPlay) {
            this.quranAudio.src = this.currentSurahAudioList[index];
            this.quranAudio.play().catch(e => console.warn("Autoplay blocked or network issues", e));
            document.getElementById('play-quran-btn').innerHTML = '<span class="material-symbols-rounded" style="vertical-align: middle;">pause_circle</span> <span class="hide-mobile-text">Pause</span>';
        }
    }

    saveBookmark(surahId) {
        if (this.currentAyahIndex >= 0) {
            const bookmarkData = {
                surahId: surahId,
                ayahIndex: this.currentAyahIndex
            };
            localStorage.setItem('noor_quran_bookmark', JSON.stringify(bookmarkData));

            // Visual feedback
            const bookmarkBtn = document.getElementById('bookmark-btn');
            if (bookmarkBtn) {
                bookmarkBtn.style.color = 'var(--accent-color)';
                bookmarkBtn.innerHTML = '<span class="material-symbols-rounded">bookmark_added</span>';
                setTimeout(() => {
                    bookmarkBtn.style.color = 'var(--text-secondary)';
                    bookmarkBtn.innerHTML = '<span class="material-symbols-rounded">bookmark_add</span>';
                }, 2000);
            }
        }
    }

    closeSurahReader() {
        this.quranAudio.pause();
        this.quranAudio.src = '';
        document.getElementById('quran-reader').classList.add('hidden');
        document.getElementById('quran-list').classList.remove('hidden');
        document.body.classList.remove('reading-quran');
        document.getElementById('app-content').classList.remove('quran-reader-active');
    }

    // --- AZKAR LOGIC ---
    async loadAzkarData() {
        const container = document.getElementById('azkar-categories');
        if (container.dataset.loaded) return;
        container.innerHTML = 'Loading Azkar...';

        const azkar = await this.api.getAzkar();
        if (azkar) {
            const categories = Object.keys(azkar);
            container.classList.add('grid-list');
            container.innerHTML = categories.map(cat => `
         <div class="grid-card" style="cursor:pointer;" onclick="window.app.readAzkar('${cat.replace(/'/g, "\\'")}')">
            <span class="row-name" style="font-family: var(--font-arabic); font-size: 1.4rem; color: var(--text-primary);">${cat}</span>
         </div>
       `).join('');
            container.dataset.loaded = 'true';
            this.azkarData = azkar;

            // Wait to load Azkar data before selecting a random doaa
            this.setRandomDoaa();
        } else {
            container.innerHTML = 'Failed to load Azkar.';
        }
    }

    cleanAzkarText(text) {
        if (!text) return '';

        // If it's an actual array, join non-empty meaningful items
        if (Array.isArray(text)) {
            return text
                .map(t => String(t).replace(/\\n/g, ' ').replace(/\n/g, ' ').trim())
                .filter(t => t.length > 2 && /[\u0600-\u06FF]/.test(t)) // keep only Arabic-containing parts
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
        }

        let str = String(text);

        // Strip outer brackets if array-dumped: ['text', ...]
        if (str.startsWith('[') && str.endsWith(']')) {
            str = str.slice(1, -1);
        }

        // Remove escaped newlines
        str = str.replace(/\\n/g, ' ').replace(/\n/g, ' ');

        // Remove stray quotes, commas at start/end of segments, and leftover brackets
        str = str
            .replace(/['"]/g, '')      // remove all single & double quotes
            .replace(/,\s*/g, ' ')     // replace commas with space
            .replace(/\[\]/g, '')      // remove empty brackets
            .replace(/\s+/g, ' ')      // collapse spaces
            .trim();

        // Final safety: if result has no Arabic chars, return empty
        if (!/[\u0600-\u06FF]/.test(str)) return '';

        return str;
    }


    setRandomDoaa() {
        if (!this.azkarData) return;

        // Pick ad3ya or any generic category like "أدعية قرآنية"
        const categories = Object.keys(this.azkarData);
        // Prioritize Quranic doaas or comprehensive doaas if available for snippet
        let targetCategory = categories.find(c => c.includes('أدعية قرآنية')) || categories.find(c => c.includes('أدعية'));
        if (!targetCategory) targetCategory = categories[0];

        const list = this.azkarData[targetCategory];
        if (list && list.length > 0) {
            const randomZekr = list[Math.floor(Math.random() * list.length)];
            const text = this.cleanAzkarText(randomZekr.content || randomZekr.text || randomZekr.zekr);
            document.getElementById('doaa-snippet').innerText = text;
        }
    }

    readAzkar(category) {
        const list = document.getElementById('azkar-categories');
        const reader = document.getElementById('azkar-reader');
        list.classList.add('hidden');
        reader.classList.remove('hidden');

        const isArabic = localStorage.getItem('noor_lang') === 'ar';
        const items = this.azkarData[category];

        // Build each Zekr card with an interactive count badge
        const cardsHtml = items.map((item, idx) => {
            const text = this.cleanAzkarText(item.content || item.text || item.zekr);
            const count = parseInt(item.count) || 1;
            return `
            <div class="zekr-card" id="zekr-card-${idx}"
                 style="background: var(--card-bg); padding: 1.5rem; border-radius: var(--border-radius);
                        border: 1px solid var(--card-border); cursor: pointer; user-select: none;
                        transition: transform 0.1s ease, box-shadow 0.1s ease; position: relative; overflow: hidden;"
                 onclick="window.app.tapZekr(${idx}, event)"
                 data-count="${count}"
                 data-max="${count}">
                <p style="font-family: var(--font-arabic); font-size: 1.3rem; line-height: 1.8;
                           text-align: center; direction: rtl; pointer-events: none;">${text}</p>
                <div style="margin-top: 1.2rem; display: flex; justify-content: center; align-items: center; gap: 1rem; pointer-events: none;">
                    <div class="zekr-count-badge" id="zekr-badge-${idx}"
                         style="background: var(--accent-color); color: #000; font-weight: 700;
                                font-size: 1.4rem; width: 3rem; height: 3rem; border-radius: 50%;
                                display: flex; align-items: center; justify-content: center;
                                transition: transform 0.15s ease;">
                        ${count}
                    </div>
                    <span style="color: var(--text-secondary); font-size: 0.85rem;">
                        ${isArabic ? 'اضغط للعد' : 'Tap to count'}
                    </span>
                </div>
                <div class="zekr-progress-bar"
                     style="position: absolute; bottom: 0; left: 0; height: 3px;
                            background: var(--accent-color); width: 100%;
                            transform-origin: left; transition: transform 0.2s ease;"
                     id="zekr-bar-${idx}">
                </div>
            </div>`;
        }).join('');

        reader.innerHTML = `
            <button class="theme-btn" style="margin-bottom: 1rem;" onclick="window.app.closeAzkarReader()">
                <span class="material-symbols-rounded" style="vertical-align: middle;">arrow_back</span>
                <span class="hide-mobile-text">${isArabic ? 'رجوع' : 'Back'}</span>
            </button>
            <h3 style="text-align:center; font-family: var(--font-arabic); font-size: 1.8rem;
                       color: var(--accent-color); margin-bottom: 1rem;">${category}</h3>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                ${cardsHtml}
            </div>

            <!-- Zekr Complete Popup -->
            <div id="zekr-popup" class="hidden"
                 style="position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
                        z-index: 9999; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);">
                <div style="background: var(--card-bg); border: 1px solid var(--accent-color);
                            border-radius: 1.5rem; padding: 2.5rem 3rem; text-align: center;
                            animation: floatReveal 3s ease forwards; box-shadow: 0 0 40px rgba(212,175,55,0.3);">
                    <div style="font-size: 3rem; margin-bottom: 0.75rem;">✨</div>
                    <div id="zekr-popup-ar"
                         style="font-family: var(--font-arabic); font-size: 2rem;
                                color: var(--accent-color); font-weight: 700; direction: rtl;">
                        أحسنت! 🤲
                    </div>
                    <div id="zekr-popup-en"
                         style="font-size: 1rem; color: var(--text-secondary); margin-top: 0.5rem;">
                        Well done! Keep it up.
                    </div>
                </div>
            </div>
        `;
    }

    tapZekr(idx, event) {
        const card = document.getElementById(`zekr-card-${idx}`);
        const badge = document.getElementById(`zekr-badge-${idx}`);
        const bar = document.getElementById(`zekr-bar-${idx}`);
        if (!card || !badge) return;

        let count = parseInt(card.dataset.count);
        const max = parseInt(card.dataset.max);
        if (count <= 0) return;

        count--;
        card.dataset.count = count;

        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(40);

        // Badge bounce animation
        badge.innerText = count;
        badge.style.transform = 'scale(1.4)';
        setTimeout(() => { badge.style.transform = 'scale(1)'; }, 150);

        // Card press animation
        card.style.transform = 'scale(0.97)';
        setTimeout(() => { card.style.transform = 'scale(1)'; }, 100);

        // Progress bar shrinks as count decreases
        const pct = max > 0 ? count / max : 0;
        bar.style.transform = `scaleX(${pct})`;

        // Ripple
        const ripple = document.createElement('span');
        const rect = card.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        ripple.style.cssText = `
            position: absolute; border-radius: 50%; transform: scale(0);
            animation: zekrRipple 0.5s linear; pointer-events: none;
            background: rgba(212,175,55,0.35);
            width: ${size}px; height: ${size}px;
            left: ${event.clientX - rect.left - size / 2}px;
            top:  ${event.clientY - rect.top - size / 2}px;
        `;
        card.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);

        // When this card reaches zero — mark it and check if ALL are done
        if (count === 0) {
            badge.style.background = 'var(--text-secondary)';
            card.style.borderColor = 'var(--success-color, #10b981)';
            // Check if every card on the page is now at 0
            const allCards = document.querySelectorAll('.zekr-card');
            const allDone = Array.from(allCards).every(c => parseInt(c.dataset.count) === 0);
            if (allDone) {
                this.showZekrComplete();
            }
        }
    }

    showZekrComplete() {
        const popup = document.getElementById('zekr-popup');
        if (!popup) return;
        popup.classList.remove('hidden');
        setTimeout(() => {
            popup.classList.add('hidden');
            this.closeAzkarReader();
        }, 3000);
    }

    closeAzkarReader() {
        document.getElementById('azkar-reader').classList.add('hidden');
        document.getElementById('azkar-categories').classList.remove('hidden');
    }

    handleCelebration(prayerName) {
        const isMaghrib = prayerName === 'Maghrib';
        const madfaaEnabled = this.settings.config.theme === 'theme-ramadan' && this.settings.config.madfaa;

        if (isMaghrib && madfaaEnabled) {
            this.triggerMadfaaSequence();
        } else if (this.settings.config.celebration) {
            this.particles.triggerCelebration();
        }

        if (this.settings.config.sound) {
            this.adhanAudio.src = this.api.adhanUrl;
            this.adhanAudio.volume = 0.8;
            this.adhanAudio.play().catch(e => console.warn("Browser prevented Adhan autoplay: ", e));
        }

        // Wait 5 seconds, then refresh logic for next prayer
        setTimeout(() => {
            this.loadData();
        }, 5000);
    }

    triggerMadfaaSequence() {
        const overlay = document.getElementById('madfaa-overlay');
        const flash = overlay.querySelector('.madfaa-flash');
        const text = overlay.querySelector('.madfaa-text');

        // Reset any previous animation state so it can replay cleanly
        flash.classList.remove('fire');
        text.classList.remove('reveal');
        overlay.classList.remove('active');

        // 1. Make overlay visible (remove hidden so display:flex kicks in)
        overlay.classList.remove('hidden');

        // 2. Double rAF: first frame renders display:flex, second starts the transition
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                overlay.classList.add('active');

                // 3. 800ms pause then fire flash + text
                setTimeout(() => {
                    flash.classList.add('fire');
                    text.classList.add('reveal');

                    // 4. Clean up after animation (≈4.5s)
                    setTimeout(() => {
                        overlay.classList.remove('active');
                        setTimeout(() => {
                            overlay.classList.add('hidden');
                            flash.classList.remove('fire');
                            text.classList.remove('reveal');
                        }, 300);
                    }, 4500);
                }, 800);
            });
        });
    }

    hideSplash() {
        const splash = document.getElementById('splash-screen');
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.classList.add('hidden');
            document.getElementById('app-content').classList.remove('hidden');
        }, 500);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new NoorApp();
    window.app.init();
});
