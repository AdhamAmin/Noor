// engine.js

class NoorEngine {
    constructor() {
        this.timerElement = document.getElementById('countdown-timer');
        this.circleElement = document.querySelector('.progress-ring__circle');

        this.circumference = 2 * Math.PI * 90; // r=90
        if (this.circleElement) {
            this.circleElement.style.strokeDashoffset = this.circumference;
        }

        this.timerInterval = null;
        this.currentGoalTime = null;
        this.onZeroCallback = null;
        this.totalDurationSeconds = null;
    }

    /**
     * Start the countdown towards a target Date object
     * @param {Date} targetTime 
     * @param {number} totalSecondsForProgress - Initial range to calculate percentage against, e.g. time between prev prayer and this prayer
     * @param {Function} onZero 
     */
    start(targetTime, totalSecondsForProgress, onZero) {
        if (this.timerInterval) clearInterval(this.timerInterval);

        this.currentGoalTime = targetTime;
        this.onZeroCallback = onZero;
        this.totalDurationSeconds = totalSecondsForProgress || 3600; // fallback to 1h for UI progression

        this.timerElement.classList.remove('flash-text');
        this.tick(); // run initial tick immediately
        this.timerInterval = setInterval(() => this.tick(), 1000);
    }

    stop() {
        if (this.timerInterval) clearInterval(this.timerInterval);
    }

    tick() {
        const now = new Date();
        const diffMs = this.currentGoalTime - now;

        if (diffMs <= 0) {
            this.stop();
            this.timerElement.textContent = "00:00:00";
            this.setProgress(100);

            if (this.onZeroCallback) {
                this.onZeroCallback();
            }
            return;
        }

        // Ten seconds warning behavior
        if (diffMs <= 10000 && !this.timerElement.classList.contains('flash-text')) {
            this.timerElement.classList.add('flash-text');
        }

        // Update String
        const totalSecs = Math.floor(diffMs / 1000);
        const h = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
        const m = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
        const s = String(totalSecs % 60).padStart(2, '0');

        this.timerElement.textContent = `${h}:${m}:${s}`;

        // Update Progress Ring
        const percentage = ((this.totalDurationSeconds - totalSecs) / this.totalDurationSeconds) * 100;
        this.setProgress(Math.max(0, Math.min(percentage, 100)));
    }

    setProgress(percent) {
        // Always query live in case the element was re-rendered or toggled
        const circle = document.querySelector('.progress-ring__circle');
        if (!circle) return;
        const offset = this.circumference - (percent / 100) * this.circumference;
        circle.style.strokeDasharray = this.circumference;
        circle.style.strokeDashoffset = offset;
    }
}

const engine = new NoorEngine();
window.NoorEngine = engine;
