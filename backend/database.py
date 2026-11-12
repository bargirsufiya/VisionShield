import os
from urllib.parse import quote_plus

from pathlib import Path
from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).resolve().parent / '.env')
from pymongo import MongoClient

# Load variables from .env
load_dotenv()

# Get username and password
MONGODB_USERNAME = os.getenv("MONGODB_USERNAME")
MONGODB_PASSWORD = os.getenv("MONGODB_PASSWORD")

# Encode username and password
username = quote_plus(MONGODB_USERNAME)
password = quote_plus(MONGODB_PASSWORD)

# MongoDB connection string
MONGODB_URL = (
    f"mongodb+srv://{username}:{password}"
    f"@visionshieldcluster.ckttzeo.mongodb.net/"
    f"?appName=VisionShieldCluster"
)

# Create MongoDB client
client = MongoClient(MONGODB_URL)

# Select database
db = client["VisionShieldDB"]

# Test connection
try:
    client.admin.command("ping")
    print("MongoDB connected successfully!")
except Exception as e:
    print("MongoDB connection failed:", e)
