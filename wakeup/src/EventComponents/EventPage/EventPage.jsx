import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useMemo,
  useRef,
} from "react";
import styles from "./EventPage.module.css";
import CCC from "../EventPrew/CCC-prew.png";
import { NavLink } from "react-router-dom";
import { AuthContext } from "../../AuthContext";
import CreateEventForm from "../EventCreateForm/CreateEventForm";

// ---- Вспомогательные функции и константы ----

const ITEMS_PER_PAGE = 6;
const PREFETCH_THRESHOLD = 0.8; // Префетчим следующую страницу при 80% прокрутки

/**
 * Форматирует массив дат в строку.
 */
function formatDateRange(dateRange) {
  return Array.isArray(dateRange) ? dateRange.filter(Boolean).join(", ") : "";
}

/**
 * Нормализует URL изображения.
 */
function normalizeImageUrl(url, fallback = CCC) {
  if (!url) return fallback;
  if (/^https?:\/\//i.test(url)) return url;

  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    console.warn(`Failed to normalize URL: ${url}`);
    return fallback;
  }
}

/**
 * Префетчит изображения для массива событий.
 */
function prefetchImages(events, fallbackImage = CCC) {
  if (!events?.length) return Promise.resolve();

  const imagePromises = events.map((event) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = event.imageUrl || fallbackImage;
      img.onload = () => resolve(img);
      img.onerror = () => {
        console.warn(`Failed to prefetch image: ${event.imageUrl}`);
        resolve(null);
      };
    });
  });

  return Promise.all(imagePromises);
}

// ---- Компоненты ----

/**
 * Детализированная карточка события.
 */
const EventCardDetailed = React.memo(({
  title,
  dateRange,
  location,
  capacity,
  imageUrl,
  type,
  fallbackImage = CCC,
}) => {
  const dateText = useMemo(() => formatDateRange(dateRange), [dateRange]);
  const [imgSrc, setImgSrc] = useState(() => imageUrl || fallbackImage);

  useEffect(() => {
    setImgSrc(imageUrl || fallbackImage);
  }, [imageUrl, fallbackImage]);

  const handleImageError = useCallback(() => {
    setImgSrc(fallbackImage);
  }, [fallbackImage]);

  const typeText = useMemo(() => {
    switch (type) {
      case "solo": return "Личный";
      case "duo": return "Парный";
      default: return "Иное";
    }
  }, [type]);

  return (
    <article className={styles.card}>
      <div className={styles.leftBlock}>
        <div className={styles.headerRow}>
          <h3 className={styles.title}>{title || "Без названия"}</h3>
          <div className={styles.locationUnderTitle}>{location || "Не указано"}</div>
          <div className={styles.locationUnderTitle}>{typeText}</div>
        </div>
        {capacity && <div className={styles.meta}>{capacity}</div>}
      </div>

      <div className={styles.orangeStripe} />

      <div className={styles.rightBlock}>
        <div className={styles.imageContainer}>
          <img
            src={imgSrc}
            alt={title || "Изображение события"}
            className={styles.image}
            loading="lazy"
            decoding="async"
            onError={handleImageError}
          />
          <div className={styles.dateBox}>{dateText}</div>
        </div>
      </div>
    </article>
  );
});

EventCardDetailed.displayName = "EventCardDetailed";

/**
 * Компонент пагинации.
 */
const Pagination = React.memo(({ currentPage, totalPages, onPageChange }) => {
  const handlePrevious = useCallback(() => {
    onPageChange(Math.max(1, currentPage - 1));
  }, [currentPage, onPageChange]);

  const handleNext = useCallback(() => {
    onPageChange(Math.min(totalPages, currentPage + 1));
  }, [currentPage, totalPages, onPageChange]);

  const handlePageClick = useCallback((page) => {
    onPageChange(page);
  }, [onPageChange]);

  if (totalPages <= 1) return null;

  const buttons = [];
  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);

  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    buttons.push(
      <button
        key={i}
        onClick={() => handlePageClick(i)}
        className={i === currentPage ? `${styles.pageBtn} ${styles.pageActive}` : styles.pageBtn}
        type="button"
        aria-label={`Перейти на страницу ${i}`}
      >
        {i}
      </button>
    );
  }

  return (
    <div className={styles.pagination}>
      <button
        onClick={handlePrevious}
        disabled={currentPage === 1}
        className={styles.pageBtn}
        type="button"
        aria-label="Предыдущая страница"
      >
        &lt;
      </button>
      {buttons}
      <button
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className={styles.pageBtn}
        type="button"
        aria-label="Следующая страница"
      >
        &gt;
      </button>
    </div>
  );
});

Pagination.displayName = "Pagination";

/**
 * Основной компонент страницы событий.
 */
function EventsPage() {
  const [eventsRaw, setEventsRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const { user, token } = useContext(AuthContext) || {};
  const isAdmin = user?.role === "admin";
  const abortControllerRef = useRef(null);

  /**
   * Загружает список событий с сервера.
   */
  const fetchEvents = useCallback(async () => {
    setLoading(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/api/events", {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      setEventsRaw(Array.isArray(data?.events) ? data.events : []);
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Failed to fetch events:", error);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, []);

  // Загрузка событий при монтировании
  useEffect(() => {
    fetchEvents();
    return () => abortControllerRef.current?.abort();
  }, [fetchEvents]);

  /**
   * Обработка и сортировка событий.
   */
  const processedEvents = useMemo(() => {
    return (eventsRaw || [])
      .map((event) => {
        const dates = Array.isArray(event?.dates) ? event.dates : [];
        const earliestDate = dates.length ? new Date(Math.min(...dates.map(d => new Date(d)))) : null;
        const latestDate = dates.length ? new Date(Math.max(...dates.map(d => new Date(d)))) : null;

        return {
          ...event,
          imageUrl: normalizeImageUrl(event?.avatar),
          type: event?.type,
          dateRange: dates,
          capacity:
            event?.participants_limit !== undefined && event?.participants_count !== undefined
              ? `${event.participants_count}/${event.participants_limit} человек`
              : null,
          earliestDate,
          latestDate,
        };
      })
      .sort((a, b) => (b.latestDate?.getTime() || -Infinity) - (a.latestDate?.getTime() || -Infinity));
  }, [eventsRaw]);

  /**
   * Расчет пагинации.
   */
  const { totalPages, currentEvents } = useMemo(() => {
    const total = Math.max(1, Math.ceil(processedEvents.length / ITEMS_PER_PAGE));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const events = processedEvents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    
    return { totalPages: total, currentEvents: events };
  }, [processedEvents, currentPage]);

  /**
   * Корректировка текущей страницы при изменении данных.
   */
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  /**
   * Префетчинг изображений.
   */
  useEffect(() => {
    if (!currentEvents.length) return;

    // Префетчим текущую страницу
    prefetchImages(currentEvents)
      .then(() => console.log("Current page images prefetched"))
      .catch(console.error);

    // Префетчим следующую страницу, если она существует
    if (currentPage < totalPages) {
      const nextPageStart = currentPage * ITEMS_PER_PAGE;
      const nextEvents = processedEvents.slice(nextPageStart, nextPageStart + ITEMS_PER_PAGE);
      
      if (nextEvents.length) {
        prefetchImages(nextEvents)
          .then(() => console.log("Next page images prefetched"))
          .catch(console.error);
      }
    }
  }, [currentEvents, currentPage, totalPages, processedEvents]);

  /**
   * Обработчики навигации по страницам.
   */
  const handlePageChange = useCallback((page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [totalPages]);

  /**
   * Обработчики создания событий.
   */
  const createEvent = useCallback(async (eventData) => {
    try {
      const response = await fetch("/api/event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      await fetchEvents();
      return true;
    } catch (error) {
      console.error("Failed to create event:", error);
      return false;
    }
  }, [token, fetchEvents]);

  const handleOpenCreateForm = useCallback(() => setShowCreateForm(true), []);
  const handleCloseCreateForm = useCallback(() => setShowCreateForm(false), []);

  const handleCreateEvent = useCallback(async (eventData) => {
    const success = await createEvent(eventData);
    if (success) handleCloseCreateForm();
    return success;
  }, [createEvent, handleCloseCreateForm]);

  // ---- Рендеринг ----
  return (
    <div className={styles.page}>
      <div className={styles.headerContainer}>
        <h1 className={styles.pageTitle}>Наши события</h1>
        <p className={styles.pageSubtitle}>
          Тут вы можете посмотреть результаты уже прошедших событий или зарегистрироваться на предстоящее событие
        </p>
      </div>

      {isAdmin && (
        <div className={styles.adminControls}>
          <button 
            onClick={handleOpenCreateForm}
            className={styles.createGameBtn}
            type="button"
          >
            Создать новое событие
          </button>
        </div>
      )}

      {loading ? (
        <div className={styles.loadingContainer}>
          <p>Загрузка событий...</p>
        </div>
      ) : (
        <>
          <div className={styles.eventsGrid}>
            {currentEvents.map((event, index) => (
              <NavLink
                key={event.id || index}
                to={`/event/${event.id}`}
                className={styles.eventLink}
              >
                <EventCardDetailed
                  title={event.title}
                  dateRange={event.dateRange}
                  location={event.location}
                  capacity={event.capacity}
                  imageUrl={event.imageUrl}
                  type={event.type}
                />
              </NavLink>
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </>
      )}

      {showCreateForm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <CreateEventForm 
              onCreateEvent={handleCreateEvent}
              onClose={handleCloseCreateForm}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(EventsPage);
