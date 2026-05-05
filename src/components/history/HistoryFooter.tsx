interface Props {
  count: number;
  onCreate: () => void;
}

export const HistoryFooter: React.FC<Props> = ({
  count,
  onCreate,
}) => {
  if (count < 5) {
    return (
      <button
        className="create-filter-button"
        onClick={onCreate}
      >
        Новый поиск
      </button>
    );
  }

  return (
    <div className="history-limit">
      Нельзя сохранить более 5 подборок, удалите лишнюю.
    </div>
  );
};
