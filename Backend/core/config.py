from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GOOGLE_API_KEY: str = "AIzaSyCwcfE_VSBhxhFa7LTcQW6hrXQYIJs0Ur4"
    DATABASE_URL: str = "postgresql://postgres:root@localhost:5432/ai_workplace"
    SECRET_KEY: str = "my_super_secret_key_12345"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    CHROMA_PERSIST_DIR: str = "./vector_store"

    class Config:
        env_file = ".env"

settings = Settings()
