import React, { useContext, useEffect, useState } from "react";
import styles from "./NavBar.module.css";
import { NavLink, Link, useLocation } from "react-router-dom";
import { AuthContext } from "../AuthContext";
import defaultAvatar from "./avatar.png";
import wh from "../images/WhiteHeart.png";

const Navbar = () => {
  const { user, isAuthenticated, token, logout } = useContext(AuthContext);
  const location = useLocation();
  const [currentUserData, setCurrentUserData] = useState(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

    // При смене страницы закрываем мобильное меню
    setIsMenuOpen(false);

    return () => {
      isCancelled = true;
    };
  }, [user, token, isAuthenticated, location.pathname]);

  const avatarSrc = currentUserData?.photoUrl || user?.photoUrl || defaultAvatar;

  const handleLinkClick = () => {
    setIsMenuOpen(false);
  };

  return (
    <nav className={styles.navbar}>
      {isMenuOpen && <div className={styles.overlay} onClick={() => setIsMenuOpen(false)} />}

      <div className={styles.navbarContainer}>
        <div className={styles.navbarLeft}>
          <div className={styles.navbarLogo}>
            <NavLink to="/" onClick={handleLinkClick}>
              <img src={wh} alt="" />
              <span className={styles.logoHighlight}>WakeUp</span> Mafia
            </NavLink>
          </div>
        </div>

        {/* --- ИЗМЕНЕНИЕ: Восстановлена правильная структура --- */}
        <div className={`${styles.navbarCenter} ${isMenuOpen ? styles.menuOpen : ''}`}>
          <ul className={styles.navbarMenu}>
            <li className={styles.navbarItem}>
              <NavLink to="/events" onClick={handleLinkClick} className={({ isActive }) => (isActive ? styles.active : undefined)}>
                Мероприятия
              </NavLink>
            </li>
            <li className={styles.navbarItem}>
              <NavLink to="/rating" onClick={handleLinkClick} className={({ isActive }) => (isActive ? styles.active : undefined)}>
                Рейтинг
              </NavLink>
            </li>
            <li className={styles.navbarItem}>
              <NavLink to="/players" onClick={handleLinkClick} className={({ isActive }) => (isActive ? styles.active : undefined)}>
                Игроки
              </NavLink>
            </li>
            {isAuthenticated && user && (
              <li className={styles.navbarItem}>
                <NavLink to={`/profile/${user.id}`} onClick={handleLinkClick} className={({ isActive }) => (isActive ? styles.active : undefined)}>
                  Профиль
                </NavLink>
              </li>
            )}
            <li className={styles.navbarItem}>
              <NavLink to="/BTS" onClick={handleLinkClick} className={({ isActive }) => (isActive ? styles.active : undefined)}>
                BTS
              </NavLink>
            </li>
          </ul>
        </div>

        <div className={styles.navbarRight}>
          {isAuthenticated && user ? (
            <div className={styles.userInfo}>
              <Link to="/notifications" className={styles.avatarLink} onClick={handleLinkClick}>
                <img
                  src={avatarSrc}
                  alt="Аватар пользователя"
                  className={styles.userAvatar}
                  key={avatarSrc}
                />
                {unreadNotificationsCount > 0 && (
                  <span className={styles.notificationsBadge}>{unreadNotificationsCount}</span>
                )}
              </Link>
              <Link to={`/profile/${user.id}`} className={styles.userNameLink} onClick={handleLinkClick}>
                <span className={styles.userName}>{user.nickname}</span>
              </Link>
              <button
                onClick={() => { logout(); handleLinkClick(); }}
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
              onClick={handleLinkClick}
            >
              Войти
            </NavLink>
          )}
        </div>

        <button className={styles.hamburger} onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Открыть меню">
            <span className={styles.hamburgerBar}></span>
            <span className={styles.hamburgerBar}></span>
            <span className={styles.hamburgerBar}></span>
        </button>
      </div>
    </nav>
  );
};

export default Navbar;