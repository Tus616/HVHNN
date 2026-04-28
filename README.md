# HVHN (Hyperlocal Verified Help Network)

A community-driven platform for verifying and fulfilling local help requests.

## Project Structure

- `frontend/`: React + Vite application.
- `backend/`: Spring Boot application.

## Prerequisites

- Node.js (v18+)
- Java 17+
- Maven
- MongoDB (or MongoDB Atlas)
- Firebase Project

## Initial Setup

To get the project running locally, follow these steps:

### 1. Configure Environment Variables

Use the provided setup script or manually copy the example files:

**Automatic (Windows/PowerShell):**
```powershell
./setup.ps1
```

**Manual:**
- Copy `frontend/.env.example` to `frontend/.env`
- Copy `backend/src/main/resources/application-example.properties` to `backend/src/main/resources/application.properties`

### 2. Add Secrets

- Fill in your Firebase API keys in `frontend/.env`.
- Fill in your database and security configurations in `backend/src/main/resources/application.properties`.
- Place your Firebase `serviceAccountKey.json` in `backend/src/main/resources/firebase/`.

## Running the Application

### Backend
```bash
cd backend
./mvnw spring-boot:run
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Branch Management

- Frontend changes are pushed to the `frontend` branch.
- Backend changes are pushed to the `backend` branch.
