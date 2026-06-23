export function setCookie(name, value, days = 7) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
}

export function getCookie(name) {
  return document.cookie.split('; ').reduce((r, v) => {
    const parts = v.split('=');
    return parts[0] === name ? decodeURIComponent(parts[1]) : r
  }, '');
}

export function removeCookie(name) {
  document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

/**
 * Formats a date string or object to Thai Buddhist Era format.
 * @param {Date|string} date - The date to format.
 * @param {object} options - Options for month and day (e.g., { month: 'long', day: 'numeric' })
 * @returns {string} Formatted date.
 */
export function formatThaiDate(date, options = null) {
  if (!date) return 'TBD';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'TBD';
  
  const year = d.getFullYear() + 543;
  
  if (options) {
    const day = d.toLocaleDateString('th-TH', { day: options.day || 'numeric' });
    const month = d.toLocaleDateString('th-TH', { month: options.month || 'long' });
    return `${day} ${month} ${year}`;
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${year}`;
}

/**
 * Formats a date string or object to 24-hour time format (HH:mm).
 * @param {Date|string} date - The date to format.
 * @returns {string} Formatted time.
 */
export function formatThaiTime(date) {
  if (!date) return 'TBD';
  
  // Handle direct time strings like "14:30" or "14:30:00"
  if (typeof date === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(date)) {
    return date.substring(0, 5);
  }

  const d = new Date(date);
  if (isNaN(d.getTime())) return 'TBD';

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Formats a date string or object to both Thai Date and 24-hour Time.
 * @param {Date|string} date - The date to format.
 * @returns {string} Formatted date and time.
 */
export function formatThaiDateTime(date) {
  if (!date) return 'TBD';
  return `${formatThaiDate(date)} ${formatThaiTime(date)}`;
}

/**
 * Formats a date to full Thai format including seconds and Buddhist Year.
 * Example: 18 เม.ย. 2569 เวลา 14:30:15 น.
 */
export function formatThaiFullDateTime(date) {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';

    const day = d.getDate();
    const month = d.toLocaleString('th-TH', { month: 'short' });
    const year = d.getFullYear() + 543;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return `${day} ${month} ${year} เวลา ${hours}:${minutes}:${seconds} น.`;
}
/**
 * Converts a date to local YYYY-MM-DDTHH:mm format for input fields.
 * Handles both JS Date objects and ISO strings.
 * @param {Date|string} date - The date to format.
 * @returns {string} Formatted date string for input value.
 */
export function formatForInput(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
/**
 * Calculates age from birth date.
 * @param {Date|string} birthDate - The birth date to calculate age from.
 * @returns {number|null} Calculated age or null if birthDate is invalid.
 */
export function calculateAge(birthDate) {
  if (!birthDate) return null;
  const today = new Date();
  const birthDateObj = new Date(birthDate);
  if (isNaN(birthDateObj.getTime())) return null;

  let age = today.getFullYear() - birthDateObj.getFullYear();
  const m = today.getMonth() - birthDateObj.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDateObj.getDate())) {
    age--;
  }
  return age;
}
