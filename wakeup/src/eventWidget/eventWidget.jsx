import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./eventWidget.module.css";
import defaultAvatar from "../NavBar/avatar.png";

function extractEventIdFromPath(pathname) {
  const parts = pathname.split("/").filter(Boolean);

  const fromEventPrefix = parts.find((p) => /^event_[A-Za-z0-9]+$/.test(p));
  if (fromEventPrefix) return fromEventPrefix.replace(/^event_/, "");

  const numeric = parts.find((p) => /^\d+$/.test(p));
  if (numeric) return numeric;

  const idx = parts.findIndex((p) => p === "events");
  if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];

  return null;
}

export default function EventPlayerStatsTable() {
  const [data, setData] = useState(null);
  const [photos, setPhotos] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [page, setPage] = useState(0); // текущая “десятка”
  const lastDataHashRef = useRef("");
  const requestedPhotosRef = useRef(new Set());

  const location = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    const loc = qs.get("location");
    return loc && loc.trim() ? loc.trim() : null;
  }, []);

  // === Загрузка статистики ===
  useEffect(() => {
    const eventId = extractEventIdFromPath(window.location.pathname);
    if (!eventId) {
      setError("Не удалось определить event_id из URL.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const API_BASE = "/api";

    const load = async (isFirst = false) => {
      try {
        if (isFirst) setLoading(true);
        setError("");

        const url =
          `${API_BASE}/events/${encodeURIComponent(eventId)}/player-stats` +
          (location ? `?location=${encodeURIComponent(location)}` : "");

        const res = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        const hash = JSON.stringify(json);
        if (hash !== lastDataHashRef.current) {
          lastDataHashRef.current = hash;
          setData(json);
          setPage(0); // при обновлении данных — на первую десятку
        }
      } catch (e) {
        if (e?.name !== "AbortError") {
          setError(`Ошибка загрузки статистики: ${e.message || String(e)}`);
        }
      } finally {
        if (isFirst) setLoading(false);
      }
    };

    load(true);
    const interval = setInterval(() => load(false), 3000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [location]);

  // === Нормализация строк (без ролей и без id) ===
  const rows = useMemo(() => {
    const players = data?.players || [];
    return players.map((p, i) => ({
      rank: i + 1,
      name: (p?.name || p?.nickname || `Игрок ${i + 1}`).trim(),
      totalPoints: Number(p?.totalPoints || 0),

      totalCi: Number(p?.totalCi || 0),
      totalCb: Number(p?.totalCb || 0),
      skPenalty: Number(p?.total_sk_penalty || 0),
      jkPenalty: Number(p?.total_jk_penalty || 0),

      deaths: Number(p?.deaths || 0),
      deaths1: Number(p?.deathsWith1Black || 0),
      deaths2: Number(p?.deathsWith2Black || 0),
      deaths3: Number(p?.deathsWith3Black || 0),
    }));
  }, [data]);

  // === Фото игроков — без дублей ===
  useEffect(() => {
    if (!rows.length) return;

    rows.forEach(async (r) => {
      const nickname = r.name;
      if (!nickname) return;

      if (photos[nickname] || requestedPhotosRef.current.has(nickname)) return;
      requestedPhotosRef.current.add(nickname);

      try {
        const res = await fetch(`/api/getUserPhoto/${encodeURIComponent(nickname)}`);
        if (!res.ok) return;
        const json = await res.json();
        if (json?.photoUrl) {
          setPhotos((prev) => ({ ...prev, [nickname]: json.photoUrl }));
        }
      } catch {
        // молча
      }
    });
  }, [rows, photos]);

  // === Автосвайп по 10 игроков каждые 10 секунд ===
  useEffect(() => {
    if (!rows.length) return;

    const pagesCount = Math.max(1, Math.ceil(rows.length / 10));

    const timer = setInterval(() => {
      setPage((prev) => (prev + 1) % pagesCount);
    }, 10000);

    return () => clearInterval(timer);
  }, [rows.length]);

  const visibleRows = useMemo(() => {
    const start = page * 10;
    return rows.slice(start, start + 10);
  }, [rows, page]);

  if (loading) return <div className={styles.loading}>Загрузка статистики события...</div>;
  if (error) return <div className={styles.loading}>{error}</div>;
  if (!data || !Array.isArray(data.players)) return <div className={styles.loading}>Нет данных.</div>;

  const pagesCount = Math.max(1, Math.ceil(rows.length / 10));

  return (
    <div className={styles.tableWrapper}>
      <div style={{ marginBottom: 10, opacity: 0.85 }}>
        Событие: <b>{data.event_id}</b> · Игр: <b>{data.total_games}</b>
        {location ? (
          <>
            {" "}
            · Локация: <b>{location}</b>
          </>
        ) : null}
        {" "}
        · Стр: <b>{page + 1}/{pagesCount}</b>
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>Фото</th>
            <th>Игрок</th>
            <th>Очки</th>
            <th>CI</th>
            <th>CB</th>
            <th>СК</th>
            <th>ЖК</th>
            <th>Смерти (1/2/3)</th>
          </tr>
        </thead>

        <tbody>
          {visibleRows.map((r) => {
            const photoUrl = photos[r.name] || defaultAvatar;

            return (
              <tr key={`${r.name}-${r.rank}`}>
                <td>{r.rank}</td>
                <td>
                  <img src={photoUrl} alt={r.name} className={styles.avatar} />
                </td>
                <td style={{ fontWeight: 600 }}>{r.name}</td>
                <td className={styles.total}>{r.totalPoints.toFixed(2)}</td>
                <td>{r.totalCi.toFixed(2)}</td>
                <td>{r.totalCb.toFixed(2)}</td>
                <td>{r.skPenalty.toFixed(2)}</td>
                <td>{r.jkPenalty.toFixed(2)}</td>
                <td>
                  {r.deaths} ({r.deaths1}/{r.deaths2}/{r.deaths3})
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
