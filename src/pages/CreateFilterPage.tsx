import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPropertiesCount } from "../api/properties";
import { createFilter } from "../api/filters";
import { useEffect } from "react";
import { SectionCard } from "../components/filter-creation-form/SectionCard";
import { ChipGroup } from "../components/filter-creation-form/ChipGroup";
import { ToggleRow } from "../components/filter-creation-form/TogleRow";
import { ButtonGroup } from "../components/filter-creation-form/ButtonGroup";
export default function CreateFilterPage () {
  const [city, setCity] = useState("constanta");
  const [constantaDistrict, setConstantaDistrict] = useState("city"); // один
  const [bucharestSectors, setBucharestSectors] = useState<string[]>(["2"]); // много
  const [rooms, setRooms] = useState<string[]>(["2"]);
  const [type, setType] = useState("flat");

  const [pets, setPets] = useState(false);
  const [parking, setParking] = useState(false);
  const [separateKitchen, setSeparateKitchen] = useState(false);

  const [rentType, setRentType] = useState("long");
  const [summerOnly, setSummerOnly] = useState(false);
  const [availableCount, setAvailableCount] = useState<number | null>(null);
  const navigate = useNavigate();
  const handleApply = async () => {
  const payload = buildPayload();

  try {
    const res = await createFilter(payload);

    const filterId = res.filter_id;

    navigate(`/results?filter_id=${filterId}`);

  } catch (e) {
    console.error(e);
    alert("Ошибка создания фильтра");
  }
};



  useEffect(() => {
    if (city === "constanta") {
      setBucharestSectors([]); // или ["2"] если хочешь дефолт
    } else {
      setConstantaDistrict("city");
    }
  }, [city]);

  const buildPayload = () => ({
    city,
    district: city === "constanta" ? constantaDistrict : null,
    sectors: city === "bucharest" ? bucharestSectors : [],
    rooms,
    type,
    pets,
    parking,
    separateKitchen,
    summerOnly,
    rentType
  });

  useEffect(() => {
  const loadCount = async () => {
    try {
      const res = await getPropertiesCount(buildPayload());
      setAvailableCount(res.count);
    } catch (e) {
      console.error(e);
    }
  };

  loadCount();
  }, [
    city,
    constantaDistrict,
    bucharestSectors,
    rooms,
    type,
    pets,
    parking,
    separateKitchen,
    summerOnly,
    rentType
  ]);

  return (
    <div className="content">

      <div className="filters-header">
        Настройте фильтры поиска
      </div>

      {/* ГОРОД */}
      <SectionCard title="Город">
        <ChipGroup
          options={[
            { id: "constanta", label: "Констанца" },
            { id: "bucharest", label: "Бухарест" },
          ]}
          value={city}
          onChange={setCity}
        />
      </SectionCard>

      {city === "constanta" ? (
      <SectionCard title="Район">
        <ChipGroup
          options={[
            { id: "city", label: "Констанца (город)" },
            { id: "mamaia", label: "Mamaia (коса)" },
            { id: "mamaia-sat", label: "Mamaia-Sat (Navodari)" },
          ]}
          value={constantaDistrict}
          onChange={setConstantaDistrict}
        />
      </SectionCard>
    ) : (
      <SectionCard title="Сектор">
        <ChipGroup
          multiple
          options={[
            { id: "1", label: "Сектор 1" },
            { id: "2", label: "Сектор 2" },
            { id: "3", label: "Сектор 3" },
            { id: "4", label: "Сектор 4" },
            { id: "5", label: "Сектор 5" },
            { id: "6", label: "Сектор 6" },
          ]}
          value={bucharestSectors}
          onChange={setBucharestSectors}
        />
      </SectionCard>
    )}

      {/* ТИП */}
      <SectionCard title="Тип недвижимости">
        <ChipGroup
          options={[
            { id: "flat", label: "Квартира" },
            { id: "house", label: "Дом" },
          ]}
          value={type}
          onChange={setType}
          highlight="yellow"
        />
      </SectionCard>

      {/* КОМНАТЫ */}
      <SectionCard title="Количество комнат">
        <ChipGroup
          multiple
          options={[
            { id: "1", label: "1 Комнатная" },
            { id: "2", label: "2 Комнатные" },
            { id: "3", label: "3 Комнатные" },
            { id: "4", label: "4+ Комнатные" },
          ]}
          value={rooms}
          onChange={setRooms}
        />
      </SectionCard>

      {/* ПЕРЕКЛЮЧАТЕЛИ */}
      <SectionCard>
        <ToggleRow
          label="Кухня отдельно"
          value={separateKitchen}
          onChange={setSeparateKitchen}
        />
        {/* <Divider /> */}
        <ToggleRow
          label="Можно с животными"
          value={pets}
          onChange={setPets}
        />
        {/* <Divider /> */}
        <ToggleRow
          label="Парковка"
          value={parking}
          onChange={setParking}
        />
        <ToggleRow
          label="Сдаётся летом"
          value={summerOnly}
          onChange={setSummerOnly}
        />
      </SectionCard>

      {/* СРОК */}
      <SectionCard title="Срок аренды">
        <ButtonGroup
          value={rentType}
          onChange={setRentType}
        />
      </SectionCard>

      {/* КНОПКА */}
      <button className="apply-btn" onClick={handleApply}>
        Показать варианты
      </button>

      <div className="available">
        {availableCount !== null
          ? `Доступно ${availableCount} объектов`
          : "—"}
      </div>

    </div>
  );
};
