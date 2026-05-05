import { apiRequest } from "./client";

export async function getPropertiesCount(filter: any) {
  return apiRequest("/properties/count", {
    method: "POST",
    body: JSON.stringify(filter)
  });
}

export async function searchProperties(filter: any) {
  return apiRequest("/properties/search", {
    method: "POST",
    body: JSON.stringify(filter)
  });
}

export async function searchByFilter(filterId: number, offset = 0) {
  return apiRequest(`/properties/search_by_filter`, {
    method: "POST",
    body: JSON.stringify({
      filter_id: filterId,
      offset,
      limit: 5
    })
  });
}

export async function getPropertiesByIds(ids: number[]) {
  return apiRequest("/properties/by_ids", {
    method: "POST",
    body: JSON.stringify({ ids })
  });
}