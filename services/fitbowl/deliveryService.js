/**
 * FitBowl Delivery Service
 * Handles delivery fee calculation based on distance and order amount
 */

// FitBowl base location (restaurant coordinates)
const BASE_LATITUDE = 41.2995;
const BASE_LONGITUDE = 69.2401;

// Delivery fee constants (in sum)
const FLAT_FEE = 15000;
const MIN_FEE = 10000;
const MAX_FEE = 30000;
const FREE_DELIVERY_THRESHOLD = 100000;
const FEE_PER_KM = 3000;

/**
 * Calculate the distance between two coordinates using the Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (value) => (value * Math.PI) / 180;

  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Calculate delivery fee based on address and order amount
 * @param {Object} address - The delivery address object
 * @param {number} address.latitude - Latitude of delivery address
 * @param {number} address.longitude - Longitude of delivery address
 * @param {number} [orderAmount=0] - The order subtotal amount in sum
 * @returns {number} The delivery fee in sum
 */
exports.calculateDeliveryFee = (address, orderAmount = 0) => {
  // Free delivery for orders over threshold
  if (orderAmount >= FREE_DELIVERY_THRESHOLD) {
    return 0;
  }

  // If address has coordinates, calculate distance-based fee
  if (
    address &&
    address.latitude != null &&
    address.longitude != null &&
    !isNaN(address.latitude) &&
    !isNaN(address.longitude)
  ) {
    const distance = calculateDistance(
      BASE_LATITUDE,
      BASE_LONGITUDE,
      parseFloat(address.latitude),
      parseFloat(address.longitude)
    );

    // Calculate fee based on distance
    let fee = Math.round(distance * FEE_PER_KM);

    // Enforce min and max bounds
    fee = Math.max(MIN_FEE, fee);
    fee = Math.min(MAX_FEE, fee);

    return fee;
  }

  // No coordinates available, return flat fee
  return FLAT_FEE;
};
