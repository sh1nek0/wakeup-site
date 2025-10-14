from sqlalchemy import Column, String, Text, DateTime, Integer, Float, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from .base import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    nickname = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="user")
    club = Column(String, nullable=True)
    update_ai = Column(DateTime, nullable=True, default=None)
    avatar = Column(String, nullable=True)
    name = Column(String, nullable=True)
    favoriteCard = Column(String, nullable=True)
    vk = Column(String, nullable=True)
    tg = Column(String, nullable=True)
    site1 = Column(String, nullable=True)
    site2 = Column(String, nullable=True)

class Game(Base):
    __tablename__ = "games"
    gameId = Column(String, primary_key=True, index=True)
    data = Column(Text)
    event_id = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Event(Base):
    __tablename__ = "events"
    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    dates = Column(String, nullable=False)
    location = Column(String, nullable=False)
    type = Column(String, nullable=False)
    participants_limit = Column(Integer, nullable=False)
    participants_count = Column(Integer, default=0)
    fee = Column(Float, nullable=False)
    currency = Column(String, default="₽")
    gs_name = Column(String, nullable=False)
    gs_role = Column(String, default="ГС турнира")
    gs_avatar = Column(String, nullable=True)
    org_name = Column(String, nullable=False)
    org_role = Column(String, default="Организатор")
    org_avatar = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Team(Base):
    __tablename__ = "teams"
    id = Column(String, primary_key=True, index=True)
    event_id = Column(String, ForeignKey("events.id"), nullable=False)
    name = Column(String, nullable=False)
    members = Column(Text, nullable=False) # JSON: [{"user_id": "...", "status": "pending/approved"}]
    status = Column(String, default="pending", nullable=False) # pending, approved
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    event = relationship("Event", backref="teams")
    creator = relationship("User")


class Registration(Base):
    __tablename__ = "registrations"
    id = Column(String, primary_key=True, index=True)
    event_id = Column(String, ForeignKey("events.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="pending", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")
    event = relationship("Event")

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(String, primary_key=True, index=True)
    recipient_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    sender_id = Column(String, ForeignKey("users.id"), nullable=True)
    type = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    related_id = Column(String, nullable=True)
    is_read = Column(Boolean, default=False)
    actions = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    recipient = relationship("User", foreign_keys=[recipient_id], backref="notifications")
    sender = relationship("User", foreign_keys=[sender_id])