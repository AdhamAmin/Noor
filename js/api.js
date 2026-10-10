// api.js - Enhanced Network & Data Layer for Noor

class NoorAPI {
  constructor() {
    this.aladhanBase = 'https://api.aladhan.com/v1';
    this.quranBase = 'https://api.alquran.cloud/v1';
    this.adhanUrls = {
      default: 'https://islamdownload.net/wp-content/uploads-by-id/123801/Adzan-Misyari-Rasyid.mp3',
      makkah: 'https://download.quranicaudio.com/adhan/adhan_makkah.mp3',
      madinah: 'https://download.quranicaudio.com/adhan/adhan_madinah.mp3'
    };

    // In-memory caches for snappy responsiveness
    this._surahCache = {};
    this._tafsirCache = {};
    this._timingsCache = {};
    this._azkarCache = null;
  }

  get adhanUrl() {
    return this.adhanUrls.default;
  }

  async getTimingsByCoordinates(lat, lng, method = 5, school = 0) {
    const d = new Date();
    const dateStr = `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)},${method},${school},${dateStr}`;
    
    if (this._timingsCache[cacheKey]) {
      return this._timingsCache[cacheKey];
    }

    // Check localStorage cache
    const localSaved = localStorage.getItem(`noor_timings_${cacheKey}`);
    if (localSaved) {
      try {
        const parsed = JSON.parse(localSaved);
        this._timingsCache[cacheKey] = parsed;
        return parsed;
      } catch (e) {}
    }

    try {
      const url = `${this.aladhanBase}/timings/${dateStr}?latitude=${lat}&longitude=${lng}&method=${method}&school=${school}&iso8601=true`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Aladhan API HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.data) {
        this._timingsCache[cacheKey] = data.data;
        try {
          localStorage.setItem(`noor_timings_${cacheKey}`, JSON.stringify(data.data));
        } catch (e) {}
        return data.data;
      }
      return null;
    } catch (err) {
      console.warn("Prayer times fetch error:", err);
      return null;
    }
  }

  isRamadan(data) {
    if (!data || !data.date || !data.date.hijri) return false;
    return Number(data.date.hijri.month.number) === 9;
  }

  // --- QURAN APIS ---
  async getSurahs() {
    if (window.QURAN_DATA && window.QURAN_DATA.SURAHS) {
      return window.QURAN_DATA.SURAHS;
    }
    try {
      const res = await fetch(`${this.quranBase}/surah`);
      if (!res.ok) throw new Error('Surah list request failed');
      const data = await res.json();
      return data.data || [];
    } catch (e) {
      console.warn("Failed to fetch surahs list:", e);
      return [];
    }
  }

  async getSurah(id, audioEdition = 'ar.alafasy') {
    const cacheKey = `${id}:${audioEdition}`;
    if (this._surahCache[cacheKey]) {
      return this._surahCache[cacheKey];
    }

    try {
      // Fetch Arabic Uthmani text + English translation simultaneously, along with reciter audio
      const [dualRes, audioRes] = await Promise.all([
        fetch(`${this.quranBase}/surah/${id}/editions/quran-uthmani,en.asad`).catch(() => null),
        fetch(`${this.quranBase}/surah/${id}/${audioEdition}`).catch(() => null)
      ]);

      let surahData = null;
      let translationAyahs = [];

      if (dualRes && dualRes.ok) {
        const dualData = await dualRes.json();
        if (dualData.data && dualData.data.length >= 2) {
          surahData = dualData.data[0]; // quran-uthmani
          translationAyahs = dualData.data[1].ayahs || [];
        } else if (dualData.data && dualData.data[0]) {
          surahData = dualData.data[0];
        }
      }

      // Fallback if dual endpoint failed
      if (!surahData) {
        const fallbackRes = await fetch(`${this.quranBase}/surah/${id}/quran-uthmani`);
        if (!fallbackRes.ok) throw new Error('Failed to fetch surah uthmani text');
        const fallbackData = await fallbackRes.json();
        surahData = fallbackData.data;
      }

      // Merge audio and translations into each ayah object
      let audioAyahs = [];
      if (audioRes && audioRes.ok) {
        const audioJson = await audioRes.json();
        audioAyahs = (audioJson.data && audioJson.data.ayahs) || [];
      }

      surahData.ayahs = surahData.ayahs.map((ayah, idx) => {
        return {
          ...ayah,
          translation: translationAyahs[idx] ? translationAyahs[idx].text : '',
          audio: audioAyahs[idx] ? audioAyahs[idx].audio : (ayah.audio || null)
        };
      });

      this._surahCache[cacheKey] = surahData;
      return surahData;
    } catch (err) {
      console.error("Error loading surah:", err);
      return null;
    }
  }

  async getAyahTafsir(surahId, ayahNumberInSurah) {
    const key = `${surahId}:${ayahNumberInSurah}`;
    if (this._tafsirCache[key]) return this._tafsirCache[key];

    try {
      const res = await fetch(`${this.quranBase}/ayah/${surahId}:${ayahNumberInSurah}/ar.muyassar`);
      if (!res.ok) throw new Error('Tafsir fetch error');
      const data = await res.json();
      if (data && data.data && data.data.text) {
        this._tafsirCache[key] = data.data.text;
        return data.data.text;
      }
      return 'تفسير الميسر غير متوفر لهذه الآية حالياً.';
    } catch (e) {
      console.warn("Tafsir error:", e);
      return 'تعذر تحميل التفسير. يرجى التحقق من اتصالك بالإنترنت.';
    }
  }

  async getReciters() {
    if (window.QURAN_DATA && window.QURAN_DATA.RECITERS) {
      return window.QURAN_DATA.RECITERS;
    }
    return [
      { id: 'ar.alafasy', name: 'مشاري راشد العفاسي', englishName: 'Mishary Rashid Alafasy' },
      { id: 'ar.abdulbasitmurattal', name: 'عبد الباسط عبد الصمد (مرتل)', englishName: 'AbdulBaset AbdulSamad (Murattal)' },
      { id: 'ar.husary', name: 'محمود خليل الحصري', englishName: 'Mahmoud Khalil Al-Husary' },
      { id: 'ar.minshawi', name: 'محمد صديق المنشاوي', englishName: 'Mohamed Siddiq Al-Minshawi' }
    ];
  }

  // --- AZKAR API ---
  async getAzkar() {
    if (this._azkarCache) return this._azkarCache;

    const saved = localStorage.getItem('noor_azkar_cache');
    if (saved) {
      try {
        this._azkarCache = JSON.parse(saved);
        return this._azkarCache;
      } catch (e) {}
    }

    try {
      const res = await fetch('https://raw.githubusercontent.com/nawafalqari/azkar-api/56df51279ab6eb86dc2f6202c7de26c8948331c1/azkar.json');
      if (!res.ok) throw new Error('Azkar network error');
      const data = await res.json();
      this._azkarCache = data;
      try {
        localStorage.setItem('noor_azkar_cache', JSON.stringify(data));
      } catch (e) {}
      return this._azkarCache;
    } catch (err) {
      console.warn("Failed to fetch Azkar, using offline backup:", err);
      // Essential offline fallback
      this._azkarCache = this._getOfflineAzkar();
      return this._azkarCache;
    }
  }

  _getOfflineAzkar() {
    return {
      'أذكار الصباح': [
        { zekr: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ.', count: 1 },
        { zekr: 'اللَّهُمَّ أَنْتَ رَبِّي لاَ إِلَهَ إِلاَّ أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لاَ يَغْفِرُ الذُّنُوبَ إِلاَّ أَنْتَ.', count: 1 },
        { zekr: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ: عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ.', count: 3 },
        { zekr: 'بِسْمِ اللَّهِ الَّذِي لاَ يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الأَرْضِ وَلاَ فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ.', count: 3 },
        { zekr: 'رَضِيتُ بِاللَّهِ رَبّاً، وَبِالإِسْلاَمِ دِيناً، وَبِمُحَمَّدٍ صلى الله عليه وسلم نَبِيّاً.', count: 3 }
      ],
      'أذكار المساء': [
        { zekr: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ.', count: 1 },
        { zekr: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ.', count: 3 },
        { zekr: 'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ وَإِلَيْكَ الْمَصِيرُ.', count: 1 },
        { zekr: 'حَسْبِيَ اللَّهُ لاَ إِلَهَ إِلاَّ هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ.', count: 7 }
      ],
      'أذكار بعد الصلاة': [
        { zekr: 'أَسْتَغْفِرُ اللَّهَ، أَسْتَغْفِرُ اللَّهَ، أَسْتَغْفِرُ اللَّهَ. اللَّهُمَّ أَنْتَ السَّلاَمُ وَمِنْكَ السَّلاَمُ، تَبَارَكْتَ يَا ذَا الْجَلاَلِ وَالإِكْرَامِ.', count: 1 },
        { zekr: 'سُبْحَانَ اللَّهِ (٣٣)، الْحَمْدُ لِلَّهِ (٣٣)، اللَّهُ أَكْبَرُ (٣٣)، لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ (١).', count: 1 },
        { zekr: 'اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ، وَشُكْرِكَ، وَحُسْنِ عِبَادَتِكَ.', count: 1 }
      ],
      'أذكار النوم': [
        { zekr: 'بِاسْمِكَ رَبِّي وَضَعْتُ جَنْبِي، وَبِكَ أَرْفَعُهُ، فَإِن أَمْسَكْتَ نَفْسِي فَارْحَمْهَا، وَإِنْ أَرْسَلْتَهَا فَاحْفَظْهَا بِمَا تَحْفَظُ بِهِ عِبَادَكَ الصَّالِحِينَ.', count: 1 },
        { zekr: 'اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ.', count: 3 }
      ],
      'أدعية قرآنية': [
        { zekr: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ.', count: 3 },
        { zekr: 'رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِنْ لَدُنْكَ رَحْمَةً إِنَّكَ أَنْتَ الْوَهَّابُ.', count: 1 },
        { zekr: 'رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي وَاحْلُلْ عُقْدَةً مِنْ لِسَانِي يَفْقَهُوا قَوْلِي.', count: 1 },
        { zekr: 'رَبِّ زِدْنِي عِلْمًا.', count: 3 }
      ]
    };
  }
}

const api = new NoorAPI();
window.NoorAPI = api;
