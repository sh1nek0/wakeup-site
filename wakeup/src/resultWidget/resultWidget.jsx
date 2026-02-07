import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./resultWidget.module.css"; // Убедитесь, что этот путь корректный
import defaultAvatar from "../NavBar/avatar.png"; // Убедитесь, что этот путь корректный

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
  // `storageKey` больше не нужен, так как localStorage используется как fallback, но не основной источник
  // const storageKeyRef = useRef(null);

  // === Загрузка gameState с сервера ===
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
    let initialLoadDone = false; // Флаг для определения, была ли уже загрузка с сервера

    const fetchGameData = async () => {
      try {
        const url = `/api/gameState?gameId=${encodeURIComponent(gameId)}`;
        const res = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!res.ok) {
          if (res.status === 404) {
             console.warn(`Игра с ID ${gameId} не найдена на сервере.`);
             // Если игра не найдена на сервере, попробуем загрузить из localStorage
             const rawFromStorage = localStorage.getItem(`gameData-event-fallback-${gameId}`); // Предполагаемый ключ
             if (rawFromStorage) {
                try {
                   const parsed = JSON.parse(rawFromStorage);
                   setGameData(parsed);
                   console.log("Загружены данные из localStorage как fallback.");
                } catch (err) {
                   console.error("Ошибка парсинга localStorage fallback:", err);
                }
             }
             return; // Прекращаем дальнейшее выполнение, т.к. игра не найдена
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const parsed = await res.json();

        // Обновляем gameData, если данные изменились
        setGameData((prev) =>
          JSON.stringify(prev) !== JSON.stringify(parsed) ? parsed : prev
        );
        initialLoadDone = true; // Отмечаем, что серверная загрузка успешна
      } catch (err) {
        if (err?.name !== "AbortError") {
          console.error("Ошибка загрузки gameState:", err);
          // Если серверная загрузка не удалась, пробуем localStorage
          if (!initialLoadDone) {
             const rawFromStorage = localStorage.getItem(`gameData-event-fallback-${gameId}`); // Предполагаемый ключ
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

    fetchGameData(); // Первоначальная загрузка
    const interval = setInterval(fetchGameData, 1000); // Периодическое обновление

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []); // Зависимость пустая, чтобы запускался только один раз при монтировании

  // === Загрузка фото игроков ===
  useEffect(() => {
    if (gameData?.players) {
      const nicknames = new Set(
        gameData.players
          .map((p) => p.name)
          .filter((n) => n && typeof n === 'string' && n.trim()) // Добавлена проверка типа
          .map((n) => n.trim())
      );
      nicknames.forEach(async (nickname) => {
        // Проверяем, есть ли уже фото, чтобы избежать лишних запросов
        if (photos[nickname]) return;

        try {
          const res = await fetch(`/api/getUserPhoto/${encodeURIComponent(nickname)}`);
          if (!res.ok) {
            // Не бросаем ошибку, если фото не найдено (например, 404)
            console.warn(`Не удалось получить фото для ${nickname}. Статус: ${res.status}`);
            return; // Пропускаем установку фото
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
  }, [gameData, photos]); // Добавлена `photos` в зависимости, чтобы перепроверить, если `photos` обновится
                           // с другим игроком, а `gameData` останется тем же


    // === Вычисления внутри useMemo ===
    // Теперь `rows` вычисляет "total", который будет использоваться в JSX
    const rows = useMemo(() => {
        if (!gameData || !gameData.players) return [];

        const { players = [], gameInfo = {} } = gameData;
        // Получаем победителя, если он есть, иначе по умолчанию "red"
        const winnerTeam = (gameInfo?.winner || "red").toLowerCase();

        return players.map((p, index) => {
            const jk = Number(p.jk) || 0;
            const sk = Number(p.sk) || 0;
            const plus = Number(p.plus) || 0;
            const minusCards = 0.5 * (jk + sk);
            let calculatedTotal = plus - minusCards;

            const role = (p.role || "").toLowerCase();

            // Логика начисления бонусных очков за победу команды
            if (winnerTeam === "red" && (role === "мирный" || role === "шериф")) {
                calculatedTotal += 2.5;
            }
            if (winnerTeam === "black" && (role === "мафия" || role === "дон")) {
                calculatedTotal += 2.5;
            }

            return {
                ...p, // Копируем все свойства игрока
                rank: index + 1, // Ранг основан на порядке в массиве `players`
                jk,
                sk,
                plus,
                minusCards: minusCards.toFixed(1), // Форматируем как строку
                total: calculatedTotal.toFixed(1), // Используем calculatedTotal и форматируем
            };
        });
    }, [gameData]); // Зависимость: только `gameData`


  // === Отрисовка ===
  if (!gameData) {
    return <div className={styles.loading}>Загрузка данных игры...</div>;
  }

  // Получаем победителя для возможной стилизации или информации, хотя в таблице он не используется напрямую
  const winner = gameData.gameInfo?.winner || "red";
  // console.log(rows) // Оставляем для отладки, если нужно

  return (
    <div className={styles.tableWrapper}>
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
            // Используем p.name для поиска фото, fallback на defaultAvatar
            const photoUrl = photos[p.name?.trim()] || defaultAvatar;
            const roleStyle = getRoleColor(p.role);

            return (
              <tr key={p.id || p.name || p.rank}> {/* Использование multiple keys */}
                <td>{p.rank}</td>
                {/* Класс playerCell для адаптивности */}
                <td className={styles.playerCell}>
                  <img src={photoUrl} alt={p.name || `Player ${p.id}`} className={styles.avatar} />
                  {/* Имя игрока */}
                  <span className={styles.playerName}>{p.name?.trim() || `Игрок ${p.id}`}</span>
                </td>
                <td style={roleStyle}>{p.role}</td>
                <td>{p.plus}</td>
                <td>{p.minusCards}</td>
                <td className={styles.total}>
                  {p.sum.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
