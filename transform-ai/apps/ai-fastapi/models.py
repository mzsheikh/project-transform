from sqlalchemy import Column, DateTime, Integer, Text, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector

from db import AI_DB_SCHEMA, Base

class AiDocument(Base):
    __tablename__ = "ai_documents"
    __table_args__ = {"schema": AI_DB_SCHEMA}

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    app_code = Column(Text, nullable=False)
    source_type = Column(Text, nullable=False)      # "pdf"
    source_path = Column(Text, nullable=False)
    title = Column(Text, nullable=True)
    meta = Column(JSONB, nullable=False, server_default="{}")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    chunks = relationship("AiChunk", back_populates="document", cascade="all, delete-orphan")


class AiChunk(Base):
    __tablename__ = "ai_chunks"
    __table_args__ = {"schema": AI_DB_SCHEMA}

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    document_id = Column(UUID(as_uuid=True), ForeignKey(f"{AI_DB_SCHEMA}.ai_documents.id", ondelete="CASCADE"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(384), nullable=False)
    meta = Column(JSONB, nullable=False, server_default="{}")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    document = relationship("AiDocument", back_populates="chunks")
