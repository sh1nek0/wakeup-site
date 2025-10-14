import React, { useEffect, useState, useRef } from 'react';
import CCC_prew from "../EventPrew/Rock.png";
import logo from "../images/CCC.jpg";
import styles from './gameWidget.module.css';
import sheriff from "../images/gameIcon/Sheriff.png";
import Don from "../images/gameIcon/Don.png";
import Golos from "../images/gameIcon/Golos.png";
import Strelba from "../images/gameIcon/Strelba.png";

import OBSWebSocket from 'obs-websocket-js';

const obs = new OBSWebSocket();

async function connectOBS() {
  try {
    await obs.connect("ws://127.0.0.1:4455", "R19022004r"); // пароль из настроек
    console.log("✅ Подключено к OBS");
  } catch (err) {
    console.error("Ошибка подключения:", err);
  }
}

async function switchScene(sceneName) {
  try {
    await obs.call("SetCurrentProgramScene", { sceneName });
    console.log(`🎬 Переключено на сцену: ${sceneName}`);
  } catch (err) {
    console.error("Ошибка переключения сцены:", err);
  }
}

// Пример использования
connectOBS();
// потом вызови: switchScene("Game Scene");

const GameWidget = () => {
  const [gameData, setGameData] = useState(null);
  const [eventId, setEventId] = useState(null);
  const [gameId, setGameId] = useState(null);
  const storageKeyRef = useRef(null);

  // === Извлекаем eventId и gameId из URL ===
  useEffect(() => {
    const pathParts = window.location.pathname.split('/');
    const event = pathParts.find(p => /^\d+$/.test(p));
    const game = pathParts.find(p => p.startsWith('game_'));

    if (!event || !game) {
      console.error('Не удалось извлечь eventId или gameId из URL');
      return;
    }

    setEventId(event);
    setGameId(game);

    const storageKey = `gameData-${event}-${game}`;
    storageKeyRef.current = storageKey;

    // Первоначальная загрузка данных
    const rawData = localStorage.getItem(storageKey);
    if (rawData) {
      try {
        setGameData(JSON.parse(rawData));
      } catch (err) {
        console.error('Ошибка парсинга JSON из localStorage:', err);
      }
    }

    // === Подписка на изменения в localStorage ===
    const handleStorageChange = (e) => {
      if (e.key === storageKey) {
        try {
          const newData = JSON.parse(e.newValue);
          setGameData((prev) => {
            const prevString = JSON.stringify(prev);
            const newString = JSON.stringify(newData);
            if (prevString !== newString) {
              console.log('Обновлены данные игры из localStorage ✅');
              return newData;
            }
            return prev;
          });
        } catch (err) {
          console.error('Ошибка при обновлении данных из localStorage:', err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // === Интервал на случай, если изменения происходят в той же вкладке ===
    const interval = setInterval(() => {
      const currentRaw = localStorage.getItem(storageKeyRef.current);
      if (currentRaw) {
        try {
          const parsed = JSON.parse(currentRaw);
          setGameData((prev) => {
            const prevString = JSON.stringify(prev);
            const newString = JSON.stringify(parsed);
            if (prevString !== newString) {
              console.log('Изменения в localStorage (в той же вкладке) ✅');
              return parsed;
            }
            return prev;
          });
        } catch {}
      }
    }, 2000); // проверка каждые 2 секунды

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  if (!gameData) {
    return <div className={styles.loading}>Загрузка данных игры...</div>;
  }

  // === Формируем список игроков ===
  const players = (gameData.players || []).map((p, i) => ({
    id: p.id ?? i + 1,
    name: p.name && p.name.trim() !== '' ? p.name : `Игрок ${i + 1}`,
    fouls: p.fouls ?? 0,
    role: p.role && p.role.trim() !== '' ? p.role.toLowerCase() : 'неизвестно',
  }));

  const activePlayers = players.slice(0, 8);
  const foldedPlayers = players.slice(8);
  const squares = Array.from({ length: 5 });

  // === Цвета ролей ===
  const getRoleColor = (role) => {
    switch (role) {
      case 'мирный': return { background: 'red', color: 'white' };
      case 'мафия': return { background: 'black', color: 'white' };
      case 'дон': return { background: 'gray', color: 'white' };
      case 'шериф': return { background: '#ffb700ff', color: 'black' };
      default: return { background: '#444', color: 'white' };
    }
  };

  return (
    <div className={styles.fullScreenContainer}>
      {/* Верхняя панель */}
      <div className={styles.topPanel}>
        <div className={styles.iconColumn}>
          {/* Слева: 2 ряда с иконками sheriff и Don */}
          {[sheriff, Don].map((iconSrc, idx) => (
            <div key={idx} className={styles.row}>
              <div className={styles.icon}>
                <img src={iconSrc} alt="" className={styles.iconImage} />
              </div>
              <div className={styles.squares}>
                {squares.map((_, i) => (
                  <div key={i} className={styles.square}></div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.centerInfo}>
          <div className={styles.tableTitle}>Стол 1</div>
          <div className={styles.gameRound}>Игра 1/13</div>
        </div>

        <div className={styles.iconColumn}>
          {/* Справа: 2 ряда с иконками Golos и Strelba */}
          {[Golos, Strelba].map((iconSrc, idx) => (
            <div key={idx} className={styles.row}>
              <div className={styles.squares}>
                {squares.map((_, i) => (
                  <div key={i} className={styles.square}></div>
                ))}
              </div>
              <div className={styles.icon}>
                <img src={iconSrc} alt="" className={styles.iconImage} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Игроки снизу */}
      <div className={styles.cardsSection}>
        <img src={logo} alt="Logo" className={styles.logo} />

        <div className={styles.cardsContainer}>
          {activePlayers.map((player) => {
            const roleStyle = getRoleColor(player.role);
            return (
              <div
                key={player.id}
                className={`${styles.playerCard} ${player.fouls > 0 ? styles.hasFouls : ''}`}
              >
                <img src={CCC_prew} alt="Player preview" className={styles.image} />
                <div className={styles.bottomSection}>
                  <div
                    className={styles.bottomBar}
                    style={{
                      backgroundColor: roleStyle.background,
                      color: roleStyle.color,
                    }}
                  >
                    <span>
                      <span className={styles.playerNumber}>{player.id}</span>
                      <span className={styles.separator}>/</span>
                      <span className={styles.playerName}>{player.name}</span>
                    </span>
                  </div>
                  <div className={styles.dots}>
                    <span></span><span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            );
          })}

          {foldedPlayers.map((player) => {
            const roleStyle = getRoleColor(player.role);
            return (
              <div key={player.id} className={`${styles.playerCard} ${styles.folded}`}>
                <div className={styles.bottomSection}>
                  <div
                    className={styles.bottomBar}
                    style={{
                      backgroundColor: roleStyle.background,
                      color: roleStyle.color,
                    }}
                  >
                    <span>
                      <span className={styles.playerNumber}>{player.id}</span>
                      <span className={styles.separator}>/</span>
                      <span className={styles.playerName}>{player.name}</span>
                    </span>
                  </div>
                  <div className={styles.dots}>
                    <span></span><span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GameWidget;