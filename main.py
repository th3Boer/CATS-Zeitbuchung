from fastapi import FastAPI, Request, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime, timedelta
import os
import io
import csv
import calendar
import json
import asyncio
from typing import List

app = FastAPI(title="Zeiterfassung CATS")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

DATABASE_URL = "sqlite:///./zeiterfassung.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    color = Column(String(7), default="#667eea")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class TimeEntry(Base):
    __tablename__ = "time_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    project = Column(String(100), nullable=False)
    description = Column(String(500))
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime)
    duration_minutes = Column(Integer)
    is_running = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_db_sync():
    db = SessionLocal()
    try:
        return db
    except:
        db.close()
        raise

# WebSocket Manager für Live-Updates
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except:
                pass

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api/entries")
async def get_entries():
    db = get_db_sync()
    try:
        entries = db.query(TimeEntry).order_by(TimeEntry.created_at.desc()).limit(50).all()
        return [
            {
                "id": entry.id,
                "project": entry.project,
                "description": entry.description,
                "start_time": entry.start_time.isoformat(),
                "end_time": entry.end_time.isoformat() if entry.end_time else None,
                "duration_minutes": entry.duration_minutes,
                "is_running": entry.is_running
            }
            for entry in entries
        ]
    finally:
        db.close()

@app.post("/api/entries/start")
async def start_timer(project: str = Form(...), description: str = Form("")):
    db = get_db_sync()
    try:
        running_entry = db.query(TimeEntry).filter(TimeEntry.is_running == True).first()
        if running_entry:
            raise HTTPException(status_code=400, detail="Timer bereits aktiv")
        
        new_entry = TimeEntry(
            project=project,
            description=description,
            start_time=datetime.now(),
            is_running=True
        )
        db.add(new_entry)
        db.commit()
        
        # Broadcast live update
        await manager.broadcast({
            "type": "timer_started",
            "data": {
                "id": new_entry.id,
                "project": project,
                "description": description,
                "start_time": new_entry.start_time.isoformat()
            }
        })
        
        return {"message": "Timer gestartet", "id": new_entry.id}
    finally:
        db.close()

@app.post("/api/entries/stop")
async def stop_timer():
    db = get_db_sync()
    try:
        running_entry = db.query(TimeEntry).filter(TimeEntry.is_running == True).first()
        if not running_entry:
            raise HTTPException(status_code=400, detail="Kein aktiver Timer")
        
        running_entry.end_time = datetime.now()
        running_entry.duration_minutes = int(
            (running_entry.end_time - running_entry.start_time).total_seconds() / 60
        )
        running_entry.is_running = False
        db.commit()
        
        # Broadcast live update
        await manager.broadcast({
            "type": "timer_stopped",
            "data": {
                "id": running_entry.id,
                "duration": running_entry.duration_minutes,
                "end_time": running_entry.end_time.isoformat()
            }
        })
        
        return {"message": "Timer gestoppt", "duration": running_entry.duration_minutes}
    finally:
        db.close()

@app.post("/api/entries/manual")
async def add_manual_entry(
    project: str = Form(...),
    description: str = Form(""),
    date: str = Form(...),
    start_time: str = Form(...),
    end_time: str = Form(...),
):
    db = get_db_sync()
    try:
        start_datetime = datetime.fromisoformat(f"{date}T{start_time}")
        end_datetime = datetime.fromisoformat(f"{date}T{end_time}")
        
        if end_datetime <= start_datetime:
            raise HTTPException(status_code=400, detail="Endzeit muss nach Startzeit liegen")
        
        duration_minutes = int((end_datetime - start_datetime).total_seconds() / 60)
        
        new_entry = TimeEntry(
            project=project,
            description=description,
            start_time=start_datetime,
            end_time=end_datetime,
            duration_minutes=duration_minutes,
            is_running=False
        )
        
        db.add(new_entry)
        db.commit()
        
        # Broadcast live update
        await manager.broadcast({
            "type": "entry_created",
            "data": {
                "id": new_entry.id,
                "project": project,
                "description": description,
                "duration": duration_minutes
            }
        })
        
        return {"message": "Manueller Eintrag erstellt", "duration": duration_minutes}
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Ungültiges Datum/Zeit Format")
    finally:
        db.close()

@app.delete("/api/entries/{entry_id}")
async def delete_entry(entry_id: int):
    db = get_db_sync()
    try:
        entry = db.query(TimeEntry).filter(TimeEntry.id == entry_id).first()
        if not entry:
            raise HTTPException(status_code=404, detail="Eintrag nicht gefunden")
        
        if entry.is_running:
            raise HTTPException(status_code=400, detail="Laufender Timer kann nicht gelöscht werden")
        
        db.delete(entry)
        db.commit()
        
        # Broadcast live update
        await manager.broadcast({
            "type": "entry_deleted",
            "data": {"id": entry_id}
        })
        
        return {"message": "Eintrag gelöscht"}
    finally:
        db.close()

@app.put("/api/entries/{entry_id}")
async def update_entry(
    entry_id: int,
    project: str = Form(...),
    description: str = Form(""),
    date: str = Form(...),
    start_time: str = Form(...),
    end_time: str = Form(...),
):
    db = get_db_sync()
    try:
        entry = db.query(TimeEntry).filter(TimeEntry.id == entry_id).first()
        if not entry:
            raise HTTPException(status_code=404, detail="Eintrag nicht gefunden")
        
        if entry.is_running:
            raise HTTPException(status_code=400, detail="Laufender Timer kann nicht bearbeitet werden")
        
        start_datetime = datetime.fromisoformat(f"{date}T{start_time}")
        end_datetime = datetime.fromisoformat(f"{date}T{end_time}")
        
        if end_datetime <= start_datetime:
            raise HTTPException(status_code=400, detail="Endzeit muss nach Startzeit liegen")
        
        duration_minutes = int((end_datetime - start_datetime).total_seconds() / 60)
        
        # Only update if values are provided
        if project:
            entry.project = project
        if description:
            entry.description = description
        entry.start_time = start_datetime
        entry.end_time = end_datetime
        entry.duration_minutes = duration_minutes
        
        db.commit()
        
        # Broadcast live update
        await manager.broadcast({
            "type": "entry_updated",
            "data": {
                "id": entry.id,
                "project": project,
                "description": description,
                "duration": duration_minutes
            }
        })
        
        return {"message": "Eintrag aktualisiert", "duration": duration_minutes}
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Ungültiges Datum/Zeit Format")
    finally:
        db.close()

@app.get("/api/stats/week")
async def week_stats():
    db = get_db_sync()
    try:
        today = datetime.now().date()
        start_of_week = today - timedelta(days=today.weekday())
        
        entries = db.query(TimeEntry).filter(
            TimeEntry.start_time >= start_of_week,
            TimeEntry.is_running == False
        ).all()
        
        total_minutes = sum(entry.duration_minutes or 0 for entry in entries)
        project_stats = {}
        
        for entry in entries:
            if entry.project not in project_stats:
                project_stats[entry.project] = 0
            project_stats[entry.project] += entry.duration_minutes or 0
        
        return {
            "total_hours": round(total_minutes / 60, 2),
            "total_minutes": total_minutes,
            "projects": project_stats
        }
    finally:
        db.close()

@app.get("/api/export/csv")
async def export_csv(start_date: str = None, end_date: str = None):
    db = get_db_sync()
    try:
        query = db.query(TimeEntry).filter(TimeEntry.is_running == False)
        
        if start_date:
            start = datetime.fromisoformat(start_date)
            query = query.filter(TimeEntry.start_time >= start)
        
        if end_date:
            end = datetime.fromisoformat(end_date + "T23:59:59")
            query = query.filter(TimeEntry.start_time <= end)
        
        entries = query.order_by(TimeEntry.start_time.desc()).all()
        
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Projekt', 'Beschreibung', 'Startzeit', 'Endzeit', 'Dauer (Min)', 'Datum'])
        
        for entry in entries:
            writer.writerow([
                entry.project,
                entry.description or '',
                entry.start_time.strftime('%H:%M:%S'),
                entry.end_time.strftime('%H:%M:%S') if entry.end_time else '',
                entry.duration_minutes or 0,
                entry.start_time.strftime('%Y-%m-%d')
            ])
        
        output.seek(0)
        
        filename = f"zeiterfassung_{datetime.now().strftime('%Y%m%d')}.csv"
        
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode('utf-8')),
            media_type='text/csv',
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    finally:
        db.close()

@app.get("/api/projects")
async def get_projects():
    db = get_db_sync()
    try:
        projects = db.query(Project).filter(Project.is_active == True).all()
        return [{"id": p.id, "name": p.name, "color": p.color} for p in projects]
    finally:
        db.close()

@app.post("/api/projects")
async def create_project(name: str = Form(...), color: str = Form("#667eea")):
    db = get_db_sync()
    try:
        existing = db.query(Project).filter(Project.name == name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Projekt existiert bereits")
        
        new_project = Project(name=name, color=color)
        db.add(new_project)
        db.commit()
        
        # Broadcast live update
        await manager.broadcast({
            "type": "project_created",
            "data": {
                "id": new_project.id,
                "name": name,
                "color": color
            }
        })
        
        return {"message": "Projekt erstellt", "id": new_project.id}
    finally:
        db.close()

@app.put("/api/projects/{project_id}")
async def update_project(project_id: int, name: str = Form(...), color: str = Form("#667eea")):
    db = get_db_sync()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
        
        # Check if name already exists (but allow same name for same project)
        existing = db.query(Project).filter(Project.name == name, Project.id != project_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Projektname bereits vergeben")
        
        # Store old name to update time entries
        old_name = project.name
        
        # Update project
        project.name = name
        project.color = color
        
        # Update all time entries that reference this project
        if old_name != name:
            time_entries = db.query(TimeEntry).filter(TimeEntry.project == old_name).all()
            for entry in time_entries:
                entry.project = name
        
        db.commit()
        
        # Count updated entries
        updated_entries_count = 0
        if old_name != name:
            updated_entries_count = len(time_entries)
        
        # Broadcast live update
        await manager.broadcast({
            "type": "project_updated",
            "data": {
                "id": project.id,
                "name": name,
                "color": color,
                "old_name": old_name,
                "updated_entries": updated_entries_count
            }
        })
        
        message = f"Projekt aktualisiert"
        if updated_entries_count > 0:
            message += f" ({updated_entries_count} Einträge aktualisiert)"
        
        return {"message": message, "id": project.id, "updated_entries": updated_entries_count}
    finally:
        db.close()

@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: int):
    db = get_db_sync()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
        
        # Set project as inactive instead of deleting to preserve entries
        project.is_active = False
        db.commit()
        
        # Broadcast live update
        await manager.broadcast({
            "type": "project_deleted",
            "data": {"id": project_id}
        })
        
        return {"message": "Projekt deaktiviert"}
    finally:
        db.close()

@app.get("/api/stats/week/{year}/{week}")
async def week_stats_by_week(year: int, week: int):
    db = get_db_sync()
    try:
        # Berechne Start und Ende der Kalenderwoche
        jan_4 = datetime(year, 1, 4)
        week_1_monday = jan_4 - timedelta(days=jan_4.weekday())
        start_of_week = week_1_monday + timedelta(weeks=week-1)
        end_of_week = start_of_week + timedelta(days=6, hours=23, minutes=59, seconds=59)
        
        entries = db.query(TimeEntry).filter(
            TimeEntry.start_time >= start_of_week,
            TimeEntry.start_time <= end_of_week,
            TimeEntry.is_running == False
        ).all()
        
        total_minutes = sum(entry.duration_minutes or 0 for entry in entries)
        project_stats = {}
        
        for entry in entries:
            if entry.project not in project_stats:
                project_stats[entry.project] = 0
            project_stats[entry.project] += entry.duration_minutes or 0
        
        return {
            "year": year,
            "week": week,
            "total_hours": round(total_minutes / 60, 2),
            "total_minutes": total_minutes,
            "projects": project_stats,
            "start_date": start_of_week.strftime("%d.%m.%Y"),
            "end_date": end_of_week.strftime("%d.%m.%Y")
        }
    finally:
        db.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)