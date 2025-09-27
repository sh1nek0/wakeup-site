// HomePage.jsx
import React, { useState, useRef, useEffect } from "react";
import styles from "./HomePage.module.css";
import tg from "../tg.png";
import vk from "../vk.png";
import mietLogo from "../MIETLOGO.png";
import mipt from "../MIPT.png";
import BTS from "../EventPrew/BTS.png";
import CCC from "../EventPrew/CCC-prew.png";
import Dec from "../EventPrew/Dec-main.png";
import Junior from "../EventPrew/Junior.png";
import Rock from "../EventPrew/Rock.png";

const clubs = [
  {
    id: 1,
    name: "WakeUp Mafia | MIET",
    location: "г. Зеленоград, ул. Юности 11",
    days: "Пятница - Суббота",
    iconUrl: mietLogo,
    telegramLink: "https://t.me/club_miet",
    vkLink: "https://vk.com/club_miet",
    leader: "Подкалюк Анна",
  },
  {
    id: 2,
    name: "WakeUp Mafia | MIPT",
    location: "г. Долгопрудный, ул. Юности 11",
    days: "Четверг - Суббота",
    leader: "Подкалюк Анна",
    iconUrl: mipt,
    telegramLink: "https://t.me/club_mipt",
    vkLink: "https://vk.com/club_mipt",
  },
];

const events = [
  {
    id: 4,
    title: "Турнир Десяти",
    imageUrl: Dec,
    backgroundUrl: "linear-gradient(150deg, #070707ff 10%, #320404ff 20%, #ff9646ff 100%)"
  },
  {
    id: 2,
    title: "Cyber Couple Cup",
    imageUrl: CCC,
    backgroundUrl: "linear-gradient(135deg, #414040ff 0%, #4e2403ff 100%)"
  },
  {
    id: 6,
    title: "Break the Silence",
    imageUrl: BTS,
    backgroundUrl: "linear-gradient(150deg, #bf8ee7ff 30%, #560574ff 100%)"
  },
  {
    id: 3,
    title: "WakeUp.Junior",
    imageUrl: Junior,
    backgroundUrl: "linear-gradient(150deg, #E38C33 30%, #000000 100%)"
  },
  {
    id: 5,
    title: "Rock cup",
    imageUrl: Rock,
    backgroundUrl: "linear-gradient(150deg, #dac9b8ee 30%, #892727ff 100%)"
  },
];


const TelegramIcon = () => <img src={tg} alt="Telegram" width="40" height="40" />;
const VkIcon = () => <img src={vk} alt="VK" width="40" height="40" />;



const HomePage = () => {
  const [activeEventId, setActiveEventId] = useState(events[0].id);
  const activeEvent = events.find((e) => e.id === activeEventId);

  // Реф для контейнера с карточками
  const eventsRowRef = useRef(null);

  // При изменении activeEventId скроллим контейнер, чтобы активная карточка была по центру
  useEffect(() => {
    if (!eventsRowRef.current) return;

    const container = eventsRowRef.current;
    const children = Array.from(container.children);
    const activeIndex = events.findIndex((e) => e.id === activeEventId);
    const activeCard = children[activeIndex];

    if (activeCard) {
      const containerRect = container.getBoundingClientRect();
      const cardRect = activeCard.getBoundingClientRect();

      const containerCenter = containerRect.left + containerRect.width / 2;
      const cardCenter = cardRect.left + cardRect.width / 2;
      const scrollOffset = cardCenter - containerCenter;

      container.scrollBy({ left: scrollOffset, behavior: "smooth" });
    }
  }, [activeEventId]);

  const handleEventClick = (eventId) => {
    setActiveEventId(eventId);
  };

  const handleEventKeyDown = (e, eventId) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setActiveEventId(eventId);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>
          Спортивная мафия <br /> МИЭТ и МФТИ
        </h1>
        <p className={styles.description}>
          Присоединяйтесь к клубам спортивной мафии WakeUp Mafia — окунитесь в
          захватывающий мир интеллектуально-психологической игры «Мафия»!
        </p>
        <button className={styles.button}>Присоединяйся к нам</button>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerItem}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="24"
            height="24"
            className={styles.icon}
            aria-hidden="true"
          >
            <path d="M17 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M7 21v-2a4 4 0 0 1 3-3.87" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          100 активных игроков
        </div>
        <div className={styles.footerItem}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="24"
            height="24"
            className={styles.icon}
            aria-hidden="true"
          >
            <path d="M12 20h9" />
            <path d="M12 4h9" />
            <path d="M4 12h16" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Развитие интеллекта и коммуникации
        </div>
        <div className={styles.footerItem}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="24"
            height="24"
            className={styles.icon}
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Игры каждую неделю
        </div>
      </div>

      <section className={styles.clubsSection} aria-label="Наши клубы">
        <h2 className={styles.clubsTitle}>НАШИ КЛУБЫ</h2>
        <div className={styles.clubsList}>
          {clubs.map((club) => (
            <article key={club.id} className={styles.clubCard}>
              <img
                src={club.iconUrl}
                alt={`${club.name} логотип`}
                className={styles.clubIcon}
                loading="lazy"
              />
              <div className={styles.clubInfo}>
                <h3 className={styles.clubName}>{club.name}</h3>
                <p className={styles.clubDetails}>
                  Расположение: {club.location} <br />
                  Игровые дни: {club.days} <br />
                  {club.leader && <>Руководитель: {club.leader}</>}
                </p>
              </div>
              <div className={styles.socialLinks}>
                <a
                  href={club.telegramLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Telegram ${club.name}`}
                  className={styles.socialLink}
                >
                  <TelegramIcon />
                </a>
                <a
                  href={club.vkLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`VK ${club.name}`}
                  className={styles.socialLink}
                >
                  <VkIcon />
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className={styles.y}>
        wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\
      </div>

      <section
        className={styles.eventsSection}
        aria-label="Множество мероприятий"
        style={{
          background: activeEvent ? activeEvent.backgroundUrl : undefined,
        }}
      >
        <div>
          <h2 className={styles.eventsTitle}>МНОЖЕСТВО МЕРОПРИЯТИЙ</h2>
          <div className={styles.eventsRow} ref={eventsRowRef}>
            {events.map((event) => (
              <div
                key={event.id}
                className={`${styles.eventCard} ${
                  event.id === activeEventId ? styles.activeEventCard : ""
                }`}
                onClick={() => handleEventClick(event.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => handleEventKeyDown(e, event.id)}
                aria-pressed={event.id === activeEventId}
                aria-label={`Карточка мероприятия: ${event.title}`}
              >
                <img
                  src={event.imageUrl}
                  alt={event.title}
                  className={styles.eventImage}
                  loading="lazy"
                  draggable={false}
                />
                <div className={styles.eventText}>
                  <strong>{event.title}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.y}>
        wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\wakeup mafia/\
      </div>

     
    </div>
  );
};


export default HomePage;
