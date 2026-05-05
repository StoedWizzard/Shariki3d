import { useNavigate } from "react-router-dom";
import { useState } from "react";

import PandaLogo from "../assets/panda-logo.png";
import ClockImg from "../assets/clock.svg";
import SearchImg from "../assets/search-normal.svg";
import HeartImg from "../assets/heart.svg";
import QrImg from "../assets/qr_code.png";

export default function HomePage() {
  const navigate = useNavigate();
  const [showQr, setShowQr] = useState(false);

  return (
    <div className="landing-content">

      {/* Logo / QR flip */}
      <div
        className={`landing-logo-wrapper ${showQr ? "flipped" : ""}`}
        onClick={() => setShowQr(!showQr)}
      >
        <div className="landing-logo-inner">

          {/* front */}
          <div className="landing-logo-front">
            <img src={PandaLogo} className="landing-logo" />
          </div>

          {/* back */}
          <div className="landing-logo-back">
            <div className="landing-qr-container">
              <img src={QrImg} className="landing-qr" />
              <div className="landing-qr-text">Поделиться</div>
            </div>
          </div>

        </div>
      </div>

      {/* Title */}
      <h1 className="landing-title">
        Аренда жилья
        <br />
        в Румынии
      </h1>

      <div className="landing-subtitle">
        Констанца • Бухарест
      </div>

      {/* Buttons */}
      <div className="landing-actions">

        <button
          className="landing-btn primary"
          onClick={() => navigate("/create-filter")}
        >
          <img src={SearchImg}/>
          Новый поиск
        </button>

        <button
          className="landing-btn"
          onClick={() => navigate("/saved")}
        >
          <img src={HeartImg}/>
          Сохраненные
        </button>

        <button
          className="landing-btn"
          onClick={() => navigate("/history")}
        >
          <img src={ClockImg}/>
          История поиска
        </button>

      </div>
    </div>
  );
}