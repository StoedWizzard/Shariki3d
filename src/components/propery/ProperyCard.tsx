import React, { useState } from "react";
import ParkingImg from "../../assets/parking.svg";
import PetImg from "../../assets/pet.svg";
import PetInactiveImg from "../../assets/petinactive.svg";
import ParkingInactiveImg from "../../assets/parkinginactive.svg";
import SavedImg from "../../assets/saved.svg";
import UnSavedImg from "../../assets/unsaved.svg";
import SmsImg from "../../assets/sms.svg";
import HouseImg from "../../assets/house.svg";
import LocationImg from "../../assets/location.svg";
import SettingsImg from "../../assets/settings.svg";
import BuildingsImg from "../../assets/buildings.svg";
interface Price {
  label: string;
  value: number;
}

interface PropertyCardProps {
  id: number;
  city: string;
  title: string;
  location: string;
  landmark?: string;
  floorInfo?: string;
  area?: number;
  priceMain: number;
  prices: Price[];
  images: string[];
  hasPets?: boolean;
  hasParking?: boolean;
  telegramLink?: string;   // ← ДОБАВИТЬ
  isSaved?: boolean;
  code: string;
  pets_text: string;
  parking_text: string;
  rooms_raw: string;
  kitchenware: string;
  bed_sheets: string;
  equipment_text: string;
  prices_text: string;
  onToggleSaved?: (id: number) => void;
}

const placeholder =
  "https://via.placeholder.com/400x250?text=No+Image";

export const PropertyCard: React.FC<PropertyCardProps> = ({
  id,
  city,
  title,
  location,
  landmark,
  floorInfo,
  area,
  priceMain,
  prices,
  images,
  hasPets,
  hasParking,
  telegramLink,
  code,
  pets_text,
  parking_text,
  rooms_raw,
  kitchenware,
  bed_sheets,
  equipment_text,
  prices_text,
  isSaved = false,
  onToggleSaved,
}) => {
  console.log(kitchenware)
  console.log(bed_sheets)
  const [index, setIndex] = useState(0);
const [expanded, setExpanded] = useState(false);
const [viewerOpen, setViewerOpen] = useState(false);
const [scale, setScale] = useState(1);
const [touchStart, setTouchStart] = useState<number | null>(null);
const [copied, setCopied] = useState(false);
const [flyToSaved, setFlyToSaved] = useState<null | {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  img: string;
  animate: boolean;
}>(null);

const animateToSaved = () => {
  const target = document.getElementById("saved-nav-button");
  const imageEl = document.querySelector(
    `.property-card[data-id="${id}"] .pc-image img`
  ) as HTMLImageElement | null;

  if (!target || !imageEl) return;

  const imageRect = imageEl.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  const startX = imageRect.left + imageRect.width / 2;
  const startY = imageRect.top + imageRect.height / 2;

  const endX = targetRect.left + targetRect.width / 2;
  const endY = targetRect.top + targetRect.height / 2;

  setFlyToSaved({
    startX,
    startY,
    endX,
    endY,
    img: imgs[index],
    animate: false,
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setFlyToSaved((prev) => (prev ? { ...prev, animate: true } : null));
    });
  });

  setTimeout(() => {
    setFlyToSaved(null);
  }, 800);
};


const onTouchStart = (e: React.TouchEvent) => {
  setTouchStart(e.touches[0].clientX);
};

const onTouchEnd = (e: React.TouchEvent) => {
  if (touchStart === null) return;
  const delta = e.changedTouches[0].clientX - touchStart;

  if (delta > 50) {
    setIndex((i) => (i - 1 + imgs.length) % imgs.length);
  }
  if (delta < -50) {
    setIndex((i) => (i + 1) % imgs.length);
  }

  setTouchStart(null);
};

  const imgs = images.length ? images : [placeholder];

  () => setIndex((i) => (i + 1) % imgs.length);
  () =>
    setIndex((i) => (i - 1 + imgs.length) % imgs.length);

  const copyLink = async () => {
    if (!telegramLink) return;

    try {
      await navigator.clipboard.writeText(telegramLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const MANAGERS = ["AyilimE", "UmMargo"];

  const writeManager = () => {
    if (!telegramLink) return;

    const manager =
      MANAGERS[Math.floor(Math.random() * MANAGERS.length)];

    const text = encodeURIComponent(
      `Здравствуйте, заинтересовал объект ${telegramLink}`
    );

    const url = `https://t.me/${manager}?text=${text}`;
    window.open(url, "_blank");
  };

  return (
    <div data-id={id} className="property-card">
      {copied && (
        <div className="copy-toast">
          Ссылка скопирована
        </div>
      )}
      {/* Image block */}
      <div
  className="pc-image"
  onTouchStart={onTouchStart}
  onTouchEnd={onTouchEnd}
>
        {imgs.length > 1 && (
        <>
            <button
            className="pc-nav left"
            onClick={(e) => {
                e.stopPropagation();
                setIndex((i) => (i - 1 + imgs.length) % imgs.length);
            }}
            >
            ‹
            </button>

            <button
            className="pc-nav right"
            onClick={(e) => {
                e.stopPropagation();
                setIndex((i) => (i + 1) % imgs.length);
            }}
            >
            ›
            </button>
        </>
        )}
        <img
        src={imgs[index]}
        alt=""
        onClick={() => {
            setViewerOpen(true);
            setScale(1);
        }}
        />

        {/* Navigation */}
        {imgs.length > 1 && (
          <>
            <div className="pc-counter">
              {index + 1}/{imgs.length}
            </div>

            <div className="pc-dots">
              {imgs.map((_, i) => (
                <span
                  key={i}
                  className={i === index ? "active" : ""}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
          </>
        )}

        <div className="pc-price">{priceMain} €</div>

        <button
          className={`pc-fav ${isSaved ? "active" : ""}`}
          onClick={(e) => {
  e.stopPropagation();

  if (!isSaved) {
    animateToSaved();
  }

  onToggleSaved?.(id);
}}
        >
          {isSaved ? <img src={SavedImg} /> : <img src={UnSavedImg}/>}
        </button>
      </div>

      {/* Content */}
      <div className="pc-content">
          <div className="pc-content-title">
          <div className="pc-title">
            <span>{title}</span>
            <div className="pc-location"><img src={LocationImg}/><span>{location}</span></div>
          </div>

          {landmark && (
            <div className="pc-sub"><span>Ориентир</span>: {landmark}</div>
          )}
          <div className = "pc-fetures-data">
            {floorInfo && <div className="pc-sub"><span>{floorInfo}</span></div>}

            {/* Features */}
            <div className="pc-features">
              {hasPets ? <div className="chip"><img src={PetImg}/></div> : <div className="chip"><img src={PetInactiveImg}/></div>}
              {hasParking ? <div className="chip"><img src={ParkingImg}/></div>: <div className="chip"><img src={ParkingInactiveImg}/></div>}
              {area && <div className="chip">{area} м²</div>}
            </div>
          </div>
        </div>

        {/* Prices */}
        <div className="pc-prices">
          {prices.map((p, i) => (
            <div key={i} className="price-btn">
              {p.label} — {p.value} €
            </div>
          ))}
        </div>

        {/* More */}
        <div
            className="pc-more"
            onClick={() => setExpanded((v) => !v)}
            >
            <span />
            подробнее {expanded ? "▲" : "▼"}
            <span />
        </div>
        {expanded && (
            <div className="pc-expanded">

                <button
                  className="action-btn primary"
                  onClick={writeManager}
                >
                  <img src={SmsImg}/>
                  Написать менеджеру
                </button>

                <button
                  className="action-btn"
                  onClick={copyLink}
                >
                  Копировать ссылку
                </button>

                <div className="info-card">
                <div className="info-title"><img src={HouseImg}/>Об объекте:</div>
                <div className="info-text">
                    {rooms_raw}, {city}
                </div>
                <div className="info-text">
                    <img src={BuildingsImg}/><span>{location}</span> | Район
                </div>
                <div className="info-text">Код: {code}</div>
                </div>

                {landmark && (
                <div className="info-card">
                    <div className="info-title"><img src={LocationImg}/>Локация</div>
                    <div className="info-text">
                    Ориентир: <span>{landmark}</span>
                    </div>
                </div>
                )}

                {floorInfo && (
                <div className="info-card">
                    <div className="info-title"><img src={SettingsImg}/>Оснащение</div>
                    <div className="info-text">
                      {equipment_text}
                    </div>
                </div>
                )}

                <div className="info-card">
                  <div className="feature-row"><img src={PetImg}/> {pets_text}</div>
                  <div className="feature-row"><img src={ParkingImg}/> {parking_text}</div>
                </div>

                <div className="info-card">
                <div className="info-title">Аренда</div>
                  <div className = "info-text">{prices_text}</div>
                </div>

            </div>
            )}
      </div>
      {viewerOpen && (
        <div
            className="image-viewer"
            onClick={() => {
            setViewerOpen(false);
            setScale(1);
            }}
        >
          {imgs.length > 1 && (
        <>
            <button
            className="pc-nav left"
            onClick={(e) => {
                e.stopPropagation();
                setIndex((i) => (i - 1 + imgs.length) % imgs.length);
            }}
            >
            ‹
            </button>

            <button
            className="pc-nav right"
            onClick={(e) => {
                e.stopPropagation();
                setIndex((i) => (i + 1) % imgs.length);
            }}
            >
            ›
            </button>
        </>
        )}
            <button
            className="viewer-close"
            onClick={() => setViewerOpen(false)}
            >
            ✕
            </button>

            <img
            src={imgs[index]}
            className="viewer-image"
            style={{ transform: `scale(${scale})` }}
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => {
                e.stopPropagation();
                setScale((s) =>
                Math.min(3, Math.max(1, s - e.deltaY * 0.001))
                );
            }}
            />
        </div>
        )}
        {flyToSaved && (
  <div
    className={`flying-to-saved ${flyToSaved.animate ? "animate" : ""}`}
    style={
      {
        left: `${flyToSaved.startX}px`,
        top: `${flyToSaved.startY}px`,
        backgroundImage: `url(${flyToSaved.img})`,
        "--dx": `${flyToSaved.endX - flyToSaved.startX}px`,
        "--dy": `${flyToSaved.endY - flyToSaved.startY}px`,
      } as React.CSSProperties
    }
  />
)}
    </div>
  );
};
