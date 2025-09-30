import React from 'react';
import styles from './Footer.module.css';
import tg from '../images/tg.png'; // Импорт изображения для Telegram
import vk from '../images/vk.png'; // Импорт изображения для VK

// Функции иконок (вынесены сюда, без width/height — размер теперь в CSS)
const TelegramIcon = () => <img src={tg} alt="Telegram" />;
const VkIcon = () => <img src={vk} alt="VK" />;

const Footer = ({ data }) => {
  return (
    <footer className={styles.footerComponent}>
      <div className={styles.footerContainer}>
        <div className={styles.footerLeft}>
          {/* Текстовые элементы прижаты к левому краю */}
          <div className={styles.footerOwner}>{data.ownerName}</div>
          <div className={styles.footerCopyright}>{data.copyright}</div>
          <div className={styles.footerAdress}>{data.adress}</div>
        </div>

        <div className={styles.footerRight}>
          {/* Иконки контактов прижаты к правому краю */}
          <div className={styles.footerContacts}>
            <a
              href={data.contacts.telegram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              className={styles.footerIconLink}
            >
              <TelegramIcon />
            </a>
            <a
              href={data.contacts.vk}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="VK"
              className={styles.footerIconLink}
            >
              <VkIcon />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
