import os
import certifi

os.environ["SSL_CERT_FILE"] = certifi.where()
os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base, SessionLocal
from .routers import auth, farms, zones, ai, data
from . import models, auth as auth_util

# Create database tables
Base.metadata.create_all(bind=engine)

def migrate_db():
    from sqlalchemy import text
    with engine.connect() as conn:
        for col, col_type in [
            ("irrigation_method", "VARCHAR DEFAULT 'Drip Irrigation'"),
            ("original_duration_minutes", "INTEGER DEFAULT 15"),
            ("added_minutes", "INTEGER DEFAULT 0"),
            ("soil_condition", "TEXT"),
            ("completed_at", "DATETIME")
        ]:
            try:
                conn.execute(text(f"ALTER TABLE irrigation_events ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass

migrate_db()

# Seed default test user & standard zones if needed
def seed_default_user():
    db = SessionLocal()
    try:
        test_email = "shettysapthami15@gmail.com"
        user = db.query(models.User).filter(models.User.email == test_email).first()
        if not user:
            default_user = models.User(
                email=test_email,
                hashed_password=auth_util.get_password_hash("Agrinex@2026"),
                name="Sapthami Shetty",
                language="en"
            )
            db.add(default_user)
            db.commit()
            db.refresh(default_user)
            
            # Create a sample farm for the default user
            sample_farm = models.Farm(
                name="Namfarm",
                location="Bhatkal",
                area=8.0,
                area_unit="acre",
                latitude=13.987,
                longitude=74.556,
                water_availability="Borewell",
                irrigation_method="Drip",
                farming_type="Horticulture",
                owner_id=default_user.id
            )
            db.add(sample_farm)
            db.commit()
            db.refresh(sample_farm)

        # Ensure all existing farms have a full set of standard zones including Zone 2
        all_farms = db.query(models.Farm).all()
        for f in all_farms:
            existing_zones = db.query(models.Zone).filter(models.Zone.farm_id == f.id).all()
            z_names = [z.name for z in existing_zones]
            standard_zones = [
                ("Zone 1", "Tomato", "Red loam", 2.0, "healthy", 52.3),
                ("Zone 2", "Chilli", "Sandy loam", 1.5, "attention", 32.1),
                ("Zone 3", "Ragi", "Red loam", 1.0, "critical", 18.4),
                ("Zone 4", "Mango", "Clay loam", 3.0, "healthy", 48.0),
                ("Zone 5", "Nursery", "Potting mix", 0.5, "irrigating", 65.0)
            ]
            for z_name, z_crop, z_soil, z_area, z_status, z_moist in standard_zones:
                if not any(z_name in name for name in z_names):
                    new_z = models.Zone(
                        name=z_name,
                        crop=z_crop,
                        soil_type=z_soil,
                        area=z_area,
                        area_unit="acre",
                        status=z_status,
                        last_moisture=z_moist,
                        farm_id=f.id
                    )
                    db.add(new_z)
            db.commit()
    except Exception as e:
        print("Error seeding default user / zones:", e)
    finally:
        db.close()

seed_default_user()

app = FastAPI(title="AGRiNEX Farm Intelligence API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Type", "Content-Length"],
)

# Mount routes under /api (matching extracted frontend api.js baseURL)
api_router = FastAPI()
api_router.include_router(auth.router)
api_router.include_router(farms.router)
api_router.include_router(zones.router)
api_router.include_router(ai.router)
api_router.include_router(data.router)

app.mount("/api", api_router)

# Also include directly at root for convenience
app.include_router(auth.router)
app.include_router(farms.router)
app.include_router(zones.router)
app.include_router(ai.router)
app.include_router(data.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to AGRiNEX Farm Intelligence API", "status": "online"}
