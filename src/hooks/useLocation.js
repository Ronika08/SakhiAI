import { useState, useEffect, useCallback } from "react";

export default function useLocation() {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState(null);

  const [gpsStatus, setGpsStatus] = useState("Searching...");
  const [lastUpdated, setLastUpdated] = useState(null);

  const refreshLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported.");
      setErrorCode("UNSUPPORTED");
      setGpsStatus("Unavailable");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          heading: position.coords.heading,
          altitude: position.coords.altitude,
          timestamp: position.timestamp,
        });

        setGpsStatus("Connected");
        setLastUpdated(new Date());
        setError("");
        setErrorCode(null);
        setLoading(false);
      },
      (err) => {
        const denied = err.code === 1;
        setError(err.message);
        setErrorCode(denied ? "PERMISSION_DENIED" : err.code === 3 ? "TIMEOUT" : "UNAVAILABLE");
        setGpsStatus(denied ? "Permission Denied" : err.code === 3 ? "Timed Out" : "Location Error");
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
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          heading: position.coords.heading,
          altitude: position.coords.altitude,
          timestamp: position.timestamp,
        });

        setGpsStatus("Connected");
        setLastUpdated(new Date());
        setError("");
        setErrorCode(null);
        setLoading(false);
      },
      (err) => {
        const denied = err.code === 1;
        setError(err.message);
        setErrorCode(denied ? "PERMISSION_DENIED" : err.code === 3 ? "TIMEOUT" : "UNAVAILABLE");
        setGpsStatus(denied ? "Permission Denied" : err.code === 3 ? "Timed Out" : "Location Error");
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return {
    location,
    loading,
    error,
    errorCode,
    gpsStatus,
    lastUpdated,
    refreshLocation,
  };
}