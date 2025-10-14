import React, { useContext, useEffect, useState } from "react";
import styles from "./NavBar.module.css";
import { NavLink, Link, useLocation } from "react-router-dom"; // <-- Импортируем useLocation
import { AuthContext } from "../AuthContext";
import defaultAvatar from "./avatar.png";
import wh from "../images/WhiteHeart.png";
import bellIcon from "../images/bell.png";

const Navbar = () => {
  const { user, isAuthenticated, token, logout } = useContext(AuthContext);
  const location = useLocation(); // <-- Получаем текущий путь
  const [currentUserData, setCurrentUserData] = useState(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  useEffect(() => {
    if (!user || !user.id) {
      setCurrentUserData(null);
      setUnreadNotificationsCount(0);
      return;
    }

    let isCancelled = false;

    const fetchCurrentUser = async () => {
      try {
        const res = await fetch(`/api/getUser/${encodeURIComponent(user.id)}`, {
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!isCancelled) setCurrentUserData(data.user);
      } catch (err) {
        console.error("NavBar: Error fetching user data:", err);
      }
    };

    const fetchUnreadCount = async () => {
      // Не запрашиваем, если мы уже на странице уведомлений
      if (location.pathname === '/notifications') {
        setUnreadNotificationsCount(0);
        return;
      }
      try {
        const res = await fetch(`/api/notifications/count_unread`, {
          headers: { "Authorization": `Bearer ${token}` },
        });
        if (!res.ok) return;
        const count = await res.json();
        if (!isCancelled) setUnreadNotificationsCount(count);
      } catch (err) {
        console.error("Error fetching unread notifications count:", err);
      }
    };

    fetchCurrentUser();
    if (isAuthenticated && token) {
      fetchUnreadCount();
    }

    return () => {
      isCancelled = true;
    };
  }, [user, token, isAuthenticated, location.pathname]); // <-- Добавляем location.pathname в зависимости

  const avatarSrc = currentUserData?.photoUrl || user?.photoUrl || defaultAvatar;

  return (
    <nav className={styles.navbar}>
      <div className={styles.navbarContainer}>
        <div className={styles.navbarLeft}>
          <div className={styles.navbarLogo}>
            <NavLink to="/">
              <img src={wh} alt="" />
              <span className={styles.logoHighlight}>WakeUp</span> Mafia
            </NavLink>
          </div>
        </div>

        <div className={styles.navbarCenter}>
          <ul className={styles.navbarMenu}>
            <li className={styles.navbarItem}>
              <NavLink to="/events" className={({ isActive }) => (isActive ? styles.active : undefined)}>
                Мероприятия
              </NavLink>
            </li>
            <li className={styles.navbarItem}>
              <NavLink to="/rating" className={({ isActive }) => (isActive ? styles.active : undefined)}>
                Рейтинг
              </NavLink>
            </li>
            <li className={styles.navbarItem}>
              <NavLink to="/players" className={({ isActive }) => (isActive ? styles.active : undefined)}>
                Игроки
              </NavLink>
            </li>
            {isAuthenticated && user && (
              <li className={styles.navbarItem}>
                <NavLink to={`/profile/${user.id}`} className={({ isActive }) => (isActive ? styles.active : undefined)}>
                  Профиль
                </NavLink>
              </li>
            )}
            <li className={styles.navbarItem}>
              <NavLink to="/BTS" className={({ isActive }) => (isActive ? styles.active : undefined)}>
                BTS
              </NavLink>
            </li>
          </ul>
        </div>

        <div className={styles.navbarRight}>
          {isAuthenticated && user ? (
            <div className={styles.userInfo}>
              <Link to="/notifications" className={styles.notificationsIcon}>
                <img src={bellIcon} alt="Уведомления" />
                {unreadNotificationsCount > 0 && (
                  <span className={styles.notificationsBadge}>{unreadNotificationsCount}</span>
                )}
              </Link>
              <img
                src={avatarSrc}
                alt="Аватар пользователя"
                className={styles.userAvatar}
                key={avatarSrc}
              />
              <Link to={`/profile/${user.id}`} className={styles.userNameLink}>
                <span className={styles.userName}>{user.nickname}</span>
              </Link>
              <button
                onClick={logout}
                className={styles.logoutBtn}
                aria-label="Выйти из аккаунта"
              >
                Выйти
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              className={styles.navbarLoginBtn}
              aria-label="Войти в аккаунт"
            >
              Войти
            </NavLink>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;