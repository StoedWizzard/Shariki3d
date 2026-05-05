import TrashIcon from "../../assets/trash.svg";
import { FilterChip } from "./FilterChip";
import type { HistoryFilter } from "../../types/history";

interface Props {
  item: HistoryFilter;
  onDelete: (id: number) => void;
  onClick: (id: number) => void;
}

export const HistoryItem: React.FC<Props> = ({ item, onDelete, onClick }) => {
  return (
    <div className="history-item" onClick={() => {
      onClick(item.id)
    }}>
      <div className="history-item-top">
        <span>
          №{item.id} · {item.date}
        </span>

        <button
          className="history-item-delete-button"
          onClick={(e) => {
            e.stopPropagation(); // чтобы не открылся results
            onDelete(item.id);
          }}
        >
          <img src={TrashIcon} />
          <span>Удалить</span>
        </button>
      </div>

      <span className="history-item-title">
        {item.title}
      </span>

      <div className="history-item-filters-title">
        <span>Фильтры</span>
      </div>

      <div className="history-item-filters">
        {item.filters.map((f, i) => (
          <FilterChip key={i} label={f} />
        ))}
      </div>
    </div>
  );
};
