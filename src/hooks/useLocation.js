import { useState, useEffect, useCallback } from "react";
import { getAddressFromCoordinates } from "../services/locationService";

export default function useLocation() {
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setLoading(false);
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };

        setLocation(newLocation);

        try {
          const result = await getAddressFromCoordinates(
            newLocation.lat,
            newLocation.lng
          );

          setAddress(result);
        } catch (err) {
          console.error(err);
        }

        setError("");
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  useEffect(() => {
    getLocation();
  }, [getLocation]);

  return {
    location,
    address,
    loading,
    error,
    refreshLocation: getLocation,
  };
}