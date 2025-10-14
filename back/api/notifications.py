from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional
import uuid
import json
from datetime import datetime

from core.security import get_current_user, get_db
from db.models import Notification, User, Registration, Event
from schemas.main import NotificationResponse, NotificationActionRequest, MarkNotificationsReadRequest

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("/", response_model=List[NotificationResponse])
async def get_and_mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    # Сначала получаем все уведомления
    notifications = db.query(Notification).filter(
        Notification.recipient_id == current_user.id
    ).order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()
    
    # Затем помечаем их все как прочитанные
    db.query(Notification).filter(
        Notification.recipient_id == current_user.id,
        Notification.is_read == False
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()

    # Декодируем JSON-строку с действиями в список для ответа
    for n in notifications:
        if n.actions:
            try:
                n.actions = json.loads(n.actions)
            except (json.JSONDecodeError, TypeError):
                n.actions = []
            
    return notifications

@router.get("/count_unread", response_model=int)
async def count_unread_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    count = db.query(Notification).filter(
        Notification.recipient_id == current_user.id,
        Notification.is_read == False
    ).count()
    return count

# Эндпоинты /read и /read_all больше не нужны, но оставим /action
@router.post("/{notification_id}/action", response_model=dict)
async def perform_notification_action(
    notification_id: str,
    request: NotificationActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notification = db.query(Notification).options(selectinload(Notification.sender)).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Уведомление не найдено")
    if notification.recipient_id != current_user.id:
        raise HTTPException(status_code=403, detail="У вас нет прав на это действие")
    
    valid_actions = json.loads(notification.actions) if notification.actions else []
    if request.action not in valid_actions:
        raise HTTPException(status_code=400, detail="Недопустимое действие для этого уведомления")

    message = "Действие не определено"

    if request.action in ["approve_registration", "reject_registration"]:
        from api.events import manage_registration_logic
        registration_id = notification.related_id
        action = "approve" if request.action == "approve_registration" else "reject"
        
        result = await manage_registration_logic(registration_id, action, current_user, db)
        message = result.get("message", "Действие выполнено")
        
        db.delete(notification)
        db.commit()

    elif request.action in ["accept_team_invite", "decline_team_invite"]:
        from api.events import manage_team_invite_logic
        team_id = notification.related_id
        action = "accept" if request.action == "accept_team_invite" else "decline"
        
        result = await manage_team_invite_logic(team_id, action, current_user, db)
        message = result.get("message", "Действие выполнено")

        db.delete(notification)
        db.commit()

    else:
        raise HTTPException(status_code=400, detail="Логика для этого действия еще не реализована")

    return {"message": message}

def create_notification(
    db: Session,
    recipient_id: str,
    type: str,
    message: str,
    sender_id: Optional[str] = None,
    related_id: Optional[str] = None,
    actions: Optional[List[str]] = None,
    commit: bool = True
) -> Notification:
    notification = Notification(
        id=f"notif_{uuid.uuid4().hex[:12]}",
        recipient_id=recipient_id,
        sender_id=sender_id,
        type=type,
        message=message,
        related_id=related_id,
        actions=json.dumps(actions) if actions else None,
        created_at=datetime.utcnow()
    )
    db.add(notification)
    if commit:
        db.commit()
        db.refresh(notification)
    return notification

@router.post("/send_to_admins")
async def send_notification_to_admins(
    message: str,
    notification_type: str,
    related_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Только администраторы могут отправлять уведомления")
    
    admin_users = db.query(User).filter(User.role == "admin").all()
    for admin in admin_users:
        create_notification(
            db,
            recipient_id=admin.id,
            type=notification_type,
            message=message,
            sender_id=current_user.id,
            related_id=related_id
        )
    return {"message": f"Уведомление '{message}' отправлено всем администраторам."}