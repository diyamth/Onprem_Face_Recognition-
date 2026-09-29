# SMG Face Registration & Recognition (On-Prem)

This repository contains the complete on-premise face registration and recognition system for SMG.

## Components

### 1. Frontend (React)
- Operator console
- Face capture with live alignment feedback
- Registration form
- Registered users view
- Pipeline start/stop controls

### 2. Gateway (FastAPI)
- REST APIs for frontend
- Local MongoDB storage
- ZeroMQ orchestration
- Async pipeline callbacks

### 3. Pipeline Simulator
- ZeroMQ-based simulator for AI pipeline
- Supports start/stop commands
- Simulates registration success/failure
- Used for integration testing and demos

## Architecture
- Fully on-prem
- No cloud dependencies
- Async communication via ZeroMQ
- Gateway is source of truth

## Quick Start
See individual README files inside each folder.
