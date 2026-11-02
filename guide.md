# ProofChain: Fresh Windows Setup and Run Guide

This guide takes you from a fresh Windows machine to running ProofChain using the project launcher scripts:

- Start everything: `.\start.ps1`
- Stop launcher-managed services: `.\stop.ps1`

Follow the one-time setup once per machine. After that, use the short start/stop steps whenever you work on the app.

## What you need to install

Install these before continuing:

1. **Git for Windows** — to clone the repository.
2. **Node.js 22 LTS (64-bit)** — includes npm and npx. The frontend build tools need a recent Node version.
3. **Python 3.11 (64-bit)** — enable the option to add Python to PATH if offered.
4. **MongoDB Community Server for Windows**, installed as a Windows service named `MongoDB`.

After installing, open a **new PowerShell window** and check:

```powershell
git --version
node --version
npm --version
python --version
```

## 1. Clone the project

The start and stop scripts currently use the fixed project path `D:\proofchain-phase1-2`. Clone there so both scripts work without edits:

```powershell
git clone https://github.com/SHREE-NIKESH-R/proofchain.git D:\proofchain-phase1-2
Set-Location D:\proofchain-phase1-2
```

If you choose a different folder, change the `$Root` path near the top of **both** `start.ps1` and `stop.ps1` to that folder.

## 2. Create your local environment files

The repository includes safe `.env.example` templates. Create your own local `.env` files from them; this command keeps any files you already have:

```powershell
Set-Location D:\proofchain-phase1-2
if (-not (Test-Path server\.env)) { Copy-Item server\.env.example server\.env }
if (-not (Test-Path client\.env)) { Copy-Item client\.env.example client\.env }
if (-not (Test-Path ai-service\.env)) { Copy-Item ai-service\.env.example ai-service\.env }
if (-not (Test-Path blockchain\.env)) { Copy-Item blockchain\.env.example blockchain\.env }
```

The examples are configured for local development. In `server\.env`, replace the placeholder `JWT_SECRET` with a private random value. Generate one with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the printed value into `JWT_SECRET` in `server\.env`. Keep all `.env` files on your machine; **never commit or send them to GitHub**.

## 3. Install project dependencies

Run these commands from the project root:

```powershell
npm --prefix blockchain ci
npm --prefix server ci
npm --prefix client ci
```

Create the AI service's Python environment and install its CPU dependencies:

```powershell
python -m venv ai-service\venv
ai-service\venv\Scripts\python.exe -m pip install --upgrade pip
ai-service\venv\Scripts\python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cpu
ai-service\venv\Scripts\python.exe -m pip install -r ai-service\requirements.txt
```

The AI dependencies can take a while to download the first time.

## 4. Start MongoDB and seed the asset records

Open PowerShell **as Administrator** if starting the Windows service requires elevated permission:

```powershell
Start-Service MongoDB
```

If MongoDB is already running, this may report that it is running; you can continue. If the service is not installed, install MongoDB Community Server as a Windows service first. The app expects local MongoDB on port `27017`.

Import the bundled ProofChain asset metadata into your local `proofchain` database:

```powershell
Set-Location D:\proofchain-phase1-2
npm --prefix server run db:seed
```

The seed command is safe to repeat: it inserts missing fixture assets and does not replace existing records.

The fixture contains asset metadata, not MongoDB users or all of the original media files. It preserves the original owner IDs and wallets; some owners do not exist in a fresh database. Register a local app account and link a wallet for your own use. Assets whose original owner is not your account may not appear in **My Assets**. File-backed records may have no preview until their original files are restored into `server\uploads`; those files are not in this GitHub repository.

## 5. Start ProofChain

From the project root, run:

```powershell
Set-Location D:\proofchain-phase1-2
.\start.ps1
```

The launcher checks MongoDB, starts Hardhat, deploys the local contract, synchronizes its client artifact, then starts the backend, AI service, and frontend. It prints readiness and local URLs when startup succeeds. The services continue running after the startup script finishes; use `.\stop.ps1` when you are done.

Open the frontend:

```text
http://localhost:5173
```

Other local service URLs:

| Service | URL |
|---|---|
| Frontend | `http://localhost:5173` |
| Backend health check | `http://localhost:5000/health` |
| AI service health check | `http://localhost:8000/health` |
| Local blockchain RPC | `http://127.0.0.1:8545` |
| MongoDB | `mongodb://127.0.0.1:27017/proofchain` |

Create an account in the app on each fresh machine, then link your wallet as prompted. Existing passwords and user accounts are not included in the repository.

## 6. Stop ProofChain

From the project root, run:

```powershell
Set-Location D:\proofchain-phase1-2
.\stop.ps1
```

The stop script stops the service windows started by the launcher. It deliberately leaves MongoDB running. It does not kill unrelated programs that happen to use `node`, `python`, or other shared process names.

## Normal daily use

Once one-time setup is finished, the normal routine is:

```powershell
Set-Location D:\proofchain-phase1-2
.\start.ps1
```

Use the app at `http://localhost:5173`. When finished, open another PowerShell window if needed and run:

```powershell
Set-Location D:\proofchain-phase1-2
.\stop.ps1
```

Do not run `.\start.ps1` a second time while services are already running. The launcher checks its ports, but stop the stack cleanly before starting it again.

## Troubleshooting

### PowerShell says scripts are disabled

Use this command for the current launch without changing the machine-wide policy:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Stop with:

```powershell
powershell -ExecutionPolicy Bypass -File .\stop.ps1
```

### MongoDB service is missing or will not start

Install MongoDB Community Server as the `MongoDB` Windows service. If the service exists but will not start, open PowerShell as Administrator and run `Start-Service MongoDB`. The launcher cannot start the app until MongoDB is listening on port `27017`.

### A required port is already in use

ProofChain uses ports `27017`, `8545`, `5000`, `8000`, and `5173`. Close the other app using a conflicting port, then run `.\start.ps1` again. The launcher intentionally does not terminate unrelated processes.

### The launcher reports missing dependencies

Run the relevant install step again from the project root:

```powershell
npm --prefix blockchain ci
npm --prefix server ci
npm --prefix client ci
ai-service\venv\Scripts\python.exe -m pip install -r ai-service\requirements.txt
```

### The app starts but old file-backed assets have no media

The Git repository has the asset metadata but not the original upload files. Restore the original files into `server\uploads` if you have them. Without those files, the API can still load the asset metadata, but the associated media cannot be displayed or downloaded.

### Check what the launcher started

The launcher records only its own service-window process IDs in `.proofchain-runtime.json`. If startup fails partway through, read the error and the service window output; when a state file was created, run `.\stop.ps1` before retrying. MongoDB is left running.
