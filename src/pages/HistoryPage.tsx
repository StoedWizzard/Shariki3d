import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HistoryItem } from "../components/history/HistoryItem";
import { HistoryFooter } from "../components/history/HistoryFooter";
import type { HistoryFilter } from "../types/history";
import { getFilters } from "../api/filters";
import { mapFilterToHistory } from "../utils/historyMapper";
import { deleteFilter } from "../api/filters";

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryFilter[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        
        const data = await getFilters();
        const mapped = data.map(mapFilterToHistory);
        setHistory(mapped);
      } catch (e) {
        console.error(e);
      }
    };

    load();
  }, []);

  const deleteItem = async (id: number) => {
    try {
      await deleteFilter(id);

      setHistory((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      console.error(e);
      alert("Ошибка удаления");
    }
  };

  const openFilter = (id: number) => {
    navigate(`/results?filter_id=${id}`);
  };

  const createFilter = () => {
    navigate("/create-filter");
  };

  console.log(history)

  return (
    <div className="content">
      {history.map((item) => (
        <HistoryItem
          key={item.id}
          item={item}
          onDelete={deleteItem}
          onClick={() => openFilter(item.id)}
        />
      ))}

      <HistoryFooter
        count={history.length}
        onCreate={createFilter}
      />
    </div>
  );
}
