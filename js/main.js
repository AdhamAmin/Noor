// main.js - Master Application Controller for Noor

class NoorApp {
  constructor() {
    this.api = window.NoorAPI;
    this.settings = window.NoorSettings;
    this.engine = window.NoorEngine;
    this.particles = window.NoorParticles;
    this.quranData = window.QURAN_DATA;

    // Target prayers in order
    this.targetPrayers = [
      { key: 'Fajr', nameAr: 'الفجر', nameEn: 'Fajr', icon: 'wb_twilight' },
      { key: 'Sunrise', nameAr: 'الشروق', nameEn: 'Sunrise', icon: 'wb_sunny' },
      { key: 'Dhuhr', nameAr: 'الظهر', nameEn: 'Dhuhr', icon: 'light_mode' },
      { key: 'Asr', nameAr: 'العصر', nameEn: 'Asr', icon: 'wb_shade' },
      { key: 'Maghrib', nameAr: 'المغرب', nameEn: 'Maghrib', icon: 'nights_stay' },
      { key: 'Isha', nameAr: 'العشاء', nameEn: 'Isha', icon: 'bedtime' }
    ];

    // Current location state (Cairo fallback)
    this.loc = {
      lat: 30.0444,
      lng: 31.2357,
      nameAr: 'القاهرة',
      nameEn: 'Cairo',
      countryAr: 'مصر',
      countryEn: 'Egypt'
    };

    // App state
    this.timings = [];
    this.currentDate = null;
    this.currentPrayerIndex = -1;
    this.isRamadanMonth = false;

    // Quran Reader & Audio State
    this.currentSurah = null;
    this.currentAyahIndex = 0;
    this.selectedAyahIndex = null;
    this.isReaderAudioDockOpen = false;
    this.toastTimeout = null;
    this.currentReciter = 'ar.alafasy';
    this.audioSpeed = 1.0;
    this.audioPlayer = new Audio();
    this.adhanPlayer = new Audio();
    this.audioProgressInterval = null;

    // Masbaha Audio Synthesizer
    this.audioCtx = null;

    // Tasbeeh State
    this.tasbeehState = {
      count: 0,
      target: 33,
      presetId: 1,
      lifetime: parseInt(localStorage.getItem('noor_tasbeeh_lifetime') || '0', 10)
    };

    // Khatma / Wird State
    this.wirdState = {
      pagesToday: 4,
      dailyGoal: 4,
      streak: 5,
      lastReadDate: new Date().toDateString(),
      lastSurah: 2,
      lastAyah: 1
    };

    // Bookmarks
    this.bookmarks = JSON.parse(localStorage.getItem('noor_bookmarks') || '[]');
  }

  async init() {
    this.initAudioContext();
    this.loadSavedWirdState();
    this.bindNavigation();
    this.bindHomeEvents();
    this.bindQuranHubEvents();
    this.bindReaderEvents();
    this.bindTasbeehEvents();
    this.bindAzkarEvents();
    this.bindLocationEvents();
    this.bindGlobalEvents();

    // Render Quran tabs immediately from static dataset
    this.renderQuranSurahs();
    this.renderQuranJuz();
    this.renderQuranAhzab();
    this.renderQuranPages();
    this.renderBookmarks();
    this.initTasbeeh();

    // Load location and live prayer data
    try {
      await this.initLocation();
    } catch (e) {
      console.warn("Using fallback location:", e);
    }

    await this.loadPrayerData();
    this.hideSplash();
  }

  // --- AUDIO SYNTHESIZER (MASBAHA CLICKS) ---
  initAudioContext() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      this.audioCtx = new AudioContext();
    }
  }

  playMasbahaClick() {
    if (!this.settings.config.tasbeehSound) return;
    try {
      if (!this.audioCtx) this.initAudioContext();
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(620, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, this.audioCtx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.04);
    } catch (e) {}
  }

  // --- NAVIGATION CONTROLLER ---
  bindNavigation() {
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const targetViewId = item.getAttribute('data-target');
        this.switchToTab(targetViewId);
      });
    });
  }

  switchToTab(viewId) {
    // Nav items active state
    document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-target') === viewId);
    });

    // Views switching
    document.querySelectorAll('.view').forEach(view => {
      view.classList.remove('active');
    });

    const activeView = document.getElementById(viewId);
    if (activeView) {
      activeView.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'instant' });
    }

    if (viewId === 'view-azkar') this.loadAzkarCategories();
    if (viewId === 'view-qibla') this.initQiblaCompass();
  }

  // --- LOCATION & PRAYER DATA ---
  async initLocation() {
    const savedLoc = localStorage.getItem('noor_user_location');
    if (savedLoc) {
      try {
        this.loc = { ...this.loc, ...JSON.parse(savedLoc) };
        this.updateLocationUI();
        return;
      } catch (e) {}
    }

    if (navigator.geolocation) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            this.loc.lat = pos.coords.latitude;
            this.loc.lng = pos.coords.longitude;
            try {
              const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${this.loc.lat}&longitude=${this.loc.lng}&localityLanguage=ar`);
              const data = await res.json();
              if (data && data.city) {
                this.loc.nameAr = data.city || data.locality;
                this.loc.nameEn = data.city || data.locality;
                this.loc.countryAr = data.countryName || '';
                this.loc.countryEn = data.countryName || '';
              }
            } catch (err) {}
            this.saveLocation();
            resolve();
          },
          () => resolve(),
          { timeout: 4000 }
        );
      });
    }
  }

  saveLocation() {
    localStorage.setItem('noor_user_location', JSON.stringify(this.loc));
    this.updateLocationUI();
  }

  updateLocationUI() {
    const isAr = this.isArabic();
    const cityLabel = document.getElementById('current-city-label');
    if (cityLabel) cityLabel.innerText = isAr ? this.loc.nameAr : this.loc.nameEn;
  }

  async loadPrayerData() {
    const data = await this.api.getTimingsByCoordinates(
      this.loc.lat,
      this.loc.lng,
      this.settings.config.method,
      this.settings.config.madhab
    );

    if (!data) return;

    this.isRamadanMonth = this.api.isRamadan(data);
    if (this.isRamadanMonth && this.settings.config.theme === 'theme-ramadan') {
      if (this.particles && typeof this.particles.startRamadanBackground === 'function') {
        this.particles.startRamadanBackground();
      }
    }

    this.currentDate = data.date;
    this.parsePrayerTimings(data.timings);
    this.renderPrayerTimeline();
    this.calculateNextPrayer();
    this.updateDatesDisplay();
  }

  parsePrayerTimings(rawTimings) {
    this.timings = [];
    const now = new Date();

    this.targetPrayers.forEach(prayerDef => {
      const raw = rawTimings[prayerDef.key];
      if (raw) {
        const timePart = raw.includes('T') ? raw.split('T')[1].substring(0, 5) : raw.substring(0, 5);
        const [hours, minutes] = timePart.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
          const prayerDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
          this.timings.push({
            ...prayerDef,
            date: prayerDate,
            time24: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
            timeFormatted: this.formatTimeAMPM(hours, minutes)
          });
        }
      }
    });

    this.timings.sort((a, b) => a.date - b.date);
  }

  formatTimeAMPM(hours, minutes) {
    const isAr = this.isArabic();
    const ampm = hours >= 12 ? (isAr ? 'م' : 'PM') : (isAr ? 'ص' : 'AM');
    const h = hours % 12 || 12;
    const m = String(minutes).padStart(2, '0');
    return `${isAr ? this.toArabicNumerals(h) : h}:${isAr ? this.toArabicNumerals(m) : m} ${ampm}`;
  }

  renderPrayerTimeline() {
    const container = document.getElementById('prayer-timeline-container');
    if (!container || !this.timings) return;

    const isAr = this.isArabic();
    container.innerHTML = this.timings.map((prayer, idx) => {
      return `
        <div class="prayer-tile" id="prayer-tile-${idx}">
          <span class="material-symbols-rounded tile-icon">${prayer.icon}</span>
          <span class="tile-name">${isAr ? prayer.nameAr : prayer.nameEn}</span>
          <span class="tile-time">${prayer.timeFormatted}</span>
        </div>
      `;
    }).join('');
  }

  calculateNextPrayer() {
    const now = new Date();
    let nextIndex = -1;
    let prevDate = null;

    // Filter main prayers for next countdown (Fajr, Dhuhr, Asr, Maghrib, Isha)
    for (let i = 0; i < this.timings.length; i++) {
      if (this.timings[i].date > now) {
        nextIndex = i;
        prevDate = i > 0 ? this.timings[i - 1].date : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        break;
      }
    }

    let isTomorrow = false;
    if (nextIndex === -1 && this.timings.length > 0) {
      nextIndex = 0;
      isTomorrow = true;
      const tomorrowFajr = new Date(this.timings[0].date);
      tomorrowFajr.setDate(tomorrowFajr.getDate() + 1);
      this.timings[0].date = tomorrowFajr;
      prevDate = this.timings[this.timings.length - 1].date;
    }

    this.currentPrayerIndex = nextIndex;
    const nextPrayer = this.timings[nextIndex];
    if (!nextPrayer) return;

    const isAr = this.isArabic();
    const nextNameEl = document.getElementById('next-prayer-name');
    const nextTimeEl = document.getElementById('next-prayer-time');
    const statusTextEl = document.getElementById('prayer-status-text');

    if (nextNameEl) nextNameEl.innerText = isAr ? `صلاة ${nextPrayer.nameAr}` : `${nextPrayer.nameEn} Prayer`;
    if (nextTimeEl) nextTimeEl.innerText = nextPrayer.timeFormatted;
    if (statusTextEl) statusTextEl.innerText = isTomorrow ? (isAr ? 'صلاة الغد' : 'Tomorrow Prayer') : (isAr ? 'الصلاة القادمة' : 'Next Prayer');

    // Update Tiles Active State
    this.timings.forEach((t, i) => {
      const tile = document.getElementById(`prayer-tile-${i}`);
      if (!tile) return;
      tile.classList.remove('active', 'completed');
      if (isTomorrow) {
        tile.classList.add('completed');
      } else {
        if (i < nextIndex) tile.classList.add('completed');
        if (i === nextIndex) tile.classList.add('active');
      }
    });

    // Start Countdown Engine
    let durationMs = 3600 * 1000 * 3.5;
    if (prevDate && prevDate < nextPrayer.date) {
      durationMs = nextPrayer.date.getTime() - prevDate.getTime();
    }
    const durationSec = Math.max(60, Math.floor(durationMs / 1000));

    this.engine.start(nextPrayer.date, durationSec, () => {
      this.onPrayerTimeReached(nextPrayer);
    });
  }

  onPrayerTimeReached(prayer) {
    if (this.settings.config.sound) {
      this.adhanPlayer.src = this.api.adhanUrl;
      this.adhanPlayer.play().catch(e => console.warn("Adhan autoplay prevented:", e));
    }

    if (this.settings.config.celebration && this.particles) {
      this.particles.triggerCelebration();
    }

    if (prayer.key === 'Maghrib' && this.settings.config.madfaa && this.settings.config.theme === 'theme-ramadan') {
      const overlay = document.getElementById('madfaa-overlay');
      if (overlay) {
        overlay.classList.remove('hidden');
        const text = overlay.querySelector('.madfaa-text');
        if (text) text.classList.add('reveal');
        setTimeout(() => {
          overlay.classList.add('hidden');
          if (text) text.classList.remove('reveal');
        }, 4000);
      }
    }

    setTimeout(() => {
      this.loadPrayerData();
    }, 6000);
  }

  updateDatesDisplay() {
    const isAr = this.isArabic();
    const hijriLabel = document.getElementById('hijri-date-label');
    const gregLabel = document.getElementById('gregorian-date-label');

    // 1. Hijri Date
    if (hijriLabel && this.currentDate && this.currentDate.hijri) {
      const hijri = this.currentDate.hijri;
      const hDay = isAr ? this.toArabicNumerals(hijri.day) : hijri.day;
      const hYear = isAr ? this.toArabicNumerals(hijri.year) : hijri.year;
      const mName = isAr ? (hijri.month?.ar || hijri.month?.en) : (hijri.month?.en || hijri.month?.ar);
      hijriLabel.innerText = `${hDay} ${mName} ${hYear} هـ`;
    }

    // 2. Gregorian Date (Native Intl / Arabic arrays - zero undefined)
    if (gregLabel) {
      const now = new Date();
      if (isAr) {
        const arabicWeekdays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const arabicMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
        const dayName = arabicWeekdays[now.getDay()];
        const monthName = arabicMonths[now.getMonth()];
        gregLabel.innerText = `${dayName}، ${this.toArabicNumerals(now.getDate())} ${monthName} ${this.toArabicNumerals(now.getFullYear())} م`;
      } else {
        const enWeekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const enMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        gregLabel.innerText = `${enWeekdays[now.getDay()]}, ${now.getDate()} ${enMonths[now.getMonth()]} ${now.getFullYear()}`;
      }
    }
  }

  // --- HOME EVENTS & WIRD TRACKER ---
  bindHomeEvents() {
    // Wird Tracker +1 Button
    const addPageBtn = document.getElementById('wird-add-page-btn');
    if (addPageBtn) {
      addPageBtn.addEventListener('click', () => {
        this.wirdState.pagesToday++;
        this.updateWirdUI();
        this.saveWirdState();
        if (this.particles) this.particles.triggerCelebration();
      });
    }

    // Daily Ayah Copy & Listen
    const copyAyahBtn = document.getElementById('copy-daily-ayah-btn');
    if (copyAyahBtn) {
      copyAyahBtn.addEventListener('click', () => {
        const text = document.getElementById('daily-ayah-text').innerText;
        navigator.clipboard.writeText(text);
        copyAyahBtn.innerText = this.isArabic() ? 'تم النسخ!' : 'Copied!';
        setTimeout(() => {
          copyAyahBtn.innerHTML = `<span class="material-symbols-rounded" style="font-size: 1rem;">content_copy</span><span>${this.isArabic() ? 'نسخ' : 'Copy'}</span>`;
        }, 1500);
      });
    }

    const copyDoaaBtn = document.getElementById('copy-daily-doaa-btn');
    if (copyDoaaBtn) {
      copyDoaaBtn.addEventListener('click', () => {
        const text = document.getElementById('doaa-snippet-text').innerText;
        navigator.clipboard.writeText(text);
        copyDoaaBtn.innerText = this.isArabic() ? 'تم النسخ!' : 'Copied!';
        setTimeout(() => {
          copyDoaaBtn.innerHTML = `<span class="material-symbols-rounded" style="font-size: 1rem;">share</span><span>${this.isArabic() ? 'مشاركة الدعاء' : 'Share'}</span>`;
        }, 1500);
      });
    }

    const listenAyahBtn = document.getElementById('listen-daily-ayah-btn');
    if (listenAyahBtn) {
      listenAyahBtn.addEventListener('click', () => {
        // Read Surah Ar-Ra'd ayah 28
        this.openSurahReader(13, 28);
      });
    }
  }

  loadSavedWirdState() {
    const saved = localStorage.getItem('noor_wird_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const today = new Date().toDateString();
        if (parsed.lastReadDate !== today) {
          // New day
          parsed.pagesToday = 0;
          parsed.lastReadDate = today;
          parsed.streak = (parsed.streak || 0) + 1;
        }
        this.wirdState = { ...this.wirdState, ...parsed };
      } catch (e) {}
    }
    this.updateWirdUI();
  }

  saveWirdState() {
    localStorage.setItem('noor_wird_data', JSON.stringify(this.wirdState));
  }

  updateWirdUI() {
    const isAr = this.isArabic();
    const pagesEl = document.getElementById('wird-pages-read');
    const goalEl = document.getElementById('wird-goal-target');
    const barEl = document.getElementById('wird-progress-bar');
    const streakEl = document.getElementById('wird-streak-label');
    const khatmahEl = document.getElementById('khatmah-percent-label');

    const pages = this.wirdState.pagesToday;
    const goal = this.wirdState.dailyGoal;
    const streak = this.wirdState.streak;

    if (pagesEl) pagesEl.innerText = isAr ? this.toArabicNumerals(pages) : pages;
    if (goalEl) goalEl.innerText = isAr ? ` / ${this.toArabicNumerals(goal)} صفحات اليوم` : ` / ${goal} pages today`;
    if (streakEl) streakEl.innerText = isAr ? `🔥 ${this.toArabicNumerals(streak)} أيام متتالية` : `🔥 ${streak} Days Streak`;

    const pct = Math.min(100, Math.round((pages / Math.max(1, goal)) * 100));
    if (barEl) barEl.style.width = `${pct}%`;

    // Khatma completion estimation (total 604 pages)
    const totalReadEst = Math.min(604, streak * goal + pages);
    const khatmaPct = ((totalReadEst / 604) * 100).toFixed(1);
    if (khatmahEl) khatmahEl.innerText = isAr ? `${this.toArabicNumerals(khatmaPct)}٪ من الختمة` : `${khatmaPct}% of Quran`;
  }

  // --- QURAN HUB: SURAHS, JUZ, HIZB, PAGES, BOOKMARKS ---
  bindQuranHubEvents() {
    // Tabs Navigation Pills
    const tabPills = document.querySelectorAll('.quran-tab-pill');
    tabPills.forEach(pill => {
      pill.addEventListener('click', () => {
        tabPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        const targetTab = pill.getAttribute('data-quran-tab');
        document.querySelectorAll('.quran-tab-content').forEach(c => c.classList.add('hidden'));

        const activeContent = document.getElementById(`quran-tab-${targetTab}`);
        if (activeContent) activeContent.classList.remove('hidden');
      });
    });

    // Search Input
    const searchInput = document.getElementById('quran-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterQuranHub(e.target.value.trim().toLowerCase());
      });
    }

    // Filter Chips
    const chips = document.querySelectorAll('#surah-filter-chips .chip-btn');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.filterSurahsByType(chip.getAttribute('data-filter'));
      });
    });

    // Quick Page Jump Button
    const goToPageBtn = document.getElementById('go-to-page-btn');
    const pageInput = document.getElementById('quick-page-input');
    if (goToPageBtn && pageInput) {
      goToPageBtn.addEventListener('click', () => {
        const pageNum = parseInt(pageInput.value, 10);
        if (pageNum >= 1 && pageNum <= 604) {
          this.openQuranByPage(pageNum);
        }
      });
    }
  }

  renderQuranSurahs() {
    const container = document.getElementById('quran-surahs-grid');
    if (!container || !this.quranData.SURAHS) return;

    const isAr = this.isArabic();
    container.innerHTML = this.quranData.SURAHS.map(s => {
      return `
        <div class="surah-card" onclick="window.app.openSurahReader(${s.id})" data-type="${s.type.toLowerCase()}" data-name="${s.name}" data-en="${s.englishName.toLowerCase()}" data-id="${s.id}">
          <div class="surah-card-left">
            <div class="star-badge">
              <span>${isAr ? this.toArabicNumerals(s.id) : s.id}</span>
            </div>
            <div class="surah-names-box">
              <span class="surah-en-name">${s.englishName}</span>
              <span class="surah-en-sub">
                <span>${s.englishNameTranslation}</span>
                <span class="material-symbols-rounded" style="font-size: 14px;">${s.type === 'Meccan' ? 'mosque' : 'apartment'}</span>
              </span>
            </div>
          </div>
          <div class="surah-card-right">
            <span class="surah-ar-name">${s.name}</span>
            <span class="surah-ayah-tag">${isAr ? `${this.toArabicNumerals(s.ayahsCount)} آية` : `${s.ayahsCount} Ayahs`}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  renderQuranJuz() {
    const container = document.getElementById('quran-juz-grid');
    if (!container || !this.quranData.JUZ) return;

    const isAr = this.isArabic();
    container.innerHTML = this.quranData.JUZ.map(j => {
      return `
        <div class="juz-card" onclick="window.app.openSurahReader(${j.surahStart}, ${j.ayahStart})">
          <div class="juz-card-header">
            <span class="juz-num-chip">${isAr ? j.nameAr : j.nameEn}</span>
            <span class="juz-page-range">${isAr ? `صفحة ${j.pageRange}` : `Pages ${j.startPage}`}</span>
          </div>
          <div class="juz-verse-title">${j.title}</div>
          <div class="juz-card-footer">
            <span>${j.surahRange}</span>
            <button class="juz-read-btn">
              <span>${isAr ? 'اقرأ الجزء' : 'Read Juz'}</span>
              <span class="material-symbols-rounded" style="font-size: 1rem; transform: scaleX(-1);">arrow_back</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  renderQuranAhzab() {
    const container = document.getElementById('quran-hizb-grid');
    if (!container || !this.quranData.HIZB) return;

    const isAr = this.isArabic();
    container.innerHTML = this.quranData.HIZB.map(h => {
      return `
        <div class="juz-card" onclick="window.app.openSurahReader(${h.juzId})">
          <div class="juz-card-header">
            <span class="juz-num-chip">${isAr ? h.nameAr : h.nameEn}</span>
            <span class="juz-page-range">${isAr ? `من الجزء ${this.toArabicNumerals(h.juzId)}` : `Juz ${h.juzId}`}</span>
          </div>
          <div style="font-size: 0.95rem; color: var(--text-secondary); margin-top: 0.5rem;">
            ${isAr ? h.half : h.nameEn}
          </div>
        </div>
      `;
    }).join('');
  }

  renderQuranPages() {
    const container = document.getElementById('quran-pages-grid');
    if (!container) return;

    const isAr = this.isArabic();
    // Fast render for famous landmark pages
    const landmarkPages = [
      { page: 1, title: 'سورة الفاتحة', surahId: 1 },
      { page: 2, title: 'بداية سورة البقرة', surahId: 2 },
      { page: 50, title: 'سورة آل عمران', surahId: 3 },
      { page: 293, title: 'سورة الكهف (مستحبة الجمعة)', surahId: 18 },
      { page: 440, title: 'سورة يس (قلب القرآن)', surahId: 36 },
      { page: 531, title: 'سورة الرحمن', surahId: 55 },
      { page: 562, title: 'سورة الملك (المنجية)', surahId: 67 },
      { page: 582, title: 'جزء عم (سورة النبأ)', surahId: 78 },
      { page: 604, title: 'المعوذتان وسورة الناس', surahId: 114 }
    ];

    container.innerHTML = landmarkPages.map(p => {
      return `
        <div class="juz-card" onclick="window.app.openSurahReader(${p.surahId})">
          <div class="juz-card-header">
            <span class="juz-num-chip">${isAr ? `صفحة ${this.toArabicNumerals(p.page)}` : `Page ${p.page}`}</span>
          </div>
          <div style="font-family: var(--font-arabic); font-size: 1.3rem; font-weight: 700; color: var(--text-primary); margin: 0.5rem 0;">
            ${p.title}
          </div>
          <button class="juz-read-btn">
            <span>${isAr ? 'فتح الصفحة' : 'Open Page'}</span>
            <span class="material-symbols-rounded" style="font-size: 1rem; transform: scaleX(-1);">arrow_back</span>
          </button>
        </div>
      `;
    }).join('');
  }

  renderBookmarks() {
    const container = document.getElementById('quran-bookmarks-container');
    if (!container) return;

    const isAr = this.isArabic();
    if (this.bookmarks.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <span class="material-symbols-rounded" style="font-size: 3rem; color: var(--gold-color); margin-bottom: 0.5rem;">bookmark_border</span>
          <p>${isAr ? 'لا توجد فواصل محفوظة بعد. يمكنك حفظ أي آية أثناء القراءة بالضغط على أيقونة الفاصلة.' : 'No saved bookmarks yet. Bookmark any ayah while reading.'}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.bookmarks.map((bm, idx) => {
      return `
        <div class="glass-card" style="margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem;">
          <div style="cursor: pointer;" onclick="window.app.openSurahReader(${bm.surahId}, ${bm.ayahNumber})">
            <h4 style="font-family: var(--font-arabic); font-size: 1.25rem; color: var(--gold-color);">${bm.surahName}</h4>
            <span style="font-size: 0.85rem; color: var(--text-secondary);">${isAr ? `الآية ${this.toArabicNumerals(bm.ayahNumber)}` : `Ayah ${bm.ayahNumber}`} • ${bm.date}</span>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="icon-btn" onclick="window.app.openSurahReader(${bm.surahId}, ${bm.ayahNumber})" title="متابعة">
              <span class="material-symbols-rounded">menu_book</span>
            </button>
            <button class="icon-btn" onclick="window.app.deleteBookmark(${idx})" title="حذف">
              <span class="material-symbols-rounded" style="color: var(--danger-color);">delete</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  deleteBookmark(index) {
    this.bookmarks.splice(index, 1);
    localStorage.setItem('noor_bookmarks', JSON.stringify(this.bookmarks));
    this.renderBookmarks();
  }

  filterQuranHub(query) {
    const cards = document.querySelectorAll('.surah-card');
    cards.forEach(card => {
      const name = card.dataset.name || '';
      const en = card.dataset.en || '';
      const id = card.dataset.id || '';
      const match = name.includes(query) || en.includes(query) || id === query;
      card.style.display = match ? 'flex' : 'none';
    });
  }

  filterSurahsByType(filterType) {
    const cards = document.querySelectorAll('.surah-card');
    cards.forEach(card => {
      if (filterType === 'all') {
        card.style.display = 'flex';
      } else if (filterType === 'popular') {
        const id = parseInt(card.dataset.id, 10);
        card.style.display = this.quranData.QUICK_SURAHS.includes(id) ? 'flex' : 'none';
      } else {
        card.style.display = card.dataset.type === filterType ? 'flex' : 'none';
      }
    });
  }

  openQuranByPage(pageNum) {
    // Find surah that starts nearest to pageNum
    let targetSurah = this.quranData.SURAHS[0];
    for (const s of this.quranData.SURAHS) {
      if (s.page <= pageNum) {
        targetSurah = s;
      } else {
        break;
      }
    }
    this.openSurahReader(targetSurah.id);
  }

  // --- DEDICATED QURAN READER ---
  bindReaderEvents() {
    // Close reader button
    const closeBtn = document.getElementById('close-quran-reader-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.closeQuranReader();
      });
    }

    // Toggle reading mode (Mushaf flow vs Ayah cards)
    const modeBtn = document.getElementById('toggle-reader-mode-btn');
    if (modeBtn) {
      modeBtn.addEventListener('click', () => {
        const newMode = this.settings.config.quranMode === 'mushaf' ? 'ayah' : 'mushaf';
        this.settings.update('quranMode', newMode);
        document.getElementById('reader-mode-label').innerText = newMode === 'mushaf' ? 'المصحف' : 'الآيات';
        this.hideAyahActionBar();
        if (this.currentSurah) {
          this.renderReaderContent(this.currentSurah);
        }
      });
    }

    // Header: Toggle Reader Audio Dock
    const toggleAudioBtn = document.getElementById('toggle-reader-audio-dock-btn');
    if (toggleAudioBtn) {
      toggleAudioBtn.addEventListener('click', () => {
        this.toggleReaderAudioDock();
      });
    }

    // Dock: Collapse Audio Dock button
    const collapseAudioBtn = document.getElementById('collapse-reader-audio-dock-btn');
    if (collapseAudioBtn) {
      collapseAudioBtn.addEventListener('click', () => {
        this.toggleReaderAudioDock(false);
      });
    }

    // Header: Go to Saved Ayah Button
    const goToSavedBtn = document.getElementById('reader-go-to-saved-btn');
    if (goToSavedBtn) {
      goToSavedBtn.addEventListener('click', () => {
        this.goToSavedAyah();
      });
    }

    // Two Small Floating Buttons for Switching Surahs (Forward & Backward)
    const floatPrevBtn = document.getElementById('floating-prev-surah-btn');
    if (floatPrevBtn) {
      floatPrevBtn.addEventListener('click', () => {
        this.navigateToAdjacentSurah(-1);
      });
    }

    const floatNextBtn = document.getElementById('floating-next-surah-btn');
    if (floatNextBtn) {
      floatNextBtn.addEventListener('click', () => {
        this.navigateToAdjacentSurah(1);
      });
    }

    // Floating Ayah Action Bar Buttons
    const saveActionBarBtn = document.getElementById('action-bar-save-btn');
    if (saveActionBarBtn) {
      saveActionBarBtn.addEventListener('click', () => {
        this.saveSelectedAyahBookmark();
      });
    }

    const playActionBarBtn = document.getElementById('action-bar-play-btn');
    if (playActionBarBtn) {
      playActionBarBtn.addEventListener('click', () => {
        if (this.selectedAyahIndex !== null) {
          this.playAyah(this.selectedAyahIndex);
        }
      });
    }

    const tafsirActionBarBtn = document.getElementById('action-bar-tafsir-btn');
    if (tafsirActionBarBtn) {
      tafsirActionBarBtn.addEventListener('click', () => {
        this.openTafsirForSelectedAyah();
      });
    }

    const copyActionBarBtn = document.getElementById('action-bar-copy-btn');
    if (copyActionBarBtn) {
      copyActionBarBtn.addEventListener('click', () => {
        this.copySelectedAyahText();
      });
    }

    const closeActionBarBtn = document.getElementById('action-bar-close-btn');
    if (closeActionBarBtn) {
      closeActionBarBtn.addEventListener('click', () => {
        this.hideAyahActionBar();
      });
    }

    // Click outside Ayahs in Mushaf view closes the floating action bar
    const scrollContainer = document.getElementById('reader-scroll-container');
    if (scrollContainer) {
      scrollContainer.addEventListener('click', (e) => {
        if (!e.target.closest('.ayah-span') && !e.target.closest('#mushaf-ayah-action-bar')) {
          this.hideAyahActionBar();
        }
      });
    }

    // Font size controls
    const decBtn = document.getElementById('reader-font-dec-btn');
    const incBtn = document.getElementById('reader-font-inc-btn');
    if (decBtn) {
      decBtn.addEventListener('click', () => {
        if (this.settings.config.quranFontSize > 20) {
          this.settings.update('quranFontSize', this.settings.config.quranFontSize - 2);
          this.settings.applyQuranStyles();
        }
      });
    }
    if (incBtn) {
      incBtn.addEventListener('click', () => {
        if (this.settings.config.quranFontSize < 46) {
          this.settings.update('quranFontSize', this.settings.config.quranFontSize + 2);
          this.settings.applyQuranStyles();
        }
      });
    }

    // Reciter Selector
    const reciterSelect = document.getElementById('reader-reciter-select');
    if (reciterSelect) {
      reciterSelect.innerHTML = this.quranData.RECITERS.map(r => {
        return `<option value="${r.id}">${r.name}</option>`;
      }).join('');

      reciterSelect.value = this.currentReciter;
      reciterSelect.addEventListener('change', async (e) => {
        this.currentReciter = e.target.value;
        if (this.currentSurah) {
          await this.reloadSurahAudio(this.currentSurah.number);
        }
      });
    }

    // Reader Audio Play/Pause Circle
    const playPauseBtn = document.getElementById('reader-play-pause-btn');
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => {
        this.toggleQuranPlayback();
      });
    }

    // Prev / Next Ayah
    const prevBtn = document.getElementById('reader-prev-ayah-btn');
    const nextBtn = document.getElementById('reader-next-ayah-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => this.playAyah(this.currentAyahIndex - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => this.playAyah(this.currentAyahIndex + 1));

    // Audio Speed Toggle
    const speedBtn = document.getElementById('reader-speed-btn');
    if (speedBtn) {
      speedBtn.addEventListener('click', () => {
        const speeds = [1.0, 1.25, 1.5, 0.75];
        const nextIdx = (speeds.indexOf(this.audioSpeed) + 1) % speeds.length;
        this.audioSpeed = speeds[nextIdx];
        this.audioPlayer.playbackRate = this.audioSpeed;
        speedBtn.innerText = `${this.audioSpeed}x`;
      });
    }

    // Mini Player controls
    const miniPlayBtn = document.getElementById('mini-play-btn');
    if (miniPlayBtn) {
      miniPlayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleQuranPlayback();
      });
    }
    const miniCloseBtn = document.getElementById('mini-close-btn');
    if (miniCloseBtn) {
      miniCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.stopQuranPlayback();
      });
    }
    const miniPlayer = document.getElementById('floating-mini-player');
    if (miniPlayer) {
      miniPlayer.addEventListener('click', () => {
        const readerModal = document.getElementById('view-quran-reader');
        if (readerModal) readerModal.classList.remove('hidden');
      });
    }
  }

  async openSurahReader(surahId, startAyahNum = 1) {
    const readerModal = document.getElementById('view-quran-reader');
    if (!readerModal) return;

    readerModal.classList.remove('hidden');
    document.body.classList.add('reader-active');

    // Keep reader audio dock collapsed by default for clean reading
    this.toggleReaderAudioDock(false);
    this.hideAyahActionBar();

    const contentBox = document.getElementById('quran-reader-content');
    contentBox.innerHTML = `
      <div style="text-align: center; padding: 4rem 1rem;">
        <div class="splash-loader" style="margin: 0 auto 1.5rem;"></div>
        <p style="color: var(--text-secondary); font-size: 1.1rem;">جاري تحميل آيات السورة الكريمة...</p>
      </div>
    `;

    // Fetch Surah from API
    const surah = await this.api.getSurah(surahId, this.currentReciter);
    if (!surah) {
      contentBox.innerHTML = `<p style="text-align:center; color: var(--danger-color); padding: 3rem;">تعذر تحميل السورة. يرجى التأكد من اتصال الإنترنت.</p>`;
      return;
    }

    this.currentSurah = surah;
    this.currentAyahIndex = Math.max(0, startAyahNum - 1);
    this.selectedAyahIndex = null;

    // Update Reader Header
    const isAr = this.isArabic();
    document.getElementById('reader-surah-title').innerText = isAr ? surah.name : surah.englishName;
    document.getElementById('reader-surah-info').innerText = isAr ? `الجزء ${this.toArabicNumerals(surah.ayahs[0].juz || 1)} • ${this.toArabicNumerals(surah.numberOfAyahs)} آية` : `Juz ${surah.ayahs[0].juz || 1} • ${surah.numberOfAyahs} Ayahs`;

    document.getElementById('reader-surah-banner-name').innerText = surah.name;
    document.getElementById('reader-surah-banner-meta').innerText = isAr
      ? `${surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'} • عدد آياتها ${this.toArabicNumerals(surah.numberOfAyahs)} • ترتيبها ${this.toArabicNumerals(surah.number)}`
      : `${surah.revelationType} • ${surah.numberOfAyahs} Ayahs • Surah ${surah.number}`;

    // Hide Bismillah for Surah 1 (Al-Fatiha) and Surah 9 (At-Tawbah)
    const bismillahBanner = document.getElementById('reader-bismillah-banner');
    if (bismillahBanner) {
      bismillahBanner.style.display = (surah.number === 1 || surah.number === 9) ? 'none' : 'block';
    }

    // Update Go to Saved Ayah button state in header
    this.updateSavedAyahButton(surah.number);

    // Update Two Small Floating Buttons for switching Surahs
    this.updateSurahNavButtons(surah.number);

    // Scroll reader to top when opening a new Surah
    const scrollBox = document.getElementById('reader-scroll-container');
    if (scrollBox && startAyahNum <= 1) {
      scrollBox.scrollTop = 0;
    }

    this.renderReaderContent(surah);

    // Scroll to requested ayah if startAyahNum > 1
    if (startAyahNum > 1) {
      setTimeout(() => {
        this.selectAyah(startAyahNum - 1, true);
      }, 300);
    }
  }

  renderReaderContent(surah) {
    const contentBox = document.getElementById('quran-reader-content');
    if (!contentBox) return;

    const mode = this.settings.config.quranMode;
    const isAr = this.isArabic();
    const saved = this.getSavedAyahForSurah(surah.number);

    if (mode === 'mushaf') {
      // Flowing sacred Mushaf layout
      contentBox.innerHTML = `
        <div class="mushaf-flow-container">
          ${surah.ayahs.map((ayah, idx) => {
            const cleanText = ayah.text.replace('بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ', '');
            const isSaved = saved && saved.ayahNumber === ayah.numberInSurah;
            const savedClass = isSaved ? ' has-saved-bookmark' : '';
            return `<span class="ayah-span${savedClass}" id="ayah-node-${idx}" onclick="window.app.onAyahClick(${idx})">${cleanText} <span class="ayah-num-symbol">﴿${this.toArabicNumerals(ayah.numberInSurah)}﴾</span></span>`;
          }).join(' ')}
        </div>
      `;
    } else {
      // Ayah-by-Ayah Study Mode Cards
      contentBox.innerHTML = `
        <div class="ayah-study-list">
          ${surah.ayahs.map((ayah, idx) => {
            const cleanText = ayah.text.replace('بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ', '');
            const isSaved = saved && saved.ayahNumber === ayah.numberInSurah;
            return `
              <div class="ayah-study-card${isSaved ? ' has-saved-bookmark' : ''}" id="ayah-node-${idx}">
                <div class="ayah-study-top">
                  <span class="ayah-badge-chip">${isAr ? `آية ${this.toArabicNumerals(ayah.numberInSurah)}` : `Ayah ${ayah.numberInSurah}`}${isSaved ? ' 🔖' : ''}</span>
                  <div class="ayah-study-actions">
                    <button class="icon-btn" style="width: 34px; height: 34px;" onclick="window.app.playAyah(${idx})" title="استماع">
                      <span class="material-symbols-rounded" style="font-size: 1.1rem;">volume_up</span>
                    </button>
                    <button class="icon-btn" style="width: 34px; height: 34px;" onclick="window.app.openTafsirModal(${surah.number}, ${ayah.numberInSurah}, '${this.escapeHtml(cleanText)}')" title="تفسير الميسر">
                      <span class="material-symbols-rounded" style="font-size: 1.1rem;">menu_book</span>
                    </button>
                    <button class="icon-btn" style="width: 34px; height: 34px;" onclick="window.app.bookmarkAyah(${surah.number}, '${this.escapeHtml(surah.name)}', ${ayah.numberInSurah})" title="حفظ فاصلة">
                      <span class="material-symbols-rounded" style="font-size: 1.1rem;">${isSaved ? 'bookmark' : 'bookmark_add'}</span>
                    </button>
                    <button class="icon-btn" style="width: 34px; height: 34px;" onclick="window.app.copyAyahText('${this.escapeHtml(cleanText)}')" title="نسخ الآية">
                      <span class="material-symbols-rounded" style="font-size: 1.1rem;">content_copy</span>
                    </button>
                  </div>
                </div>
                <div class="ayah-arabic-text">${cleanText}</div>
                ${ayah.translation ? `<div class="ayah-translation-text">${ayah.translation}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
  }

  // MANUAL INTERACTION: Clicking Ayah in Mushaf selects it and reveals actions without autoplaying audio
  onAyahClick(index) {
    this.selectAyah(index);
  }

  selectAyah(index, scrollIntoView = false) {
    if (!this.currentSurah || !this.currentSurah.ayahs || index < 0 || index >= this.currentSurah.ayahs.length) return;

    // Deselect previously selected ayah
    if (this.selectedAyahIndex !== null && this.selectedAyahIndex !== index) {
      const prevEl = document.getElementById(`ayah-node-${this.selectedAyahIndex}`);
      if (prevEl) prevEl.classList.remove('active-selected');
    }

    this.selectedAyahIndex = index;
    const ayah = this.currentSurah.ayahs[index];
    const targetEl = document.getElementById(`ayah-node-${index}`);

    if (targetEl) {
      targetEl.classList.add('active-selected');
      if (scrollIntoView) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    // Display and update the floating action bar
    const actionBar = document.getElementById('mushaf-ayah-action-bar');
    if (actionBar) {
      actionBar.classList.remove('hidden');

      const isAr = this.isArabic();
      const badge = document.getElementById('action-bar-ayah-badge');
      if (badge) {
        badge.innerText = isAr ? `الآية ${this.toArabicNumerals(ayah.numberInSurah)}` : `Ayah ${ayah.numberInSurah}`;
      }

      // Check if this ayah is already saved
      const saved = this.getSavedAyahForSurah(this.currentSurah.number);
      const isSaved = saved && saved.ayahNumber === ayah.numberInSurah;
      const saveLabel = document.getElementById('action-bar-save-label');
      if (saveLabel) {
        saveLabel.innerText = isSaved
          ? (isAr ? 'فاصلة محفوظة ✓' : 'Saved ✓')
          : (isAr ? 'حفظ كفاصلة' : 'Bookmark');
      }
    }
  }

  hideAyahActionBar() {
    const actionBar = document.getElementById('mushaf-ayah-action-bar');
    if (actionBar) actionBar.classList.add('hidden');

    if (this.selectedAyahIndex !== null) {
      const prevEl = document.getElementById(`ayah-node-${this.selectedAyahIndex}`);
      if (prevEl) prevEl.classList.remove('active-selected');
      this.selectedAyahIndex = null;
    }
  }

  // Save selected Ayah in Mushaf view as bookmark for this Surah
  saveSelectedAyahBookmark() {
    if (this.selectedAyahIndex === null || !this.currentSurah) return;
    const ayah = this.currentSurah.ayahs[this.selectedAyahIndex];
    if (!ayah) return;

    const savedData = {
      surahId: this.currentSurah.number,
      surahName: this.currentSurah.name,
      ayahNumber: ayah.numberInSurah,
      ayahIndex: this.selectedAyahIndex,
      date: new Date().toLocaleDateString(this.isArabic() ? 'ar-EG' : 'en-US')
    };

    // Save dedicated Surah bookmark
    localStorage.setItem(`noor_saved_ayah_surah_${this.currentSurah.number}`, JSON.stringify(savedData));

    // Also register in global bookmarks list
    this.saveBookmarkInternal(this.currentSurah.number, this.currentSurah.name, ayah.numberInSurah);

    // Update active visual bookmark on ayah nodes
    document.querySelectorAll('.ayah-span.has-saved-bookmark, .ayah-study-card.has-saved-bookmark').forEach(el => el.classList.remove('has-saved-bookmark'));
    const currentEl = document.getElementById(`ayah-node-${this.selectedAyahIndex}`);
    if (currentEl) currentEl.classList.add('has-saved-bookmark');

    // Update action bar label
    const saveLabel = document.getElementById('action-bar-save-label');
    if (saveLabel) saveLabel.innerText = this.isArabic() ? 'فاصلة محفوظة ✓' : 'Saved ✓';

    // Update header "Go to saved ayah" button immediately
    this.updateSavedAyahButton(this.currentSurah.number);

    // Notify user with elegant toast
    const isAr = this.isArabic();
    this.showToast(isAr ? `تم حفظ الآية (${this.toArabicNumerals(ayah.numberInSurah)}) كعلامة قراءة بنجاح 🔖` : `Ayah (${ayah.numberInSurah}) bookmarked successfully! 🔖`, 'bookmark_added');
  }

  // Jump smoothly to saved Ayah for current Surah
  goToSavedAyah() {
    if (!this.currentSurah) return;
    const saved = this.getSavedAyahForSurah(this.currentSurah.number);
    if (!saved) {
      this.showToast(this.isArabic() ? 'لا توجد آية محفوظة لهذه السورة بعد' : 'No saved Ayah found for this Surah', 'info');
      return;
    }

    let targetIndex = (typeof saved.ayahIndex === 'number' && saved.ayahIndex >= 0)
      ? saved.ayahIndex
      : this.currentSurah.ayahs.findIndex(a => a.numberInSurah === saved.ayahNumber);

    if (targetIndex === -1) targetIndex = Math.max(0, saved.ayahNumber - 1);

    const targetEl = document.getElementById(`ayah-node-${targetIndex}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Pulsating golden celestial flash
      targetEl.classList.remove('saved-ayah-flash');
      void targetEl.offsetWidth; // trigger reflow
      targetEl.classList.add('saved-ayah-flash');
      setTimeout(() => {
        targetEl.classList.remove('saved-ayah-flash');
      }, 2500);

      // Select this ayah and show actions
      this.selectAyah(targetIndex, false);
      const isAr = this.isArabic();
      this.showToast(isAr ? `تم الانتقال إلى الآية المحفوظة (${this.toArabicNumerals(saved.ayahNumber)}) 📖` : `Jumped to saved Ayah (${saved.ayahNumber}) 📖`, 'bookmark');
    }
  }

  getSavedAyahForSurah(surahId) {
    const raw = localStorage.getItem(`noor_saved_ayah_surah_${surahId}`);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.warn("Invalid saved ayah format", e);
      }
    }
    // Fallback: search in bookmarks
    const bm = this.bookmarks.find(b => b.surahId === surahId);
    if (bm) {
      return {
        surahId: bm.surahId,
        surahName: bm.surahName,
        ayahNumber: bm.ayahNumber,
        ayahIndex: Math.max(0, bm.ayahNumber - 1)
      };
    }
    return null;
  }

  updateSavedAyahButton(surahId) {
    const savedBtn = document.getElementById('reader-go-to-saved-btn');
    const labelEl = document.getElementById('reader-saved-ayah-label');
    if (!savedBtn || !labelEl) return;

    const saved = this.getSavedAyahForSurah(surahId);
    if (saved && saved.ayahNumber) {
      savedBtn.classList.remove('hidden');
      const isAr = this.isArabic();
      labelEl.innerText = isAr ? `الآية المحفوظة (${this.toArabicNumerals(saved.ayahNumber)})` : `Saved Ayah (${saved.ayahNumber})`;
      savedBtn.title = isAr ? `الانتقال إلى الآية المحفوظة رقم ${saved.ayahNumber}` : `Jump to saved Ayah ${saved.ayahNumber}`;
    } else {
      savedBtn.classList.add('hidden');
    }
  }

  // Switch between Surahs forward (+1) or backward (-1) via the two small floating buttons
  navigateToAdjacentSurah(direction) {
    if (!this.currentSurah) return;
    const targetId = this.currentSurah.number + direction;
    if (targetId >= 1 && targetId <= 114) {
      if (!this.audioPlayer.paused) {
        this.stopQuranPlayback();
      }
      this.openSurahReader(targetId, 1);
    }
  }

  updateSurahNavButtons(surahId) {
    const prevId = surahId - 1;
    const nextId = surahId + 1;
    const isAr = this.isArabic();

    const prevBtn = document.getElementById('floating-prev-surah-btn');
    const nextBtn = document.getElementById('floating-next-surah-btn');
    const prevTooltip = document.getElementById('floating-prev-surah-tooltip');
    const nextTooltip = document.getElementById('floating-next-surah-tooltip');

    const getSurahName = (id) => {
      const s = this.quranData?.SURAHS?.find(item => item.id === id);
      if (!s) return isAr ? `سورة ${this.toArabicNumerals(id)}` : `Surah ${id}`;
      return isAr ? s.name : s.englishName;
    };

    // Previous Surah (Backward)
    if (prevId >= 1) {
      const prevName = getSurahName(prevId);
      if (prevBtn) {
        prevBtn.classList.remove('hidden');
        prevBtn.title = isAr ? `السورة السابقة (${prevName})` : `Previous Surah (${prevName})`;
      }
      if (prevTooltip) {
        prevTooltip.innerText = prevName;
      }
    } else {
      if (prevBtn) prevBtn.classList.add('hidden');
    }

    // Next Surah (Forward)
    if (nextId <= 114) {
      const nextName = getSurahName(nextId);
      if (nextBtn) {
        nextBtn.classList.remove('hidden');
        nextBtn.title = isAr ? `السورة التالية (${nextName})` : `Next Surah (${nextName})`;
      }
      if (nextTooltip) {
        nextTooltip.innerText = nextName;
      }
    } else {
      if (nextBtn) nextBtn.classList.add('hidden');
    }
  }

  // Toggle or force visibility of reader audio control dock
  toggleReaderAudioDock(forceOpen = null) {
    const dock = document.getElementById('reader-audio-dock');
    const toggleBtn = document.getElementById('toggle-reader-audio-dock-btn');
    const scrollContainer = document.getElementById('reader-scroll-container');
    const readerModal = document.getElementById('view-quran-reader');
    if (!dock) return;

    const shouldOpen = forceOpen !== null ? forceOpen : !dock.classList.contains('is-open');

    if (shouldOpen) {
      dock.classList.add('is-open');
      this.isReaderAudioDockOpen = true;
      if (toggleBtn) toggleBtn.classList.add('is-active');
      if (scrollContainer) scrollContainer.classList.add('dock-open');
      if (readerModal) readerModal.classList.add('dock-active');
    } else {
      dock.classList.remove('is-open');
      this.isReaderAudioDockOpen = false;
      if (toggleBtn) toggleBtn.classList.remove('is-active');
      if (scrollContainer) scrollContainer.classList.remove('dock-open');
      if (readerModal) readerModal.classList.remove('dock-active');
    }
  }

  openTafsirForSelectedAyah() {
    if (this.selectedAyahIndex === null || !this.currentSurah) return;
    const ayah = this.currentSurah.ayahs[this.selectedAyahIndex];
    if (ayah) {
      const cleanText = ayah.text.replace('بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ', '');
      this.openTafsirModal(this.currentSurah.number, ayah.numberInSurah, cleanText);
    }
  }

  copySelectedAyahText() {
    if (this.selectedAyahIndex === null || !this.currentSurah) return;
    const ayah = this.currentSurah.ayahs[this.selectedAyahIndex];
    if (ayah) {
      const cleanText = ayah.text.replace('بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ', '');
      this.copyAyahText(cleanText);
    }
  }

  async reloadSurahAudio(surahId) {
    const updated = await this.api.getSurah(surahId, this.currentReciter);
    if (updated) {
      this.currentSurah = updated;
      if (!this.audioPlayer.paused) {
        this.playAyah(this.currentAyahIndex);
      }
    }
  }

  // Play Ayah audio (called explicitly when user presses Play)
  playAyah(index) {
    if (!this.currentSurah || !this.currentSurah.ayahs) return;
    if (index < 0 || index >= this.currentSurah.ayahs.length) return;

    // Reset previous active reciting styling
    const prevEl = document.getElementById(`ayah-node-${this.currentAyahIndex}`);
    if (prevEl) prevEl.classList.remove('active-reciting');

    this.currentAyahIndex = index;
    const ayah = this.currentSurah.ayahs[index];
    const newEl = document.getElementById(`ayah-node-${index}`);
    if (newEl) {
      newEl.classList.add('active-reciting');
      newEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Automatically reveal the audio dock so user has full control
    this.toggleReaderAudioDock(true);

    if (ayah.audio) {
      this.audioPlayer.src = ayah.audio;
      this.audioPlayer.playbackRate = this.audioSpeed;
      this.audioPlayer.play().catch(e => console.warn("Audio play blocked:", e));
      this.updatePlayPauseUI(true);
      this.updateMiniPlayerUI(true);
      this.startAudioProgressTracking();

      // Show pulsing dot on header toggle button
      const activeDot = document.getElementById('reader-audio-active-dot');
      if (activeDot) activeDot.classList.remove('hidden');
    }

    // Auto advance to next ayah on finish
    this.audioPlayer.onended = () => {
      if (this.currentAyahIndex + 1 < this.currentSurah.ayahs.length) {
        this.playAyah(this.currentAyahIndex + 1);
      } else {
        this.updatePlayPauseUI(false);
        this.updateMiniPlayerUI(false);
        const activeDot = document.getElementById('reader-audio-active-dot');
        if (activeDot) activeDot.classList.add('hidden');
      }
    };
  }

  toggleQuranPlayback() {
    if (!this.currentSurah) return;
    if (this.audioPlayer.paused) {
      const idx = this.selectedAyahIndex !== null ? this.selectedAyahIndex : this.currentAyahIndex;
      this.playAyah(idx);
    } else {
      this.audioPlayer.pause();
      this.updatePlayPauseUI(false);
      this.updateMiniPlayerUI(false);
      const activeDot = document.getElementById('reader-audio-active-dot');
      if (activeDot) activeDot.classList.add('hidden');
    }
  }

  stopQuranPlayback() {
    this.audioPlayer.pause();
    this.audioPlayer.src = '';
    this.updatePlayPauseUI(false);
    const activeDot = document.getElementById('reader-audio-active-dot');
    if (activeDot) activeDot.classList.add('hidden');
    const mini = document.getElementById('floating-mini-player');
    if (mini) mini.classList.add('hidden');
  }

  updatePlayPauseUI(isPlaying) {
    const playBtn = document.getElementById('reader-play-pause-btn');
    if (playBtn) {
      playBtn.innerHTML = isPlaying
        ? `<span class="material-symbols-rounded" style="font-size: 2rem;">pause</span>`
        : `<span class="material-symbols-rounded" style="font-size: 2rem;">play_arrow</span>`;
    }

    const miniPlayBtn = document.getElementById('mini-play-btn');
    if (miniPlayBtn) {
      miniPlayBtn.innerHTML = isPlaying
        ? `<span class="material-symbols-rounded">pause</span>`
        : `<span class="material-symbols-rounded">play_arrow</span>`;
    }

    const activeDot = document.getElementById('reader-audio-active-dot');
    if (activeDot) {
      if (isPlaying) activeDot.classList.remove('hidden');
      else activeDot.classList.add('hidden');
    }
  }

  updateMiniPlayerUI(isPlaying) {
    const mini = document.getElementById('floating-mini-player');
    if (!mini || !this.currentSurah) return;

    mini.classList.remove('hidden');
    const isAr = this.isArabic();
    const ayah = this.currentSurah.ayahs[this.currentAyahIndex];

    document.getElementById('mini-player-surah').innerText = isAr ? this.currentSurah.name : this.currentSurah.englishName;
    const reciterName = this.quranData.RECITERS.find(r => r.id === this.currentReciter)?.name || '';
    document.getElementById('mini-player-ayah').innerText = isAr
      ? `الآية ${this.toArabicNumerals(ayah.numberInSurah)} • ${reciterName}`
      : `Ayah ${ayah.numberInSurah} • ${reciterName}`;
  }

  startAudioProgressTracking() {
    if (this.audioProgressInterval) clearInterval(this.audioProgressInterval);
    this.audioProgressInterval = setInterval(() => {
      const fill = document.getElementById('reader-audio-progress-fill');
      if (!fill || this.audioPlayer.paused) return;
      const duration = this.audioPlayer.duration || 0;
      const current = this.audioPlayer.currentTime || 0;
      if (duration > 0) {
        fill.style.width = `${(current / duration) * 100}%`;
      }
    }, 200);
  }

  closeQuranReader() {
    const readerModal = document.getElementById('view-quran-reader');
    if (readerModal) readerModal.classList.add('hidden');
    document.body.classList.remove('reader-active');
    this.hideAyahActionBar();
  }

  saveBookmarkInternal(surahId, surahName, ayahNum) {
    const newBm = {
      surahId: surahId,
      surahName: surahName,
      ayahNumber: ayahNum,
      date: new Date().toLocaleDateString(this.isArabic() ? 'ar-EG' : 'en-US')
    };

    // Prevent duplicates
    this.bookmarks = this.bookmarks.filter(b => !(b.surahId === surahId && b.ayahNumber === ayahNum));
    this.bookmarks.unshift(newBm);
    localStorage.setItem('noor_bookmarks', JSON.stringify(this.bookmarks));
    this.renderBookmarks();
  }

  bookmarkAyah(surahId, surahName, ayahNum) {
    this.saveBookmarkInternal(surahId, surahName, ayahNum);
    const isAr = this.isArabic();
    this.showToast(isAr ? `تم حفظ الفاصلة (${this.toArabicNumerals(ayahNum)}) بنجاح! 🔖` : `Bookmark for Ayah (${ayahNum}) saved! 🔖`, 'bookmark_added');
  }

  copyAyahText(text) {
    navigator.clipboard.writeText(text);
    this.showToast(this.isArabic() ? 'تم نسخ نص الآية الكريمة! 📋' : 'Ayah text copied to clipboard! 📋', 'content_copy');
  }

  async openTafsirModal(surahId, ayahNum, ayahText) {
    const modal = document.getElementById('tafsir-modal');
    if (!modal) return;

    modal.classList.remove('hidden');
    const isAr = this.isArabic();
    document.getElementById('tafsir-modal-title').innerText = isAr ? `تفسير الآية ${this.toArabicNumerals(ayahNum)}` : `Tafsir Ayah ${ayahNum}`;
    document.getElementById('tafsir-ayah-box').innerText = ayahText;

    const tafsirBox = document.getElementById('tafsir-text-box');
    tafsirBox.innerText = isAr ? 'جاري تحميل التفسير الميسر...' : 'Loading Tafsir...';

    const tafsirText = await this.api.getAyahTafsir(surahId, ayahNum);
    tafsirBox.innerText = tafsirText;
  }

  showToast(message, icon = 'bookmark_added') {
    const toast = document.getElementById('app-toast');
    const msgEl = document.getElementById('toast-message');
    const iconEl = document.getElementById('toast-icon');
    if (!toast || !msgEl) return;

    msgEl.innerText = message;
    if (iconEl) iconEl.innerText = icon;

    toast.classList.remove('hidden');

    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.add('hidden');
    }, 3200);
  }

  // --- SMART ELECTRONIC MASBAHA ---
  initTasbeeh() {
    const select = document.getElementById('tasbeeh-select');
    if (select && this.quranData.TASBEEH_PRESETS) {
      select.innerHTML = this.quranData.TASBEEH_PRESETS.map(p => {
        return `<option value="${p.id}">${p.text} (${p.count})</option>`;
      }).join('');

      select.addEventListener('change', (e) => {
        const preset = this.quranData.TASBEEH_PRESETS.find(p => p.id === parseInt(e.target.value, 10));
        if (preset) {
          this.tasbeehState.presetId = preset.id;
          this.tasbeehState.target = preset.count;
          this.tasbeehState.count = 0;
          this.updateTasbeehUI();
        }
      });
    }

    this.updateTasbeehUI();
  }

  bindTasbeehEvents() {
    // Touch circle button
    const target = document.getElementById('tasbeeh-touch-target');
    if (target) {
      target.addEventListener('click', (e) => {
        this.tapTasbeeh(e);
      });
    }

    // Reset button
    const resetBtn = document.getElementById('tasbeeh-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.tasbeehState.count = 0;
        this.updateTasbeehUI();
      });
    }

    // Target pills
    const targetPills = document.querySelectorAll('[data-target-count]');
    targetPills.forEach(pill => {
      pill.addEventListener('click', () => {
        targetPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.tasbeehState.target = parseInt(pill.getAttribute('data-target-count'), 10);
        this.tasbeehState.count = 0;
        this.updateTasbeehUI();
      });
    });

    // Sound toggle
    const soundToggle = document.getElementById('tasbeeh-sound-toggle-btn');
    if (soundToggle) {
      soundToggle.addEventListener('click', () => {
        this.settings.update('tasbeehSound', !this.settings.config.tasbeehSound);
        document.getElementById('tasbeeh-sound-icon').innerText = this.settings.config.tasbeehSound ? 'volume_up' : 'volume_off';
      });
    }
  }

  tapTasbeeh(event) {
    this.tasbeehState.count++;
    this.tasbeehState.lifetime++;
    localStorage.setItem('noor_tasbeeh_lifetime', this.tasbeehState.lifetime);

    // Audio click & haptics
    this.playMasbahaClick();
    if (this.settings.config.tasbeehVibration && navigator.vibrate) {
      navigator.vibrate(30);
    }

    // Ripple effect
    const btn = document.getElementById('tasbeeh-touch-target');
    if (btn) {
      const ripple = document.createElement('span');
      ripple.style.cssText = `
        position: absolute; border-radius: 50%;
        background: rgba(16, 185, 129, 0.35); pointer-events: none;
        width: 150px; height: 150px; transform: scale(0);
        animation: spin 0.4s linear; left: 50%; top: 50%;
        margin-left: -75px; margin-top: -75px;
      `;
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 400);
    }

    // Target reached celebration
    if (this.tasbeehState.target > 0 && this.tasbeehState.count >= this.tasbeehState.target) {
      if (this.particles) this.particles.triggerCelebration();
      if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
      setTimeout(() => {
        this.tasbeehState.count = 0;
        this.updateTasbeehUI();
      }, 500);
    }

    this.updateTasbeehUI();
  }

  updateTasbeehUI() {
    const isAr = this.isArabic();
    const countEl = document.getElementById('tasbeeh-current-count');
    const targetEl = document.getElementById('tasbeeh-target-label');
    const lifetimeEl = document.getElementById('tasbeeh-total-lifetime');

    if (countEl) countEl.innerText = isAr ? this.toArabicNumerals(this.tasbeehState.count) : this.tasbeehState.count;
    if (targetEl) {
      targetEl.innerText = this.tasbeehState.target === 0
        ? (isAr ? 'الهدف: عداد حر ∞' : 'Target: Free count ∞')
        : (isAr ? `الهدف: ${this.toArabicNumerals(this.tasbeehState.target)}` : `Target: ${this.tasbeehState.target}`);
    }
    if (lifetimeEl) lifetimeEl.innerText = isAr ? this.toArabicNumerals(this.tasbeehState.lifetime) : this.tasbeehState.lifetime;
  }

  // --- AZKAR LOGIC ---
  bindAzkarEvents() {
    const backBtn = document.getElementById('back-to-azkar-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        document.getElementById('azkar-reader-section').classList.add('hidden');
        document.getElementById('azkar-categories-section').classList.remove('hidden');
      });
    }

    const searchInput = document.getElementById('azkar-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        document.querySelectorAll('.azkar-cat-card').forEach(card => {
          const title = card.innerText.toLowerCase();
          card.style.display = title.includes(q) ? 'flex' : 'none';
        });
      });
    }
  }

  async loadAzkarCategories() {
    const container = document.getElementById('azkar-categories-list');
    if (!container || container.dataset.loaded) return;

    container.innerHTML = `<div style="text-align: center; grid-column: span 12; padding: 2rem;"><div class="splash-loader" style="margin: 0 auto;"></div></div>`;

    const azkar = await this.api.getAzkar();
    if (!azkar) {
      container.innerHTML = `<p style="text-align: center; color: var(--danger-color);">تعذر تحميل الأذكار.</p>`;
      return;
    }

    const icons = {
      'أذكار الصباح': '🌅',
      'أذكار المساء': '🌙',
      'أذكار بعد الصلاة': '🕌',
      'أذكار النوم': '😴',
      'أذكار الاستيقاظ': '☀️',
      'أدعية قرآنية': '📖',
      'أدعية الأنبياء': '🤲',
      'الرقية الشرعية': '🌿'
    };

    const isAr = this.isArabic();
    container.innerHTML = Object.keys(azkar).map(category => {
      const count = azkar[category].length;
      const icon = icons[category] || '📿';
      return `
        <div class="azkar-cat-card" onclick="window.app.openAzkarCategory('${this.escapeHtml(category)}')">
          <div class="azkar-cat-icon">${icon}</div>
          <div>
            <h3 class="azkar-cat-title">${category}</h3>
            <span class="azkar-cat-count">${isAr ? `${this.toArabicNumerals(count)} أذكار` : `${count} Adhkar`}</span>
          </div>
        </div>
      `;
    }).join('');

    container.dataset.loaded = 'true';
  }

  async openAzkarCategory(category) {
    const azkar = await this.api.getAzkar();
    if (!azkar || !azkar[category]) return;

    document.getElementById('azkar-categories-section').classList.add('hidden');
    const reader = document.getElementById('azkar-reader-section');
    reader.classList.remove('hidden');

    document.getElementById('azkar-category-title').innerText = category;
    const cardsContainer = document.getElementById('azkar-cards-container');

    const isAr = this.isArabic();
    cardsContainer.innerHTML = azkar[category].map((item, idx) => {
      const text = item.zekr || item.content || item.text || '';
      const count = parseInt(item.count, 10) || 1;
      return `
        <div class="zekr-card" id="zekr-card-${idx}" data-count="${count}" data-max="${count}" onclick="window.app.tapZekrCard(${idx})">
          <p class="zekr-card-text">${text}</p>
          <div class="zekr-bottom-bar">
            <div class="zekr-badge" id="zekr-badge-${idx}">${isAr ? this.toArabicNumerals(count) : count}</div>
            <span style="font-size: 0.85rem; color: var(--text-secondary);">${isAr ? 'اضغط للعد' : 'Tap to count'}</span>
          </div>
          <div class="zekr-progress-line" id="zekr-prog-${idx}"></div>
        </div>
      `;
    }).join('');

    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  tapZekrCard(idx) {
    const card = document.getElementById(`zekr-card-${idx}`);
    const badge = document.getElementById(`zekr-badge-${idx}`);
    const prog = document.getElementById(`zekr-prog-${idx}`);
    if (!card || !badge) return;

    let count = parseInt(card.dataset.count, 10);
    const max = parseInt(card.dataset.max, 10);
    if (count <= 0) return;

    count--;
    card.dataset.count = count;

    this.playMasbahaClick();
    if (this.settings.config.tasbeehVibration && navigator.vibrate) {
      navigator.vibrate(30);
    }

    badge.innerText = this.isArabic() ? this.toArabicNumerals(count) : count;
    badge.style.transform = 'scale(1.25)';
    setTimeout(() => { badge.style.transform = 'scale(1)'; }, 150);

    const pct = max > 0 ? (count / max) * 100 : 0;
    if (prog) prog.style.width = `${pct}%`;

    if (count === 0) {
      badge.style.background = 'var(--text-muted)';
      card.style.borderColor = 'var(--accent-color)';
      // Check if all completed
      const allCards = document.querySelectorAll('.zekr-card');
      const allDone = Array.from(allCards).every(c => parseInt(c.dataset.count, 10) === 0);
      if (allDone && this.particles) {
        this.particles.triggerCelebration();
        alert(this.isArabic() ? 'أحسنت! تقبل الله طاعتكم وذكركم ✨' : 'Well done! All completed ✨');
      }
    }
  }

  // --- LUXURY 3D QIBLA COMPASS ---
  initQiblaCompass() {
    const MECCA_LAT = 21.4225;
    const MECCA_LNG = 39.8262;

    const lat1 = this.loc.lat * Math.PI / 180;
    const lat2 = MECCA_LAT * Math.PI / 180;
    const dLng = (MECCA_LNG - this.loc.lng) * Math.PI / 180;

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const qiblaAngle = Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360);

    // Distance to Makkah in km (Haversine Formula)
    const R = 6371; // Earth radius in km
    const dLat = (MECCA_LAT - this.loc.lat) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = Math.round(R * c);

    const isAr = this.isArabic();
    const degEl = document.getElementById('qibla-degree-value');
    const distEl = document.getElementById('qibla-city-distance');

    if (degEl) degEl.innerText = `${isAr ? this.toArabicNumerals(qiblaAngle) : qiblaAngle}°`;
    if (distEl) distEl.innerText = isAr
      ? `اتجاه القبلة: ${this.toArabicNumerals(qiblaAngle)}° من الشمال • المسافة إلى الكعبة: ${this.toArabicNumerals(distanceKm)} كم`
      : `Qibla Angle: ${qiblaAngle}° from North • Distance: ${distanceKm} km`;

    // Static initial rotation pointing arrow to bearing
    const arrow = document.getElementById('qibla-arrow-container');
    if (arrow) arrow.style.transform = `rotate(${qiblaAngle}deg)`;

    // Orientation sensor
    const calibrateBtn = document.getElementById('calibrate-compass-btn');
    if (calibrateBtn) {
      calibrateBtn.onclick = () => {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
          DeviceOrientationEvent.requestPermission().then(state => {
            if (state === 'granted') {
              window.addEventListener('deviceorientation', (e) => this.handleDeviceOrientation(e, qiblaAngle));
              calibrateBtn.innerText = isAr ? 'المستشعر نشط' : 'Sensor Active';
            }
          });
        } else if (window.DeviceOrientationEvent) {
          window.addEventListener('deviceorientation', (e) => this.handleDeviceOrientation(e, qiblaAngle));
          calibrateBtn.innerText = isAr ? 'المستشعر نشط' : 'Sensor Active';
        }
      };
    }
  }

  handleDeviceOrientation(e, qiblaAngle) {
    const heading = e.webkitCompassHeading || e.alpha;
    if (heading === null || heading === undefined) return;
    const disc = document.getElementById('compass-disc-ring');
    if (disc) {
      disc.style.transform = `rotate(${-heading}deg)`;
    }
  }

  // --- CITY LOCATION SELECTOR MODAL ---
  bindLocationEvents() {
    const locBtn = document.getElementById('location-select-btn');
    const modal = document.getElementById('location-modal');
    if (locBtn && modal) {
      locBtn.addEventListener('click', () => {
        this.renderPopularCities();
        modal.classList.remove('hidden');
      });
    }

    const gpsBtn = document.getElementById('auto-gps-detect-btn');
    if (gpsBtn && modal) {
      gpsBtn.addEventListener('click', async () => {
        modal.classList.add('hidden');
        await this.initLocation();
        await this.loadPrayerData();
      });
    }

    const searchInput = document.getElementById('city-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        document.querySelectorAll('.city-select-row').forEach(row => {
          const text = row.innerText.toLowerCase();
          row.style.display = text.includes(q) ? 'flex' : 'none';
        });
      });
    }
  }

  renderPopularCities() {
    const list = document.getElementById('popular-cities-list');
    if (!list || !this.quranData.CITIES) return;

    const isAr = this.isArabic();
    list.innerHTML = this.quranData.CITIES.map(c => {
      return `
        <div class="glass-card city-select-row" style="display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 1rem; cursor: pointer;" onclick="window.app.selectCity('${c.name}', '${c.nameAr}', '${c.country}', '${c.countryAr}', ${c.lat}, ${c.lng})">
          <div>
            <strong style="color: var(--text-primary);">${isAr ? c.nameAr : c.name}</strong>
            <span style="font-size: 0.82rem; color: var(--text-muted); display: block;">${isAr ? c.countryAr : c.country}</span>
          </div>
          <span class="material-symbols-rounded" style="color: var(--accent-color);">chevron_left</span>
        </div>
      `;
    }).join('');
  }

  async selectCity(name, nameAr, country, countryAr, lat, lng) {
    this.loc = { nameEn: name, nameAr: nameAr, countryEn: country, countryAr: countryAr, lat: lat, lng: lng };
    this.saveLocation();
    document.getElementById('location-modal').classList.add('hidden');
    await this.loadPrayerData();
  }

  // --- GLOBAL HELPERS & LANGUAGE ---
  bindGlobalEvents() {
    // Language toggles
    const langArBtn = document.getElementById('lang-btn-ar');
    const langEnBtn = document.getElementById('lang-btn-en');

    if (langArBtn) {
      langArBtn.addEventListener('click', () => {
        this.switchLanguage('ar');
      });
    }

    if (langEnBtn) {
      langEnBtn.addEventListener('click', () => {
        this.switchLanguage('en');
      });
    }
  }

  switchLanguage(lang) {
    localStorage.setItem('noor_lang', lang);
    if (lang === 'ar') {
      document.body.classList.remove('ltr');
      document.body.classList.add('rtl');
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
    } else {
      document.body.classList.remove('rtl');
      document.body.classList.add('ltr');
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = 'en';
    }

    const arBtn = document.getElementById('lang-btn-ar');
    const enBtn = document.getElementById('lang-btn-en');
    if (arBtn) arBtn.classList.toggle('active', lang === 'ar');
    if (enBtn) enBtn.classList.toggle('active', lang === 'en');

    this.updateLocationUI();
    this.updateDatesDisplay();
    this.calculateNextPrayer();
    this.updateWirdUI();
    this.updateTasbeehUI();
    this.renderQuranSurahs();
    this.renderQuranJuz();
    this.renderBookmarks();
  }

  isArabic() {
    return localStorage.getItem('noor_lang') !== 'en';
  }

  toArabicNumerals(num) {
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return String(num).replace(/[0-9]/g, (w) => arabicDigits[+w]);
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  hideSplash() {
    const splash = document.getElementById('splash-screen');
    const app = document.getElementById('app-content');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => {
        splash.classList.add('hidden');
        if (app) app.classList.remove('hidden');
      }, 500);
    }
  }
}

// Bootstrap Noor
document.addEventListener('DOMContentLoaded', () => {
  window.app = new NoorApp();
  window.app.init();
});
