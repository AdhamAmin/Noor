// api.js

class NoorAPI {
  constructor() {
    this.baseUrl = 'https://api.aladhan.com/v1';
    this.adhanUrl = 'https://islamdownload.net/wp-content/uploads-by-id/123801/Adzan-Misyari-Rasyid.mp3';

    // In-memory caches — survive the page session
    this._surahCache = {};     // key: `${id}:${edition}`
    this._surahListCache = null;
    this._recitersCache = null;
    this._azkarCache = null;
    this._timingsCache = {};   // key: `${lat},${lng},${method},${school}`
  }

  async getTimingsByCoordinates(lat, lng, method, school) {
    const d = new Date();
    const dateStr = `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;
    const key = `${lat},${lng},${method},${school},${dateStr}`;
    if (this._timingsCache[key]) return this._timingsCache[key];

    try {
      const url = `${this.baseUrl}/timings/${dateStr}?latitude=${lat}&longitude=${lng}&method=${method}&school=${school}&iso8601=true`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('API fetching failed');
      const data = await response.json();
      this._timingsCache[key] = data.data;
      return data.data;
    } catch (error) {
      console.error("Error fetching prayer times: ", error);
      return null;
    }
  }

  isRamadan(data) {
    if (!data || !data.date || !data.date.hijri) return false;
    return data.date.hijri.month.number === 9;
  }

  // --- QURAN API ---
  async getSurahs() {
    if (this._surahListCache) return this._surahListCache;
    try {
      const res = await fetch('https://api.alquran.cloud/v1/surah');
      if (!res.ok) throw new Error('Failed to fetch surahs');
      const data = await res.json();
      this._surahListCache = data.data;
      return this._surahListCache;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  async getSurah(id, audioEdition = 'ar.alafasy') {
    const cacheKey = `${id}:${audioEdition}`;
    if (this._surahCache[cacheKey]) return this._surahCache[cacheKey];

    try {
      // Fetch text AND audio in parallel
      const [textRes, audioRes] = await Promise.all([
        fetch(`https://api.alquran.cloud/v1/surah/${id}/quran-uthmani`),
        fetch(`https://api.alquran.cloud/v1/surah/${id}/${audioEdition}`).catch(() => null)
      ]);

      if (!textRes.ok) throw new Error('Failed to fetch surah text');
      const textData = await textRes.json();
      const surah = textData.data;

      // Merge audio if available
      if (audioRes && audioRes.ok) {
        const audioData = await audioRes.json();
        const audioAyahs = audioData.data.ayahs;
        surah.ayahs = surah.ayahs.map((ayah, idx) => ({
          ...ayah,
          audio: audioAyahs[idx] ? audioAyahs[idx].audio : null,
        }));
      }

      this._surahCache[cacheKey] = surah;
      return surah;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  async getReciters() {
    if (this._recitersCache) return this._recitersCache;
    try {
      const res = await fetch('https://api.alquran.cloud/v1/edition/format/audio');
      if (!res.ok) throw new Error('Failed to fetch reciters');
      const data = await res.json();
      this._recitersCache = data.data
        .filter(e => e.language === 'ar')
        .sort((a, b) => a.englishName.localeCompare(b.englishName));
      return this._recitersCache;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  // --- AZKAR API ---
  async getAzkar() {
    if (this._azkarCache) return this._azkarCache;
    try {
      const res = await fetch('https://raw.githubusercontent.com/nawafalqari/azkar-api/56df51279ab6eb86dc2f6202c7de26c8948331c1/azkar.json');
      if (!res.ok) throw new Error('Failed to fetch azkar');
      const data = await res.json();
      this._azkarCache = data;
      return this._azkarCache;
    } catch (error) {
      console.error(error);
      return null;
    }
  }
}

const api = new NoorAPI();
window.NoorAPI = api;
