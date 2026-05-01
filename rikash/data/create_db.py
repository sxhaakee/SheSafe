"""
SheSafe - Police Station SQLite Database Creator
Run: python create_db.py
"""
import json, sqlite3, os

DIR = os.path.dirname(os.path.abspath(__file__))

def create_database():
    db_path = os.path.join(DIR, "police_stations.db")
    if os.path.exists(db_path):
        os.remove(db_path)
    
    with open(os.path.join(DIR, "police_stations.json"), "r") as f:
        stations = json.load(f)
    
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("""CREATE TABLE police_stations (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL,
        address TEXT NOT NULL, lat REAL NOT NULL,
        lng REAL NOT NULL, phone TEXT NOT NULL,
        jurisdiction TEXT)""")
    c.execute("CREATE INDEX idx_lat_lng ON police_stations (lat, lng)")
    
    for s in stations:
        c.execute("INSERT INTO police_stations VALUES (?,?,?,?,?,?,?)",
            (s["id"], s["name"], s["address"], s["lat"], s["lng"], s["phone"], s.get("jurisdiction","")))
    
    conn.commit()
    c.execute("SELECT COUNT(*) FROM police_stations")
    print(f"Created {db_path} with {c.fetchone()[0]} stations")
    conn.close()

if __name__ == "__main__":
    create_database()
