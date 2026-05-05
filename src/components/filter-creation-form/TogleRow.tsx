export const ToggleRow: React.FC<{
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, value, onChange }) => (
  <div className="toggle-row">
    <span>{label}</span>
    <div
      className={`switch ${value ? "on" : ""}`}
      onClick={() => onChange(!value)}
    >
      <div className="knob" />
    </div>
  </div>
);