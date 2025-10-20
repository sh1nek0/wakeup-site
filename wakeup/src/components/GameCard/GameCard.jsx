import React from 'react';
import styles from './GameCard.module.css';
import RoleIcon from '../../RoleIcon/RoleIcon';

function GameCard({ game, isAdmin, onDelete, onEdit, onPlayerClick, gameNumber }) {
    // Определяем номер стола из разных возможных полей
    const tableNumber = game.tableNumber || game.id.match(/_t(\d+)/)?.[1] || '?';
    
    // Гарантируем, что у нас всегда 10 строк
    const rows = Array.from({ length: 10 }, (_, i) => game.players?.[i] || {});
    
    // Форматируем дату
    const gameDate = game.date || (game.created_at ? new Date(game.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

    // Определяем классы для цвета результата и локации
    let resultColorClass = '';
    if (game.badgeColor === 'red') resultColorClass = styles.resRed;
    else if (game.badgeColor === 'black') resultColorClass = styles.resBlack;
    else resultColorClass = styles.resGray;

    let locationColorClass = '';
    if (game.location === 'МФТИ') locationColorClass = styles.locMIPT;
    else if (game.location === 'МИЭТ') locationColorClass = styles.locMIET;

    return (
        <article className={styles.sheetCard}>
            <div className={styles.sheetMeta}>
                <div className={`${styles.sheetLocation} ${locationColorClass}`}>{game.location || ''}</div>
                <div className={styles.sheetTableNumber}>Стол #{tableNumber}</div>
                <div className={styles.sheetJudge}>
                    {game.judge_id ? (
                        <span className={styles.clickableName} onClick={() => onPlayerClick(game.judge_id)}>
                            {game.judge_nickname || 'Не указан'}
                        </span>
                    ) : (
                        game.judge_nickname || 'Не указан'
                    )}
                </div>
            </div>
            <div className={styles.sheetTop}>
                <span className={styles.sheetTitle}>Игра #{gameNumber || tableNumber}</span>
                <div className={`${styles.sheetSlashTop} ${locationColorClass}`} />
                <time className={styles.sheetDate}>{gameDate}</time>
            </div>
            <div className={styles.sheetTableWrap}>
                <table className={styles.sheetTable}>
                    <thead>
                        <tr><th>№</th><th>Игрок</th><th>Роль</th><th>Очки</th></tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={`${game.id}-${i}`} className={row.best_move ? styles.eliminatedRow : ''}>
                                <td>{i + 1}</td>
                                <td className={styles.nameP}>
                                    <span className={styles.clickableNameInTable} onClick={() => onPlayerClick(row.id)}>
                                        {row.name || ''}
                                    </span>
                                </td>
                                <td><RoleIcon role={row.role || ''} /></td>
                                <td>
                                    {typeof row.points === 'number' ? row.points.toFixed(2) : (typeof row.sum === 'number' ? row.sum.toFixed(2) : '')}
                                    {row.best_move && (
                                        <span className={styles.bestMoveText}>
                                            {' '}(ЛХ: {row.best_move})
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className={styles.sheetBottom}>
                <span className={styles.sheetBottomLeft}>Результат</span>
                <div className={`${styles.sheetSlashBottom} ${resultColorClass}`} />
                <span className={styles.sheetBottomRight}>
                    {game.badgeColor ? (game.badgeColor === 'red' ? 'Победа мирных' : 'Победа мафии') : 'Не сыграна'}
                </span>
            </div>
            {isAdmin && (
                <div className={styles.sheetActions}>
                    <button onClick={() => onEdit(game.id, game.event_id)} className={styles.sheetEditBtn}>Редактировать</button>
                    <button onClick={() => onDelete(game.id)} className={styles.sheetDeleteBtn}>Удалить</button>
                </div>
            )}
        </article>
    );
}

export default GameCard;
