// api.js

class NoorAPI {
  constructor() {
    this.baseUrl = 'https://api.aladhan.com/v1';
    // Use a clean, public mp3 for Adhan (Makkah Adhan example)
    this.adhanUrl = 'https://download.quranicaudio.com/adhan/makkah.mp3';
  }

  /**
   * Fetch timings by coordinates
   * @param {number} lat 
   * @param {number} lng 
   * @param {number} method - Calculation method ID
   * @param {number} school - 0 for Shafi/Hanbali/Maliki, 1 for Hanafi
   * @returns {Promise<Object>} Timings object
   */
  async getTimingsByCoordinates(lat, lng, method, school) {
    const d = new Date();
    const dateStr = `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;

    try {
      // Adding iso8601=true to get dates we can easily parse
      const url = `${this.baseUrl}/timings/${dateStr}?latitude=${lat}&longitude=${lng}&method=${method}&school=${school}&iso8601=true`;
      const response = await fetch(url);

      if (!response.ok) throw new Error('API fetching failed');
      const data = await response.json();

      return data.data;
    } catch (error) {
      console.error("Error fetching prayer times: ", error);
      return null;
    }
  }

  /**
   * Check if the current Hijri month is Ramadan
   * @param {Object} data - The data object from Aladhan API response
   * @returns {boolean}
   */
  isRamadan(data) {
    if (!data || !data.date || !data.date.hijri) return false;
    // Hijri month 9 is Ramadan
    return data.date.hijri.month.number === 9;
  }

  // --- QURAN API ---
  async getSurahs() {
    try {
      const res = await fetch('https://api.alquran.cloud/v1/surah');
      if (!res.ok) throw new Error('Failed to fetch surahs');
      const data = await res.json();
      return data.data;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  async getSurah(id, edition = 'quran-uthmani') {
    try {
      const res = await fetch(`https://api.alquran.cloud/v1/surah/${id}/${edition}`);
      if (!res.ok) throw new Error('Failed to fetch surah content');
      const data = await res.json();
      return data.data;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  async getReciters() {
    try {
      // Fetch available audio editions (format: audio)
      const res = await fetch('https://api.alquran.cloud/v1/edition/format/audio');
      if (!res.ok) throw new Error('Failed to fetch reciters');
      const data = await res.json();
      // Filter for Arabic only to keep it clean, and sort
      return data.data.filter(e => e.language === 'ar').sort((a, b) => a.englishName.localeCompare(b.englishName));
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  // --- AZKAR API ---
  async getAzkar() {
    try {
      // Using a popular public raw JSON for Azkar
      const res = await fetch('https://raw.githubusercontent.com/nawafalqari/azkar-api/56df51279ab6eb86dc2f6202c7de26c8948331c1/azkar.json');
      if (!res.ok) throw new Error('Failed to fetch azkar');
      const data = await res.json();
      return data;
    } catch (error) {
      console.error(error);
      return null;
    }
  }
}

const api = new NoorAPI();
window.NoorAPI = api;
