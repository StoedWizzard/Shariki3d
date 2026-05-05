interface Props {
  label: string;
}

export const FilterChip: React.FC<Props> = ({ label }) => {
  return (
    <span className="history-item-filter">
      {label}
    </span>
  );
};
