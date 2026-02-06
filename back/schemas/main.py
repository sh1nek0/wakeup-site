from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any, Union
from datetime import datetime

class SaveGameData(BaseModel):
    gameId: str = Field(..., description="Идентификатор игры (теперь первичный ключ)")
    players: List[dict] = Field(..., description="Список игроков")
    fouls: List[dict] = Field(..., description="Список фолов")
    gameInfo: dict = Field(..., description="Информация по игре")
    badgeColor: str = Field(..., description="Цвет бейджа")
    eventId: str = Field(..., description="ID события для привязки")
    location: Optional[str] = Field(None, description="Локация игры")
    tableNumber: Optional[int] = Field(None, description="Номер стола")
    currentDay: Optional[str] = Field(None, description="Текущий день игры")
    currentPhase: Optional[str] = Field(None, description="Текущая фаза игры")

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

class EventSetupRequest(BaseModel):
    num_rounds: int = Field(..., gt=0, description="Количество раундов/игр на участника")
    num_tables: int = Field(..., gt=0, description="Количество параллельных столов")

class GenerateSeatingRequest(BaseModel):
    exclusions: List[List[str]] = Field([], description="Список пар никнеймов, которых нельзя сажать вместе")
    exclusions_text: str = Field("", description="Текстовое поле с исключениями")


# --- ДОБАВЛЕННАЯ МОДЕЛЬ ---
class UpdateCredentialsRequest(BaseModel):
    userId: str
    current_password: str
    new_nickname: Optional[str] = None
    new_password: Optional[str] = None

# --- НОВАЯ МОДЕЛЬ ДЛЯ СОБЫТИЯ ---
class Event(BaseModel):
    id: str = Field(..., description="Идентификатор события")
    title: str = Field(..., description="Название события")
    dates: List[datetime] = Field(..., description="Список дат проведения события")
    location: Optional[str] = Field(..., description="Локация события")
    type: str = Field(..., description="Тип события")
    participants_limit: int = Field(..., description="Максимальное количество участников")
    participants_count: int = Field(0, description="Текущее количество участников")
    fee: float = Field(..., description="Стоимость участия")
    currency: str = Field(..., description="Валюта оплаты")
    gs_name: str = Field(..., description="Имя игрового сервера")
    gs_role: str = Field(..., description="Роль игрового сервера")
    gs_avatar: Optional[str] = Field(None, description="Аватар игрового сервера (URL)")
    org_name: str = Field(..., description="Имя организатора")
    org_role: str = Field(..., description="Роль организатора")
    org_avatar: Optional[str] = Field(None, description="Аватар организатора (URL)")
    created_at: datetime = Field(..., description="Дата создания события")
    games_are_hidden: bool = Field(False, description="Флаг, скрыты ли игры")
    seating_exclusions: List[List[str]] = Field([], description="Список исключений для рассадки (пары никнеймов)")


class CreateEventRequest(BaseModel):
    title: str = Field(..., description="Название события")
    dates: List[datetime] = Field(..., description="Список дат проведения события")
    location: str = Field(..., description="Локация события")
    type: str = Field(..., description="Тип события (например, 'solo', 'pair', 'team')")
    participants_limit: int = Field(..., gt=0, description="Максимальное количество участников")
    fee: float = Field(..., ge=0, description="Стоимость участия")
    currency: str = Field(..., description="Валюта оплаты")
    gs_name: str = Field(..., description="Имя игрового сервера")
    gs_role: str = Field(..., description="Роль игрового сервера")
    gs_avatar: Optional[str] = Field(None, description="Аватар игрового сервера (URL)")
    org_name: str = Field(..., description="Имя организатора")
    org_role: str = Field(..., description="Роль организатора")
    org_avatar: Optional[str] = Field(None, description="Аватар организатора (URL)")
    games_are_hidden: bool = Field(False, description="Флаг, скрыты ли игры по умолчанию")
    seating_exclusions: List[List[str]] = Field([], description="Список исключений для рассадки (пары никнеймов)")

class UpdateEventRequest(BaseModel):
    title: Optional[str] = None
    dates: Optional[List[str]] = None  # <- строки удобнее для фронта
    location: Optional[str] = None
    type: Optional[str] = None
    participants_limit: Optional[int] = None
    fee: Optional[float] = None
    currency: Optional[str] = None
    gs_name: Optional[str] = None
    gs_role: Optional[str] = None
    gs_avatar: Optional[str] = None
    org_name: Optional[str] = None
    org_role: Optional[str] = None
    org_avatar: Optional[str] = None
    games_are_hidden: Optional[bool] = None
    seating_exclusions: Optional[List[List[str]]] = None

class DemoteUserRequest(BaseModel):
    target_email: str
    target_nickname: str

class GetUsersPhotosRequest(BaseModel):
    nicknames: List[str]  # Список ников

class DeleteUser(BaseModel):
    nickname: Optional[str] = None
    userId: str 

UserIdLike = Union[str, int]  # чтобы принимал и "1" и 1

class ValidatePlayerIn(BaseModel):
    name: str = Field(..., description="Ник игрока (должен совпасть с users.nickname)")
    userId: Optional[UserIdLike] = Field(None, description="users.id (строка), но может прийти числом")
    id: Optional[int] = Field(None, description="номер игрока в игре (1..10)")

class ValidatePlayersRequest(BaseModel):
    players: List[ValidatePlayerIn]

class ValidatePlayersResponse(BaseModel):
    ok: bool
    errors: List[str] = []
    details: List[Dict[str, Any]] = []