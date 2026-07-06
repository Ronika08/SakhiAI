export async function getAddressFromCoordinates(lat, lng) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
    );

    const data = await response.json();

    return data.display_name || "Address not found";
  } catch (error) {
    console.error("Reverse Geocoding Error:", error);
    return "Unable to fetch address";
  }
}