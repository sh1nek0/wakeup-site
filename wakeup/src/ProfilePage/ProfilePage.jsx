// wakeup-site/wakeup/src/ProfilePage/ProfilePage.jsx

import React, { useContext, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "./ProfilePage.module.css";
import { AuthContext } from "../AuthContext";
import placeholderAvatar from "../images/profile_photo/soon.png";
import RoleIcon from "../RoleIcon/RoleIcon";

/* ===================== PlayerGames: список игр игрока ===================== */
const PlayerGames = ({ nickname, games, loading, error, userMap }) => {
  const navigate = useNavigate();

  const handlePlayerClick = (playerName) => {
    const userId = userMap.get(playerName);
    if (userId) {
      navigate(`/profile/${userId}`);
    }
  };

  if (!nickname) return <div>Никнейм отсутствует.</div>;
  if (loading) return <div>Загрузка игр...</div>;
  if (error) return <div className={styles.errorBanner}>Ошибка: {error}</div>;
  if (games.length === 0) return <div>У этого игрока пока нет сыгранных игр в рейтинге.</div>;

  const totalGames = games.length;

  return (
    <div className={styles.gamesGrid}>
      {games.map((game, index) => (
        <article key={game.id ?? `${nickname}-${index}`} className={styles.gameCard}>
          <div className={styles.gameHeader}>
            <span>Игра #{totalGames - index}</span>
            <time>{game.date}</time>
          </div>

          <div className={styles.gameJudge}>
            Судья: {game.judge_nickname || "Не указан"}
          </div>

          <table className={styles.gameTable}>
            <tbody>
              {(game.players || []).map((player, i) => (
                <tr
                  key={i}
                  className={player.name === nickname ? styles.highlightedRow : ""}
                >
                  <td className={styles.playerNumber}>{i + 1}</td>
                  <td className={styles.playerName}>
                    <span className={styles.clickableName} onClick={() => handlePlayerClick(player.name)}>
                      {player.name}
                    </span>
                  </td>
                  <td className={styles.playerPoints}>
                    <RoleIcon role={player.role} />
                    <span>
                      {typeof player.sum === "number" ? player.sum.toFixed(2) : player.sum ?? "-"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.gameFooter}>
            <span>
              {game.badgeColor === "black" ? "Победа мафии" : "Победа мирных"}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
};
/* ===================== /PlayerGames ===================== */


/* ===== Утилита: человекочитаемый размер файла ===== */
const humanFileSize = (bytes) => {
  const thresh = 1024;
  if (Math.abs(bytes) < thresh) return bytes + " B";
  const units = ["KB", "MB", "GB", "TB"];
  let u = -1;
  do {
    bytes /= thresh;
    ++u;
  } while (Math.abs(bytes) >= thresh && u < units.length - 1);
  return bytes.toFixed(1) + " " + units[u];
};

const clubsList = ["WakeUp | MIET", "WakeUp | MIPT", "Другой"];
const favoriteCardsList = ["Шериф", "Мирный", "Мафия", "Дон"];

const ProfilePage = () => {
  const { user, token } = useContext(AuthContext) || {};
  const { profileId } = useParams();

  const targetUserId = profileId || user?.id;
  const isOwnProfile = useMemo(
    () => !!user && targetUserId === String(user.id),
    [user, targetUserId]
  );
  const isAdmin = user?.role === "admin";
  const canEdit = isOwnProfile || isAdmin;

  const [profileData, setProfileData] = useState({
    nickname: "",
    name: "",
    club: "",
    favoriteCard: "",
    vk: "",
    tg: "",
    site1: "",
    site2: "",
    photoUrl: null,
  });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveOk, setSaveOk] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [activeTab, setActiveTab] = useState("profile");

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const MAX_BYTES = 2 * 1024 * 1024;

  const [playerGames, setPlayerGames] = useState([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [gamesError, setGamesError] = useState(null);

  const [userMap, setUserMap] = useState(new Map());

  // --- НАЧАЛО ИЗМЕНЕНИЙ ---
  // Этот эффект сбрасывает вкладку на "Профиль" при смене ID пользователя в URL
  useEffect(() => {
    setActiveTab("profile");
  }, [targetUserId]);
  // --- КОНЕЦ ИЗМЕНЕНИЙ ---

  useEffect(() => {
    const fetchAllUsers = async () => {
      try {
        const res = await fetch('/api/getUsers');
        const data = await res.json();
        if (data.users) {
          const map = new Map(data.users.map(u => [u.nickname, u.id]));
          setUserMap(map);
        }
      } catch (error) {
        console.error("Failed to fetch user list for navigation:", error);
      }
    };
    fetchAllUsers();
  }, []);

  const normalizeAvatarPath = (url) =>
    typeof url === "string" && url.startsWith("/uploads/avatars/")
      ? url.replace("/uploads/avatars/", "/data/avatars/")
      : url;

  const resetProfileData = (data) => {
    const src = data?.user || data || {};
    setProfileData({
      nickname: src.nickname || "",
      name: src.name || "Здесь будет твое имя",
      club: src.club || clubsList[0],
      favoriteCard: src.favoriteCard || favoriteCardsList[0],
      vk: src.vk || "",
      tg: src.tg || "",
      site1: src.site1 || "",
      site2: src.site2 || "",
      photoUrl: src.photoUrl || null,
    });
  };

  const fetchProfile = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (!targetUserId) throw new Error("Не указан ID профиля.");
      const res = await fetch(`/api/getUser/${encodeURIComponent(targetUserId)}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        let msg = `Ошибка загрузки профиля (${res.status})`;
        try {
          const j = await res.json();
          msg = j.detail || j.message || msg;
        } catch {}
        throw new Error(msg);
      }
      const data = await res.json();
      resetProfileData(data);
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId]);

  useEffect(() => {
    if (!profileData.nickname) return;

    const fetchGames = async () => {
      setGamesLoading(true);
      setGamesError(null);
      try {
        const response = await fetch(`/api/getPlayerGames/${encodeURIComponent(profileData.nickname)}`);
        if (!response.ok) throw new Error("Не удалось загрузить историю игр");
        const data = await response.json();
        setPlayerGames(Array.isArray(data?.games) ? data.games : []);
      } catch (err) {
        setGamesError(err.message);
      } finally {
        setGamesLoading(false);
      }
    };

    fetchGames();
  }, [profileData.nickname]);

  const playerStats = useMemo(() => {
    const stats = {
      totalGames: 0,
      totalWins: 0,
      totalLosses: 0,
      winrate: 0,
      byRole: {
        'Черная карта': { games: 0, wins: 0 },
        'Дон': { games: 0, wins: 0 },
        'Мафия': { games: 0, wins: 0 },
        'Красная карта': { games: 0, wins: 0 },
        'Шериф': { games: 0, wins: 0 },
        'Мирный': { games: 0, wins: 0 },
      }
    };

    if (!playerGames || playerGames.length === 0) {
      return stats;
    }

    stats.totalGames = playerGames.length;

    const roleMap = {
      'мирный': 'Мирный',
      'шериф': 'Шериф',
      'мафия': 'Мафия',
      'дон': 'Дон',
    };

    playerGames.forEach(game => {
      const playerInGame = game.players.find(p => p.name === profileData.nickname);
      if (!playerInGame || !playerInGame.role) return;

      const rawRole = playerInGame.role.toLowerCase();
      const mappedRole = roleMap[rawRole];

      const isRedPlayer = rawRole === 'мирный' || rawRole === 'шериф';
      const isBlackPlayer = rawRole === 'мафия' || rawRole === 'дон';

      let isWin = false;
      if (game.badgeColor === 'red' && isRedPlayer) {
        isWin = true;
      } else if (game.badgeColor === 'black' && isBlackPlayer) {
        isWin = true;
      }

      if (isWin) {
        stats.totalWins++;
      } else if (game.badgeColor === 'red' || game.badgeColor === 'black') {
        stats.totalLosses++;
      }

      if (mappedRole && stats.byRole[mappedRole]) {
        stats.byRole[mappedRole].games++;
        if (isWin) stats.byRole[mappedRole].wins++;
      }
      
      if (isRedPlayer) {
        stats.byRole['Красная карта'].games++;
        if (isWin) stats.byRole['Красная карта'].wins++;
      }
      if (isBlackPlayer) {
        stats.byRole['Черная карта'].games++;
        if (isWin) stats.byRole['Черная карта'].wins++;
      }
    });

    if (stats.totalGames > 0) {
      stats.winrate = Math.round((stats.totalWins / stats.totalGames) * 100);
    }

    return stats;
  }, [playerGames, profileData.nickname]);

  const onChangeField = (field) => (e) => {
    const val = e.target.value;
    setProfileData((prev) => ({ ...prev, [field]: val }));
    setSaveOk(false);
    setSaveError(null);
  };

  const onToggleEdit = () => {
    if (!canEdit) return;
    setIsEditing((v) => !v);
    setSaveOk(false);
    setSaveError(null);
    if (isEditing) {
      fetchProfile();
      setAvatarFile(null);
      setAvatarPreview(null);
      setUploadError(null);
    }
  };

  const onSave = async () => {
    if (!canEdit) return;
    if (!token) {
      setSaveError("Необходима авторизация.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    window.location.reload();
    try {
      const res = await fetch(`/api/updateProfile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: targetUserId,
          name: profileData.name,
          club: profileData.club,
          favoriteCard: profileData.favoriteCard,
          vk: profileData.vk,
          tg: profileData.tg,
          site1: profileData.site1,
          site2: profileData.site2,
        }),
      });
      if (!res.ok) {
        let msg = `Ошибка сохранения (${res.status})`;
        try {
          const j = await res.json();
          msg = j.detail || j.message || msg;
        } catch {}
        throw new Error(msg);
      }
      setSaveOk(true);
      setIsEditing(false);
      fetchProfile();
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const onPickAvatar = (file) => {
    setUploadError(null);
    setAvatarFile(null);
    setAvatarPreview(null);

    if (!file) return;
    if (file.type !== "image/png") {
      setUploadError("Допустим только PNG-файл.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError(
        `Файл слишком большой (${humanFileSize(file.size)}). Лимит: ${humanFileSize(MAX_BYTES)}.`
      );
      return;
    }
    const url = URL.createObjectURL(file);
    setAvatarFile(file);
    setAvatarPreview(url);
  };

  const uploadAvatar = async () => {
    if (!canEdit) return;
    if (!token) {
      setUploadError("Необходима авторизация для загрузки файла.");
      return;
    }
    if (!avatarFile) {
      setUploadError("Сначала выберите PNG-файл.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("avatar", avatarFile);
      form.append("userId", String(targetUserId));

      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });

      if (!res.ok) {
        let msg = "Ошибка загрузки файла.";
        try {
          const j = await res.json();
          msg = j.detail || j.message || msg;
        } catch {}
        throw new Error(msg);
      }
      const data = await res.json();
      setAvatarFile(null);
      setAvatarPreview(null);
      setProfileData((prev) => ({ ...prev, photoUrl: data.url }));
    } catch (e) {
      setUploadError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const photoSrc =
    avatarPreview ||
    normalizeAvatarPath(profileData.photoUrl) ||
    placeholderAvatar;

  if (loading) return <div className={styles.pageWrapper}>Загрузка…</div>;
  if (loadError)
    return (
      <div className={styles.pageWrapper}>
        <div>{loadError}</div>
        <button onClick={fetchProfile}>Повторить</button>
      </div>
    );

  return (
    <div className={styles.pageWrapper}>
      {saveOk && <div className={styles.successBanner}>Изменения сохранены ✅</div>}
      {saveError && <div className={styles.errorBanner}>{saveError}</div>}

      <div className={styles.mainContent}>
        <div className={styles.left}>
          <div className={styles.nickname}>{profileData.nickname || "—"}</div>

          <div className={styles.tabsWrapper}>
            <button
              className={`${styles.tabButton} ${activeTab === "profile" ? styles.active : ""}`}
              onClick={() => setActiveTab("profile")}
            >
              Профиль
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === "stats" ? styles.active : ""}`}
              onClick={() => setActiveTab("stats")}
            >
              Статистика
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === "games" ? styles.active : ""}`}
              onClick={() => setActiveTab("games")}
            >
              Игры
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === "tournaments" ? styles.active : ""}`}
              onClick={() => setActiveTab("tournaments")}
            >
              Турниры
            </button>
          </div>

          {activeTab === "profile" && (
            <div className={styles.infoBox}>
              <p>
                <span>Имя:</span>{" "}
                {isEditing && canEdit ? (
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={onChangeField("name")}
                    placeholder="Введите имя"
                  />
                ) : (
                  profileData.name || "—"
                )}
              </p>
              <p>
                <span>Любимая карта:</span>{" "}
                {isEditing && canEdit ? (
                  <select
                    value={profileData.favoriteCard}
                    onChange={onChangeField("favoriteCard")}
                  >
                    {favoriteCardsList.map((card) => (
                      <option key={card} value={card}>
                        {card}
                      </option>
                    ))}
                  </select>
                ) : (
                  profileData.favoriteCard || "—"
                )}
              </p>
              <p>
                <span>Клуб:</span>{" "}
                {isEditing && canEdit ? (
                  <select
                    value={profileData.club}
                    onChange={onChangeField("club")}
                  >
                    {clubsList.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                ) : (
                  profileData.club || "—"
                )}
              </p>
              <p>
                <span>VK:</span>{" "}
                {isEditing && canEdit ? (
                  <input
                    type="text"
                    value={profileData.vk}
                    onChange={onChangeField("vk")}
                    placeholder="Ссылка на VK"
                  />
                ) : profileData.vk ? (
                  <a href={profileData.vk} target="_blank" rel="noreferrer">
                    {profileData.vk}
                  </a>
                ) : (
                  "—"
                )}
              </p>
              <p>
                <span>Telegram:</span>{" "}
                {isEditing && canEdit ? (
                  <input
                    type="text"
                    value={profileData.tg}
                    onChange={onChangeField("tg")}
                    placeholder="Ссылка на Telegram"
                  />
                ) : profileData.tg ? (
                  <a href={profileData.tg} target="_blank" rel="noreferrer">
                    {profileData.tg}
                  </a>
                ) : (
                  "—"
                )}
              </p>
              <p>
                <span>Gomafia:</span>{" "}
                {isEditing && canEdit ? (
                  <input
                    type="text"
                    value={profileData.site1}
                    onChange={onChangeField("site1")}
                    placeholder="Ссылка на Gomafia"
                  />
                ) : profileData.site1 ? (
                  <a href={profileData.site1} target="_blank" rel="noreferrer">
                    {profileData.site1}
                  </a>
                ) : (
                  "—"
                )}
              </p>
              <p>
                <span>Mafia Universe:</span>{" "}
                {isEditing && canEdit ? (
                  <input
                    type="text"
                    value={profileData.site2}
                    onChange={onChangeField("site2")}
                    placeholder="Ссылка на Mafia Universe"
                  />
                ) : profileData.site2 ? (
                  <a href={profileData.site2} target="_blank" rel="noreferrer">
                    {profileData.site2}
                  </a>
                ) : (
                  "—"
                )}
              </p>
            </div>
          )}

          {activeTab === "stats" && (
            <div className={styles.statsContainer}>
              <h3 className={styles.statsTitle}>Общая статистика</h3>
              <table className={styles.statsTable}>
                <tbody>
                  <tr><td>Игры</td><td>{playerStats.totalGames}</td></tr>
                  <tr><td>Победы</td><td>{playerStats.totalWins}</td></tr>
                  <tr><td>Поражения</td><td>{playerStats.totalLosses}</td></tr>
                  <tr><td>Ничьи</td><td>{playerStats.totalGames - playerStats.totalWins - playerStats.totalLosses}</td></tr>
                  <tr><td>Winrate</td><td>{playerStats.winrate}%</td></tr>
                </tbody>
              </table>

              <h3 className={styles.statsTitle}>По ролям</h3>
              <table className={styles.statsTable}>
                <thead>
                  <tr><th>Роль</th><th>Игры</th><th>Победы</th><th>%</th><th>Поражения</th></tr>
                </thead>
                <tbody>
                  {['Черная карта', 'Дон', 'Мафия', 'Красная карта', 'Шериф', 'Мирный'].map(role => {
                    const data = playerStats.byRole[role];
                    const losses = data.games - data.wins;
                    const winPercent = data.games > 0 ? Math.round((data.wins / data.games) * 100) : 0;
                    return (
                      <tr key={role}>
                        <td>{role}</td>
                        <td>{data.games}</td>
                        <td>{data.wins}</td>
                        <td>{winPercent}%</td>
                        <td>{losses}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "tournaments" && (
            <div className={styles.infoBox}>Турниры скоро появятся…</div>
          )}

          {activeTab === "games" && (
            <PlayerGames 
              nickname={profileData.nickname} 
              games={playerGames}
              loading={gamesLoading}
              error={gamesError}
              userMap={userMap}
            />
          )}

          {canEdit && activeTab === "profile" && (
            <div className={styles.editControls}>
              {!isEditing ? (
                <button onClick={onToggleEdit}>Редактировать</button>
              ) : (
                <>
                  <button onClick={onSave} disabled={saving}>
                    {saving ? "Сохранение…" : "Сохранить"}
                  </button>
                  <button onClick={onToggleEdit}>Отмена</button>
                </>
              )}
            </div>
          )}
        </div>

        <div className={styles.right}>
          <img
            src={photoSrc}
            alt="Фото профиля"
            className={styles.photo}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = placeholderAvatar;
            }}
          />

          {canEdit && isEditing && (
            <div className={styles.uploadBox}>
              <label className={styles.fileLabel}>
                <input
                  type="file"
                  accept="image/png"
                  onChange={(e) => onPickAvatar(e.target.files?.[0] || null)}
                />
                Выбрать PNG
              </label>
              {avatarPreview && (
                <div className={styles.hint}>
                  Предпросмотр — нажмите «Загрузить»
                </div>
              )}
              {avatarPreview && <button onClick={uploadAvatar} disabled={uploading || !avatarFile} className={styles.loadbutton}>
                {uploading ? "Загрузка…" : "Загрузить аватар"}
              </button>}
              {uploadError && <div className={styles.errorText}>{uploadError}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;