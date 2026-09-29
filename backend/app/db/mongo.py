from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError, ConnectionFailure
import os
import logging

logger = logging.getLogger(__name__)

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")

try:
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    # Verify the connection
    client.admin.command('ping')
    logger.info(f"✓ Successfully connected to MongoDB at {MONGO_URL}")
except (ServerSelectionTimeoutError, ConnectionFailure) as e:
    logger.error(f"✗ Failed to connect to MongoDB at {MONGO_URL}")
    logger.error(f"Error: {e}")
    logger.warning("Make sure MongoDB is running and MONGO_URL is correct")
    raise

db = client["smg_face"]
users_collection = db["users"]
verification_collection = db["verifications"]
# Face recognition database (written by edge device)
face_recognition_db = client["face_recognition"]
face_recognition_users_collection = face_recognition_db["users"]
