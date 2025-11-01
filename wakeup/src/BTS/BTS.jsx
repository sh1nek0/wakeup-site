import React, { useMemo } from "react";
import s from "./BTS.module.css";

// постер схемы (твоя картинка)
import poster from "../images/RTB.png";
import poster_m from "../images/BTSback.png";

// заглушка для аватарок
import avatarPlaceholder from "../NavBar/avatar.png";

/** Массив игроков, прошедших на текущий момент.
 *  Поля для реальных данных: id, nick, from, avatar
 */
const qualifiedNow = [
  // Примеры (можешь оставить пустым [] — тогда покажется "Ты можешь стать первым!")
  // { id: 3, nick: "Neo", from: "Финал миникланов", avatar: avatarPlaceholder },
];

export default function RoadPoster() {
  // Мемоизация проверок и JSX элементов, чтобы избежать пересоздания
  const hasQualified = useMemo(
    () => qualifiedNow && qualifiedNow.length > 0,
    []
  );

  const qualifiedList = useMemo(() => {
    if (!hasQualified) return null;
    return (
      <ul className={s.list}>
        {qualifiedNow.map((p) => (
          <li key={p.id} className={s.item}>
            <img
              src={p.avatar || avatarPlaceholder}
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
  }, [hasQualified]);

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
