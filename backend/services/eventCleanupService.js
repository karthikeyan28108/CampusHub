import Event from '../models/Event.js';
import EventRegistration from '../models/EventRegistration.js';

/**
 * Calculates the exact Date and time when an event concludes.
 * Combines the eventDate with endTime if provided.
 *
 * @param {Date|string} eventDate - The date of the event
 * @param {string} [endTime] - Optional end time string (e.g. "04:00 PM", "16:00", "09:00 PM")
 * @returns {Date} The expiration timestamp
 */
export const getEventExpirationDate = (eventDate, endTime) => {
  if (!eventDate) return new Date(0);

  let year, month, day;

  if (typeof eventDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(eventDate)) {
    const parts = eventDate.substring(0, 10).split('-').map(Number);
    year = parts[0];
    month = parts[1] - 1;
    day = parts[2];
  } else {
    const d = new Date(eventDate);
    if (isNaN(d.getTime())) return new Date(0);
    // If midnight UTC (from standard date input), use UTC date values
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
      year = d.getUTCFullYear();
      month = d.getUTCMonth();
      day = d.getUTCDate();
    } else {
      year = d.getFullYear();
      month = d.getMonth();
      day = d.getDate();
    }
  }

  let hours = 23;
  let minutes = 59;
  let seconds = 59;

  if (endTime && typeof endTime === 'string') {
    const trimmed = endTime.trim();
    // Matches "HH:MM AM/PM" or "HH:MM"
    const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const meridiem = match[3] ? match[3].toUpperCase() : null;

      if (meridiem === 'PM' && h < 12) h += 12;
      if (meridiem === 'AM' && h === 12) h = 0;

      hours = h;
      minutes = m;
      seconds = 0;
    }
  }

  return new Date(year, month, day, hours, minutes, seconds, 999);
};

/**
 * Checks whether an event is past its conclusion time.
 * @param {Object} event - Event document
 * @returns {boolean}
 */
export const isEventExpired = (event) => {
  if (!event) return false;
  const expirationDate = getEventExpirationDate(event.eventDate, event.endTime);
  return expirationDate.getTime() < Date.now();
};

/**
 * Scans active events and automatically removes or marks expired ones.
 *
 * @param {Object} options
 * @param {boolean} [options.hardDelete=false] - If true, permanently deletes expired events from DB.
 * @param {boolean} [options.deleteUnregistered=true] - If true, permanently deletes expired events that had 0 registrations.
 * @returns {Promise<{ checked: number, expiredCount: number, deletedCount: number, updatedCount: number }>}
 */
export const cleanupExpiredEvents = async ({ hardDelete = false, deleteUnregistered = true } = {}) => {
  try {
    const activeEvents = await Event.find({ status: 'Active' });
    let expiredCount = 0;
    let deletedCount = 0;
    let updatedCount = 0;

    for (const event of activeEvents) {
      if (isEventExpired(event)) {
        expiredCount++;

        // Check if event has any registrations
        const regCount = await EventRegistration.countDocuments({ event: event._id });

        if (hardDelete || (deleteUnregistered && regCount === 0)) {
          // Permanently delete event if requested or if no registrations exist
          await event.deleteOne();
          // Clean up any remaining registrations just in case
          await EventRegistration.deleteMany({ event: event._id });
          deletedCount++;
          console.log(`[EventCleanup] Automatically deleted expired event: "${event.title}" (ID: ${event._id})`);
        } else {
          // Soft removal: Update status to 'Expired' to preserve student registration logs & payment history
          event.status = 'Expired';
          await event.save();
          updatedCount++;
          console.log(`[EventCleanup] Automatically marked event as Expired: "${event.title}" (ID: ${event._id})`);
        }
      }
    }

    return {
      checked: activeEvents.length,
      expiredCount,
      deletedCount,
      updatedCount
    };
  } catch (error) {
    console.error('[EventCleanup] Error running cleanupExpiredEvents:', error.message);
    return { error: error.message };
  }
};

/**
 * Starts a recurring background job to periodically purge expired events.
 *
 * @param {number} [intervalMinutes=10] - Interval in minutes
 * @returns {NodeJS.Timeout} The timer reference
 */
export const startEventCleanupJob = (intervalMinutes = 10) => {
  const intervalMs = intervalMinutes * 60 * 1000;

  // Run once immediately on startup
  cleanupExpiredEvents();

  const timer = setInterval(() => {
    cleanupExpiredEvents();
  }, intervalMs);

  console.log(`[EventCleanup] Background event expiry watchdog active (running every ${intervalMinutes} mins).`);
  return timer;
};
