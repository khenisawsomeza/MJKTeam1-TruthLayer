from pydantic import BaseModel


class PostData(BaseModel):
    text: str
    source_score: float = 50.0

