from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime

class SaveGameData(BaseModel):
    gameId: str = Field(..., description="Идентификатор игры (теперь первичный ключ)")
    players: List[dict] = Field(..., description="Список игроков")
    fouls: List[dict] = Field(..., description="Список фолов")
    gameInfo: dict = Field(..., description="Информация по игре")
    badgeColor: str = Field(..., description="Цвет бейджа")
    eventId: str = Field(..., description="ID события для привязки")
    location: Optional[str] = Field(None, description="Локация игры")

class DeleteGameRequest(BaseModel):
    admin_nickname: str = Field(..., description="Никнейм админа для аутентификации")
    admin_password: str = Field(..., description="Пароль админа для аутентификации")

class UserCreate(BaseModel):
    email: str
    nickname: str
    password: str
    club: str
    name: str

class UserLogin(BaseModel):
    nickname: str
    password: str

class PromoteAdminRequest(BaseModel):
    target_email: str = Field(..., description="Email пользователя, которого нужно сделать админом")
    target_nickname: str = Field(..., description="Никнейм пользователя, которого нужно сделать админом")

class CreateTeamRequest(BaseModel):
    event_id: str = Field(..., description="ID события")
    name: str = Field(..., description="Название команды/пары")
    members: List[str] = Field(..., description="Список ID участников (включая создателя)")

class UpdateProfileRequest(BaseModel):
    userId: str = Field(..., description="ID пользователя для обновления")
    name: str = Field("", description="Имя пользователя")
    club: str = Field("", description="Клуб пользователя")
    favoriteCard: str = Field("", description="Любимая карта")
    vk: str = Field("", description="Ссылка на VK")
    tg: str = Field("", description="Ссылка на Telegram")
    site1: str = Field("", description="Ссылка на сайт 1 (Gomafia)")
    site2: str = Field("", description="Ссылка на сайт 2 (MU)")

class ManageRegistrationRequest(BaseModel):
    action: str = Field(..., description="Действие: 'approve' или 'reject'")

class AvatarUploadResponse(BaseModel):
    url: str

class DeleteAvatarRequest(BaseModel):
    userId: str

class NotificationBase(BaseModel):
    type: str
    message: str
    related_id: Optional[str] = None
    is_read: bool = False
    actions: Optional[List[str]] = None

class NotificationCreate(NotificationBase):
    recipient_id: str
    sender_id: Optional[str] = None

class NotificationResponse(NotificationBase):
    id: str
    created_at: datetime
    recipient_id: str
    sender_id: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class NotificationActionRequest(BaseModel):
    action: str

# --- НОВЫЕ МОДЕЛИ ---
class MarkNotificationsReadRequest(BaseModel):
    notification_ids: List[str]

class TeamActionRequest(BaseModel):
    action: str # "accept" or "decline"

# --- ДОБАВЛЕННАЯ МОДЕЛЬ ---
class UpdateCredentialsRequest(BaseModel):
    userId: str
    current_password: str
    new_nickname: Optional[str] = None
    new_password: Optional[str] = None