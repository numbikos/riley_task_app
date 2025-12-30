import React from 'react';

interface NavigationHeaderProps {
  title: string;
  onPrev: () => void;
  onNext: () => void;
  onToday?: () => void;
  todayLabel?: string;
  className?: string;
  titleClassName?: string;
  btnClassName?: string;
}

export default function NavigationHeader({
  title,
  onPrev,
  onNext,
  onToday,
  todayLabel = "Today",
  className = "day-nav-header",
  titleClassName = "day-nav-title",
  btnClassName = "day-nav-btn"
}: NavigationHeaderProps) {
  return (
    <div className={className}>
      {onToday && (
        <div className="nav-header-top-action">
          <button className="week-today-btn" onClick={onToday}>{todayLabel}</button>
        </div>
      )}
      <div className="day-nav">
        <button className={btnClassName} onClick={onPrev}>←</button>
        <h2 className={titleClassName}>{title}</h2>
        <button className={btnClassName} onClick={onNext}>→</button>
      </div>
    </div>
  );
}

