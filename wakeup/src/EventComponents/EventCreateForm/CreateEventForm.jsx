// components/CreateEventForm.jsx
import React, { useState, useCallback } from "react";
import styles from "./CreateEventForm.module.css";

function CreateEventForm({ onCreateEvent, onClose }) {
  const [title, setTitle] = useState("");
  const [dates, setDates] = useState([""]);
  const [location, setLocation] = useState("");
  const [type, setType] = useState("solo");
  const [participantsLimit, setParticipantsLimit] = useState("");
  const [fee, setFee] = useState("");
  const [currency, setCurrency] = useState("Руб");
  const [gsName, setGsName] = useState("");
  const [gsRole, setGsRole] = useState("Главный Судья");
  const [orgName, setOrgName] = useState("");
  const [orgRole, setOrgRole] = useState("Организатор");

  const handleAddDate = useCallback(() => {
    setDates((prevDates) => [...prevDates, ""]);
  }, []);

  const handleDateChange = useCallback((index, value) => {
    setDates((prevDates) =>
      prevDates.map((date, i) => (i === index ? value : date))
    );
  }, []);

  const handleRemoveDate = useCallback((index) => {
    setDates((prevDates) => prevDates.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      const newEventData = {
        title: title.trim(),
        dates: dates.map(d => d.trim()).filter(Boolean),
        location: location.trim(),
        type: type,
        participants_limit: parseInt(participantsLimit, 10) || 0,
        fee: parseFloat(fee) || 0.0,
        currency: currency,
        gs_name: gsName.trim(),
        gs_role: gsRole.trim(),
        org_name: orgName.trim(),
        org_role: orgRole.trim(),
      };

      if (!newEventData.title || newEventData.dates.length === 0) {
        alert("Пожалуйста, укажите название и хотя бы одну дату события.");
        return;
      }

      onCreateEvent(newEventData);
      onClose();
    },
    [
      title,
      dates,
      location,
      type,
      participantsLimit,
      fee,
      currency,
      gsName,
      gsRole,
      orgName,
      orgRole,
      onCreateEvent,
      onClose,
    ]
  );

  return (
    <div className={styles.createEventOverlay}>
      <div className={styles.createEventFormContainer}>
        {/* Кнопка закрытия добавлена в заголовок формы */}
        <div className={styles.formHeader}>
          <h2 className={styles.formTitle}>Создание нового ивента</h2>
          <button 
            type="button" 
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Закрыть форму"
          >
            ×
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.formContent}>
          {/* Поля ввода остаются без изменений */}
          <div className={styles.formGroup}>
            <label htmlFor="eventTitle">Название:</label>
            <input
              id="eventTitle"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Даты:</label>
            {dates.map((date, index) => (
              <div key={index} className={styles.dateInputRow}>
                <input
                  type="datetime-local"
                  value={date}
                  onChange={(e) => handleDateChange(index, e.target.value)}
                  className={styles.datePicker}
                  required={index === 0}
                />
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveDate(index)}
                    className={styles.removeDateBtn}
                    aria-label="Удалить дату"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={handleAddDate} className={styles.addDateBtn}>
              + Добавить дату
            </button>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="eventLocation">Местоположение:</label>
            <input
              id="eventLocation"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="eventType">Тип:</label>
            <select
              id="eventType"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="solo">Личное</option>
              <option value="duo">Парное</option>
              <option value="team">Командное</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="eventCapacity">Лимит участников:</label>
            <input
              id="eventCapacity"
              type="number"
              value={participantsLimit}
              onChange={(e) => setParticipantsLimit(e.target.value)}
              min="0"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="eventFee">Взнос:</label>
            <input
              id="eventFee"
              type="number"
              step="0.01"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              min="0"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="eventCurrency">Валюта:</label>
            <input
              id="eventCurrency"
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              maxLength="3"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="eventGsName">Название GS:</label>
            <input
              id="eventGsName"
              type="text"
              value={gsName}
              onChange={(e) => setGsName(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="eventGsRole">Роль GS:</label>
            <input
              id="eventGsRole"
              type="text"
              value={gsRole}
              onChange={(e) => setGsRole(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="eventOrgName">Название Организатора:</label>
            <input
              id="eventOrgName"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="eventOrgRole">Роль Организатора:</label>
            <input
              id="eventOrgRole"
              type="text"
              value={orgRole}
              onChange={(e) => setOrgRole(e.target.value)}
            />
          </div>

          {/* Кнопки управления формой */}
          <div className={styles.formActions}>
            <button type="submit" className={styles.submitFormBtn}>
              Создать
            </button>
            <button type="button" onClick={onClose} className={styles.cancelFormBtn}>
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateEventForm;
