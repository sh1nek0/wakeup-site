from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid
from datetime import datetime

from core.security import get_password_hash, verify_password, create_access_token, get_current_user, get_db
from db.models import User
from schemas.main import UserCreate, UserLogin, PromoteAdminRequest, DemoteUserRequest

router = APIRouter()

@router.post("/register")
async def register(user: UserCreate, db: Session = Depends(get_db)):
    valid_clubs = ["WakeUp | MIET", "WakeUp | MIPT", "Другой", "Misis Mafia", "Триада Менделеева"]
    if user.club and user.club not in valid_clubs:
        raise HTTPException(status_code=400, detail="Недопустимое значение клуба")

    existing_user = db.query(User).filter(
        (User.email == user.email) | (User.nickname == user.nickname)
    ).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Пользователь с таким email или nickname уже существует")

    hashed_password = get_password_hash(user.password)
    new_user = User(
        id=f"user_{uuid.uuid4().hex[:12]}",
        email=user.email,
        nickname=user.nickname,
        hashed_password=hashed_password,
        role="user",
        name="",
        club=user.club,
        update_ai=datetime.utcnow(),
        favoriteCard="",
        vk="",
        tg="",
        site1="",
        site2=""
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token(
        data={"sub": new_user.nickname, "role": new_user.role, "id": new_user.id}
    )
    user_data = {
        "id": new_user.id,
        "nickname": new_user.nickname,
        "role": new_user.role,
        'name': new_user.name,
        "club": new_user.club,
        "favoriteCard": new_user.favoriteCard,
        "vk": new_user.vk,
        "tg": new_user.tg,
        "site1": new_user.site1,
        "site2": new_user.site2
    }

    return {
        "message": "Вход выполнен успешно",
        "token": access_token,
        "user": user_data
    }

@router.post("/login")
async def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.nickname == user.nickname).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Неверный nickname или пароль")

    access_token = create_access_token(
        data={"sub": db_user.nickname, "role": db_user.role, "id": db_user.id}
    )

    user_data = {
        "nickname": db_user.nickname,
        "role": db_user.role,
        "id": db_user.id,
        'name': db_user.name,
        "club": db_user.club,
        "favoriteCard": db_user.favoriteCard,
        "vk": db_user.vk,
        "tg": db_user.tg,
        "site1": db_user.site1,
        "site2": db_user.site2,
        "photoUrl": db_user.avatar
    }

    return {
        "message": "Вход выполнен успешно",
        "token": access_token,
        "user": user_data
    }

@router.post("/promote_admin")
async def promote_admin(request: PromoteAdminRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="У вас нет прав для выполнения этого действия")

    target_user = db.query(User).filter(
        (User.email == request.target_email) & (User.nickname == request.target_nickname)
    ).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь с таким email и nickname не найден")

    target_user.role = "admin"
    db.commit()

    return {"message": f"Пользователь {target_user.nickname} успешно повышен до админа"}




@router.post("/demote-user")
async def demote_user_to_regular(
    request: DemoteUserRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Проверка прав: только админ может выполнять
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="У вас нет прав для выполнения этого действия")

    # Поиск целевого пользователя по email и nickname
    target_user = db.query(User).filter(
        (User.email == request.target_email) & (User.nickname == request.target_nickname)
    ).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь с таким email и nickname не найден")

    # Проверка, является ли пользователь уже обычным пользователем
    if target_user.role != "admin":
        raise HTTPException(status_code=400, detail="Пользователь уже не является администратором")

    # Понижение роли до обычного пользователя
    target_user.role = "user"
    db.commit()

    return {"message": f"Пользователь {target_user.nickname} успешно понижен до обычного пользователя"}