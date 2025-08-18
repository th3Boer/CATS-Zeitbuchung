#!/usr/bin/env python3
"""
CATS - Zeiterfassung
Starte die Anwendung mit: python start.py
"""

import subprocess
import sys
import os

def check_requirements():
    """Prüfe ob alle Anforderungen installiert sind"""
    try:
        import fastapi
        import uvicorn
        import sqlalchemy
        import jinja2
        print("✓ Alle Abhängigkeiten sind installiert")
        return True
    except ImportError as e:
        print(f"✗ Fehlende Abhängigkeit: {e}")
        print("Installiere Abhängigkeiten mit: pip install -r requirements.txt")
        return False

def main():
    print("🐱 CATS Zeiterfassung wird gestartet...")
    
    if not check_requirements():
        sys.exit(1)
    
    print("✓ Server startet auf http://localhost:8000")
    print("✓ Drücke Ctrl+C zum Beenden")
    
    try:
        subprocess.run([
            sys.executable, "-m", "uvicorn", 
            "main:app", 
            "--host", "0.0.0.0", 
            "--port", "8000", 
            "--reload"
        ])
    except KeyboardInterrupt:
        print("\n🐱 CATS Zeiterfassung beendet")

if __name__ == "__main__":
    main()