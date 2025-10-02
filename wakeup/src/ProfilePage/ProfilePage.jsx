import React from "react";
import styles from "./ProfilePage.module.css";

const ProfilePage = ({
  nickname = "SWAGG",
  name = "Анжелика",
  age = 21,
  favoriteCard = "Шериф",
  club = "WakeUp Mafia | МИЭТ",
  photoSrc = "/profile-photo.jpg",
  number = 3,
  description = "Здесь будет текст описания игрока..."
}) => {
  return (
    <div className={styles.pageWrapper}>
    

      {/* Основная секция профиля */}
      <div className={styles.mainContent}>
        {/* Левая часть: информация и вкладки */}
        <div className={styles.left}>
          <h2 className={styles.nickname}>{nickname}</h2>

          <div className={styles.tabs}>
            <button>Профиль</button>
            <button>Статистика</button>
            <button>Турниры</button>
            <button>Альбомы</button>
          </div>

          <div className={styles.infoBox}>
            <p><span>Имя:</span> {name}</p>
            <p><span>Возраст:</span> {age}</p>
            <p><span>Любимая карта:</span> {favoriteCard}</p>
            <p><span>Клуб:</span> {club}</p>
          </div>
        </div>

        {/* Правая часть: фото и номер */}
        <div className={styles.right}>
          <img src={photoSrc} alt="Фото профиля" className={styles.photo} />
          <div className={styles.number}>{number}</div>
        </div>
      </div>

      {/* Секция описания */}
      <div className={styles.descriptionBox}>
        <h3>Описание игрока</h3>
        <p>{description}</p>
      </div>
    </div>
  );
};

export default ProfilePage;
