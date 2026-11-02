# ProofChain Development Setup

## First-time setup

Install Node.js 18+, MongoDB, and Python. From the project root, install the three Node dependency sets:

```powershell
cd D:\proofchain-phase1-2\blockchain; npm install
cd D:\proofchain-phase1-2\server; npm install
cd D:\proofchain-phase1-2\client; npm install
```

From the project root, copy the example environment files without overwriting any existing local settings:

```powershell
if (-not (Test-Path server\.env)) { Copy-Item server\.env.example server\.env }
if (-not (Test-Path client\.env)) { Copy-Item client\.env.example client\.env }
if (-not (Test-Path ai-service\.env)) { Copy-Item ai-service\.env.example ai-service\.env }
if (-not (Test-Path blockchain\.env)) { Copy-Item blockchain\.env.example blockchain\.env }
```

Keep the resulting `.env` files local: they are intentionally excluded from Git. Replace the example JWT secret with a private random value and enter any needed credentials locally; never commit them. The example MongoDB URI uses the local `proofchain` database.

Create the AI virtual environment and install its requirements:

```powershell
cd D:\proofchain-phase1-2\ai-service
python -m venv venv
venv\Scripts\python.exe -m pip install -r requirements.txt
```

The launcher uses the existing environment files and ports; it does not modify them.

## Seed the local MongoDB database

After MongoDB is running and the server dependencies are installed, import the bundled asset records:

```powershell
cd D:\proofchain-phase1-2\server
npm run db:seed
```

The script uses `MONGODB_URI` from `server\.env`, or defaults to `mongodb://127.0.0.1:27017/proofchain`. It validates the fixture and inserts records that are not already present by `assetId`; it does not update or delete existing assets. Running it again is safe.

The fixture preserves the original `userId` and wallet values. Some referenced users are not part of this asset-only fixture, so those records may not appear in a signed-in user's **My Assets** list. Their ownership metadata is not reassigned.

The seven file-backed fixture records refer to media files that are not included in Git. Restore those files separately into `server\uploads` if you need their media to be available; the asset metadata can still be imported.

## One-command startup

From the project root:

```powershell
cd D:\proofchain-phase1-2
.\start-proofchain.ps1
```

The script starts MongoDB when needed, opens separate PowerShell windows for Hardhat, the backend, the AI service, and Vite, waits for readiness, deploys the localhost contract, and synchronizes the client contract artifact.

## One-command shutdown

```powershell
cd D:\proofchain-phase1-2
.\stop-proofchain.ps1
```

Shutdown stops only the PowerShell launcher windows recorded in `.proofchain-runtime.json`. It does not stop MongoDB and does not search for or kill processes by generic names such as `node`, `python`, or `powershell`.

## Services and ports

| Service         |  Port | Purpose                                         |
| --------------- | ----: | ----------------------------------------------- |
| MongoDB         | 27017 | Local database for the backend                  |
| Hardhat         |  8545 | Local Ethereum JSON-RPC node                    |
| Express backend |  5000 | API, auth, assets, and blockchain orchestration |
| AI service      |  8000 | FastAPI originality and similarity analysis     |
| Vite frontend   |  5173 | Browser application                             |

URLs:

- Frontend: http://localhost:5173
- Backend: http://localhost:5000
- AI service: http://localhost:8000

## Duplicate detection

Before launching a service, the script checks whether its expected TCP port is already listening. An occupied port is treated as an already-running service and no second copy is started. Hardhat receives an additional JSON-RPC `eth_chainId` check and must report chain ID `31337`. Backend and AI readiness use `/health`; Vite readiness uses its HTTP root.

The runtime state file contains only launcher-created PowerShell window PIDs. Services that were already running are not written as owned processes and are not stopped by the shutdown script.

## Troubleshooting

- **MongoDB service does not exist:** install MongoDB as a Windows service, or start a compatible MongoDB instance manually on port 27017.
- **Port occupied by an unrelated process:** stop that process yourself or change the conflicting local setup. The launcher will not kill it.
- **Hardhat fails:** check the Blockchain PowerShell window and confirm `blockchain\node_modules` exists.
- **Deployment fails:** verify Hardhat is ready and the blockchain dependencies are installed.
- **Client sync fails:** run `npm install` in `client` and confirm the deployment file was created in `blockchain\deployments`.
- **Backend or AI readiness fails:** inspect its PowerShell window for missing `.env` values, MongoDB connectivity errors, or missing dependencies.
- **Python virtual environment is missing:** create `ai-service\venv` and install `requirements.txt` as shown above.
- **Execution policy blocks the script:** run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or invoke the script with `powershell -ExecutionPolicy Bypass -File .\start-proofchain.ps1`.

Startup errors are printed and the script exits non-zero. It does not hide failed deployment, synchronization, or readiness checks.

## Manual startup for debugging

Use separate PowerShell windows:

```powershell
Start-Service MongoDB

cd D:\proofchain-phase1-2\blockchain
npx hardhat node

cd D:\proofchain-phase1-2\blockchain
npx hardhat run scripts/deploy.js --network localhost

cd D:\proofchain-phase1-2\client
npm run sync:contract

cd D:\proofchain-phase1-2\server
npm run dev

cd D:\proofchain-phase1-2\ai-service
venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

cd D:\proofchain-phase1-2\client
npm run dev
```
