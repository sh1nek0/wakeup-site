import React, { useState } from 'react';
import styles from './EventPage.module.css';
import CCC from "../CCC.png";

const EventCardDetailed = ({ 
  title, 
  description, 
  dateRange, 
  location, 
  participantsCount, 
  ratingSystem, 
  registrationStatus,
  imageUrl  
}) => {
  const [imageLoaded, setImageLoaded] = useState(true);

  return (
    <div className={styles.card}>
      {/* Левая часть: изображение или оранжевый фон */}
      <div className={`${styles.leftBlock} ${!imageUrl || !imageLoaded ? styles.noImage : ''}`}>
        {imageUrl && imageLoaded ? (
          <img 
            src={imageUrl} 
            alt={title} 
            className={styles.image}
            onError={() => setImageLoaded(false)}
          />
        ) : (
          // Пустой блок с фоном из CSS, если нет картинки
          null
        )}
      </div>

      {/* Правая часть: текст */}
      <div className={styles.rightBlock}>
        <h3 className={styles.title} style={{marginBottom: 4}}>{title}</h3>
        <p className={styles.description} style={{marginBottom: 12, textTransform: 'uppercase'}}>{description}</p>
        <div className={styles.details} style={{lineHeight: 1.4}}>
          <div className={styles.detailItem}>
            <span role="img" aria-label="calendar">📅</span>
            <span>{dateRange}</span>
          </div>
          <div className={styles.detailItem}>
            <span role="img" aria-label="location">📍</span>
            <span>{location}</span>
          </div>
          <div className>
            <span>Система оценивания: {ratingSystem}</span>
          </div>
          <div className={styles.detailItem}>
            <span role="img" aria-label="participants">👥</span>
            <span>{participantsCount}</span>
          </div>
          <div className={`${styles.detailItem} ${styles.status}`}>
            <span role="img" aria-label="registration">📝</span>
            <span>Регистрация {registrationStatus.toLowerCase()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const EventsPage = () => {
  const events = [
    {
      id: 2,
      title: "Cyber Couple Cup",
      description: "Парный турнир ССС (Cyber Couple Cup) по спортивной мафии был запущен клубами WakeUp в 2023 году и с тех пор стал одним из самых ожидаемых событий в мире студенческой спортивной мафии. Каждый год он привлекает участников и зрителей своим уникальным форматом и захватывающей атмосферой.",
      dateRange: "22-23 ноября 2025",
      location: "Физтех, Долгопрудный, ул.Инститская 9",
      participantsCount: "0/40 человек",
      registrationStatus: "Открыта",
      ratingSystem: 'MGP',
      imageUrl: CCC
    }
  ];

  return (
    <div className={styles.page}>
      <h1 style={{color: '#ffb74d', marginBottom: 20}}>Список мероприятий</h1>
      {events.map(event => (
        <EventCardDetailed
          key={event.id}
          title={event.title}
          description={event.description}
          dateRange={event.dateRange}
          location={event.location}
          ratingSystem={event.ratingSystem}
          participantsCount={event.participantsCount}
          registrationStatus={event.registrationStatus}
          imageUrl={event.imageUrl}
        />
      ))}
    </div>
  );
};

export default EventsPage;
