
import sqlite3
import uuid

db_path = r"C:\Users\koume\Downloads\code\apps\money-master\data\money-master.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

start_day = 1
end_day = 17
base_year = 2025
base_month = 12

# Values from 11/30
total_value = 7381395.91002
total_cost = 5475338.21284
total_pl = 1906057.69718

print(f"Backfilling {base_year}-{base_month} from day {start_day} to {end_day}...")

for day in range(start_day, end_day + 1):
    date_str = f"{base_year}-{base_month:02d}-{day:02d}"
    
    # Check if exists
    cursor.execute("SELECT id FROM HistoryEntry WHERE date = ?", (date_str,))
    if cursor.fetchone():
        print(f"Skipping {date_str} (already exists)")
        continue

    entry_id = str(uuid.uuid4())
    cursor.execute("""
        INSERT INTO HistoryEntry (id, date, totalValue, totalCost, totalPL, data)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (entry_id, date_str, total_value, total_cost, total_pl, None))
    print(f"Inserted {date_str}")

conn.commit()
conn.close()
print("Done.")
