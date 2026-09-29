# Gateway Service (FastAPI)

## Responsibilities
- Exposes HTTP APIs to frontend
- Stores user data in MongoDB
- Communicates with AI pipeline via ZeroMQ
- Maintains registration state

## Run Locally

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
