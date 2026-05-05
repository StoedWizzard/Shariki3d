export interface Property {
  id: string;
  city: string;
  title: string;           // "3 Комнаты"
  location: string;        // "Faleza Nord"
  landmark?: string;
  floorInfo?: string;      // "3 этаж · без лифта"
  area?: number;           // 75
  priceMain: number;       // 990
  prices: {
    label: string;
    value: number;
  }[];
  images: string[];
  hasPets?: boolean;
  hasParking?: boolean;

  code: string;
  pets_text: string;
  parking_text: string;
  rooms_raw: string;
  kitchenware: string;
  bed_sheets: string;
  equipment_text: string;
  prices_text: string;
}
