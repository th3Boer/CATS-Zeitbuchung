class TimeTracker {
    constructor() {
        this.timerInterval = null;
        this.startTime = null;
        this.isRunning = false;
        this.currentYear = new Date().getFullYear();
        this.currentWeek = this.getWeekNumber(new Date());
        
        this.initializeElements();
        this.bindEvents();
        this.setupWebSocketListeners();
        this.loadProjects();
        this.updateWeekDisplay();
        this.loadWeekData();
        this.checkRunningTimer();
        
        // Auto-Refresh initialisieren
        this.autoRefresh = new AutoRefresh(this);
    }
    
    initializeElements() {
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.projectSelect = document.getElementById('projectSelect');
        this.descriptionInput = document.getElementById('description');
        this.timerDisplay = document.getElementById('timerDisplay');
        this.notification = document.getElementById('notification');
        this.entriesList = document.getElementById('entriesList');
        this.totalHours = document.getElementById('totalHours');
        this.projectCount = document.getElementById('projectCount');
        this.projectStats = document.getElementById('projectStats');
        
        this.weekDisplay = document.getElementById('weekDisplay');
        this.dateRange = document.getElementById('dateRange');
        this.prevWeekBtn = document.getElementById('prevWeek');
        this.nextWeekBtn = document.getElementById('nextWeek');
        this.weekCalendar = document.getElementById('weekCalendar');
        
        this.addProjectBtn = document.getElementById('addProjectBtn');
        this.projectModal = document.getElementById('projectModal');
        this.newProjectName = document.getElementById('newProjectName');
        this.newProjectColor = document.getElementById('newProjectColor');
        this.colorPreview = document.getElementById('colorPreview');
        this.saveProjectBtn = document.getElementById('saveProject');
        this.cancelProjectBtn = document.getElementById('cancelProject');
        
        this.manualModal = document.getElementById('manualModal');
        this.manualForm = document.getElementById('manualForm');
        this.manualProjectSelect = document.getElementById('manualProjectSelect');
        this.manualDescription = document.getElementById('manualDescription');
        this.manualDate = document.getElementById('manualDate');
        this.manualStartTime = document.getElementById('manualStartTime');
        this.manualEndTime = document.getElementById('manualEndTime');
        this.cancelManualBtn = document.getElementById('cancelManual');
        this.manualModalTitle = document.getElementById('manualModalTitle');
        this.saveManualBtn = document.getElementById('saveManualBtn');
        
        this.dayFilterButtons = document.querySelectorAll('.day-btn');
        this.currentDayFilter = '';
        
        this.projectsModal = document.getElementById('projectsModal');
        this.projectsList = document.getElementById('projectsList');
        this.closeProjectsBtn = document.getElementById('closeProjectsBtn');
        
        this.currentEditingEntryId = null;
        this.dragIndicator = null;
        this.draggedElement = null;
        this.currentDragData = null;
        this.longClickTimer = null;
        this.longClickStartPos = null;
        this.dragIndicatorCleanupTimer = null;
    }
    
    bindEvents() {
        this.startBtn.addEventListener('click', () => this.startTimer());
        this.stopBtn.addEventListener('click', () => this.stopTimer());
        
        this.prevWeekBtn.addEventListener('click', () => this.changeWeek(-1));
        this.nextWeekBtn.addEventListener('click', () => this.changeWeek(1));
        
        this.addProjectBtn.addEventListener('click', () => this.showProjectModal());
        this.saveProjectBtn.addEventListener('click', () => this.saveProject());
        this.cancelProjectBtn.addEventListener('click', () => this.hideProjectModal());
        this.newProjectColor.addEventListener('input', () => this.updateColorPreview());
        
        this.manualForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addManualEntry();
        });
        this.cancelManualBtn.addEventListener('click', () => this.hideManualModal());
        
        this.manualDate.value = new Date().toISOString().split('T')[0];
        
        // Add event listeners to day filter buttons
        this.dayFilterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active class from all buttons
                this.dayFilterButtons.forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                e.target.classList.add('active');
                // Update current filter
                this.currentDayFilter = e.target.dataset.day;
                // Filter entries
                this.filterEntries();
            });
        });
        
        this.closeProjectsBtn.addEventListener('click', () => this.hideProjectsModal());
        
        // Global drag indicator cleanup events
        window.addEventListener('blur', () => this.forceCleanupDragIndicators());
        window.addEventListener('beforeunload', () => this.forceCleanupDragIndicators());
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.forceCleanupDragIndicators();
            }
        });
        
        // Handle escape key to cancel drag
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.forceCleanupDragIndicators();
            }
        });
        
        // MutationObserver to watch for orphaned drag indicators
        this.setupDragIndicatorWatcher();
        
        // Prevent zoom gestures
        this.setupZoomPrevention();
        
        // Close modals on outside click
        this.projectModal.addEventListener('click', (e) => {
            if (e.target === this.projectModal) this.hideProjectModal();
        });
        this.manualModal.addEventListener('click', (e) => {
            if (e.target === this.manualModal) this.hideManualModal();
        });
        this.projectsModal.addEventListener('click', (e) => {
            if (e.target === this.projectsModal) this.hideProjectsModal();
        });
    }
    
    setupWebSocketListeners() {
        // Timer Events
        window.wsManager.on('timer_started', (data) => {
            this.handleTimerStarted(data);
            // Force reload entries to update status with delay
            setTimeout(() => {
                this.loadEntries();
            }, 100);
        });
        
        window.wsManager.on('timer_stopped', (data) => {
            this.handleTimerStopped(data);
            // Force reload entries to update status with delay
            setTimeout(() => {
                this.loadEntries();
            }, 200);
        });
        
        // Entry Events
        window.wsManager.on('entry_created', (data) => {
            this.showNotification(`Neuer Eintrag: ${data.project}`, 'success');
            this.loadEntries();
            this.loadWeekData();
        });
        
        window.wsManager.on('entry_updated', (data) => {
            this.showNotification(`Eintrag aktualisiert: ${data.project}`, 'success');
            this.loadEntries();
            this.loadWeekData();
        });
        
        window.wsManager.on('entry_deleted', (data) => {
            this.showNotification('Eintrag gelöscht', 'success');
            this.loadEntries();
            this.loadWeekData();
        });
        
        // Project Events
        window.wsManager.on('project_created', (data) => {
            this.showNotification(`Neues Projekt: ${data.name}`, 'success');
            this.loadProjects().then(() => {
                this.loadProjectsForEdit(); // Refresh editing modal if open
            });
        });
        
        window.wsManager.on('project_updated', (data) => {
            console.log('WebSocket project updated:', data);
            const message = data.updated_entries > 0 
                ? `Projekt "${data.name}" aktualisiert (${data.updated_entries} Einträge)`
                : `Projekt "${data.name}" aktualisiert`;
            this.showNotification(message, 'success');
            // Force complete reload of all data
            Promise.all([
                this.loadProjects(), // Reload project data
                this.loadEntries()   // Reload entries with updated project names
            ]).then(() => {
                this.updateCalendarWithData(); // Refresh calendar
                this.filterEntries(); // Refresh entry list
                if (this.projectsModal.classList.contains('show')) {
                    this.loadProjectsForEdit(); // Refresh editing modal if open
                }
            });
        });
        
        window.wsManager.on('project_deleted', (data) => {
            this.showNotification('Projekt deaktiviert', 'success');
            this.loadProjects().then(() => {
                this.loadWeekData(); // Refresh calendar
                this.loadProjectsForEdit(); // Refresh editing modal if open
            });
        });
    }
    
    handleTimerStarted(data) {
        // Update UI only if this instance didn't start the timer
        if (!this.isRunning) {
            this.isRunning = true;
            this.startTime = new Date(data.start_time);
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.projectSelect.disabled = true;
            this.descriptionInput.disabled = true;
            this.projectSelect.value = data.project;
            this.descriptionInput.value = data.description || '';
            
            this.startTimerDisplay();
            this.showNotification('Timer wurde gestartet', 'success');
            // Immediate update
            setTimeout(() => {
                this.loadEntries();
            }, 100);
        }
    }
    
    handleTimerStopped(data) {
        // Force stop timer regardless of current state
        this.isRunning = false;
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.projectSelect.disabled = false;
        this.descriptionInput.disabled = false;
        
        this.stopTimerDisplay();
        this.showNotification(`Timer gestoppt: ${Math.round(data.duration)} Min`, 'success');
        
        this.projectSelect.value = '';
        this.descriptionInput.value = '';
        
        // Immediate update
        setTimeout(() => {
            this.loadEntries();
            this.loadWeekData();
        }, 100);
    }
    
    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }
    
    getDateOfWeek(year, week) {
        const jan4 = new Date(year, 0, 4);
        const week1Monday = new Date(jan4.getTime() - (jan4.getDay() - 1) * 24 * 60 * 60 * 1000);
        return new Date(week1Monday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
    }
    
    roundToQuarterHour(hour) {
        const totalMinutes = hour * 60;
        const roundedMinutes = Math.round(totalMinutes / 15) * 15;
        return roundedMinutes / 60;
    }
    
    formatTimeFromHour(hour) {
        const hours = Math.floor(hour);
        const minutes = Math.round((hour % 1) * 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    
    createDragIndicator() {
        if (!this.dragIndicator) {
            this.dragIndicator = document.createElement('div');
            this.dragIndicator.className = 'drag-time-indicator';
            this.dragIndicator.style.position = 'fixed';
            this.dragIndicator.style.background = 'rgba(0, 0, 0, 0.9)';
            this.dragIndicator.style.color = 'white';
            this.dragIndicator.style.padding = '8px 12px';
            this.dragIndicator.style.borderRadius = '6px';
            this.dragIndicator.style.fontSize = '12px';
            this.dragIndicator.style.fontWeight = 'bold';
            this.dragIndicator.style.zIndex = '999999';
            this.dragIndicator.style.pointerEvents = 'none';
            this.dragIndicator.style.whiteSpace = 'nowrap';
            this.dragIndicator.style.display = 'none';
            document.body.appendChild(this.dragIndicator);
        }
        return this.dragIndicator;
    }
    
    hideDragIndicator() {
        if (this.dragIndicator) {
            this.dragIndicator.style.display = 'none';
            // Ensure indicator is properly removed from DOM
            if (this.dragIndicator.parentNode) {
                this.dragIndicator.parentNode.removeChild(this.dragIndicator);
            }
            this.dragIndicator = null;
        }
        // Just remove any orphaned drag indicators without resetting drag state
        document.querySelectorAll('.drag-time-indicator').forEach(indicator => {
            if (indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        });
    }
    
    forceCleanupDragIndicators() {
        // Clear any existing cleanup timer
        if (this.dragIndicatorCleanupTimer) {
            clearTimeout(this.dragIndicatorCleanupTimer);
            this.dragIndicatorCleanupTimer = null;
        }
        
        // Remove any remaining drag indicators from the DOM
        document.querySelectorAll('.drag-time-indicator').forEach(indicator => {
            if (indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        });
        
        // Only reset drag state if no active drag operation
        const isDragActive = document.querySelector('.dragging') !== null;
        if (!isDragActive) {
            // Remove drop target highlights only if no active drag
            document.querySelectorAll('.drop-target').forEach(el => {
                el.classList.remove('drop-target');
            });
            
            // Remove dragging class from any elements
            document.querySelectorAll('.dragging').forEach(el => {
                el.classList.remove('dragging');
            });
            
            // Reset drag state only if no active drag
            this.draggedElement = null;
            this.currentDragData = null;
            this.dragIndicator = null;
        }
    }
    
    showDragIndicator(x, y, startTime, endTime, draggedElement) {
        // Clear any existing cleanup timer when showing indicator
        if (this.dragIndicatorCleanupTimer) {
            clearTimeout(this.dragIndicatorCleanupTimer);
            this.dragIndicatorCleanupTimer = null;
        }
        
        const indicator = this.createDragIndicator();
        
        // Remove from current parent if exists
        if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
        }
        
        // Set all styles directly
        indicator.style.cssText = `
            position: fixed !important;
            display: block !important;
            visibility: visible !important;
            z-index: 2147483647 !important;
            background: rgba(0, 0, 0, 0.9) !important;
            color: white !important;
            padding: 8px 12px !important;
            border-radius: 6px !important;
            font-size: 12px !important;
            font-weight: bold !important;
            pointer-events: none !important;
            white-space: nowrap !important;
            left: ${x - 50}px !important;
            top: ${y - 60}px !important;
            transform: translate(10px, -50%) !important;
        `;
        
        const timeText = `${this.formatTimeFromHour(startTime)} - ${this.formatTimeFromHour(endTime)}`;
        indicator.textContent = timeText;
        
        // Add timestamp for cleanup tracking
        indicator.dataset.created = Date.now().toString();
        
        // Append to body as last element
        document.body.appendChild(indicator);
        
        // Force reflow to ensure it's rendered
        indicator.offsetHeight;
        
        // Set a safety timeout to automatically cleanup after 30 seconds
        this.dragIndicatorCleanupTimer = setTimeout(() => {
            this.forceCleanupDragIndicators();
        }, 30000);
    }
    
    setupDragIndicatorWatcher() {
        // Periodic cleanup check every 30 seconds as fallback - much less aggressive
        setInterval(() => {
            const indicators = document.querySelectorAll('.drag-time-indicator');
            // Only cleanup if no drag is active AND indicators have been there for a while
            if (indicators.length > 0 && !this.currentDragData && !this.draggedElement) {
                // Add a timestamp check to avoid removing recently created indicators
                let shouldCleanup = true;
                indicators.forEach(indicator => {
                    if (indicator.dataset.created && Date.now() - parseInt(indicator.dataset.created) < 5000) {
                        shouldCleanup = false;
                    }
                });
                if (shouldCleanup) {
                    this.forceCleanupDragIndicators();
                }
            }
        }, 30000); // Every 30 seconds instead of 5
    }
    
    setupZoomPrevention() {
        // Prevent double-tap zoom
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = new Date().getTime();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
        
        // Prevent wheel zoom (Ctrl+scroll)
        document.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
            }
        }, { passive: false });
        
        // Prevent keyboard zoom shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '0')) {
                e.preventDefault();
            }
        });
    }
    
    addLongClickToTimeline(timeline, dayDate) {
        let longClickTimer = null;
        let startPos = null;
        
        // Mouse events
        timeline.addEventListener('mousedown', (e) => {
            // Only handle left mouse button and ignore if clicking on time-block
            if (e.button !== 0 || e.target.classList.contains('time-block')) {
                return;
            }
            
            startPos = { x: e.clientX, y: e.clientY };
            longClickTimer = setTimeout(() => {
                this.createEntryAtPosition(timeline, dayDate, e.clientY);
            }, 800); // 800ms long click
        });
        
        timeline.addEventListener('mouseup', (e) => {
            if (longClickTimer) {
                clearTimeout(longClickTimer);
                longClickTimer = null;
            }
        });
        
        timeline.addEventListener('mousemove', (e) => {
            if (longClickTimer && startPos) {
                // Cancel if mouse moved too much
                const distance = Math.sqrt(
                    Math.pow(e.clientX - startPos.x, 2) + 
                    Math.pow(e.clientY - startPos.y, 2)
                );
                if (distance > 10) {
                    clearTimeout(longClickTimer);
                    longClickTimer = null;
                }
            }
        });
        
        timeline.addEventListener('mouseleave', (e) => {
            if (longClickTimer) {
                clearTimeout(longClickTimer);
                longClickTimer = null;
            }
        });
        
        // Touch events
        timeline.addEventListener('touchstart', (e) => {
            // Ignore if touching time-block
            if (e.target.classList.contains('time-block')) {
                return;
            }
            
            const touch = e.touches[0];
            startPos = { x: touch.clientX, y: touch.clientY };
            longClickTimer = setTimeout(() => {
                this.createEntryAtPosition(timeline, dayDate, touch.clientY);
            }, 800); // 800ms long click
        });
        
        timeline.addEventListener('touchend', (e) => {
            if (longClickTimer) {
                clearTimeout(longClickTimer);
                longClickTimer = null;
            }
            // Cleanup drag indicators on touch end
            this.forceCleanupDragIndicators();
        });
        
        timeline.addEventListener('touchmove', (e) => {
            if (longClickTimer && startPos) {
                const touch = e.touches[0];
                // Cancel if finger moved too much
                const distance = Math.sqrt(
                    Math.pow(touch.clientX - startPos.x, 2) + 
                    Math.pow(touch.clientY - startPos.y, 2)
                );
                if (distance > 10) {
                    clearTimeout(longClickTimer);
                    longClickTimer = null;
                }
            }
        });
        
        // Touch cancel cleanup
        timeline.addEventListener('touchcancel', (e) => {
            if (longClickTimer) {
                clearTimeout(longClickTimer);
                longClickTimer = null;
            }
            this.forceCleanupDragIndicators();
        });
    }
    
    createEntryAtPosition(timeline, dayDate, clickY) {
        const timelineRect = timeline.getBoundingClientRect();
        const relativeY = clickY - timelineRect.top;
        const timelineHeight = timelineRect.height;
        
        // Calculate time based on position (6:00 to 22:00)
        const hourPercent = relativeY / timelineHeight;
        const clickHour = 6 + (hourPercent * 17); // 6-22 hours (17 slots)
        
        // Round to 15-minute intervals
        const roundedStartHour = this.roundToQuarterHour(clickHour);
        const startHour = Math.max(6, Math.min(21.75, roundedStartHour)); // Ensure within bounds
        
        // Set default 1-hour duration
        const endHour = Math.min(22, startHour + 1);
        
        // Create start and end times
        const startDate = new Date(dayDate);
        startDate.setHours(Math.floor(startHour));
        startDate.setMinutes((startHour % 1) * 60);
        startDate.setSeconds(0);
        startDate.setMilliseconds(0);
        
        const endDate = new Date(dayDate);
        endDate.setHours(Math.floor(endHour));
        endDate.setMinutes((endHour % 1) * 60);
        endDate.setSeconds(0);
        endDate.setMilliseconds(0);
        
        // Pre-fill the manual entry form
        this.currentEditingEntryId = null;
        this.manualModalTitle.textContent = 'Neuer Eintrag';
        this.saveManualBtn.textContent = 'Speichern';
        
        this.manualDate.value = startDate.toISOString().split('T')[0];
        this.manualStartTime.value = startDate.toTimeString().slice(0, 5);
        this.manualEndTime.value = endDate.toTimeString().slice(0, 5);
        this.manualDescription.value = '';
        this.manualProjectSelect.value = '';
        
        this.manualModal.classList.add('show');
        
        // Don't auto-focus on mobile to prevent dropdown opening
        if (!/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            this.manualProjectSelect.focus();
        }
    }
    
    showProjectsModal() {
        this.loadProjectsForEdit();
        this.projectsModal.classList.add('show');
    }
    
    hideProjectsModal() {
        this.projectsModal.classList.remove('show');
    }
    
    async loadProjectsForEdit() {
        try {
            const response = await fetch('/api/projects');
            const projects = await response.json();
            
            this.projectsList.innerHTML = '';
            
            projects.forEach(project => {
                const projectDiv = document.createElement('div');
                projectDiv.className = 'project-edit-item';
                projectDiv.style.setProperty('--project-color', project.color);
                
                projectDiv.innerHTML = `
                    <input type="text" value="${project.name}" data-project-id="${project.id}" class="project-name-input">
                    <input type="color" value="${project.color}" data-project-id="${project.id}" class="project-color-input">
                    <button class="btn-delete" onclick="timeTracker.deleteProject(${project.id})">Löschen</button>
                `;
                
                // Add event listeners for real-time updates
                const nameInput = projectDiv.querySelector('.project-name-input');
                const colorInput = projectDiv.querySelector('.project-color-input');
                
                nameInput.addEventListener('blur', () => {
                    const newName = nameInput.value.trim();
                    if (newName && newName !== project.name) {
                        console.log('Updating project name:', project.name, '->', newName);
                        this.updateProject(project.id, newName, colorInput.value);
                    }
                });
                
                colorInput.addEventListener('change', () => {
                    projectDiv.style.setProperty('--project-color', colorInput.value);
                    if (colorInput.value !== project.color) {
                        console.log('Updating project color:', project.name, colorInput.value);
                        this.updateProject(project.id, nameInput.value.trim(), colorInput.value);
                    }
                });
                
                this.projectsList.appendChild(projectDiv);
            });
        } catch (error) {
            console.error('Fehler beim Laden der Projekte für Bearbeitung:', error);
        }
    }
    
    async updateProject(projectId, name, color) {
        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('color', color);
            
            console.log('Updating project:', projectId, 'to name:', name, 'color:', color);
            
            const response = await fetch(`/api/projects/${projectId}`, {
                method: 'PUT',
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Project update successful:', result);
                this.showNotification(result.message, 'success');
                
                // Force immediate refresh of all data
                await this.loadProjects(); // This updates projectsData
                await this.loadEntries(); // Reload entries to get updated project references  
                this.updateCalendarWithData(); // Refresh calendar
                this.filterEntries(); // Refresh entry list
                
                // Don't reload the editing modal to avoid losing user input
            } else {
                const error = await response.json();
                console.error('Project update failed:', error);
                this.showNotification(error.detail, 'error');
            }
        } catch (error) {
            console.error('Project update error:', error);
            this.showNotification('Fehler beim Aktualisieren', 'error');
        }
    }
    
    async deleteProject(projectId) {
        if (!confirm('Projekt wirklich löschen? Alle zugehörigen Einträge bleiben erhalten.')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/projects/${projectId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.showNotification('Projekt gelöscht', 'success');
                await this.loadProjects(); // Refresh dropdowns first
                this.loadProjectsForEdit(); // Refresh list
                this.updateCalendarWithData(); // Refresh calendar
                this.filterEntries(); // Refresh entry list
            } else {
                const error = await response.json();
                this.showNotification(error.detail, 'error');
            }
        } catch (error) {
            this.showNotification('Fehler beim Löschen', 'error');
        }
    }
    
    updateWeekDisplay() {
        this.weekDisplay.textContent = `KW ${this.currentWeek}`;
        
        const startOfWeek = this.getDateOfWeek(this.currentYear, this.currentWeek);
        const endOfWeek = new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000);
        
        const formatDate = (date) => {
            return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        };
        
        this.dateRange.textContent = `${formatDate(startOfWeek)} - ${formatDate(endOfWeek)}.${this.currentYear}`;
        this.renderWeekCalendar();
    }
    
    renderWeekCalendar() {
        const startOfWeek = this.getDateOfWeek(this.currentYear, this.currentWeek);
        const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
        const today = new Date();
        
        this.weekCalendar.innerHTML = '';
        
        // Add time sidebar with header
        const timeSidebar = document.createElement('div');
        timeSidebar.className = 'time-sidebar';
        
        // Add header space with Zeit label
        const headerSpace = document.createElement('div');
        headerSpace.className = 'time-header-space';
        headerSpace.textContent = 'Zeit';
        timeSidebar.appendChild(headerSpace);
        
        // Create time slots from 6:00 to 22:00 (every hour)
        const timeSlots = ['6:00', '7:00', '8:00', '9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];
        timeSlots.forEach(time => {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            timeSlot.textContent = time;
            timeSidebar.appendChild(timeSlot);
        });
        
        this.weekCalendar.appendChild(timeSidebar);
        
        // Add day columns (Monday to Friday only)
        for (let i = 0; i < 5; i++) {
            const currentDay = new Date(startOfWeek.getTime() + i * 24 * 60 * 60 * 1000);
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day';
            
            // Check if it's today
            if (currentDay.toDateString() === today.toDateString()) {
                dayDiv.classList.add('today');
            }
            
            dayDiv.innerHTML = `
                <div class="day-header">
                    <div class="day-name" id="day-name-${i}">${dayNames[i]}</div>
                    <div class="day-number" id="day-number-${i}">${currentDay.getDate().toString().padStart(2, '0')}.${(currentDay.getMonth() + 1).toString().padStart(2, '0')}</div>
                </div>
                <div class="day-timeline" id="day-timeline-${i}"></div>
            `;
            
            // Add long-click functionality to timeline
            const timeline = dayDiv.querySelector('.day-timeline');
            this.addLongClickToTimeline(timeline, currentDay);
            
            // Add drop zone events
            dayDiv.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                dayDiv.classList.add('drop-target');
                
                // Show time indicator with updated times
                if (this.currentDragData && this.currentDragData.duration_minutes && this.draggedElement) {
                    const timeline = dayDiv.querySelector('.day-timeline');
                    const timelineRect = timeline.getBoundingClientRect();
                    
                    // Calculate new time based on mouse position (using top edge as reference)
                    let dropY = e.clientY - timelineRect.top;
                    
                    // For touch devices, adjust for finger position
                    if (e.touches && e.touches.length > 0) {
                        dropY = e.touches[0].clientY - timelineRect.top;
                    }
                    
                    const timelineHeight = timelineRect.height;
                    const hourPercent = dropY / timelineHeight;
                    const newStartHour = 6 + (hourPercent * 17); // 6-22 hours (17 slots)
                    
                    // Round to 15-minute intervals
                    const roundedStartHour = this.roundToQuarterHour(newStartHour);
                    const durationHours = this.currentDragData.duration_minutes / 60;
                    
                    // Clamp to valid range
                    const clampedStartHour = Math.max(6, Math.min(22 - durationHours, roundedStartHour));
                    const clampedEndHour = clampedStartHour + durationHours;
                    
                    this.showDragIndicator(e.clientX, e.clientY, clampedStartHour, clampedEndHour, this.draggedElement);
                }
            });
            
            dayDiv.addEventListener('dragleave', (e) => {
                if (!dayDiv.contains(e.relatedTarget)) {
                    dayDiv.classList.remove('drop-target');
                    this.hideDragIndicator();
                }
            });
            
            dayDiv.addEventListener('drop', (e) => {
                e.preventDefault();
                dayDiv.classList.remove('drop-target');
                // Force hide drag indicator immediately
                this.hideDragIndicator();
                // Clear any remaining indicators
                document.querySelectorAll('.drag-time-indicator').forEach(indicator => {
                    if (indicator.parentNode) {
                        indicator.parentNode.removeChild(indicator);
                    }
                });
                
                if (this.currentDragData) {
                    const timeline = dayDiv.querySelector('.day-timeline');
                    const timelineRect = timeline.getBoundingClientRect();
                    
                    // Calculate new time based on drop position (using top edge as reference)
                    let dropY = e.clientY - timelineRect.top;
                    
                    // For touch devices, adjust for finger position
                    if (e.touches && e.touches.length > 0) {
                        dropY = e.touches[0].clientY - timelineRect.top;
                    }
                    
                    const timelineHeight = timelineRect.height;
                    const hourPercent = dropY / timelineHeight;
                    const newStartHour = 6 + (hourPercent * 17); // 6-22 hours (17 slots)
                    
                    // Round to 15-minute intervals
                    const roundedStartHour = this.roundToQuarterHour(newStartHour);
                    const durationHours = this.currentDragData.duration_minutes / 60;
                    
                    // Clamp to valid range
                    const clampedStartHour = Math.max(6, Math.min(22 - durationHours, roundedStartHour));
                    
                    // Calculate new date with rounded time
                    const newDate = new Date(currentDay);
                    newDate.setHours(Math.floor(clampedStartHour));
                    newDate.setMinutes((clampedStartHour % 1) * 60);
                    newDate.setSeconds(0);
                    newDate.setMilliseconds(0);
                    
                    // Calculate end time based on original duration
                    const originalDuration = this.currentDragData.duration_minutes || 60;
                    const newEndTime = new Date(newDate.getTime() + originalDuration * 60000);
                    
                    this.moveEntry(this.currentDragData.id, newDate, newEndTime);
                }
            });
            
            this.weekCalendar.appendChild(dayDiv);
        }
    }
    
    changeWeek(direction) {
        this.currentWeek += direction;
        
        if (this.currentWeek < 1) {
            this.currentYear--;
            this.currentWeek = 52;
        } else if (this.currentWeek > 52) {
            this.currentYear++;
            this.currentWeek = 1;
        }
        
        this.updateWeekDisplay();
        this.loadWeekData();
    }
    
    async loadProjects() {
        try {
            const response = await fetch('/api/projects');
            const projects = await response.json();
            
            // Store projects for color mapping
            this.projectsData = {};
            projects.forEach(project => {
                this.projectsData[project.name] = project;
            });
            
            [this.projectSelect, this.manualProjectSelect].forEach(select => {
                select.innerHTML = '<option value="">Projekt wählen...</option>';
                projects.forEach(project => {
                    const option = document.createElement('option');
                    option.value = project.name;
                    option.textContent = project.name;
                    select.appendChild(option);
                });
            });
        } catch (error) {
            console.error('Fehler beim Laden der Projekte:', error);
        }
    }
    
    showProjectModal() {
        this.projectModal.classList.add('show');
        this.updateColorPreview();
        this.newProjectName.focus();
    }
    
    hideProjectModal() {
        this.projectModal.classList.remove('show');
        this.newProjectName.value = '';
        this.newProjectColor.value = '#667eea';
        this.updateColorPreview();
    }
    
    updateColorPreview() {
        const color = this.newProjectColor.value;
        this.colorPreview.style.background = color;
        this.colorPreview.textContent = 'Vorschau';
    }
    
    async saveProject() {
        const name = this.newProjectName.value.trim();
        const color = this.newProjectColor.value;
        
        if (!name) {
            this.showNotification('Bitte Projektname eingeben', 'error');
            return;
        }
        
        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('color', color);
            
            const response = await fetch('/api/projects', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                this.showNotification('Projekt erstellt', 'success');
                this.hideProjectModal();
                // Projects will be refreshed via WebSocket
            } else {
                const error = await response.json();
                this.showNotification(error.detail, 'error');
            }
        } catch (error) {
            this.showNotification('Fehler beim Erstellen', 'error');
        }
    }
    
    toggleManualEntry() {
        this.currentEditingEntryId = null;
        this.manualModalTitle.textContent = 'Manueller Eintrag';
        this.saveManualBtn.textContent = 'Speichern';
        this.manualProjectSelect.value = '';
        this.manualModal.classList.add('show');
        // Don't auto-focus on mobile to prevent dropdown opening
        if (!/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            this.manualProjectSelect.focus();
        }
    }
    
    editEntry(entry) {
        this.currentEditingEntryId = entry.id;
        this.manualModalTitle.textContent = 'Eintrag bearbeiten';
        this.saveManualBtn.textContent = 'Speichern';
        
        // Fill form with entry data
        this.manualProjectSelect.value = entry.project;
        this.manualDescription.value = entry.description || '';
        
        const startDate = new Date(entry.start_time);
        const endDate = new Date(entry.end_time);
        
        this.manualDate.value = startDate.toISOString().split('T')[0];
        this.manualStartTime.value = startDate.toTimeString().slice(0, 5);
        this.manualEndTime.value = endDate.toTimeString().slice(0, 5);
        
        this.manualModal.classList.add('show');
        // Don't auto-focus on mobile to prevent dropdown opening
        if (!/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            this.manualProjectSelect.focus();
        }
    }
    
    hideManualModal() {
        this.manualModal.classList.remove('show');
        this.manualForm.reset();
        this.manualProjectSelect.value = '';
        this.manualDate.value = new Date().toISOString().split('T')[0];
        this.currentEditingEntryId = null;
    }
    
    async startTimer() {
        const project = this.projectSelect.value.trim();
        const description = this.descriptionInput.value.trim();
        
        if (!project) {
            this.showNotification('Bitte Projekt auswählen', 'error');
            return;
        }
        
        try {
            const formData = new FormData();
            formData.append('project', project);
            formData.append('description', description);
            
            const response = await fetch('/api/entries/start', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                this.isRunning = true;
                this.startTime = new Date();
                this.startBtn.disabled = true;
                this.stopBtn.disabled = false;
                this.projectSelect.disabled = true;
                this.descriptionInput.disabled = true;
                
                this.startTimerDisplay();
                this.showNotification('Timer gestartet', 'success');
                // Immediate update
                setTimeout(() => {
                    this.loadEntries();
                }, 100);
            } else {
                const error = await response.json();
                this.showNotification(error.detail, 'error');
            }
        } catch (error) {
            this.showNotification('Fehler beim Starten', 'error');
        }
    }
    
    async stopTimer() {
        try {
            const response = await fetch('/api/entries/stop', {
                method: 'POST'
            });
            
            if (response.ok) {
                const result = await response.json();
                this.isRunning = false;
                this.startBtn.disabled = false;
                this.stopBtn.disabled = true;
                this.projectSelect.disabled = false;
                this.descriptionInput.disabled = false;
                
                // Force timer state reset
                this.isRunning = false;
                this.stopTimerDisplay();
                this.showNotification(`Timer gestoppt: ${Math.round(result.duration)} Min`, 'success');
                
                this.projectSelect.value = '';
                this.descriptionInput.value = '';
                
                // Immediate update
                setTimeout(() => {
                    this.loadEntries();
                    this.loadWeekData();
                }, 100);
            } else {
                const error = await response.json();
                this.showNotification(error.detail, 'error');
            }
        } catch (error) {
            this.showNotification('Fehler beim Stoppen', 'error');
        }
    }
    
    async addManualEntry() {
        const project = this.manualProjectSelect.value.trim();
        const description = this.manualDescription.value.trim();
        const date = this.manualDate.value;
        const startTime = this.manualStartTime.value;
        const endTime = this.manualEndTime.value;
        
        if (!project || !date || !startTime || !endTime) {
            this.showNotification('Bitte alle Pflichtfelder ausfüllen', 'error');
            return;
        }
        
        try {
            const formData = new FormData();
            formData.append('project', project);
            formData.append('description', description);
            formData.append('date', date);
            formData.append('start_time', startTime);
            formData.append('end_time', endTime);
            
            let url = '/api/entries/manual';
            let method = 'POST';
            
            // Check if we're editing an existing entry
            if (this.currentEditingEntryId) {
                url = `/api/entries/${this.currentEditingEntryId}`;
                method = 'PUT';
            }
            
            const response = await fetch(url, {
                method: method,
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                const action = this.currentEditingEntryId ? 'aktualisiert' : 'erstellt';
                this.showNotification(`Eintrag ${action}: ${Math.round(result.duration)} Min`, 'success');
                this.hideManualModal();
                // Force immediate reload
                this.loadEntries();
                this.loadWeekData();
            } else {
                const error = await response.json();
                this.showNotification(error.detail, 'error');
            }
        } catch (error) {
            this.showNotification('Fehler beim Speichern', 'error');
        }
    }
    
    async deleteEntry(entryId) {
        if (!confirm('Eintrag wirklich löschen?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/entries/${entryId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.showNotification('Eintrag gelöscht', 'success');
                // Force immediate reload
                this.loadEntries();
                this.loadWeekData();
            } else {
                const error = await response.json();
                this.showNotification(error.detail, 'error');
            }
        } catch (error) {
            this.showNotification('Fehler beim Löschen', 'error');
        }
    }
    
    startTimerDisplay() {
        this.timerInterval = setInterval(() => {
            if (this.startTime) {
                const elapsed = new Date() - this.startTime;
                this.updateTimerDisplay(elapsed);
            }
        }, 1000);
    }
    
    stopTimerDisplay() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        // Force immediate timer reset
        this.timerDisplay.textContent = '00:00:00';
        this.startTime = null;
    }
    
    updateTimerDisplay(elapsed) {
        const hours = Math.floor(elapsed / (1000 * 60 * 60));
        const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);
        
        this.timerDisplay.textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    async checkRunningTimer() {
        try {
            const response = await fetch('/api/entries');
            const entries = await response.json();
            
            const runningEntry = entries.find(entry => entry.is_running);
            if (runningEntry) {
                this.isRunning = true;
                this.startTime = new Date(runningEntry.start_time);
                this.startBtn.disabled = true;
                this.stopBtn.disabled = false;
                this.projectSelect.disabled = true;
                this.descriptionInput.disabled = true;
                this.projectSelect.value = runningEntry.project;
                this.descriptionInput.value = runningEntry.description || '';
                
                this.startTimerDisplay();
            }
        } catch (error) {
            console.error('Fehler beim Prüfen des laufenden Timers:', error);
        }
    }
    
    async loadWeekData() {
        await Promise.all([
            this.loadEntries(),
            this.loadWeekStats(),
            this.loadProjects() // Ensure projects are loaded for calendar colors
        ]);
        // Only update calendar if it exists and is rendered
        if (document.getElementById('day-name-0')) {
            this.updateCalendarWithData();
        }
    }
    
    updateCalendarWithData() {
        // Only reset if calendar exists
        if (!document.getElementById('day-name-0')) {
            return; // Calendar not yet rendered
        }
        
        // Use cached entries if available to reduce requests
        this.updateCalendarFromCache();
    }
    
    updateCalendarFromCache() {
        if (!this.allEntries) return;
        
        // Reset all day names to original weekday only
        for (let i = 0; i < 5; i++) {
            const dayName = document.getElementById(`day-name-${i}`);
            const dayTimeline = document.getElementById(`day-timeline-${i}`);
            const dayDiv = dayName?.closest('.calendar-day');
            
            if (dayName) {
                // Reset to original weekday format without hours
                const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
                dayName.textContent = dayNames[i];
            }
            if (dayTimeline) dayTimeline.innerHTML = '';
            if (dayDiv) dayDiv.classList.remove('has-work');
        }
        
        // Filter out running entries (they shouldn't be displayed in calendar)
        const weekEntries = this.allEntries.filter(entry => {
            const isActuallyRunning = entry.is_running === true && !entry.end_time;
            return !isActuallyRunning;
        });
        
        // Group entries by day
        const entriesByDay = {};
        
        weekEntries.forEach(entry => {
            const entryDate = new Date(entry.start_time);
            const dayIndex = (entryDate.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
            
            // Only process Monday to Friday (dayIndex 0-4)
            if (dayIndex < 5) {
                if (!entriesByDay[dayIndex]) {
                    entriesByDay[dayIndex] = {
                        totalMinutes: 0,
                        entries: []
                    };
                }
                
                entriesByDay[dayIndex].totalMinutes += entry.duration_minutes || 0;
                entriesByDay[dayIndex].entries.push(entry);
            }
        });
        
        // Update calendar display with hours in day-name
        Object.keys(entriesByDay).forEach(dayIndex => {
            const data = entriesByDay[dayIndex];
            const dayName = document.getElementById(`day-name-${dayIndex}`);
            const dayTimeline = document.getElementById(`day-timeline-${dayIndex}`);
            const dayDiv = dayName?.closest('.calendar-day');
            
            if (dayName && data.totalMinutes > 0) {
                // Get original weekday names
                const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
                const weekdayText = dayNames[parseInt(dayIndex)];
                
                // Add hours next to weekday
                const hours = (data.totalMinutes / 60).toFixed(1);
                dayName.textContent = `${weekdayText} (${hours}h)`;
                
                if (dayDiv) {
                    dayDiv.classList.add('has-work');
                }
                
                // Create timeline blocks
                if (dayTimeline) {
                    this.renderDayTimeline(dayTimeline, data.entries, dayIndex);
                }
            }
        });
    }
    
    renderDayTimeline(timelineElement, entries, dayIndex) {
        // Sort entries by start time
        const sortedEntries = entries.sort((a, b) => 
            new Date(a.start_time) - new Date(b.start_time)
        );
        
        const projectColors = new Map();
        let colorIndex = 1;
        
        // Timeline represents 6:00 to 22:00 (17 hour slots total)
        const TIMELINE_START_HOUR = 6;
        const TIMELINE_END_HOUR = 22;
        const TIMELINE_HOURS = 17; // 17 time slots: 6:00, 7:00, 8:00, ..., 22:00
        
        sortedEntries.forEach((entry, index) => {
            const startTime = new Date(entry.start_time);
            const endTime = new Date(entry.end_time);
            
            // Calculate vertical position (6:00 = 0%, 22:00 = 100%)
            const startHour = startTime.getHours() + startTime.getMinutes() / 60;
            const endHour = endTime.getHours() + endTime.getMinutes() / 60;
            
            // Clamp to timeline range (ensure minimum is exactly 6.0)
            const clampedStartHour = Math.max(6.0, Math.min(TIMELINE_END_HOUR, startHour));
            const clampedEndHour = Math.max(6.0, Math.min(TIMELINE_END_HOUR, endHour));
            
            // Calculate position and height as percentage of timeline
            const topPercent = ((clampedStartHour - TIMELINE_START_HOUR) / TIMELINE_HOURS) * 100;
            const heightPercent = ((clampedEndHour - clampedStartHour) / TIMELINE_HOURS) * 100;
            
            if (heightPercent > 0) {
                const timeBlock = document.createElement('div');
                timeBlock.className = 'time-block';
                timeBlock.style.top = `${topPercent}%`;
                timeBlock.style.height = `${Math.max(heightPercent, 2)}%`; // Minimum 2% height
                timeBlock.dataset.entryId = entry.id;
                
                // Use project's defined color
                if (this.projectsData && this.projectsData[entry.project]) {
                    timeBlock.style.backgroundColor = this.projectsData[entry.project].color;
                } else {
                    // Fallback to default colors
                    if (!projectColors.has(entry.project)) {
                        projectColors.set(entry.project, colorIndex);
                        colorIndex = (colorIndex % 6) + 1;
                    }
                    timeBlock.classList.add(`project-${projectColors.get(entry.project)}`);
                }
                
                const duration = Math.round(entry.duration_minutes || 0);
                const shortText = entry.project.length > 6 ? entry.project.substring(0, 6) + '...' : entry.project;
                timeBlock.textContent = shortText;
                timeBlock.title = `${entry.project}: ${startTime.toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})} - ${endTime.toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})} (${duration} Min)${entry.description ? '\n' + entry.description : ''}`;
                
                // Make draggable
                timeBlock.draggable = true;
                timeBlock.dataset.entryData = JSON.stringify(entry);
                
                // Add drag and drop events
                timeBlock.addEventListener('dragstart', (e) => {
                    timeBlock.classList.add('dragging');
                    e.dataTransfer.setData('text/plain', JSON.stringify(entry));
                    e.dataTransfer.effectAllowed = 'move';
                    
                    // Store reference to dragged element
                    this.draggedElement = timeBlock;
                    this.currentDragData = entry;
                    
                    // Show initial indicator with delay to ensure it appears after drag image
                    setTimeout(() => {
                        const originalStart = new Date(entry.start_time);
                        const startHour = originalStart.getHours() + originalStart.getMinutes() / 60;
                        const endHour = startHour + (entry.duration_minutes / 60);
                        this.showDragIndicator(e.clientX, e.clientY, startHour, endHour, timeBlock);
                    }, 10);
                });
                
                timeBlock.addEventListener('drag', (e) => {
                    // Update indicator position during drag
                    if (this.draggedElement && this.currentDragData && e.clientX > 0 && e.clientY > 0) {
                        // Show current times during drag - position follows mouse
                        const originalStart = new Date(this.currentDragData.start_time);
                        const startHour = originalStart.getHours() + originalStart.getMinutes() / 60;
                        const endHour = startHour + (this.currentDragData.duration_minutes / 60);
                        
                        this.showDragIndicator(e.clientX, e.clientY, startHour, endHour, this.draggedElement);
                    }
                });
                
                timeBlock.addEventListener('dragend', () => {
                    timeBlock.classList.remove('dragging');
                    this.hideDragIndicator();
                    // Force cleanup of any remaining indicators
                    document.querySelectorAll('.drag-time-indicator').forEach(indicator => {
                        if (indicator.parentNode) {
                            indicator.parentNode.removeChild(indicator);
                        }
                    });
                    this.draggedElement = null;
                    this.currentDragData = null;
                    // Remove drop target highlights
                    document.querySelectorAll('.drop-target').forEach(el => {
                        el.classList.remove('drop-target');
                    });
                });
                
                // Add touch events for mobile drag support
                let touchStartY = null;
                let touchStartX = null;
                let isDragging = false;
                let longTouchTimer = null;
                
                timeBlock.addEventListener('touchstart', (e) => {
                    // Don't prevent default initially to allow scrolling
                    const touch = e.touches[0];
                    touchStartX = touch.clientX;
                    touchStartY = touch.clientY;
                    isDragging = false;
                    
                    // Start long touch timer for drag initiation
                    longTouchTimer = setTimeout(() => {
                        isDragging = true;
                        timeBlock.classList.add('dragging');
                        this.draggedElement = timeBlock;
                        this.currentDragData = entry;
                        
                        // Show drag indicator
                        const originalStart = new Date(entry.start_time);
                        const startHour = originalStart.getHours() + originalStart.getMinutes() / 60;
                        const endHour = startHour + (entry.duration_minutes / 60);
                        this.showDragIndicator(touchStartX, touchStartY, startHour, endHour, timeBlock);
                    }, 500); // 500ms for drag initiation
                });
                
                timeBlock.addEventListener('touchmove', (e) => {
                    if (longTouchTimer) {
                        const touch = e.touches[0];
                        const deltaX = Math.abs(touch.clientX - touchStartX);
                        const deltaY = Math.abs(touch.clientY - touchStartY);
                        
                        // Allow vertical scrolling if primarily vertical movement
                        if (!isDragging && deltaY > deltaX && deltaY > 10) {
                            clearTimeout(longTouchTimer);
                            longTouchTimer = null;
                            return; // Allow scrolling
                        }
                        
                        // Cancel long touch if moved too much horizontally
                        if (!isDragging && deltaX > 15) {
                            clearTimeout(longTouchTimer);
                            longTouchTimer = null;
                            return;
                        }
                    }
                    
                    if (isDragging) {
                        e.preventDefault(); // Only prevent scrolling during active drag
                        const touch = e.touches[0];
                        
                        // Update drag indicator position
                        if (this.currentDragData) {
                            const originalStart = new Date(this.currentDragData.start_time);
                            const startHour = originalStart.getHours() + originalStart.getMinutes() / 60;
                            const endHour = startHour + (this.currentDragData.duration_minutes / 60);
                            this.showDragIndicator(touch.clientX, touch.clientY, startHour, endHour, timeBlock);
                        }
                        
                        // Highlight drop targets
                        const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                        const dayDiv = elementBelow?.closest('.calendar-day');
                        
                        // Remove previous highlights
                        document.querySelectorAll('.drop-target').forEach(el => {
                            el.classList.remove('drop-target');
                        });
                        
                        if (dayDiv && dayDiv !== timeBlock.closest('.calendar-day')) {
                            dayDiv.classList.add('drop-target');
                        }
                    }
                });
                
                timeBlock.addEventListener('touchend', (e) => {
                    if (longTouchTimer) {
                        clearTimeout(longTouchTimer);
                        longTouchTimer = null;
                    }
                    
                    if (isDragging) {
                        e.preventDefault();
                        const touch = e.changedTouches[0];
                        const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                        const dayDiv = elementBelow?.closest('.calendar-day');
                        
                        if (dayDiv && dayDiv !== timeBlock.closest('.calendar-day')) {
                            // Simulate drop event
                            const timeline = dayDiv.querySelector('.day-timeline');
                            if (timeline && this.currentDragData) {
                                const timelineRect = timeline.getBoundingClientRect();
                                const dropY = touch.clientY - timelineRect.top;
                                const timelineHeight = timelineRect.height;
                                const hourPercent = dropY / timelineHeight;
                                const newStartHour = 6 + (hourPercent * 17);
                                
                                // Round to 15-minute intervals
                                const roundedStartHour = this.roundToQuarterHour(newStartHour);
                                const durationHours = this.currentDragData.duration_minutes / 60;
                                const clampedStartHour = Math.max(6, Math.min(22 - durationHours, roundedStartHour));
                                
                                // Calculate new date
                                const startOfWeek = this.getDateOfWeek(this.currentYear, this.currentWeek);
                                const dayIndex = Array.from(dayDiv.parentNode.children).indexOf(dayDiv) - 1; // -1 for time sidebar
                                const newDate = new Date(startOfWeek.getTime() + dayIndex * 24 * 60 * 60 * 1000);
                                newDate.setHours(Math.floor(clampedStartHour));
                                newDate.setMinutes((clampedStartHour % 1) * 60);
                                newDate.setSeconds(0);
                                newDate.setMilliseconds(0);
                                
                                const originalDuration = this.currentDragData.duration_minutes || 60;
                                const newEndTime = new Date(newDate.getTime() + originalDuration * 60000);
                                
                                this.moveEntry(this.currentDragData.id, newDate, newEndTime);
                            }
                        }
                        
                        // Cleanup
                        timeBlock.classList.remove('dragging');
                        this.hideDragIndicator();
                        document.querySelectorAll('.drop-target').forEach(el => {
                            el.classList.remove('drop-target');
                        });
                        this.draggedElement = null;
                        this.currentDragData = null;
                        isDragging = false;
                    }
                });
                
                timeBlock.addEventListener('touchcancel', (e) => {
                    if (longTouchTimer) {
                        clearTimeout(longTouchTimer);
                        longTouchTimer = null;
                    }
                    
                    // Cleanup on touch cancel
                    timeBlock.classList.remove('dragging');
                    this.forceCleanupDragIndicators();
                    isDragging = false;
                });
                
                // Add click event for editing
                timeBlock.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.editEntry(entry);
                });
                
                timelineElement.appendChild(timeBlock);
            }
        });
    }
    
    async loadEntries() {
        try {
            const response = await fetch('/api/entries');
            const entries = await response.json();
            
            // Store ALL entries (not filtered) for better caching
            this.allEntriesRaw = entries;
            
            // Store filtered entries for current week
            this.allEntries = entries.filter(entry => {
                const entryDate = new Date(entry.start_time);
                const entryWeek = this.getWeekNumber(entryDate);
                const entryYear = entryDate.getFullYear();
                return entryWeek === this.currentWeek && entryYear === this.currentYear;
            });
            
            this.filterEntries();
        } catch (error) {
            console.error('Fehler beim Laden der Einträge:', error);
        }
    }
    
    filterEntries() {
        this.entriesList.innerHTML = '';
        
        let filteredEntries = this.allEntries || [];
        
        // Apply day filter from button selection
        if (this.currentDayFilter !== '') {
            const dayIndex = parseInt(this.currentDayFilter);
            filteredEntries = filteredEntries.filter(entry => {
                const entryDate = new Date(entry.start_time);
                const entryDayIndex = (entryDate.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
                return entryDayIndex === dayIndex;
            });
        }
        
        if (filteredEntries.length === 0) {
            this.entriesList.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">Keine Einträge gefunden</div>';
            return;
        }
        
        // Sort entries by start time (oldest first) with running entries at top
        filteredEntries.sort((a, b) => {
            if (a.is_running && !b.is_running) return -1;
            if (!a.is_running && b.is_running) return 1;
            return new Date(a.start_time) - new Date(b.start_time); // Oldest first
        });
        
        filteredEntries.forEach(entry => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'entry-item';
            
            // Apply project color as border-left color
            if (this.projectsData && this.projectsData[entry.project]) {
                entryDiv.style.borderLeftColor = this.projectsData[entry.project].color;
            }
            
            if (!entry.is_running) {
                entryDiv.style.cursor = 'pointer';
                entryDiv.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('btn-delete')) {
                        this.editEntry(entry);
                    }
                });
            }
            
            const startTime = new Date(entry.start_time);
            const endTime = entry.end_time ? new Date(entry.end_time) : null;
            
            // Force display "Läuft..." only if really running (has no end_time and is_running is true)
            const isActuallyRunning = entry.is_running === true && !entry.end_time;
            const durationText = isActuallyRunning ? 'Läuft...' : (entry.duration_minutes ? Math.round(entry.duration_minutes) + ' Min' : '0 Min');
            
            entryDiv.innerHTML = `
                <div class="entry-header">
                    <span class="entry-project">${entry.project}${isActuallyRunning ? '<span class="running-indicator"></span>' : ''}</span>
                    <span class="entry-duration">${durationText}</span>
                </div>
                ${entry.description ? `<div class="entry-description">${entry.description}</div>` : ''}
                <div class="entry-time">
                    ${startTime.toLocaleString('de-DE')}${endTime ? ' - ' + endTime.toLocaleTimeString('de-DE') : ''}
                </div>
                ${!isActuallyRunning ? `
                    <div class="entry-actions">
                        <button class="btn-delete" onclick="timeTracker.deleteEntry(${entry.id})">Löschen</button>
                    </div>
                ` : ''}
            `;
            
            this.entriesList.appendChild(entryDiv);
        });
    }
    
    async loadWeekStats() {
        try {
            const response = await fetch(`/api/stats/week/${this.currentYear}/${this.currentWeek}`);
            const stats = await response.json();
            
            // These elements might not exist in the current HTML
            if (this.totalHours) this.totalHours.textContent = stats.total_hours.toFixed(1);
            if (this.projectCount) this.projectCount.textContent = Object.keys(stats.projects).length;
            
            if (this.projectStats) this.projectStats.innerHTML = '';
            
            if (this.projectStats) {
                Object.entries(stats.projects).forEach(([project, minutes]) => {
                    const projectDiv = document.createElement('div');
                    projectDiv.className = 'project-item';
                    projectDiv.innerHTML = `
                        <span>${project}</span>
                        <span>${(minutes / 60).toFixed(1)}h</span>
                    `;
                    this.projectStats.appendChild(projectDiv);
                });
            }
            
        } catch (error) {
            console.error('Fehler beim Laden der Statistiken:', error);
        }
    }
    
    exportCSV() {
        const startOfWeek = this.getDateOfWeek(this.currentYear, this.currentWeek);
        const endOfWeek = new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000);
        
        const startDate = startOfWeek.toISOString().split('T')[0];
        const endDate = endOfWeek.toISOString().split('T')[0];
        
        const url = `/api/export/csv?start_date=${startDate}&end_date=${endDate}`;
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `zeiterfassung_KW${this.currentWeek}_${this.currentYear}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showNotification('CSV Export gestartet', 'success');
    }
    
    async moveEntry(entryId, newStartTime, newEndTime) {
        try {
            // Get the original entry data first (search in all entries, not just current week)
            const originalEntry = (this.allEntriesRaw || this.allEntries || []).find(entry => entry.id === entryId);
            if (!originalEntry) {
                this.showNotification('Eintrag nicht gefunden', 'error');
                return;
            }
            
            const formData = new FormData();
            formData.append('project', originalEntry.project);
            formData.append('description', originalEntry.description || '');
            formData.append('date', newStartTime.toISOString().split('T')[0]);
            formData.append('start_time', newStartTime.toTimeString().slice(0, 5));
            formData.append('end_time', newEndTime.toTimeString().slice(0, 5));
            
            const response = await fetch(`/api/entries/${entryId}`, {
                method: 'PUT',
                body: formData
            });
            
            if (response.ok) {
                this.showNotification('Eintrag verschoben', 'success');
                this.loadEntries();
                this.loadWeekData();
            } else {
                const error = await response.json();
                this.showNotification(error.detail, 'error');
            }
        } catch (error) {
            this.showNotification('Fehler beim Verschieben', 'error');
        }
    }
    
    showNotification(message, type) {
        this.notification.textContent = message;
        this.notification.className = `notification ${type}`;
        
        setTimeout(() => {
            this.notification.classList.add('hidden');
        }, 3000);
    }
}

let timeTracker;

document.addEventListener('DOMContentLoaded', () => {
    timeTracker = new TimeTracker();
});