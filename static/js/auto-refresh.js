// Auto-Refresh für periodische Updates
class AutoRefresh {
    constructor(timeTracker) {
        this.timeTracker = timeTracker;
        this.intervals = new Map();
        this.isActive = true;
        
        this.startAutoRefresh();
        this.setupVisibilityHandling();
    }
    
    startAutoRefresh() {
        // Alle 2 Minuten Daten aktualisieren (falls WebSocket nicht funktioniert)
        this.intervals.set('data', setInterval(() => {
            if (this.isActive && document.visibilityState === 'visible') {
                this.timeTracker.loadWeekData();
            }
        }, 120000));
        
        // Alle 10 Minuten Projekte neu laden
        this.intervals.set('projects', setInterval(() => {
            if (this.isActive && document.visibilityState === 'visible') {
                this.timeTracker.loadProjects();
            }
        }, 600000));
        
        // Bei laufendem Timer: Alle Sekunde Timer-Display aktualisieren
        // (wird bereits in TimeTracker gemacht, hier nur als Fallback)
        this.intervals.set('timer', setInterval(() => {
            if (this.timeTracker.isRunning && this.timeTracker.startTime) {
                const elapsed = new Date() - this.timeTracker.startTime;
                this.timeTracker.updateTimerDisplay(elapsed);
            }
        }, 1000));
    }
    
    setupVisibilityHandling() {
        // Wenn Tab wieder sichtbar wird, sofort aktualisieren
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.isActive) {
                console.log('Tab wieder sichtbar - aktualisiere Daten...');
                this.timeTracker.loadWeekData();
                this.timeTracker.loadProjects();
                this.timeTracker.checkRunningTimer();
            }
        });
        
        // Beim Fokus auf das Fenster auch aktualisieren
        window.addEventListener('focus', () => {
            if (this.isActive) {
                this.timeTracker.loadWeekData();
            }
        });
    }
    
    pause() {
        this.isActive = false;
        console.log('Auto-Refresh pausiert');
    }
    
    resume() {
        this.isActive = true;
        console.log('Auto-Refresh wieder aktiv');
        // Sofort aktualisieren beim Wiederaktivieren
        this.timeTracker.loadWeekData();
    }
    
    stop() {
        this.isActive = false;
        this.intervals.forEach((interval, name) => {
            clearInterval(interval);
            console.log(`${name} Auto-Refresh gestoppt`);
        });
        this.intervals.clear();
    }
}

// Auto-Refresh wird in app.js initialisiert