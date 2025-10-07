import React, { useState, useEffect } from 'react';
import styles from './EventPage.module.css';
import CCC from '../EventPrew/CCC-prew.png';
import { NavLink } from "react-router-dom";

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
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/events')
      .then(res => {
        if (!res.ok) {
          throw new Error('Network response was not ok');
        }
        return res.json();
      })
      .then(data => {
        const eventsWithImages = data.events.map(event => ({
          ...event,
          imageUrl: CCC, 
          dateRange: event.dates,
          capacity: `(${event.participants_count}/${event.participants_limit}) человек`
        }));
        setEvents(eventsWithImages);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch events", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.headerContainer}>
        <h1 className={styles.pageTitle}>Наши события</h1>
        <p className={styles.pageSubtitle}>
          Тут вы можете посмотреть результаты уже прошедших событий или же
          зарегистрироваться на предстоящее событие
        </p>
      </div>

      {loading ? (
        <p>Загрузка событий...</p>
      ) : (
        events.map((e) => (
          <NavLink to={"/Event/"+e.id} key={e.id}><EventCardDetailed {...e} /></NavLink>
        ))
      )}
    </div>
  );
}