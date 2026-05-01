/**
 * SheSafe — Offline Map Caching
 * Rikash's Domain: Pre-cache map tiles for offline use
 * 
 * Strategy: On onboarding, silently pan the map across user's city
 * to trigger Google Maps tile caching. This is a hack but works for demo.
 */

import * as Location from 'expo-location';

// Pre-defined city center coordinates for Karnataka
const CITY_CENTERS = {
  bengaluru: { lat: 12.9716, lng: 77.5946, radius: 0.15 },
  mysuru: { lat: 12.3051, lng: 76.6551, radius: 0.08 },
  mangaluru: { lat: 12.8714, lng: 74.8425, radius: 0.06 },
  hubli: { lat: 15.3647, lng: 75.1240, radius: 0.05 },
};

// Tile zoom levels to cache
const CACHE_ZOOM_LEVELS = [12, 14, 16];

class OfflineMapManager {
  constructor() {
    this.mapRef = null;
    this.isCaching = false;
    this.cacheProgress = 0;
    this.onProgressUpdate = null;
  }

  /**
   * Set the MapView ref for controlling the map
   * @param {Object} mapRef - React ref to MapView component
   */
  setMapRef(mapRef) {
    this.mapRef = mapRef;
  }

  /**
   * Get the nearest city center to the user's location
   */
  async getNearestCity() {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const userLat = location.coords.latitude;
      const userLng = location.coords.longitude;

      let nearest = 'bengaluru'; // default
      let minDist = Infinity;

      for (const [city, coords] of Object.entries(CITY_CENTERS)) {
        const dist = Math.sqrt(
          Math.pow(userLat - coords.lat, 2) +
          Math.pow(userLng - coords.lng, 2)
        );
        if (dist < minDist) {
          minDist = dist;
          nearest = city;
        }
      }

      return { city: nearest, ...CITY_CENTERS[nearest] };
    } catch (e) {
      console.log('[SheSafe Maps] Could not get location, defaulting to Bengaluru');
      return { city: 'bengaluru', ...CITY_CENTERS.bengaluru };
    }
  }

  /**
   * Generate grid of points to pan across for tile caching
   */
  _generateCacheGrid(centerLat, centerLng, radius, gridSize = 5) {
    const points = [];
    const step = (radius * 2) / gridSize;

    for (let i = 0; i <= gridSize; i++) {
      for (let j = 0; j <= gridSize; j++) {
        points.push({
          lat: centerLat - radius + (i * step),
          lng: centerLng - radius + (j * step),
        });
      }
    }
    return points;
  }

  /**
   * Cache map tiles by silently panning across the user's city
   * Call this during onboarding — runs in background
   * 
   * @param {Function} onProgress - Progress callback (0-100)
   */
  async startCaching(onProgress = null) {
    if (this.isCaching || !this.mapRef) {
      console.log('[SheSafe Maps] Cannot cache — already caching or no map ref');
      return;
    }

    this.isCaching = true;
    this.onProgressUpdate = onProgress;

    try {
      const city = await this.getNearestCity();
      console.log(`[SheSafe Maps] Caching tiles for ${city.city}`);

      const points = this._generateCacheGrid(city.lat, city.lng, city.radius);
      const totalSteps = points.length * CACHE_ZOOM_LEVELS.length;
      let currentStep = 0;

      for (const zoom of CACHE_ZOOM_LEVELS) {
        // Convert zoom level to latitudeDelta
        const latDelta = 360 / Math.pow(2, zoom);
        const lngDelta = latDelta;

        for (const point of points) {
          if (!this.isCaching) break; // Allow cancellation

          try {
            await this.mapRef.animateToRegion(
              {
                latitude: point.lat,
                longitude: point.lng,
                latitudeDelta: latDelta,
                longitudeDelta: lngDelta,
              },
              50 // 50ms animation — fast enough to cache, slow enough to render
            );

            // Small delay to let tiles load
            await this._sleep(100);
          } catch (e) {
            // Silently continue — some regions may fail
          }

          currentStep++;
          this.cacheProgress = Math.round((currentStep / totalSteps) * 100);

          if (this.onProgressUpdate) {
            this.onProgressUpdate(this.cacheProgress);
          }
        }
      }

      // Return to user's location
      const userLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await this.mapRef.animateToRegion({
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);

      console.log(`[SheSafe Maps] Caching complete for ${city.city}`);
    } catch (e) {
      console.error('[SheSafe Maps] Caching error:', e.message);
    } finally {
      this.isCaching = false;
    }
  }

  /**
   * Cancel ongoing caching
   */
  stopCaching() {
    this.isCaching = false;
    console.log('[SheSafe Maps] Caching cancelled');
  }

  /**
   * Get the initial region for MapView centered on user
   */
  async getInitialRegion() {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    } catch (e) {
      // Default to Bengaluru center
      return {
        latitude: 12.9716,
        longitude: 77.5946,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
  }

  /**
   * Get map region showing the nearest police stations
   */
  getRegionForStations(userLat, userLng, stations) {
    if (!stations || stations.length === 0) {
      return {
        latitude: userLat,
        longitude: userLng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }

    const allLats = [userLat, ...stations.map(s => s.lat)];
    const allLngs = [userLng, ...stations.map(s => s.lng)];

    const minLat = Math.min(...allLats);
    const maxLat = Math.max(...allLats);
    const minLng = Math.min(...allLngs);
    const maxLng = Math.max(...allLngs);

    const padding = 0.01;
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: (maxLat - minLat) + padding,
      longitudeDelta: (maxLng - minLng) + padding,
    };
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const offlineMapManager = new OfflineMapManager();
export default OfflineMapManager;
