import{ React,useContext} from "react";
import styles from "./ProfilePage.module.css";
import avatar from  "../images/profile_photo/soon.png"
import { AuthContext } from '../AuthContext';



const ProfilePage = ({
  

  nickname = "SWAGG",
  name = "Здесь будет твое имя",
  age = 21,
  favoriteCard = "Шериф",
  club = "WakeUp Mafia | МИЭТ",
  photoSrc = avatar,
  number = 3,
  description = "Здесь будет текст описания игрока..."
}) => {

  const { user, loading } = useContext(AuthContext);

  // --- ИСПРАВЛЕНИЕ ---
  // Если auth state еще определяется, показываем заглушку
  if (loading) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.mainContent}>
          Загрузка...
        </div>
      </div>
    );
  }
  
  // Если пользователь не загружен после проверки, показываем заглушку
  if (!user) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.mainContent}>
          Загрузка профиля...
        </div>
      </div>
    );
  }
  // --- КОНЕЦ ИСПРАВЛЕНИЯ ---

  const isAdmin = user && user.role === 'admin';
  console.log(user)
  return (
    <div className={styles.pageWrapper}>
    

      {/* Основная секция профиля */}
      <div className={styles.mainContent}>
        {/* Левая часть: информация и вкладки */}
        <div className={styles.left}>
          <h2 className={styles.nickname}>{user.nickname}</h2>

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