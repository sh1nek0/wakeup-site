// EventsPage.jsx
import React, { useState } from 'react';
import styles from './EventPage.module.css';
import CCC from '../CCC.png';
<<<<<<< HEAD
=======
import { NavLink } from "react-router-dom";
>>>>>>> 65d93eb3354d9d38ad50827b4ad7ec0a96b2a007

function EventCardDetailed({ title, dateRange, location, capacity, imageUrl }) {
  const [imageOk, setImageOk] = useState(true);

  return (
    <article className={styles.card}>
      {/* Левая часть */}
      <div className={styles.leftBlock}>
        <div className={styles.headerRow}>
          <h3 className={styles.title}>{title}</h3>
          <div className={styles.locationUnderTitle}>{location}</div>
        </div>
        {capacity && <div className={styles.meta}>{capacity}</div>}
      </div>

      {/* Диагональная полоса */}
      <div className={styles.orangeStripe} />

      {/* Правая часть (картинка + дата) */}
      <div className={`${styles.rightBlock} ${!imageUrl || !imageOk ? styles.noImage : ''}`}>
        {imageUrl && imageOk && (
          <div className={styles.imageContainer}>
            <img
              src={imageUrl}
              alt=""
              className={styles.image}
              onError={() => setImageOk(false)}
            />
            <div className={styles.dateBox}>{dateRange}</div>
          </div>
        )}
      </div>
    </article>
  );
}

export default function EventsPage() {
  const events = [
    {
      id: 2,
      title: 'Cyber Couple Cup',
      dateRange: '22-23.11.25',
      location: 'Физтех, Долгопрудный, ул. Институтская 9',
      capacity: '(0/40) человек',
      imageUrl: CCC,
    },

  ];

  return (
    <div className={styles.page}>
      <div className={styles.headerContainer}>
        <h1 className={styles.pageTitle}>Наши события</h1>
        <p className={styles.pageSubtitle}>
          Тут вы можете посмотреть результаты уже прошедших событий или же
          зарегистрироваться на предстоящее событие
        </p>
      </div>

      {events.map((e) => (
<<<<<<< HEAD
        <EventCardDetailed key={e.id} {...e} />
=======
        <NavLink to={"/Event/"+e.id}><EventCardDetailed key={e.id} {...e} /></NavLink>
>>>>>>> 65d93eb3354d9d38ad50827b4ad7ec0a96b2a007
      ))}
    </div>
  );
}
