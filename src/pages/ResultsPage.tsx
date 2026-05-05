import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { searchByFilter } from "../api/properties";
import { PropertyCard } from "../components/propery/ProperyCard";
import { getSaved, addSaved, removeSaved } from "../api/saved";

const PAGE_SIZE = 5;

export default function ResultsPage() {
  const [params] = useSearchParams();
  const filterId = Number(params.get("filter_id"));

  const [items, setItems] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [savedIds, setSavedIds] = useState<number[]>([]);

  const loaderRef = useRef<HTMLDivElement | null>(null);

  // ------------------------
  // Load saved
  // ------------------------
  useEffect(() => {
    const loadSaved = async () => {
      const ids = await getSaved();
      setSavedIds(ids);
    };
    loadSaved();
  }, []);

  const toggleSaved = async (id: number) => {
    if (savedIds.includes(id)) {
      await removeSaved(id);
      setSavedIds(prev => prev.filter(i => i !== id));
    } else {
      await addSaved(id);
      setSavedIds(prev => [...prev, id]);
    }
  };

  // ------------------------
  // Reset when filter changes
  // ------------------------
  useEffect(() => {
    setItems([]);
    setOffset(0);
    setHasMore(true);
  }, [filterId]);

  // ------------------------
  // Load data
  // ------------------------
  const loadMore = useCallback(async () => {
    if (!filterId || loading || !hasMore) return;

    setLoading(true);

    try {
      const data = await searchByFilter(filterId, offset);

      setItems(prev => [...prev, ...data]);
      setOffset(prev => prev + data.length);

      if (data.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } catch (e) {
      console.error(e);
    }

    setLoading(false);
  }, [filterId, offset, loading, hasMore]);

  // initial load
  useEffect(() => {
    if (offset === 0) {
      loadMore();
    }
  }, [offset, filterId]);

  // ------------------------
  // Intersection Observer
  // ------------------------
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const first = entries[0];
        if (first.isIntersecting) {
          loadMore();
        }
      },
      {
        rootMargin: "200px",
      }
    );

    const current = loaderRef.current;
    if (current) observer.observe(current);

    return () => {
      if (current) observer.unobserve(current);
    };
  }, [loadMore]);

  // ------------------------
  // UI
  // ------------------------
  return (
    <div className="content">
      {items.map(item => (
        <PropertyCard
          key={item.id}
          id={item.id}
          city={item.city}
          title={item.title}
          location={item.location}
          landmark={item.landmark}
          floorInfo={item.floorInfo}
          area={item.area}
          priceMain={item.priceMain}
          hasPets={item.hasPets}
          hasParking={item.hasParking}
          images={item.images}
          prices={item.prices}
          telegramLink={item.telegramLink}
          isSaved={savedIds.includes(item.id)}
          onToggleSaved={toggleSaved}
          code={item.code}
          pets_text={item.pets_text}
          parking_text={item.parking_text}
          rooms_raw={item.rooms_raw}
          kitchenware={item.kitchenware}
          bed_sheets={item.bed_sheets}
          equipment_text={item.equipment_text}
          prices_text={item.prices_text}
        />
      ))}

      {/* Loader trigger */}
      {hasMore && (
        <div ref={loaderRef} style={{ height: 1 }} />
      )}

      {loading && <div className="loading">Загрузка...</div>}
      {!hasMore && items.length > 0 && (
        <div className="loading">Больше нет объектов</div>
      )}
    </div>
  );
}
