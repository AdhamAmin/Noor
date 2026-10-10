// engine.js - Noor Prayer Countdown Engine

class NoorEngine {
    constructor() {
        this.timerElement = null;
        this.circleElement = null;
        this.timerInterval = null;
        this.currentGoalTime = null;
        this.onZeroCallback = null;
        this.totalDurationSeconds = null;
        this.circumference = 2 * Math.PI * 58;
    }

    getElements() {
        if (!this.timerElement) {
            this.timerElement = document.getElementById('countdown-timer');
        }
        if (!this.circleElement) {
            this.circleElement = document.getElementById('countdown-progress-circle') ||
                                 document.querySelector('.progress-ring-circle') ||
                                 document.querySelector('.progress-ring__circle');
        }
    }

    /**
     * Start the countdown towards a target Date object
     * @param {Date} targetTime 
     * @param {number} totalSecondsForProgress - Total time window in seconds between previous prayer and this prayer
     * @param {Function} onZero 
     */
    start(targetTime, totalSecondsForProgress, onZero) {
        if (this.timerInterval) clearInterval(this.timerInterval);

        this.getElements();
        this.currentGoalTime = targetTime;
        this.onZeroCallback = onZero;
        this.totalDurationSeconds = totalSecondsForProgress || 3600;

        if (this.timerElement) {
            this.timerElement.classList.remove('flash-text');
        }

        this.tick(); // run initial tick immediately
        this.timerInterval = setInterval(() => this.tick(), 1000);
    }

    stop() {
        if (this.timerInterval) clearInterval(this.timerInterval);
    }

    tick() {
        if (!this.currentGoalTime) return;
        this.getElements();

        const now = new Date();
        const diffMs = this.currentGoalTime.getTime() - now.getTime();

        if (diffMs <= 0) {
            this.stop();
            if (this.timerElement) this.timerElement.textContent = "00:00:00";
            this.setProgress(100);

            if (this.onZeroCallback) {
                this.onZeroCallback();
            }
            return;
        }

        // Ten seconds warning behavior
        if (diffMs <= 10000 && this.timerElement && !this.timerElement.classList.contains('flash-text')) {
            this.timerElement.classList.add('flash-text');
        }

        // Update Digital Countdown String
        const totalSecs = Math.max(0, Math.floor(diffMs / 1000));
        const h = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
        const m = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
        const s = String(totalSecs % 60).padStart(2, '0');

        if (this.timerElement) {
            this.timerElement.textContent = `${h}:${m}:${s}`;
        }

        // Update Circular Progress Ring (Filling up from 0% to 100% as time remaining reaches 0)
        const duration = Math.max(1, this.totalDurationSeconds || (totalSecs + 1));
        const elapsedSecs = Math.max(0, duration - totalSecs);
        const percentage = Math.min(100, Math.max(0, (elapsedSecs / duration) * 100));

        this.setProgress(percentage);
    }

    setProgress(percent) {
        const circle = document.getElementById('countdown-progress-circle') ||
                       document.querySelector('.progress-ring-circle') ||
                       document.querySelector('.progress-ring__circle');
        if (!circle) return;

        const radius = parseFloat(circle.getAttribute('r')) || 58;
        const circumference = 2 * Math.PI * radius;

        const offset = circumference - (percent / 100) * circumference;
        circle.style.strokeDasharray = `${circumference}`;
        circle.style.strokeDashoffset = `${offset}`;
    }
}

const engine = new NoorEngine();
window.NoorEngine = engine;
