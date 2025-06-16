# MTN MoMo Dashboard

This is a fullstack analytics dashboard that processes, categorizes, and visualizes MTN MoMo SMS data in XML format.

link to video oh how it basically works: https://youtu.be/iHoRYasi03M

#Features
- Upload and parse XML SMS data
- Categorize and store into SQLite database
- View categorized transactions
- Interactive charts using Chart.js
- Download PDF report

# Project Structure
- `backend/`: FastAPI backend to serve data
- `frontend/`: HTML/CSS/JS dashboard
- `data/`: Original XML
- `logs/`: Unprocessed logs
- `momo_sms.db`: SQLite database

# How to Run

cd backend
uvicorn app:app --reload --port 8000
