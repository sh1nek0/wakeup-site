import React, { useState, useEffect, useContext, useCallback, useMemo, useRef } from "react";
import styles from "./EventPage.module.css";
import CCC from "../EventPrew/CCC-prew.png";
import { NavLink } from "react-router-dom";
import { AuthContext } from "../AuthContext";

function formatDateRange(dateRange) {
  if (Array.isArray(dateRange)) return dateRange.join(", ");
  return String(dateRange ?? "");
}

function EventCardDetailed({
  title,
  dateRange,
  location,
  capacity,
  imageUrl,
  type,
  fallbackImage = CCC,
}) {
  const dateText = useMemo(() => formatDateRange(dateRange), [dateRange]);
  const [imgSrc, setImgSrc] = useState(imageUrl || fallbackImage);

  useEffect(() => {
    setImgSrc(imageUrl || fallbackImage);
  }, [imageUrl, fallbackImage]);

  return (
    <article className={styles.card}>
      <div className={styles.leftBlock}>
        <div className={styles.headerRow}>
          <h3 className={styles.title}>{title}</h3>
          <div className={styles.locationUnderTitle}>{location}</div>
          <div className={styles.locationUnderTitle}>
            {type === "solo" ? "Личный" : "Парный"}
          </div>
        </div>

        {capacity && <div className={styles.meta}>{capacity}</div>}
      </div>

      <div className={styles.orangeStripe} />

      <div className={styles.rightBlock}>
        <div className={styles.imageContainer}>
          <img
            src={imgSrc}
            alt=""
            className={styles.image}
            loading="lazy"
            decoding="async"
            onError={() => {
              if (imgSrc !== fallbackImage) setImgSrc(fallbackImage);
            }}
          />
          <div className={styles.dateBox}>{dateText}</div>
        </div>
      </div>
    </article>
  );
}

export default function EventsPage() {
  const [eventsRaw, setEventsRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 6;
  const { user, token } = useContext(AuthContext) ?? {};
  const isAdmin = user?.role === "admin";

  const abortRef = useRef(null);

  // относительный -> абсолютный (если нужно)
  const normalizeImageUrl = useCallback((url) => {
    if (!url) return CCC;
    if (/^https?:\/\//i.test(url)) return url;

    try {
      return new URL(url, window.location.origin).toString();
    } catch {
      return CCC;
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    setLoading(true);

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/events", { signal: controller.signal });
      if (!res.ok) throw new Error("Network response was not ok");
      const data = await res.json();
      setEventsRaw(Array.isArray(data?.events) ? data.events : []);
    } catch (err) {
      if (err?.name === "AbortError") return;
      console.error("Failed to fetch events", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchEvents]);

  // ✅ мемоизация трансформации + сортировки (НОВЫЕ -> СТАРЫЕ)
  const events = useMemo(() => {
    const mapped = (eventsRaw || []).map((event) => {
      const dates = Array.isArray(event?.dates) ? event.dates : [];

 
      const earliestStr = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
      const latestStr = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;

      const earliestDate = earliestStr ? new Date(earliestStr) : null;
      const latestDate = latestStr ? new Date(latestStr) : null;

      return {
        ...event,
        imageUrl: normalizeImageUrl(event?.avatar),
        type: event?.type,
        dateRange: event?.dates,
        capacity: `(${event?.participants_count ?? 0}/${event?.participants_limit ?? 0}) человек`,
        earliestDate,
        latestDate,
      };
    });

    // ✅ сортируем по latestDate: новые события сверху
    mapped.sort((a, b) => {
      const aTime = a.latestDate ? a.latestDate.getTime() : -Infinity;
      const bTime = b.latestDate ? b.latestDate.getTime() : -Infinity;
      return bTime - aTime; // новые -> старые
    });

    return mapped;
  }, [eventsRaw, normalizeImageUrl]);

  // ✅ пагинация
  const totalPagesCalculated = useMemo(() => {
    return Math.max(1, Math.ceil(events.length / itemsPerPage));
  }, [events.length]);

  const currentEvents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return events.slice(start, start + itemsPerPage);
  }, [events, currentPage]);

  // ✅ префетчим картинки только текущей страницы (меньше лишней нагрузки)
  useEffect(() => {
    if (!currentEvents?.length) return;

    const imgs = currentEvents.map((e) => {
      const img = new Image();
      img.src = e.imageUrl || CCC;
      return img;
    });

    return () => {
      imgs.length = 0;
    };
  }, [currentEvents]);

  useEffect(() => {
    if (currentPage > totalPagesCalculated) setCurrentPage(totalPagesCalculated);
  }, [currentPage, totalPagesCalculated]);

  const onPageChange = useCallback(
    (page) => {
      if (page >= 1 && page <= totalPagesCalculated) setCurrentPage(page);
    },
    [totalPagesCalculated]
  );

  const renderPagination = useMemo(() => {
    const pages = [];
    for (let i = 1; i <= totalPagesCalculated; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => onPageChange(i)}
          className={i === currentPage ? `${styles.pageBtn} ${styles.pageActive}` : styles.pageBtn}
          type="button"
        >
          {i}
        </button>
      );
    }
    return pages;
  }, [currentPage, onPageChange, totalPagesCalculated]);

  const createEvent = useCallback(async () => {
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
      gs_role: "ГС",
      gs_avatar: null,
      org_name: "Test Organizer",
      org_role: "Организатор",
      org_avatar: null,
      games_are_hidden: false,
      seating_exclusions: [],
    };

    try {
      const response = await fetch("/api/event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newEventData),
      });

      if (!response.ok) throw new Error("Failed to create event");
      await response.json();
      await fetchEvents();
    } catch (err) {
      console.error("Failed to create event", err);
      alert("Ошибка при создании события. Проверьте консоль.");
    } finally {
      setCreating(false);
    }
  }, [token, fetchEvents]);

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
          <button onClick={createEvent} disabled={creating} className={styles.createGameBtn} type="button">
            {creating ? "Создание..." : "Добавить ивент"}
          </button>
        </div>
      )}

      {loading ? (
        <p>Загрузка событий...</p>
      ) : (
        <>
          {currentEvents.map((e) => (
            <NavLink to={`/Event/${e.id}`} key={e.id}>
              <EventCardDetailed {...e} fallbackImage={CCC} />
            </NavLink>
          ))}

          {totalPagesCalculated > 1 && (
            <div className={styles.pagination}>
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={styles.pageBtn}
                type="button"
              >
                ‹
              </button>

              {renderPagination}

              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPagesCalculated}
                className={styles.pageBtn}
                type="button"
              >
                ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
