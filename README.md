# 🐱 CATS - Zeiterfassung

Eine moderne, mobile-friendly Arbeitszeiterfassungs-App mit lokaler SQLite-Datenbank und Docker-Support.

<img width="558" height="946" alt="image" src="https://github.com/user-attachments/assets/fe327bf0-ac92-4e18-ab8f-d11b27e5714f" />


## ✨ Features

- **⏱️ Timer-Funktion**: Start/Stop Timer für Projekte
- **📝 Manuelle Einträge**: Nachträgliche Zeiterfassung  
- **📊 Wochenübersicht**: Statistiken und Projektaufschlüsselung
- **📱 Mobile-friendly**: Responsive Design für alle Geräte
- **📤 Export**: CSV-Export der Arbeitsdaten
- **🗄️ Lokale Datenbank**: Alle Daten bleiben auf deinem Computer
- **🔄 Live-Updates**: WebSocket-basierte Echtzeit-Updates
- **🎨 Projektverwaltung**: Erstellen und Verwalten von Projekten mit Farben

## 🚀 Installation

### Mit Docker (Empfohlen)

1. **Repository klonen**:
   ```bash
   git clone <repository-url>
   cd CATS
   ```

2. **Mit Docker Compose starten**:
   ```bash
   docker-compose up -d
   ```

3. **Browser öffnen**: [http://localhost:8000](http://localhost:8000)

### Lokale Installation

1. **Abhängigkeiten installieren**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Anwendung starten**:
   ```bash
   python start.py
   ```

3. **Browser öffnen**: [http://localhost:8000](http://localhost:8000)

## Nutzung

### Timer verwenden
1. Projekt/App-Name eingeben
2. Optional: Beschreibung hinzufügen
3. "Start" klicken
4. Bei Fertigstellung "Stop" klicken

### Manuelle Einträge
1. Im "Manueller Eintrag" Bereich ausfüllen
2. Datum, Start- und Endzeit eingeben
3. "Eintrag hinzufügen" klicken

### Export
- CSV-Export der aktuellen Woche über den "CSV Export" Button
- Daten werden als Download bereitgestellt

## 🐳 Docker Setup

### Dockerfile Features
- **Base Image**: Python 3.11-slim für optimale Performance
- **Volume**: `/app/data` für persistente Datenspeicherung
- **Port**: 8000 (Web-Interface)
- **Environment**: Konfigurierbare Database URL

### Docker Compose Features
- **Automatischer Restart**: `unless-stopped` Policy
- **Health Check**: Überwachung der Anwendung
- **Volume Mapping**: `./data:/app/data` für lokale Datenpersistenz

### Docker Commands

```bash
# Container bauen und starten
docker-compose up --build

# Im Hintergrund starten
docker-compose up -d

# Logs anzeigen
docker-compose logs -f

# Container stoppen
docker-compose down

# Container stoppen und Volumes löschen
docker-compose down -v
```

## 📁 Projektstruktur

```
CATS/
├── main.py              # FastAPI Hauptanwendung
├── start.py             # Lokaler Starter mit Dependency-Check
├── requirements.txt     # Python Dependencies
├── Dockerfile          # Docker Container Definition
├── docker-compose.yml  # Docker Compose Configuration
├── .dockerignore       # Docker Ignore File
├── static/             # Frontend Assets
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── app.js
│       ├── auto-refresh.js
│       └── websocket.js
├── templates/          # HTML Templates
│   └── index.html
└── data/               # Datenbank (automatisch erstellt)
    └── zeiterfassung.db
```

## 🛠️ Technologie-Stack

- **Backend**: FastAPI + Uvicorn + SQLAlchemy
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Datenbank**: SQLite (lokal)
- **WebSockets**: Echtzeit-Updates
- **Container**: Docker + Docker Compose
- **Styling**: Moderne Gradients, Mobile-first Design

## 📊 API Endpunkte

- `GET /` - Web-Interface
- `GET /api/entries` - Alle Zeiteinträge
- `POST /api/entries/start` - Timer starten
- `POST /api/entries/stop` - Timer stoppen
- `POST /api/entries/manual` - Manuellen Eintrag erstellen
- `PUT /api/entries/{id}` - Eintrag bearbeiten
- `DELETE /api/entries/{id}` - Eintrag löschen
- `GET /api/stats/week` - Wochenstatistiken
- `GET /api/export/csv` - CSV Export
- `GET /api/projects` - Projekte verwalten
- `WebSocket /ws` - Live-Updates


## 🔒 Datenschutz

Alle Daten werden lokal in einer SQLite-Datenbank gespeichert. Keine Cloud-Verbindung oder externe Services.
