import React, { useState, useEffect,useContext } from 'react';
import styles from './EventPage.module.css';
import CCC from '../EventPrew/CCC-prew.png';
import { NavLink } from "react-router-dom";
import { AuthContext } from "../AuthContext";

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
  const [creating, setCreating] = useState(false);
  const { user, token, isAuthenticated } = useContext(AuthContext) ?? {};

  // Функция для загрузки списка событий (предполагается, что backend имеет GET /api/events)
  const fetchEvents = () => {
    setLoading(true);
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
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // Функция для создания нового события (с заглушками - hardcoded данными)
  const createEvent = async () => {
    setCreating(true);
    // Заглушки для полей события (можно заменить на форму позже)
    const newEventData = {
      title: "Тестовое событие",  // Заглушка: название
      dates: [new Date().toISOString()],  // Заглушка: одна дата на сегодня
      location: "Тестовая локация",  // Заглушка: локация
      type: "solo",  // Заглушка: тип
      participants_limit: 100,  // Заглушка: лимит участников
      fee: 0.0,  // Заглушка: бесплатное
      currency: "USD",  // Заглушка: валюта
      gs_name: "Test GS",  // Заглушка: имя GS
      gs_role: "Admin",  // Заглушка: роль GS
      gs_avatar: null,  // Заглушка: аватар GS
      org_name: "Test Organizer",  // Заглушка: имя орг
      org_role: "Organizer",  // Заглушка: роль орг
      org_avatar: null,  // Заглушка: аватар орг
      games_are_hidden: false,  // Заглушка: игры видимы
      seating_exclusions: []  // Заглушка: без исключений
    };

    try {
      const response = await fetch('/api/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
          // Для теста предполагаем, что backend позволяет без токена или используйте заглушку
        },
        body: JSON.stringify(newEventData)
      });

      if (!response.ok) {
        throw new Error('Failed to create event');
      }

      const result = await response.json();
      console.log("Event created:", result);

      // После создания перезагружаем список событий для отображения нового
      fetchEvents();
    } catch (err) {
      console.error("Failed to create event", err);
      alert("Ошибка при создании события. Проверьте консоль.");  // Заглушка для ошибки
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerContainer}>
        <h1 className={styles.pageTitle}>Наши события</h1>
        <p className={styles.pageSubtitle}>
          Тут вы можете посмотреть результаты уже прошедших событий или же
          зарегистрироваться на предстоящее событие
        </p>
      </div>
      <div>
        <button onClick={createEvent} disabled={creating}  className={styles.createGameBtn}>
          {creating ? "Создание..." : "Добавить ивент"}  {/* Заглушка: кнопка с состоянием */}
        </button>
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
