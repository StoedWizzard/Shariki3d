import { apiRequest } from "./client";

export async function createFilter(data: any) {
  return apiRequest("/filters", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export const getFilters = () => {
  return apiRequest(`/filters`);
};

export const deleteFilter = async (filterId: number) => {
  return apiRequest(`/filters/${filterId}`, {
    method: "DELETE",
  });
};

