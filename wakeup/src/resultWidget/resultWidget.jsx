import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./resultWidget.module.css"; // Убедитесь, что этот путь корректный
import defaultAvatar from "../NavBar/avatar.png";
import redWin from "../images/redWin.png";
import blackWin from "../images/blackWin.png"; // Предполагаем, что у вас есть фото для черных

// Helper function for role colors (already looks good)
const getRoleColor = (role) => {
  switch ((role || "").toLowerCase()) {
    case "мирный":
      return { color: "#ff4444" };
    case "мафия":
      return { color: "#00FFFF" };
    case "дон":
      return { color: "#B266FF" };
    case "шериф":
      return { color: "#ffb700" };
    default:
      return { color: "#ccc" };
  }
};

export default function GameResultsTable() {
  const [gameData, setGameData] = useState(null);
  const [photos, setPhotos] = useState({});

  useEffect(() => {
    const pathParts = window.location.pathname.split("/").filter(Boolean);

    const gameId =
      pathParts.find((p) => /^game_[A-Za-z0-9_]+$/.test(p)) ||
      pathParts.find((p) => /^event_[A-Za-z0-9]+_[A-Za-z0-9_]+$/.test(p)) ||
      pathParts.find((p) => /^\d+$/.test(p));

    if (!gameId) {
      console.error("Не удалось определить gameId из URL:", { pathParts });
      return;
    }

    const controller = new AbortController();
    let initialLoadDone = false; 

    const fetchGameData = async () => {
      try {
        const url = `/api/gameState?gameId=${encodeURIComponent(gameId)}`;
        const res = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!res.ok) {
          if (res.status === 404) {
             console.warn(`Игра с ID ${gameId} не найдена на сервере.`);
             const rawFromStorage = localStorage.getItem(`gameData-event-fallback-${gameId}`); 
             if (rawFromStorage) {
                try {
                   const parsed = JSON.parse(rawFromStorage);
                   setGameData(parsed);
                   console.log("Загружены данные из localStorage как fallback.");
                } catch (err) {
                   console.error("Ошибка парсинга localStorage fallback:", err);
                }
             }
             return; 
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const parsed = await res.json();

        setGameData((prev) =>
          JSON.stringify(prev) !== JSON.stringify(parsed) ? parsed : prev
        );
        initialLoadDone = true; 
      } catch (err) {
        if (err?.name !== "AbortError") {
          console.error("Ошибка загрузки gameState:", err);
          if (!initialLoadDone) {
             const rawFromStorage = localStorage.getItem(`gameData-event-fallback-${gameId}`); 
             if (rawFromStorage) {
                try {
                   const parsed = JSON.parse(rawFromStorage);
                   setGameData(parsed);
                   console.log("Загружены данные из localStorage как fallback после ошибки сервера.");
                } catch (err) {
                   console.error("Ошибка парсинга localStorage fallback (после ошибки сервера):", err);
                }
             }
          }
        }
      }
    };

    fetchGameData(); 
    const interval = setInterval(fetchGameData, 1000); 

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []); 

  useEffect(() => {
    if (gameData?.players) {
      const nicknames = new Set(
        gameData.players
          .map((p) => p.name)
          .filter((n) => n && typeof n === 'string' && n.trim()) 
          .map((n) => n.trim())
      );
      nicknames.forEach(async (nickname) => {
        if (photos[nickname]) return;

        try {
          const res = await fetch(`/api/getUserPhoto/${encodeURIComponent(nickname)}`);
          if (!res.ok) {
            console.warn(`Не удалось получить фото для ${nickname}. Статус: ${res.status}`);
            return; 
          }
          const data = await res.json();
          if (data.photoUrl) {
            setPhotos((prev) => ({ ...prev, [nickname]: data.photoUrl }));
          }
        } catch (err) {
          console.warn(`Ошибка при запросе фото для ${nickname}:`, err);
        }
      });
    }
  }, [gameData, photos]); 


    const rows = useMemo(() => {
        if (!gameData || !gameData.players) return [];

        const { players = [], gameInfo = {} } = gameData;
        const winnerTeam = (gameInfo?.badgeColor || "red").toLowerCase();

        return players.map((p, index) => {
            const jk = Number(p.jk) || 0;
            const sk = Number(p.sk) || 0;
            const plus = Number(p.plus) || 0;
            const minusCards = 0.5 * (jk + sk);
            let calculatedTotal = plus - minusCards;

            const role = (p.role || "").toLowerCase();

            if (winnerTeam === "red" && (role === "мирный" || role === "шериф")) {
                calculatedTotal += 2.50;
            }
            if (winnerTeam === "black" && (role === "мафия" || role === "дон")) {
                calculatedTotal += 2.50;
            }

            return {
                ...p, 
                rank: index + 1, 
                jk,
                sk,
                plus: plus.toFixed(2),
                minusCards: minusCards.toFixed(1), 
                total: calculatedTotal.toFixed(2), 
            };
        });
    }, [gameData]); 


  // === Отрисовка ===
  if (!gameData) {
    return <div className={styles.loading}>Загрузка данных игры...</div>;
  }

  const winner = gameData?.badgeColor || "red";
  console.log(gameData?.badgeColor)
  const hasWinner = !!gameData?.badgeColor; // Проверяем, есть ли вообще информация о победителе

  const winPhotoImage = winner === "red" ? redWin : blackWin;

  // Стиль для .winPhoto
  const winPhotoStyles = {
    opacity: hasWinner ? 1 : 0,
    zIndex: hasWinner ? -1 : -2, // Убедитесь, что z-index таблицы выше (-1 для фото, 0-1 для таблицы)
  };

  // Стиль для контейнера таблицы
  const tableContainerStyles = {
    // Пример: Если фото занимает 50%, таблица должна иметь отступ справа
    // Можете настроить процент или использовать фиксированное значение
    marginRight: hasWinner ? "50%" : "0", 
    zIndex: 1, // Убедитесь, что таблица поверх фото
  };

  return (
    <>
      <img 
        src={winPhotoImage} 
        alt={winner === "red" ? "Красная команда победила" : "Черная команда победила"} 
        className={styles.winPhoto} 
        style={winPhotoStyles}
      />

      {/* Контейнер для таблицы, который будет смещаться влево */}
      <div className={styles.tableContainer} style={tableContainerStyles}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>№</th>
                <th>Игрок</th>
                <th>Роль</th>
                <th>Доп</th>
                <th>Минус</th>
                <th>Итог</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const photoUrl = photos[p.name?.trim()] || defaultAvatar;
                const roleStyle = getRoleColor(p.role);

                return (
                  <tr key={p.id || p.name || p.rank}>
                    <td>{p.rank}</td>
                    <td className={styles.playerCell}>
                      <img src={photoUrl} alt={p.name || `Player ${p.id}`} className={styles.avatar} />
                      <span className={styles.playerName}>{p.name?.trim() || `Игрок ${p.id}`}</span>
                    </td>
                    <td style={roleStyle}>{p.role}</td>
                    <td>{p.plus}</td>
                    <td>{p.minusCards}</td>
                    <td className={styles.total}>
                      {p.sum}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
      </div>
    </>
  );
}
