import React, { useState, useEffect, useContext } from 'react';
import styles from './EventPage.module.css';
import CCC from '../EventPrew/CCC-prew.png';
import { NavLink } from "react-router-dom";
import { AuthContext } from "../AuthContext";

function EventCardDetailed({ title, dateRange, location, capacity, imageUrl ,type}) {
  const [imageOk, setImageOk] = useState(true);

  return (
    <article className={styles.card}>
      <div className={styles.leftBlock}>
        <div className={styles.headerRow}>
          <h3 className={styles.title}>{title}</h3>
          <div className={styles.locationUnderTitle}>{location}</div>
          <div className={styles.locationUnderTitle}>{type === "solo" ? "Личный" : "Парный"}</div>
        </div>
        {capacity && <div className={styles.meta}>{capacity}</div>}
      </div>

      <div className={styles.orangeStripe} />

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
  const [creating, setCreating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;
  const { user, token } = useContext(AuthContext) ?? {};
  const isAdmin = user?.role === 'admin';

  const fetchEvents = () => {
    setLoading(true);
    fetch('/api/events')
      .then(res => res.ok ? res.json() : Promise.reject('Network response was not ok'))
      .then(data => {
        const eventsWithImages = data.events.map(event => ({
          ...event,
          imageUrl: event.avatar || CCC,
          type: event.type,
          dateRange: event.dates,
          capacity: `(${event.participants_count}/${event.participants_limit}) человек`,
          earliestDate: new Date(event.dates.reduce((a, b) => a < b ? a : b))
        }))
        .sort((a, b) => a.earliestDate - b.earliestDate);

        setEvents(eventsWithImages);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch events", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const createEvent = async () => {
    setCreating(true);
    const newEventData = {
      title: "Миникап",
      dates: [new Date().toISOString()],
      location: "МИЭТ",
      type: "solo",
      participants_limit: 10,
      fee: 0.0,
      currency: "USD",
      gs_name: "Test GS",
      gs_role: "Admin",
      gs_avatar: null,
      org_name: "Test Organizer",
      org_role: "Organizer",
      org_avatar: null,
      games_are_hidden: false,
      seating_exclusions: []
    };

    try {
      const response = await fetch('/api/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newEventData)
      });

      if (!response.ok) throw new Error('Failed to create event');
      await response.json();
      fetchEvents();
    } catch (err) {
      console.error("Failed to create event", err);
      alert("Ошибка при создании события. Проверьте консоль.");
    } finally {
      setCreating(false);
    }
  };

  // Пагинация
  const totalPagesCalculated = Math.ceil(events.length / itemsPerPage);
  const currentEvents = events.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const onPageChange = (page) => {
    if (page >= 1 && page <= totalPagesCalculated) {
      setCurrentPage(page);
    }
  };

  const renderPagination = () => {
    const pages = [];
    for (let i = 1; i <= totalPagesCalculated; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => onPageChange(i)}
          className={i === currentPage ? `${styles.pageBtn} ${styles.pageActive}` : styles.pageBtn}
        >
          {i}
        </button>
      );
    }
    return pages;
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerContainer}>
        <h1 className={styles.pageTitle}>Наши события</h1>
        <p className={styles.pageSubtitle}>
          Тут вы можете посмотреть результаты уже прошедших событий или зарегистрироваться на предстоящее событие
        </p>
      </div>

      {isAdmin && (
        <div>
          <button onClick={createEvent} disabled={creating} className={styles.createGameBtn}>
            {creating ? "Создание..." : "Добавить ивент"}
          </button>
        </div>
      )}

      {loading ? (
        <p>Загрузка событий...</p>
      ) : (
        <>
          {currentEvents.map(e => (
            <NavLink to={"/Event/" + e.id} key={e.id}>
              <EventCardDetailed {...e} />
            </NavLink>
          ))}

          {totalPagesCalculated > 1 && (
            <div className={styles.pagination}>
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={styles.pageBtn}
              >
                &lt;
              </button>
              {renderPagination()}
              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPagesCalculated}
                className={styles.pageBtn}
              >
                &gt;
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
