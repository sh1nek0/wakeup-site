// wakeup-site/wakeup/src/RoleIcon/RoleIcon.jsx
import React from 'react';
import styles from './RoleIcon.module.css';

// Предполагается, что иконки лежат в /src/images/roles/
import donIcon from '../images/roles/don.png';
import mafiaIcon from '../images/roles/mafia.png';
import sheriffIcon from '../images/roles/sheriff.png';
import citizenIcon from '../images/roles/citizen.png';

const roleIcons = {
  'дон': donIcon,
  'мафия': mafiaIcon,
  'шериф': sheriffIcon,
  'мирный': citizenIcon
};

const RoleIcon = ({ role }) => {
  if (!role) {
    return null; // Ничего не рендерим, если роль не передана
  }

  const roleKey = role.toLowerCase();

  // Если роль "мирный", ничего не отображаем
//   if (roleKey === 'мирный') {
//     return null;
//   }

  const iconSrc = roleIcons[roleKey];

  // Если для роли есть иконка, показываем ее
  if (iconSrc) {
    return <img src={iconSrc} alt={role} className={styles.roleIcon} title={role} />;
  }

  // Для других ролей без иконок (если появятся) просто показываем текст
  return <span>{role}</span>;
};

export default RoleIcon;