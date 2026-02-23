import React from 'react';
import styles from './GameCard.module.css';
import RoleIcon from '../../RoleIcon/RoleIcon';
import { useNavigate } from 'react-router-dom';

function GameCard({ game, isAdmin, onDelete, onEdit, onPlayerClick, showOnlyNames, gameNumber }) {
  const navigate = useNavigate();

  const tableNumber = game.tableNumber;
  const rows = Array.from({ length: 10 }, (_, i) => game.players?.[i] || {});
  const gameDate = game.date || (game.created_at
    ? new Date(game.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '');

  const resultColorClass = game.badgeColor === 'red' ? styles.resRed
    : game.badgeColor === 'black' ? styles.resBlack
    : styles.resGray;

  const locationColorClass = game.location === 'МФТИ' ? styles.locMIPT
    : game.location === 'МИЭТ' ? styles.locMIET
    : '';

  const title = game.roundNumber
    ? `Раунд ${game.roundNumber} (Стол: ${game.tableNumber})`
    : `Игра #${gameNumber || game.id.slice(-4)}`;

  const breakdownSource = game.gameInfo?.breakdownSource;
  const breakdownPlayerNumber = game.gameInfo?.breakdownPlayerNumber;

  return (
    <article className={styles.sheetCard}>
      {/* Meta */}
      {!showOnlyNames && (
        <div className={styles.sheetMeta}>
          <div className={`${styles.sheetLocation} ${locationColorClass}`}>{game.location || ''}</div>
          {tableNumber && <div className={styles.sheetTableNumber}>Стол #{tableNumber}</div>}
          <div className={styles.sheetJudge}>
            {game.judge_id ? (
              <span className={styles.clickableName} onClick={() => onPlayerClick(game.judge_id)}>
                {game.judge_nickname || 'Не указан'}
              </span>
            ) : game.judge_nickname || 'Не указан'}
          </div>
        </div>
      )}

      {/* Title and date */}
      <div className={styles.sheetTop}>
        <span
          className={styles.sheetTitle}
          onClick={() => navigate(`/Event/${game.event_id || '1'}/Game/${game.id}?mode=view`)}
        >
          {title}
        </span>
        {!showOnlyNames && <div className={`${styles.sheetSlashTop} ${locationColorClass}`} />}
        {!showOnlyNames && <time className={styles.sheetDate}>{gameDate}</time>}
      </div>

      {/* Players Table */}
      <div className={styles.sheetTableWrap}>
        <table className={styles.sheetTable}>
          <thead>
            <tr>
              <th>№</th>
              <th>Игрок</th>
              {/* Столбец "Роль" отображается всегда */}
              <th>Роль</th> 
              {/* Столбец "Очки" отображается всегда */}
              <th>Очки</th> 
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              // Логика для стилизации строк, применима если showOnlyNames === false
              let rowClass = '';
              if (!showOnlyNames) {
                const playerNumber = i + 1;
                const hasBestMove = row.best_move && String(row.best_move).trim() !== '';
                const isBrokenPlayer = (breakdownSource === 'red' || breakdownSource === 'black') && breakdownPlayerNumber === playerNumber;
                const isBestMoveNotBroken = hasBestMove && !isBrokenPlayer;
                if (isBrokenPlayer) rowClass = styles.brokenPlayerRow;
                else if (isBestMoveNotBroken) rowClass = styles.bestMoveRow;
              }

              return (
                <tr key={`${game.id}-${i}`} className={rowClass}>
                  <td>{i + 1}</td>
                  <td className={styles.nameP}>
                    <span className={styles.clickableNameInTable} onClick={() => onPlayerClick(row.id)}>
                      {row.name || ''}
                    </span>
                  </td>

                  {/* Ячейка для роли: отображает RoleIcon если !showOnlyNames, иначе просто пустая */}
                  <td>
                    {!showOnlyNames ? <RoleIcon role={row.role || ''} /> : ''}
                  </td>

                  {/* Ячейка для очков: отображает очки и ЛХ если !showOnlyNames, иначе пустая */}
                  <td>
                    {!showOnlyNames 
                      ? (
                          <> {/* Используем Fragment для группировки */}
                            {/* Отображаем число очков */}
                            {typeof row.points === 'number'
                              ? row.points.toFixed(2)
                              : typeof row.sum === 'number'
                                ? row.sum.toFixed(2)
                                : ''}
                            {/* Отображаем ЛХ, только если он есть И showOnlyNames === false */}
                            {row.best_move && (
                              <span className={styles.bestMoveText}> {' '}ЛХ: {row.best_move}</span>
                            )}
                          </>
                        ) 
                      : '' /* Пустая ячейка, если showOnlyNames === true */}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Result */}
      {!showOnlyNames && (
        <div className={styles.sheetBottom}>
          <span className={styles.sheetBottomLeft}>Результат</span>
          <div className={`${styles.sheetSlashBottom} ${resultColorClass}`} />
          <span className={styles.sheetBottomRight}>
            {game.badgeColor ? (game.badgeColor === 'red' ? 'Победа мирных' : 'Победа мафии') : 'Не сыграна'}
          </span>
        </div>
      )}

      {/* Admin Actions */}
      {!showOnlyNames && isAdmin && (
        <div className={styles.sheetActions}>
          <button onClick={() => onEdit(game.id, game.event_id)} className={styles.sheetEditBtn}>Редактировать</button>
          <button onClick={() => onDelete(game.id)} className={styles.sheetDeleteBtn}>Удалить</button>
        </div>
      )}
    </article>
  );
}

export default GameCard;
