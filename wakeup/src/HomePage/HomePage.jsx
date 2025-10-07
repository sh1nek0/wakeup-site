import React, { useState, useRef, useEffect } from "react";
import styles from "./HomePage.module.css";
import {NavLink} from "react-router-dom"

import background1 from "../images/01BOX.png";
import background2 from "../images/02BOX.png";
import background4 from "../images/04BOX.png";
import light1 from "../images/light1.png";
import card1 from "../images/card1.png";
import groupSitting from "../images/group_sitting.png";
import light2 from "../images/light2.png";
import mietLogo from "../images/Logo_MIET.png";
import miptLogo from "../images/Logo_MIPT.png";
import vkIcon from "../images/vk_icon.png";
import tgIcon from "../images/tg_icon.png";
import btsImg from "../images/BTS.png";
import rockcupImg from "../images/rockcup.png";
import mafImg from "../images/maf.png";
import sherifImg from "../images/sherif.png";
import mirImg from "../images/mir.png";
import donImg from "../images/don.png";
import CCC_prew from "../EventPrew/CCC-prew.png";
import Junior_prew from "../EventPrew/Junior.png"
import Dec_prew from "../EventPrew/Dec-main.png"


// Статические данные для UI (картинки, описания). Ссылки будут обновлены динамически.
const staticTournaments = [
  { id:2, title: "Cyber Couple Cup", desc: "Парный турнир с трехлетней историей проводимый в честь вечной дружбы и сотрудничества между Физтехом и МИЭТом", color: "#1f1f1f", img: CCC_prew, btn_text:"Зарегистрироваться", btn_to:"#" },
  { id:3, title: "WakeUp.Junior", desc: "Первый шанс для молодых игроков в мафию почувстовать на себе дух соревнования и получить турьерный опыт", color: "#110C07", img: Junior_prew, btn_text:"Скоро регистрация", btn_to:"#"  },
  { id:4, title: "Тематический", desc: "Стилистический турнир в личном зачете, погружающий в атмосферу выбранной темы", color: "#181312ff", img: rockcupImg, btn_text: "Скоро регистрация", btn_to:"#"   },
  { id:5, title: "Турнир десяти", desc: "Традиционный закрытый турнир WakeUp Mafia, претепевший модифиакции прохода", color: "#1a1d1cff", img: Dec_prew, btn_text:"Подробнее", btn_to:"/rating"   },
  { id:6, title: "Break the Silence", desc: "главный турнир года, попасть в который смогут только лучшие игроки сезона", color: "#272232ff", img: btsImg, btn_text:"Подробнее", btn_to:"/BTS"   }
];

const roles = [
  { title: "Мафия", desc: "Вы — Мафия. Ваша цель: оставаться незамеченной днём и убирать игроков ночью. Держите легенду, говорите уверенно.", img: mafImg },
  { title: "Шериф", desc: "Вы — Шериф. Каждую ночь проверяете одного игрока. Ведите дискуссию и защищайте мирных.", img: sherifImg },
  { title: "Мирный житель", desc: "Вы — Мирный Житель. Сила — логика и наблюдательность. Доверяйте интуиции, но проверяйте фактами.", img: mirImg },
  { title: "Дон", desc: "Вы — Дон. Руководите мафией и ищите шерифа. Задавайте темп и оставайтесь вне подозрений.", img: donImg }
];

const HomePage = () => {
  // Состояния для каруселей
  const [tournaments, setTournaments] = useState(staticTournaments);
  const [activeTournament, setActiveTournament] = useState(0);
  const [activeRole, setActiveRole] = useState(2); // Стартуем с "Мирный житель"
  const [isHovered, setIsHovered] = useState(false);

  const carousel1Ref = useRef(null);
  const rail2Ref = useRef(null);

  // --- НОВАЯ ЛОГИКА: Загрузка и обновление ссылок на турниры ---
  useEffect(() => {
    const fetchAndMergeTournaments = async () => {
      try {
        const response = await fetch('/api/events');
        if (!response.ok) {
          console.error("Не удалось загрузить события с сервера");
          return;
        }
        const data = await response.json();
        const backendEvents = data.events;

        // Создаем карту для быстрого поиска ID по названию
        const eventsMap = new Map(backendEvents.map(event => [event.title, event.id]));

        // Обновляем статические данные актуальными ссылками
        const mergedTournaments = staticTournaments.map(staticTourney => {
          const dynamicId = eventsMap.get(staticTourney.title);
          
          // Обновляем ссылку только если турнир найден и это не специальная ссылка
          const isSpecialLink = staticTourney.btn_to === "/rating" || staticTourney.btn_to === "/BTS";
          
          if (dynamicId && !isSpecialLink) {
            return { ...staticTourney, btn_to: `/Event/${dynamicId}` };
          }
          return staticTourney; // Возвращаем как есть, если совпадения нет или ссылка специальная
        });

        setTournaments(mergedTournaments);

      } catch (error) {
        console.error("Ошибка при загрузке или обработке данных о турнирах:", error);
      }
    };

    fetchAndMergeTournaments();
  }, []); // Пустой массив зависимостей означает, что эффект выполнится один раз при монтировании


  // Эффект для карусели турниров
  useEffect(() => {
  // Обновление DOM для слайдов и трансформации
  const carousel = carousel1Ref.current;
  if (!carousel) return;
  const slides = carousel.children;
  Array.from(slides).forEach((slide, i) => slide.classList.toggle('active', i === activeTournament));
  carousel.style.transform = `translateX(${computeTranslateX(activeTournament)}px)`;

  // Глобальный обработчик колесика для блокировки скролла и переключения слайдов
  const handleGlobalWheel = (e) => {
    if (isHovered) {
      e.preventDefault();  // Блокируем скролл страницы при hover
      if (e.deltaY > 0) {
        nextSlide();  // Скролл вниз -> следующий слайд
      } else {
        prevSlide();  // Скролл вверх -> предыдущий слайд
      }
    }
  };


  // Добавляем слушатель на window
  window.addEventListener('wheel', handleGlobalWheel, { passive: false });

  // Очистка: убираем слушатель при размонтировании или изменении зависимостей
  return () => {
    window.removeEventListener('wheel', handleGlobalWheel);
  };
}, [activeTournament, isHovered]);  // Зависимости: activeTournament для DOM, isHovered для wheel


  const computeTranslateX = (index) => {
    const CARD_W = 200; // Из CSS
    const GAP = 24;
    return -index * (CARD_W + GAP);
  };

  // Эффект для карусели ролей
  useEffect(() => {
    const rail = rail2Ref.current;
    if (!rail) return;
    const cards = rail.children;
    const CARD_W = 260;
    const ACTIVE = 1.28;
    const OVERLAP = 0.50;
    const SHIFT = Math.round(CARD_W * OVERLAP);

    Array.from(cards).forEach((card, i) => {
      const k = i - activeRole;
      const abs = Math.abs(k);
      const scale = k === 0 ? ACTIVE : 1 - Math.min(0.08 + abs * 0.04, 0.22);
      const x = k * SHIFT;
      card.style.zIndex = 100 - abs;
      card.style.opacity = abs > 2 ? 0.45 : 1;
      card.style.transform = `translateX(calc(-50% + ${x}px)) scale(${scale})`;
      card.classList.toggle('is-active', k === 0);
    });
  }, [activeRole]);

  // Обработчики для каруселей
  const goToTournament = (index) => {
    setActiveTournament(index);
  };

  const goToRole = (index) => {
    setActiveRole(index);
  };


const nextSlide = () => {
  setActiveTournament((prev) => (prev + 1) % tournaments.length);  // Циклическое переключение
};

const prevSlide = () => {
  setActiveTournament((prev) => (prev - 1 + tournaments.length) % tournaments.length);  // Циклическое переключение
};

// Обработчик колесика мыши
const handleWheel = (e) => {
  if (!isHovered) return;  // Если мышь не наведена на карусель, игнорируем событие
  e.preventDefault();  // Предотвращаем скролл страницы только при hover
  if (e.deltaY > 0) {
    nextSlide();  // Скролл вниз -> следующий слайд
  } else {
    prevSlide();  // Скролл вверх -> предыдущий слайд
  }
};

  return (
    <div className={styles.container}>

      {/* <div className={styles["unsupported-message"]}>Разрешение не поддерживается. Используйте экран шириной не менее 1000px в альбомной ориентации.</div>
       */}
      {/* Фоновое изображение */}
      <div className={styles["background-numberone"]}>
        <img src={background1} alt="" />
      </div>

      {/* Контент-бокс один */}
      <div className={styles["content-box-one"]}>
        
        <p className={styles["comment-top"]}>Ночь в городе...</p>
        <div className={styles["content-box-one_center-content"]}>
          <div className={styles["row-content-1"]}>
            <div className={styles.title}>
             СПОРТИВНАЯ МАФИЯ МИЭТ И МФТИ
            </div>
            <img src={light1} alt="" />
            <div className={styles.description}>
              <p>Спортивная мафия — это интеллектуальная баталия, где игроки воздействуют друг на друга словами, жестами и логикой. Здесь побеждает тот, кто лучше анализирует, убеждает и играет роль.</p>
            </div>
            <img src={card1} alt="" className={styles["card-img"]} />
          </div>
          <div className={styles["row-content-2"]}>
            <div className={styles.title}>
              WAKEUP MAFIA
            </div>
            <div className={styles.description}>
              <p>Мы семейство клубов WakeUp занимающаяся развитием спортивной мафии в Москве и Московской области.<br /> Проводим турниры, рейтингоавые игры и ламповые вечера</p>
            </div>
            <img src={groupSitting} alt="" />
            <a>Подробнее <br /> ↓</a>
          </div>
        </div>
        <p className={styles["comment-bottom"]}>Просыпается мафия...</p>
      </div>

      {/* Геометрия */}
      <div className={styles["geometry-1"]}>
        <div className={styles.line}></div>
        <div className={styles["circle-empty"]}></div>
        <div className={styles["circle-grad"]}></div>
      </div>

      {/* Контент-бокс два: клубы и правила */}
      <div className={styles["content-box-two"]}>
        <div className={styles["club-title"]}>
          <h4>СТУДЕНЧЕСКИЕ ОБЪЕДИНЕНИЯ</h4>
        </div>
        <div className={styles["club-box"]}>
          <div className={styles["club-subtitle"]}>
            <h4>WakeUp Mafia | MIET</h4>
            <div className={styles["club-description"]}>
              <p>Мы студенческий клуб, который распологается на територии МИЭТа. А все игры проходят в студенческом городке </p>
               <p className={styles.adress}> Игровые дни: Пятница - Суббота</p>
              <p className={styles.adress}>Зеленоград, ул. Юности 11</p>
            </div>
          </div>
          <div className={styles["rostik-doebalsya"]}>
            <div className={styles["club-logo"]}><img src={mietLogo} alt="" /></div>
            <div className={styles["club-social"]}>
              <a href="https://vk.com/wakeupmiet"><img src={vkIcon} alt="" /></a>
              <a href="https://vk.com/wakeupmiet"><img src={tgIcon} alt="" /></a>
            </div>
          </div>
        </div>
        <div className={styles["club-box"]}>
          <div className={styles["club-subtitle"]}>
            <h4>WakeUp Mafia | MIPT</h4>
            <div className={styles["club-description"]}>
              <p>Мы студенческий клуб, который распологается на територии МФТИ. </p>
              <p className={styles.adress}>Игровые дни: Четверг - Суббота</p>
              <p className={styles.adress}>Долгопрудный,  Институтский переулок&nbsp;9</p>
            </div>
          </div>
          <div className={styles["rostik-doebalsya"]}>
            <div className={styles["club-logo"]}><img src={miptLogo} alt="" /></div>
            <div className={styles["club-social"]}>
              <a href="https://vk.com/wakeupmipt"><img src={vkIcon} alt="" /></a>
              <a href="https:/t.me/wakeupmafia"><img src={tgIcon} alt="" /></a>
            </div>
          </div>
        </div>
        <div className={styles["rules-box"]}>
          <div className={styles["rules-title"]}>
            Правила
          </div>
          <img src={light2} alt="" />
          <div className={styles["rules-description"]}>
            С этого года мы перешли на полностью обновленную редакцию правил МСЛ но приправленные функциональными нововедением и оптимизацией 
          </div>
        </div>
      </div>

      {/* Фоновое изображение 2 */}
      <div className={styles["background-numbertwo"]}>
        <img src={background2} alt="" />
      </div>

      {/* Геометрия 2 */}
      <div className={styles.line}></div>
      <div className={styles["circle-grad2"]}></div>
      <div className={styles["circle-grad3"]}></div>


{/* Карусель турниров */}
<div className={styles["content-box-three"]} id="box1" style={{ background: tournaments.length > 0 ? tournaments[activeTournament].color : '#1f1f1f' }}>
  <div className={styles["title-tournament"]}>Турниры</div>
  <div className={styles["carousel-box"]}>
    <div className={styles["text-block"]}>
      {tournaments.length > 0 && (
        <>
          <h2 id="title1">{tournaments[activeTournament].title}</h2>
          <p id="desc1">{tournaments[activeTournament].desc}</p>
          <NavLink to={tournaments[activeTournament].btn_to}>
            <button className={styles.cta}>{tournaments[activeTournament].btn_text}</button>
          </NavLink>
        </>
      )}
    </div>
    <div className={styles["carousel-wrapper"]}>
      <div 
        className={styles.viewport} 
        id="viewport1" 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className={styles.carousel} id="carousel1" ref={carousel1Ref}>
          {tournaments.map((t, i) => (
            <div 
              key={i} 
              className={`${styles.slide} ${i === activeTournament ? styles.active : ''}`} 
              onClick={() => goToTournament(i)}
            >
              <img src={t.img} alt={t.title} />
            </div>
          ))}
        </div>
      </div>
      <div className={styles.dots} id="dots1">
        {tournaments.map((_, i) => (
          <div 
            key={i} 
            className={`${styles.dot} ${i === activeTournament ? styles.active : ''}`} 
            onClick={() => goToTournament(i)}
          ></div>
        ))}
      </div>
    </div>
  </div>
</div>
<div className={styles.line}></div>




      {/* Фоновое изображение 4 */}
      <div className={styles["background-numberfour"]}>
        <img src={background4} alt="" />
      </div>

      {/* Карусель ролей */}
      <div className={styles["content-box-two"]}>
        <p className={styles["comment-bottom"]}>Ваш выбор...</p>
        <section className={styles.wrap}>
          <h1 className={styles.h1}>Твоя любимая карта?</h1>
          <div className={styles.grid}>
            <div className={styles["carousel-area"]}>
              <div className={styles.stage}>
                <div className={styles.rail} id="rail2" ref={rail2Ref}>
                  {roles.map((r, i) => (
                    <div key={i} className={styles.card} onClick={() => goToRole(i)}>
                      <img src={r.img} alt={r.title} />
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.dots} id="dots2">
                {roles.map((_, i) => (
                  <div key={i} className={`${styles.dot} ${i === activeRole ? styles.active : ''}`} onClick={() => goToRole(i)}></div>
                ))}
              </div>
            </div>
            <aside className={styles.info}>
              <h2 className={styles.title} id="title2">{roles[activeRole].title}</h2>
              <p className={styles.desc} id="desc2">{roles[activeRole].desc}</p>
              <button className={styles.cta}>Выбрать</button>
            </aside>
          </div>
        </section>
      </div>
      
    </div>
    
  );
};

export default HomePage;