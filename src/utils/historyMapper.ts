export const mapFilterToHistory = (f: any) => {
  const filters: string[] = [];

  // city
  if (f.city === "constanta") filters.push("Констанца");
  if (f.city === "bucharest") filters.push("Бухарест");

  // type
  if (f.type === "flat") filters.push("Квартира");
  if (f.type === "house") filters.push("Дом");

  // rooms
  if (f.rooms?.length) {
    filters.push(`${f.rooms.join(", ")} комн.`);
  }

  // flags
  if (f.pets) filters.push("Можно с животными");
  if (f.parking) filters.push("Парковка");
  if (f.separateKitchen) filters.push("Отдельная кухня");
  if (f.summerOnly) filters.push("Летняя аренда");

  // rent
  if (f.rentType === "long") filters.push("Долгосрочно");
  if (f.rentType === "short") filters.push("Краткосрочно");

  return {
    id: f.id,
    date: new Date().toLocaleDateString(),
    title: f.rooms.length ? `${f.rooms?.join(", ") || ""} комнаты`: "Любое количество комнат",
    filters,
  };
};
