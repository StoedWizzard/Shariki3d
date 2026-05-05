import { useEffect, useState, useRef, useCallback } from "react";
import { getSaved, removeSaved } from "../api/saved";
import { getPropertiesByIds } from "../api/properties";
import { PropertyCard } from "../components/propery/ProperyCard";

const PAGE_SIZE = 5;

export default function SavedPage() {
  const [allIds, setAllIds] = useState<number[]>([]);
  const [idsLoaded, setIdsLoaded] = useState(false);

  const [items, setItems] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loaderRef = useRef<HTMLDivElement | null>(null);

  // ------------------------
  // Load saved IDs
  // ------------------------
  useEffect(() => {
    const loadSaved = async () => {
      try {
        const ids = await getSaved();

        setAllIds(ids);
        setIdsLoaded(true);

        if (ids.length === 0) {
          setHasMore(false);
        }
      } catch (e) {
        console.error(e);
        setIdsLoaded(true);
        setHasMore(false);
      }
    };

    loadSaved();
  }, []);

  // ------------------------
  // Load next page
  // ------------------------
  const loadMore = useCallback(async () => {
    if (!idsLoaded) return;
    if (loading || !hasMore) return;

    const nextIds = allIds.slice(offset, offset + PAGE_SIZE);
    if (nextIds.length === 0) {
      setHasMore(false);
      return;
    }

    setLoading(true);

    try {
      const properties = await getPropertiesByIds(nextIds);

      setItems(prev => [...prev, ...properties]);
      setOffset(prev => prev + nextIds.length);

      if (offset + nextIds.length >= allIds.length) {
        setHasMore(false);
      }
    } catch (e) {
      console.error(e);
    }

    setLoading(false);
  }, [allIds, offset, loading, hasMore, idsLoaded]);

  // ------------------------
  // First load after IDs received
  // ------------------------
  useEffect(() => {
    if (idsLoaded && allIds.length > 0 && offset === 0) {
      loadMore();
    }
  }, [idsLoaded]);

  // ------------------------
  // Infinite scroll
  // ------------------------
  useEffect(() => {
    if (!idsLoaded) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    const current = loaderRef.current;
    if (current) observer.observe(current);

    return () => {
      if (current) observer.unobserve(current);
    };
  }, [loadMore, idsLoaded]);

  // ------------------------
  // Remove saved
  // ------------------------
  const toggleSaved = async (id: number) => {
    try {
      await removeSaved(id);

      setAllIds(prev => prev.filter(i => i !== id));
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  // ------------------------
  // UI
  // ------------------------
  if (!idsLoaded) {
    return <div className="content"><div className="loading">Загрузка...</div></div>;
  }

  return (
    <div className="content">
      {items.length === 0 && !hasMore && (
        <div className="loading">Нет сохранённых объектов</div>
      )}

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
          isSaved={true}
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

      {hasMore && <div ref={loaderRef} style={{ height: 1 }} />}

      {loading && <div className="loading">Загрузка...</div>}
      {!hasMore && items.length > 0 && (
        <div className="loading">Больше нет объектов</div>
      )}
    </div>
  );
}
