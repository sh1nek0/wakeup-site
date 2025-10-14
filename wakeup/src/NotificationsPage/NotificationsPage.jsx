import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../AuthContext';
import styles from './NotificationsPage.module.css';
import { useNavigate } from 'react-router-dom';

const NotificationsPage = () => {
    const { token, isAuthenticated } = useContext(AuthContext);
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchNotifications = async () => {
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/notifications/', {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) throw new Error('Не удалось загрузить уведомления');
            const data = await response.json();
            setNotifications(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
        } else {
            fetchNotifications();
        }
    }, [isAuthenticated, token, navigate]);

    const handleAction = async (notificationId, action) => {
        try {
            const response = await fetch(`/api/notifications/${notificationId}/action`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action }),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Ошибка выполнения действия');
            }
            // После успешного действия обновляем список уведомлений
            fetchNotifications();
        } catch (err) {
            console.error("Error performing action:", err);
            setError(err.message);
        }
    };

    if (loading) {
        return <div className={styles.pageWrapper}><p>Загрузка уведомлений...</p></div>;
    }

    if (error) {
        return <div className={styles.pageWrapper}><p>Ошибка: {error}</p></div>;
    }

    const getActionLabel = (action) => {
        const labels = {
            'approve_registration': 'Одобрить',
            'reject_registration': 'Отклонить',
            'accept_team_invite': 'Принять',
            'decline_team_invite': 'Отклонить',
        };
        return labels[action] || action;
    };

    return (
        <div className={styles.pageWrapper}>
            <main className={styles.main}>
                <h1 className={styles.title}>Уведомления</h1>

                <section className={styles.notificationsList}>
                    {notifications.length === 0 ? (
                        <p className={styles.emptyMessage}>У вас пока нет уведомлений.</p>
                    ) : (
                        notifications.map(n => (
                            <div key={n.id} className={styles.notificationItem}>
                                <div className={styles.notificationContent}>
                                    <p className={styles.notificationMessage}>{n.message}</p>
                                    <span className={styles.notificationDate}>
                                        {new Date(n.created_at).toLocaleString()}
                                    </span>
                                </div>
                                {n.actions && n.actions.length > 0 && (
                                    <div className={styles.notificationActions}>
                                        {n.actions.map(action => (
                                            <button 
                                                key={action}
                                                onClick={() => handleAction(n.id, action)}
                                                className={`${styles.actionBtn} ${styles[action]}`}
                                            >
                                                {getActionLabel(action)}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </section>
            </main>
        </div>
    );
};

export default NotificationsPage;