import { apiRequest } from "./client";

export const getSaved = () => {
  return apiRequest(`/saved`);
};

export const addSaved = (propertyId: number) => {
  return apiRequest("/saved", {
    method: "POST",
    body: JSON.stringify({
      property_id: propertyId
    })
  });
};

export const removeSaved = (propertyId: number) => {
  return apiRequest(`/saved?property_id=${propertyId}`, {
    method: "DELETE"
  });
};
