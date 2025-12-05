import React, { useState, useEffect, useMemo } from "react";
import s from "./BTS.module.css";

// постер схемы (твоя картинка)
import poster from "../images/RTB.png";
import poster_m from "../images/BTSback.png";

// заглушка для аватарок
import avatarPlaceholder from "../NavBar/avatar.png";

export default function RoadPoster() {
  // Начальный массив игроков с плейсхолдерами (как в вашем коде)
  const initialQualifiedNow = [
    { id: 1, nick: "Никто.", from: "ССС" },
    { id: 2, nick: "Ret1w", from: "ССС" }
  ];

  // Состояние для списка игроков (начально с плейсхолдерами, потом обновится с реальными аватарками)
  const [qualifiedNow, setQualifiedNow] = useState(initialQualifiedNow);

  // useEffect для загрузки аватарок при монтировании компонента
  useEffect(() => {
    const fetchAvatars = async () => {
      try {
        // Извлекаем ники из начального массива
        const nicknames = initialQualifiedNow.map(player => player.nick);

        // Отправляем POST-запрос на эндпоинт
        const response = await fetch('/getUsersPhotos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nicknames })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Новая проверка: если данные корректные (data.photos существует и является массивом)
        if (data && Array.isArray(data.photos)) {
          // Обновляем состояние: заменяем плейсхолдеры на реальные аватарки
          // Если у игрока нет аватарки (null или undefined), используем плейсхолдер
          const updatedQualifiedNow = initialQualifiedNow.map(player => {
            const photoData = data.photos.find(p => p && p.nick === player.nick);
            return {
              ...player,
              avatar: (photoData && photoData.avatar) ? photoData.avatar : avatarPlaceholder
            };
          });

          setQualifiedNow(updatedQualifiedNow);
        } else {
          // Если данные некорректные (например, пустой массив или неправильный формат), оставляем плейсхолдеры
          console.warn('API вернул некорректные данные для аватарок. Используем плейсхолдеры.');
          // Состояние не меняется, остаются плейсхолдеры
        }
      } catch (error) {
        console.error('Ошибка загрузки аватарок:', error);
        // В случае ошибки (сеть, 404 и т.д.) оставляем плейсхолдеры (состояние не меняется)
        // Компонент продолжает работать нормально
      }
    };

    // Вызываем функцию загрузки, если есть ники для запроса
    if (initialQualifiedNow.length > 0) {
      fetchAvatars();
    }
  }, []);  // Пустой массив зависимостей: эффект запускается только при монтировании

  // Мемоизация проверки наличия игроков
  const hasQualified = useMemo(
    () => qualifiedNow && qualifiedNow.length > 0,
    [qualifiedNow]  // Зависит от состояния
  );

  // Мемоизация списка игроков
  const qualifiedList = useMemo(() => {
    if (!hasQualified) return null;
    return (
      <ul className={s.list}>
        {qualifiedNow.map((p) => (
          <li key={p.id} className={s.item}>
            <img
              src={p.avatar || avatarPlaceholder}  // Дополнительная защита: если avatar почему-то null, используем плейсхолдер
              alt={p.nick}
              className={s.avatar}
              loading="lazy"
            />
            <div className={s.meta}>
              <div className={s.nick}>{p.nick}</div>
              <div className={s.from}>
                с турнира: <b>{p.from}</b>
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  }, [hasQualified, qualifiedNow]);  // Зависит от состояния

  // Остальные мемоизации (без изменений)
  const posterImage = useMemo(
    () => (
      <img
        src={poster}
        className={s.poster}
        alt="ROAD TO BREAK THE SILENCE — схема турниров и активностей"
        loading="lazy"
      />
    ),
    []
  );

  const posterMobile = useMemo(
    () => (
      <img
        src={poster_m}
        className={s.infoImage}
        alt="Break the Silence"
        loading="lazy"
      />
    ),
    []
  );

  return (
    <section className={s.wrap} aria-label="Road to Break the Silence">
      {/* ВЕРХ: готовая картинка-схема */}
      <figure className={s.frame}>{posterImage}</figure>

      {/* БЛОК ДВА: текст + картинка */}
      <div className={s.info}>
        <div className={s.infoText}>
          <h2 className={s.title}>ROAD TO BREAK THE SILENCE</h2>
          <span className={s.titleGlow} aria-hidden="true" />
          <p className={s.lead}>
            Break the Silence — финальный турнир сезона клубов WakeUp Mafia!
            Здесь сойдутся сильнейшие игроки в борьбе за крупный призовой фонд и титул легенды года.
            Участвуй в наших мероприятиях и получи шанс сразиться за главный&nbsp;приз!
          </p>
          <a
            href="https://vk.com/@wakeupmiet-wakeup-mafiaroad-to-bts"
            className={s.moreButton}
            target="_blank"
            rel="noopener noreferrer"
          >
            Подробнее
          </a>
        </div>
        <div className={s.infoImageWrap}>{posterMobile}</div>
      </div>

      {/* СПИСОК ПРОШЕДШИХ */}
      <section className={s.qualified} aria-label="Прошедшие в турнир">
        <header className={s.qualifiedHeader}>
          <h3 className={s.qTitle}>Прошли в BREAK THE SILENCE</h3>
          <span className={s.countBadge}>{qualifiedNow.length}</span>
        </header>

        {hasQualified ? qualifiedList : (
          <p className={s.empty}>Ты можешь стать первым!</p>
        )}
      </section>
    </section>
  );
}
