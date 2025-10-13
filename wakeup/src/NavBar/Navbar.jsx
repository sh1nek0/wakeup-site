import React, { useContext, useEffect, useState } from "react";
import styles from "./NavBar.module.css";
import { NavLink } from "react-router-dom";
import { AuthContext } from "../AuthContext";
import defaultAvatar from "./avatar.png";
import wh from "../images/WhiteHeart.png";

const Navbar = () => {
  const { user, isAuthenticated, token, logout } = useContext(AuthContext);
  const [currentUserData, setCurrentUserData] = useState(null);

  useEffect(() => {
    // Если пользователь вышел, сбрасываем данные
    if (!user || !user.id) {
      setCurrentUserData(null);
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

        if (!res.ok) {
          console.error("NavBar: Failed to fetch user data");
          return;
        }

        const data = await res.json();
        if (!isCancelled) {
          setCurrentUserData(data.user);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("NavBar: Error fetching user data:", err);
        }
      }
    };

    fetchCurrentUser();

    return () => {
      isCancelled = true;
    };
  }, [user, token]); // Перезапрашиваем данные при смене пользователя или токена

  // ИЗМЕНЕНИЕ: Упрощенная и надежная логика получения URL аватара
  // 1. Сначала смотрим свежие данные, полученные через fetch.
  // 2. Если их нет, смотрим данные из AuthContext (могут быть чуть старше).
  // 3. Если и там нет, ставим заглушку.
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
              <NavLink
                to="/events"
                className={({ isActive }) => (isActive ? styles.active : undefined)}
              >
                Мероприятия
              </NavLink>
            </li>
            <li className={styles.navbarItem}>
              <NavLink
                to="/rating"
                className={({ isActive }) => (isActive ? styles.active : undefined)}
              >
                Рейтинг
              </NavLink>
            </li>
            <li className={styles.navbarItem}>
              <NavLink
                to="/players"
                className={({ isActive }) => (isActive ? styles.active : undefined)}
              >
                Игроки
              </NavLink>
            </li>
            {isAuthenticated && user && (
              <li className={styles.navbarItem}>
                <NavLink
                  to={`/profile/${user.id}`}
                  className={({ isActive }) => (isActive ? styles.active : undefined)}
                >
                  Профиль
                </NavLink>
              </li>
            )}
            <li className={styles.navbarItem}>
              <NavLink
                to="/BTS"
                className={({ isActive }) => (isActive ? styles.active : undefined)}
              >
                BTS
              </NavLink>
            </li>
          </ul>
        </div>

        <div className={styles.navbarRight}>
          {isAuthenticated && user ? (
            <div className={styles.userInfo}>
              <img
                src={avatarSrc}
                alt="Аватар пользователя"
                className={styles.userAvatar}
                // Добавим ключ, чтобы React принудительно обновил img при смене src
                key={avatarSrc}
              />
              <span className={styles.userName}>{user.nickname}</span>
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