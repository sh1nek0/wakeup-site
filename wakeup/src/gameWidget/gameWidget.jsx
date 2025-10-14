import React, { useEffect, useState, useRef } from "react";
import CCC_prew from "../EventPrew/Rock.png";
import logo from "../images/CCC.jpg";
import sheriff from "../images/gameIcon/Sheriff.png";
import Don from "../images/gameIcon/Don.png";
import Golos from "../images/gameIcon/Golos.png";
import Strelba from "../images/gameIcon/Strelba.png";
import OBSWebSocket from "obs-websocket-js";
import styles from "./gameWidget.module.css";

const obs = new OBSWebSocket();

async function connectOBS() {
  try {
    await obs.connect("ws://127.0.0.1:4455", "R19022004r");
    console.log("✅ Подключено к OBS");
  } catch (err) {
    console.error("Ошибка подключения к OBS:", err);
  }
}
connectOBS();

const SLOTS = 5;
const NEUTRAL_GRAY = "#6b7280";
const MAX_FOULS = 4;

/* ========= утилиты ========= */

// ЧИСЛА из значений (не из произвольных ключей)
function extractNumbersFromAny(val, addNumber) {
  if (val == null) return;
  if (typeof val === "number" && Number.isFinite(val)) {
    addNumber(val);
    return;
  }
  if (typeof val === "string") {
    const matches = val.match(/\d+/g);
    if (matches) matches.forEach((d) => addNumber(Number(d)));
    return;
  }
  if (Array.isArray(val)) {
    val.forEach((v) => extractNumbersFromAny(v, addNumber));
    return;
  }
  if (typeof val === "object") {
    Object.values(val).forEach((v) => extractNumbersFromAny(v, addNumber));
  }
}

// ДИСПЛЕЙ-ТОКЕНЫ (числа + «-»)
function extractDisplayTokensFromAny(val, addToken) {
  if (val == null) return;
  if (typeof val === "number" && Number.isFinite(val)) {
    addToken(val);
    return;
  }
  if (typeof val === "string") {
    const digits = val.match(/\d+/g);
    if (digits && digits.length) {
      digits.forEach((d) => addToken(Number(d)));
    } else {
      const t = val.trim();
      if (t === "-" || t === "—") addToken("-");
    }
    return;
  }
  if (Array.isArray(val)) {
    val.forEach((v) => extractDisplayTokensFromAny(v, addToken));
    return;
  }
  if (typeof val === "object") {
    Object.values(val).forEach((v) => extractDisplayTokensFromAny(v, addToken));
  }
}

function getDayNode(results, dayKey) {
  if (!results || typeof results !== "object") return null;
  if (dayKey && Object.prototype.hasOwnProperty.call(results, dayKey)) {
    return results[dayKey];
  }
  return results;
}

// число дня из строки ключа (например "Д.2" -> 2)
function dayIndex(k) {
  const m = String(k).match(/\d+/);
  return m ? Number(m[0]) : Infinity;
}

function hasDayPartitions(obj) {
  if (!obj || typeof obj !== "object") return false;
  return Object.keys(obj).some((k) => /\d+/.test(k));
}

// собрать ЧИСЛА из узла только по заданным ключам
function extractNumbersAtKeys(node, keys, addNumber) {
  if (!node || typeof node !== "object") return;
  keys.forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(node, k)) {
      extractNumbersFromAny(node[k], addNumber);
    }
  });
}

// ЛОГИКА: собрать номера из всех дней <= текущего (или из всего узла, если дней нет)
function getNumbersUpToDayByKeys(results, currentDayKey, keys, minId = 1, maxId = 100) {
  const out = new Set();
  const addNumber = (n) => {
    if (Number.isFinite(n) && n >= minId && n <= maxId) out.add(n);
  };

  if (!results || typeof results !== "object") return [];

  const curIdx = dayIndex(currentDayKey || "");
  if (hasDayPartitions(results)) {
    for (const k of Object.keys(results)) {
      if (dayIndex(k) <= curIdx) {
        const node = results[k];
        if (!keys || !keys.length) extractNumbersFromAny(node, addNumber);
        else extractNumbersAtKeys(node, keys, addNumber);
      }
    }
  } else {
    if (!keys || !keys.length) extractNumbersFromAny(results, addNumber);
    else extractNumbersAtKeys(results, keys, addNumber);
  }

  return Array.from(out).sort((a, b) => a - b);
}

// ВИЗУАЛ: токены только за текущий день
function getDisplayTokensForDay(results, dayKey) {
  const tokens = [];
  const node = getDayNode(results, dayKey);
  if (!node) return [];
  extractDisplayTokensFromAny(node, (t) => tokens.push(t));
  return tokens;
}

function tokensToSlots(tokens, slots = SLOTS) {
  if (tokens.length <= slots) return tokens;
  return [...tokens.slice(0, slots - 1), `+${tokens.length - (slots - 1)}`];
}

function getRoleColor(role) {
  switch ((role || "").toLowerCase()) {
    case "мирный":
      return { background: "red", color: "white" };
    case "мафия":
      return { background: "black", color: "white" };
    case "дон":
      return { background: "gray", color: "white" };
    case "шериф":
      return { background: "#ffb700", color: "black" };
    default:
      return { background: "#444", color: "white" };
  }
}

/* ========= компонент ========= */

const GameWidget = () => {
  const [gameData, setGameData] = useState(null);
  const storageKeyRef = useRef(null);

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

  if (!gameData)
    return <div className={styles.loading}>Загрузка данных игры...</div>;

  const players = (gameData.players || []).map((p, i) => ({
    id: p.id ?? i + 1,
    name: p.name && p.name.trim() ? p.name : `Игрок ${i + 1}`,
    fouls: p.fouls ?? 0,
    role: p.role?.trim()?.toLowerCase() || "неизвестно",
  }));

  const maxId = players.length
    ? Math.max(...players.map((p) => Number(p.id) || 0))
    : 10;

  const playerIndex = Object.fromEntries(players.map((p) => [Number(p.id), p]));

  const gi = gameData.gameInfo || {};
  const dayKey = gameData.currentDay || null;

  // ВИЗУАЛ (только текущий день)
  const votingDisplay = tokensToSlots(getDisplayTokensForDay(gi.votingResults || {}, dayKey));
  const shootingDisplay = tokensToSlots(getDisplayTokensForDay(gi.shootingResults || {}, dayKey));
  const sheriffDisplay = tokensToSlots(getDisplayTokensForDay(gi.sheriffResults || {}, dayKey));
  const donDisplay = tokensToSlots(getDisplayTokensForDay(gi.donResults || {}, dayKey));

  // ЛОГИКА сворачивания (все дни <= текущего)
  const VOTE_OUT_KEYS = ["votes", "result", "out", "lynch", "lynched", "votedOut", "eliminated"];
  const NIGHT_KILL_KEYS = ["result", "killed", "shot", "dead"];

  const votedOutSet = new Set(
    getNumbersUpToDayByKeys(gi.votingResults || {}, dayKey, VOTE_OUT_KEYS, 1, maxId)
  );
  const shotSet = new Set(
    getNumbersUpToDayByKeys(gi.shootingResults || {}, dayKey, NIGHT_KILL_KEYS, 1, maxId)
  );

  const getSquareColorsByContent = (content) => {
    const str = content == null ? "" : String(content).trim();
    if (str === "" || str === "-" || str === "—" || str.startsWith("+")) {
      return { background: NEUTRAL_GRAY, color: "#fff" };
    }
    let num = null;
    if (typeof content === "number") num = content;
    else if (/^\d+$/.test(str)) num = Number(str);
    if (num != null && playerIndex[num]) {
      return getRoleColor(playerIndex[num].role);
    }
    return { background: NEUTRAL_GRAY, color: "#fff" };
  };

  const renderIconRow = (iconSrc, displayTokens, side) => {
    const Square = ({ content, idx }) => {
      const roleStyle = getSquareColorsByContent(content);
      return (
        <div
          key={idx}
          className={styles.square}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            background: roleStyle.background,
            color: roleStyle.color,
            border: "none",
          }}
        >
          {content}
        </div>
      );
    };

    return (
      <div className={styles.row}>
        {side === "left" && (
          <div className={styles.icon}>
            <img src={iconSrc} alt="" className={styles.iconImage} />
          </div>
        )}
        <div className={styles.squares}>
          {displayTokens.map((val, i) => (
            <Square key={i} content={val} idx={i} />
          ))}
        </div>
        {side === "right" && (
          <div className={styles.icon}>
            <img src={iconSrc} alt="" className={styles.iconImage} />
          </div>
        )}
      </div>
    );
  };

  const renderFouls = (count) => {
    const n = Math.max(0, Math.min(MAX_FOULS, Number(count) || 0));
    return (
      <div className={styles.foulsRow} aria-label={`Фолы: ${n}/${MAX_FOULS}`}>
        {Array.from({ length: MAX_FOULS }).map((_, i) => (
          <div
            key={i}
            className={`${styles.foulCapsule} ${
              i < n ? styles.foulCapsuleFilled : ""
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={styles.fullScreenContainer}>
      {/* === Верхняя панель === */}
      <div className={styles.topPanel}>
        <div className={styles.iconColumn}>
          {renderIconRow(sheriff, sheriffDisplay, "left")}
          {renderIconRow(Don, donDisplay, "left")}
        </div>

        <div className={styles.centerInfo}>
          <div className={styles.tableTitle}>Стол 1</div>
          <div className={styles.gameRound}>
            {gameData.currentDay || "День ?"} · {gameData.currentPhase || "фаза ?"}
          </div>
          {gi.judgeNickname ? (
            <div className={styles.judge}>Судья: {gi.judgeNickname}</div>
          ) : null}
        </div>

        <div className={styles.iconColumn}>
          {renderIconRow(Golos, votingDisplay, "right")}
          {renderIconRow(Strelba, shootingDisplay, "right")}
        </div>
      </div>

      {/* === Игроки === */}
      <div className={styles.cardsSection}>
        <img src={logo} alt="Logo" className={styles.logo} />
        <div className={styles.cardsContainer}>
          {players.map((player) => {
            const roleStyle = getRoleColor(player.role);
            const idNum = Number(player.id);
            const isFolded = votedOutSet.has(idNum) || shotSet.has(idNum);

            return (
              <div
                key={player.id}
                className={`${styles.playerCard} ${isFolded ? styles.folded : ""} ${
                  player.fouls > 0 ? styles.hasFouls : ""
                }`}
                aria-label={isFolded ? "Выбыл" : "В игре"}
              >
                {!isFolded && (
                  <img src={CCC_prew} alt="Player" className={styles.image} />
                )}

                <div className={styles.bottomSection}>
                  <div
                    className={styles.bottomBar}
                    style={{
                      backgroundColor: roleStyle.background,
                      color: roleStyle.color,
                    }}
                  >
                    <div className={styles.playerNumber}>{player.id}</div>
                    <div className={styles.dividerLine}></div>
                    <div className={styles.playerName}>{player.name}</div>
                  </div>

                  {renderFouls(player.fouls)}
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
