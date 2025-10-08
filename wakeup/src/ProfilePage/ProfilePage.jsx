import React, { useContext, useState, useEffect } from "react";
import styles from "./ProfilePage.module.css";
import avatar from "../images/profile_photo/soon.png";
import { AuthContext } from '../AuthContext';
import { useParams, useNavigate } from "react-router-dom";

// --- НАЧАЛО: Компонент для отображения игр игрока ---
const PlayerGames = ({ nickname }) => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!nickname) return;

    const fetchGames = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/getPlayerGames/${nickname}`);
        if (!response.ok) {
          throw new Error("Не удалось загрузить историю игр");
        }
        const data = await response.json();
        // Сервер уже сортирует по убыванию даты, так что массив готов к использованию
        setGames(data.games || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, [nickname]);

  if (loading) return <div>Загрузка игр...</div>;
  if (error) return <div className={styles.errorBanner}>Ошибка: {error}</div>;
  if (games.length === 0) return <div>У этого игрока пока нет сыгранных игр в рейтинге.</div>;

  const totalGames = games.length;

  return (
    <div className={styles.gamesGrid}>
      {games.map((game, index) => (
        <article key={game.id} className={styles.gameCard}>
          <div className={styles.gameHeader}>
            {/* Корректная нумерация в обратном порядке */}
            <span>Игра #{totalGames - index}</span>
            <time>{game.date}</time>
          </div>
          {/* Отображение судьи */}
          <div className={styles.gameJudge}>
            Судья: {game.judge_nickname || 'Не указан'}
          </div>
          <table className={styles.gameTable}>
            <tbody>
              {game.players.map((player, playerIndex) => (
                <tr key={playerIndex} className={player.name === nickname ? styles.highlightedRow : ''}>
                  <td className={styles.playerNumber}>{playerIndex + 1}</td>
                  <td className={styles.playerName}>{player.name}</td>
                  <td className={styles.playerRole}>{player.role}</td>
                  <td className={styles.playerPoints}>{player.sum?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.gameFooter}>
            <span>{game.badgeColor === 'black' ? 'Победа мафии' : 'Победа мирных'}</span>
          </div>
        </article>
      ))}
    </div>
  );
};
// --- КОНЕЦ: Компонент для отображения игр игрока ---


const ProfilePage = ({
  favoriteCard = "Шериф",
  club = "WakeUp Mafia | МИЭТ",
  photoSrc = avatar,
  number = 3,
  description = "Здесь будет текст описания игрока..."
}) => {
  const { user, token } = useContext(AuthContext);
  const { profileId } = useParams();
  const navigate = useNavigate();
  const targetUserId = profileId;

  const isAdmin = user?.role === 'admin';
  const isOwnProfile = targetUserId === user?.id;

  const [profileData, setProfileData] = useState({
    nickname: '',
    name: '',
    club: club,
    favoriteCard: favoriteCard,
    vk: '',
    tg: '',
    site1: '',
    site2: ''
  });

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('Профиль'); // Новое состояние для вкладок

  const clubs = ["WakeUp | MIET", "WakeUp | MIPT", "Другой"];
  const favoriteCards = ["Шериф", "Мирный", "Мафия", "Дон"];

  const resetProfileData = (data) => {
    setProfileData({
      nickname: data?.nickname || '',
      name: data?.name || '',
      club: data?.club || club,
      favoriteCard: data?.favoriteCard || favoriteCard,
      vk: data?.vk || '',
      tg: data?.tg || '',
      site1: data?.site1 || '',
      site2: data?.site2 || ''
    });
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (!targetUserId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`/api/getUser/${targetUserId}`, { method: 'GET', headers });

        if (!response.ok) {
          let errorMessage = "Ошибка загрузки профиля";
          try {
            const errorData = await response.json();
            errorMessage = errorData.detail || errorMessage;
          } catch {
            const text = await response.text();
            if (text.includes('<!DOCTYPE')) {
              errorMessage = "Ошибка сервера: возвращён HTML вместо JSON.";
            }
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        resetProfileData(data.user);
      } catch (err) {
        console.error("Ошибка загрузки профиля:", err);
        setError(err.message);
        if (isOwnProfile && user) resetProfileData(user);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [targetUserId, token, isOwnProfile, user]);

  const handleChange = (field, value) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!token) {
      setError("Необходима авторизация для сохранения");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/updateProfile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: targetUserId,
          ...profileData
        }),
      });

      if (!response.ok) {
        let errorMessage = "Ошибка сохранения профиля";
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          const text = await response.text();
          if (text.includes('<!DOCTYPE')) {
            errorMessage = "Ошибка сервера: возвращён HTML вместо JSON.";
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      alert(data.message || "Профиль обновлен");
      setIsEditing(false);
    } catch (err) {
      console.error("Ошибка сохранения:", err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => setIsEditing(false);
  const canEdit = (isAdmin || isOwnProfile) && !!token;

  const tabs = ["Профиль", "Игры", "Статистика", "Турниры"];

  return (
    <div className={styles.pageWrapper}>
      
      {error && (
        <div className={styles.errorBanner}>
          ⚠️ {error}
          <button onClick={() => setError(null)} className={styles.closeBtn}>×</button>
        </div>
      )}

      <div className={styles.mainContent}>
        {loading ? (
          <div>Загрузка профиля...</div>
        ) : (
          <>
            <div className={styles.left}>
              <h2 className={styles.nickname}>
                {profileData.nickname || "Имя не указано"}
              </h2>

              <div className={styles.tabs}>
                {tabs.map(tab => (
                  <button 
                    key={tab} 
                    onClick={() => setActiveTab(tab)}
                    className={activeTab === tab ? styles.activeTab : ''}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {activeTab === 'Профиль' && (
                <div className={styles.infoBox}>
                  <p><span>Имя: </span>
                    {isEditing && canEdit ? (
                      <input
                        type="text"
                        value={profileData.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        placeholder="Введите имя"
                      />
                    ) : (profileData.name || "Не указано")}
                  </p>

                  <p><span>Любимая карта:</span>
                    {isEditing && canEdit ? (
                      <select
                        value={profileData.favoriteCard}
                        onChange={(e) => handleChange('favoriteCard', e.target.value)}
                      >
                        {favoriteCards.map(card => (
                          <option key={card} value={card}>{card}</option>
                        ))}
                      </select>
                    ) : profileData.favoriteCard}
                  </p>

                  <p><span>Клуб:</span>
                    {isEditing && canEdit ? (
                      <select
                        value={profileData.club}
                        onChange={(e) => handleChange('club', e.target.value)}
                      >
                        {clubs.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    ) : profileData.club}
                  </p>

                  <p><span>VK:</span>
                    {isEditing && canEdit ? (
                      <input
                        type="text"
                        value={profileData.vk}
                        onChange={(e) => handleChange('vk', e.target.value)}
                        placeholder="Ссылка на VK"
                      />
                    ) : (profileData.vk ? <a href={profileData.vk} target="_blank" rel="noopener noreferrer">{profileData.vk}</a> : "Не указано")}
                  </p>

                  <p><span>Telegram:</span>
                    {isEditing && canEdit ? (
                      <input
                        type="text"
                        value={profileData.tg}
                        onChange={(e) => handleChange('tg', e.target.value)}
                        placeholder="Ссылка на Telegram"
                      />
                    ) : (profileData.tg ? <a href={profileData.tg} target="_blank" rel="noopener noreferrer">{profileData.tg}</a> : "Не указано")}
                  </p>

                  <p><span>Gomafia:</span>
                    {isEditing && canEdit ? (
                      <input
                        type="text"
                        value={profileData.site1}
                        onChange={(e) => handleChange('site1', e.target.value)}
                        placeholder="Ссылка на Gomafia"
                      />
                    ) : (profileData.site1 ? <a href={profileData.site1} target="_blank" rel="noopener noreferrer">{profileData.site1}</a> : "Не указано")}
                  </p>

                  <p><span>Mafia Universe:</span>
                    {isEditing && canEdit ? (
                      <input
                        type="text"
                        value={profileData.site2}
                        onChange={(e) => handleChange('site2', e.target.value)}
                        placeholder="Ссылка на Mafia Universe"
                      />
                    ) : (profileData.site2 ? <a href={profileData.site2} target="_blank" rel="noopener noreferrer">{profileData.site2}</a> : "Не указано")}
                  </p>
                </div>
              )}

              {activeTab === 'Игры' && (
                <PlayerGames nickname={profileData.nickname} />
              )}
              
              {activeTab === 'Статистика' && <div>Статистика скоро появится...</div>}
              {activeTab === 'Турниры' && <div>Турниры скоро появятся...</div>}

              {canEdit && activeTab === 'Профиль' && (
                <div className={styles.editControls}>
                  {isEditing ? (
                    <>
                      <button onClick={handleSave} disabled={saving}>
                        {saving ? "Сохранение..." : "Сохранить"}
                      </button>
                      <button onClick={handleCancel}>Отмена</button>
                    </>
                  ) : (
                    <button onClick={() => setIsEditing(true)}>Редактировать</button>
                  )}
                </div>
              )}
            </div>

            <div className={styles.right}>
              <img src={photoSrc} alt="Фото профиля" className={styles.photo} />
            </div>
          </>
        )}
      </div>

      <div className={styles.descriptionBox}>
        <h3>Описание игрока</h3>
        <p>{description}</p>
      </div>
    </div>
  );
};

export default ProfilePage;