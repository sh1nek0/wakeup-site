import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./resultWidget.module.css";
import defaultAvatar from "../NavBar/avatar.png";

const getRoleColor = (role) => {
  switch ((role || "").toLowerCase()) {
    case "мирный":
      return { color: "#FFD700" };
    case "мафия":
      return { color: "#00FFFF" };
    case "дон":
      return { color: "#B266FF" };
    case "шериф":
      return { color: "#FF0000" };
    default:
      return { color: "#ccc" };
  }
};

export default function GameResultsTable() {
  const [gameData, setGameData] = useState(null);
  const [photos, setPhotos] = useState({});
  const storageKeyRef = useRef(null);

  // === Автообновление localStorage ===
  useEffect(() => {
    const pathParts = window.location.pathname.split("/");
    const event = pathParts.find((p) => /^\d+$/.test(p));
    const game = pathParts.find((p) => p.startsWith("game_"));
    if (!event || !game) return;
    const storageKey = `gameData-${event}-${game}`;
    storageKeyRef.current = storageKey;

    const load = () => {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        setGameData((prev) =>
          JSON.stringify(prev) !== JSON.stringify(parsed) ? parsed : prev
        );
      } catch (err) {
        console.error("Ошибка парсинга localStorage:", err);
      }
    };

    load();
    window.addEventListener("storage", load);
    const interval = setInterval(load, 2000);
    return () => {
      window.removeEventListener("storage", load);
      clearInterval(interval);
    };
  }, []);

  // === Загрузка фото игроков ===
  useEffect(() => {
    if (gameData?.players) {
      const nicknames = new Set(
        gameData.players
          .map((p) => p.name)
          .filter((n) => n && n.trim())
          .map((n) => n.trim())
      );
      nicknames.forEach(async (nickname) => {
        try {
          const res = await fetch(`/api/getUserPhoto/${encodeURIComponent(nickname)}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (data.photoUrl) {
            setPhotos((prev) => ({ ...prev, [nickname]: data.photoUrl }));
          }
        } catch (err) {
          console.warn(`Не удалось загрузить фото для ${nickname}:`, err);
        }
      });
    }
  }, [gameData]);

  // === Вычисления внутри useMemo — вызываются всегда ===
  const rows = useMemo(() => {
    if (!gameData || !gameData.players) return [];
    const { players = [], gameInfo = {} } = gameData;
    const winner = gameInfo?.winner || "red";

    return players.map((p) => {
      const jk = Number(p.jk) || 0;
      const sk = Number(p.sk) || 0;
      const plus = Number(p.plus) || 0;
      const minusCards = 0.5 * (jk + sk);
      let total = plus - minusCards;

      const role = (p.role || "").toLowerCase();
      if (winner === "red" && (role === "мирный" || role === "шериф")) total += 2.5;
      if (winner === "black" && (role === "мафия" || role === "дон")) total += 2.5;

      return {
        ...p,
        jk,
        sk,
        plus,
        minusCards: minusCards.toFixed(1),
        total: total.toFixed(1),
      };
    });
  }, [gameData]);

  // === Отрисовка ===
  if (!gameData) {
    return <div className={styles.loading}>Загрузка данных игры...</div>;
  }

  const winner = gameData.gameInfo?.winner || "red";

  return (
    <div className={styles.tableWrapper}>
      <h2 className={styles.title}>
        Итоги игры: {winner === "red" ? " Победа Красных" : " Победа Чёрных"}
      </h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>№</th>
            <th>Фото</th>
            <th>Игрок</th>
            <th>Роль</th>
            <th>Доп</th>
            <th>Минус за карточки</th>
            <th>Итог</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const photoUrl = photos[p.name] || defaultAvatar;
            const roleStyle = getRoleColor(p.role);
            return (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>
                  <img src={photoUrl} alt={p.name} className={styles.avatar} />
                </td>
                <td>{p.name || `Игрок ${p.id}`}</td>
                <td style={roleStyle}>{p.role}</td>
                <td>{p.plus}</td>
                <td>-{p.minusCards}</td>
                <td className={styles.total}>{p.total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
