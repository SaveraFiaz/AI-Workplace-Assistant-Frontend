from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # These MUST be set as environment variables on Render
    GOOGLE_API_KEY: str = ""
    DATABASE_URL: str = "postgresql://postgres:root@localhost:5432/ai_workplace"
    SECRET_KEY: str = "change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    CHROMA_PERSIST_DIR: str = "./vector_store"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
