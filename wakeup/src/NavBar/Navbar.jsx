import React, { useContext } from 'react';
import styles from './NavBar.module.css';
import { NavLink } from "react-router-dom";
import { AuthContext } from '../AuthContext';
import defaultAvatar from "./avatar.png";
import wh from "../images/WhiteHeart.png"

const Navbar = () => {
  const { user, isAuthenticated, isAdmin, logout } = useContext(AuthContext);

  return (
    <nav className={styles.navbar}>
      <div className={styles.navbarContainer}>
        <div className={styles.navbarLeft}>
          <div className={styles.navbarLogo}>
            <NavLink to="/">
              <img src={wh} alt=''></img>
              <span className={styles.logoHighlight}>WakeUp</span> Mafia
            </NavLink>
          </div>
        </div>

        <div className={styles.navbarCenter}>
          <ul className={styles.navbarMenu}>
            <li className={styles.navbarItem}>
              <NavLink
                to="/events"
                className={({ isActive }) => isActive ? styles.active : undefined}
              >
                Мероприятия
              </NavLink>
            </li>
            <li className={styles.navbarItem}>
              <NavLink
                to="/rating"
                className={({ isActive }) => isActive ? styles.active : undefined}
              >
                Рейтинг
              </NavLink>
            </li>
            {isAuthenticated && (
              <li className={styles.navbarItem}>
                <NavLink to={"/profile/"+user.id} ><li>Профиль</li></NavLink>
              </li>
            )}
            <li className={styles.navbarItem}><NavLink to="/BTS">BTS</NavLink></li>
          </ul>
        </div>

        <div className={styles.navbarRight}>
          {user ? (
            <div className={styles.userInfo}>
              <img
                src={user.avatarUrl ? user.avatarUrl : defaultAvatar}
                alt="Аватар пользователя"
                className={styles.userAvatar}
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