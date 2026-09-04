import database, models, seed_universities, seed_v1_data

def recreate():
    print("Recreating database schema with all V1 models...")
    models.Base.metadata.create_all(bind=database.engine)
    print("[OK] Tables created successfully.")

    seed_universities.seed_database()
    print("[OK] Universities seeded.")

    seed_v1_data.seed()
    print("[OK] All V1 data seeded successfully!")

if __name__ == "__main__":
    recreate()
