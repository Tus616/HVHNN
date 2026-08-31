# Sahay
### Help Where It Matters

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
- Use `backend/src/main/resources/application-example.properties` as the reference for required backend environment variables.

### 2. Add Secrets

- Fill in Firebase web client values in `frontend/.env`.
- Set `MONGODB_URI`, `JWT_SECRET`, and `CORS_ALLOWED_ORIGINS` through your shell or hosting provider for deployed environments.
- Set `FIREBASE_SERVICE_ACCOUNT_PATH` and `GEMINI_SERVICE_ACCOUNT_PATH` only on machines that need those integrations.
- Do not commit service account JSON, API keys, Maven caches, Firebase caches, or build output.

### Configuration Contract

- Frontend API URL order: `window.__HVHN_CONFIG__.API_URL`, then `VITE_API_URL`, then `http://localhost:8080/api` in Vite development only.
- Production frontend builds fail visibly at runtime if no API URL is supplied.
- Mock API mode is disabled by default. It only turns on in Vite development when `VITE_USE_MOCK=true`.
- Production backend profiles (`prod` or `production`) require `MONGODB_URI`, `JWT_SECRET`, and `CORS_ALLOWED_ORIGINS`.
- Wildcard CORS origins are rejected in production profiles.
- Health checks are available at `/api/health` and `/api/health/ready`.

## Running the Application

### Backend
```bash
cd backend
./mvnw.cmd spring-boot:run
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Validation

```bash
cd frontend
npm test
npm run test:auth
npm run build

cd ../backend
./mvnw.cmd test
./mvnw.cmd package
```

## Local Auth Testing

This Phase 1 auth setup does not need real email credentials. Local OTP email is captured by Mailpit.

Start local services:

Windows PowerShell:
```powershell
docker compose up -d mongodb mailpit
```

Unix shell:
```bash
docker compose up -d mongodb mailpit
```

Mailpit listens on SMTP `localhost:1025` and UI `http://localhost:8025`.

Backend local SMTP settings:
```properties
spring.mail.host=localhost
spring.mail.port=1025
spring.mail.username=
spring.mail.password=
spring.mail.properties.mail.smtp.auth=false
spring.mail.properties.mail.smtp.starttls.enable=false
app.mail.from=no-reply@hvhn.local
```

Run backend and frontend:

Windows PowerShell:
```powershell
cd backend
$env:MONGODB_URI="mongodb://localhost:27017/hvhn"
$env:JWT_SECRET="replace-with-a-long-local-development-secret"
$env:CORS_ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
$env:SMTP_HOST="localhost"
$env:SMTP_PORT="1025"
$env:SMTP_AUTH="false"
$env:SMTP_STARTTLS="false"
$env:MAIL_FROM="no-reply@hvhn.local"
.\mvnw.cmd spring-boot:run
```

Unix shell:
```bash
cd backend
export MONGODB_URI="mongodb://localhost:27017/hvhn"
export JWT_SECRET="replace-with-a-long-local-development-secret"
export CORS_ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
export SMTP_HOST="localhost"
export SMTP_PORT="1025"
export SMTP_AUTH="false"
export SMTP_STARTTLS="false"
export MAIL_FROM="no-reply@hvhn.local"
./mvnw spring-boot:run
```

Then start the frontend:

Windows PowerShell:
```powershell
cd frontend
npm install
npm run dev
```

Unix shell:
```bash
cd frontend
npm install
npm run dev
```

Manual smoke:

1. Open `http://localhost:5173/register`.
2. Request the registration OTP.
3. Open `http://localhost:8025` and read the captured Sahay email.
4. Enter the OTP, complete registration, and finish onboarding.
5. Confirm `GET http://localhost:8080/api/health` and `GET http://localhost:8080/api/health/ready` return healthy responses.

Automated smoke:

Windows PowerShell:
```powershell
cd backend
.\mvnw.cmd -Dtest=AuthPhase1IntegrationTest test
```

Unix shell:
```bash
cd backend
./mvnw -Dtest=AuthPhase1IntegrationTest test
```

The automated smoke uses GreenMail in-process and the `test` profile. It extracts the OTP only from captured test email memory, verifies registration through `/api/auth/register/verify`, validates the Sahay JWT through `/api/users/me`, completes onboarding, verifies login after onboarding, checks volunteer enable/disable behaviour, rejects invalid JWT/OTP, proves OTP reuse fails, and guards that the MongoDB database name contains `test`.

## Firebase Verification

Production Firebase login requires Firebase Admin credentials configured through `FIREBASE_SERVICE_ACCOUNT_PATH`. Tests do not include service-account JSON and do not contact Firebase servers.

The application now verifies Firebase ID tokens through a `FirebaseTokenVerifier` boundary:

- Production implementation uses Firebase Admin SDK.
- Test coverage mocks the verifier and validates the Sahay integration contract.
- `prod` and `production` profiles fail safely when Firebase Admin is unavailable.
- Real Firebase credential-backed runtime verification remains an external environment check, not a source-code test requirement.

## Test Commands

Windows PowerShell:
```powershell
cd frontend
npm test
npm run test:auth
npm run build

cd ..\backend
.\mvnw.cmd test
.\mvnw.cmd -Dtest=AuthPhase1IntegrationTest test
.\mvnw.cmd -DskipTests package
```

Unix shell:
```bash
cd frontend
npm test
npm run test:auth
npm run build

cd ../backend
./mvnw test
./mvnw -Dtest=AuthPhase1IntegrationTest test
./mvnw -DskipTests package
```

## Branch Management

- Frontend changes are pushed to the `frontend` branch.
- Backend changes are pushed to the `backend` branch.
