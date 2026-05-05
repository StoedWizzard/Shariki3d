export const ButtonGroup: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => (
  <div className="rent-group">
    <button
      className={`rent-btn ${value === "short" ? "active" : ""}`}
      onClick={() => onChange("short")}
    >
      Краткосрочно (1–9 месяцев)
    </button>

    <button
      className={`rent-btn purple ${value === "long" ? "active" : ""}`}
      onClick={() => onChange("long")}
    >
      Долгосрочно (от 12 месяцев)
    </button>
  </div>
);
