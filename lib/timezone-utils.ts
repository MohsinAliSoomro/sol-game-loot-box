/**
 * Timezone Utility Functions
 * 
 * Converts UTC timestamps from the database to user's local timezone
 * and formats them in a user-friendly way.
 */

/**
 * Format a UTC date string to local timezone
 * @param dateString - ISO string from database (UTC) or Date object
 * @param format - Format type: 'full', 'date', 'time', 'datetime', or custom format string
 * @returns Formatted date string in user's local timezone
 */
export const formatLocalTime = (
  dateString: string | Date | null | undefined,
  format: 'full' | 'date' | 'time' | 'datetime' | 'custom' = 'full',
  customFormat?: string
): string => {
  if (!dateString) {
    return 'N/A';
  }

  try {
    // Parse the date (handles both ISO strings and Date objects)
    let date: Date;
    
    if (typeof dateString === 'string') {
      // If string doesn't end with Z or timezone, assume it's UTC from database
      // Supabase returns timestamps in ISO format, but sometimes without Z
      const dateStr = dateString.trim();
      if (dateStr.endsWith('Z') || dateStr.includes('+') || dateStr.includes('-', 10)) {
        // Already has timezone info
        date = new Date(dateStr);
      } else {
        // No timezone info - assume UTC from database
        // Append 'Z' to indicate UTC
        date = new Date(dateStr + (dateStr.includes('T') ? 'Z' : ''));
      }
    } else {
      date = dateString;
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date provided to formatLocalTime:', dateString);
      return 'Invalid Date';
    }

    // Get user's timezone
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Format based on type
    switch (format) {
      case 'full': {
        // Example: "2025-11-07 03:45:30 PM"
        // Use Intl.DateTimeFormat to get timezone-aware components
        const fullDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
        const fullTimeFormatter = new Intl.DateTimeFormat('en-US', { timeZone: timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        const fullDatePart = fullDateFormatter.format(date);
        const fullTimePart = fullTimeFormatter.format(date);
        return `${fullDatePart} ${fullTimePart}`;
      }

      case 'date': {
        // Example: "2025-11-07"
        // Use en-CA locale which formats as YYYY-MM-DD
        const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
        return dateFormatter.format(date);
      }

      case 'time':
        // Example: "03:45 PM"
        return new Intl.DateTimeFormat('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          timeZone: timeZone,
        }).format(date);

      case 'datetime': {
        // Example: "2025-11-07 03:45 PM"
        // Format date part
        const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
        const datePart = dateFormatter.format(date);
        
        // Format time part
        const timeFormatter = new Intl.DateTimeFormat('en-US', { timeZone: timeZone, hour: '2-digit', minute: '2-digit', hour12: true });
        const timePart = timeFormatter.format(date);
        
        return `${datePart} ${timePart}`;
      }

      case 'custom':
        if (!customFormat) {
          return date.toLocaleString();
        }
        // For custom format, use toLocaleString with options
        return date.toLocaleString('en-US', {
          timeZone: timeZone,
        });

      default:
        return date.toLocaleString('en-US', {
          timeZone: timeZone,
        });
    }
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
};

/**
 * Get user's current timezone
 * @returns Timezone string (e.g., "America/New_York", "Asia/Karachi")
 */
export const getUserTimezone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Convert UTC date to local date string for display
 * @param dateString - UTC ISO string from database
 * @returns Formatted string: "YYYY-MM-DD hh:mm A"
 */
export const formatLocalDateTime = (dateString: string | Date | null | undefined): string => {
  if (!dateString) {
    return 'N/A';
  }

  try {
    // Parse the date ensuring UTC interpretation
    let date: Date;
    
    if (typeof dateString === 'string') {
      const dateStr = dateString.trim();
      
      // Supabase returns timestamps in ISO format, typically with timezone
      // But sometimes they might not have the Z suffix
      // We need to ensure we're parsing as UTC, not local time
      
      // Check if it already has timezone info
      const hasTimezone = dateStr.endsWith('Z') || 
                         dateStr.match(/[+-]\d{2}:\d{2}$/) || 
                         dateStr.match(/[+-]\d{4}$/);
      
      if (hasTimezone) {
        // Already has timezone info, parse directly
        date = new Date(dateStr);
      } else if (dateStr.includes('T')) {
        // ISO format without timezone indicator
        // CRITICAL: Supabase stores times in UTC, so we MUST append 'Z' to treat as UTC
        // Without 'Z', JavaScript treats it as LOCAL time, which is WRONG
        date = new Date(dateStr + 'Z');
        
        // Debug log in development
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.log('🔍 formatLocalDateTime - Parsing date as UTC:', {
            input: dateStr,
            withZ: dateStr + 'Z',
            parsedUTC: date.toISOString(),
            localTime: date.toLocaleString()
          });
        }
      } else {
        // Not ISO format, try parsing as-is
        date = new Date(dateStr);
      }
    } else {
      date = dateString;
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date provided to formatLocalDateTime:', dateString);
      return 'Invalid Date';
    }

    // Get user's timezone from browser
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Format date part (YYYY-MM-DD) in user's local timezone
    const dateFormatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: timeZone, 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
    const datePart = dateFormatter.format(date);
    
    // Format time part (hh:mm AM/PM) in user's local timezone
    const timeFormatter = new Intl.DateTimeFormat('en-US', { 
      timeZone: timeZone, 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true 
    });
    const timePart = timeFormatter.format(date);
    
    // Debug log in development
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('🕐 formatLocalDateTime - Formatting result:', {
        input: dateString,
        utcISO: date.toISOString(),
        userTimezone: timeZone,
        formatted: `${datePart} ${timePart}`
      });
    }
    
    return `${datePart} ${timePart}`;
  } catch (error) {
    console.error('Error formatting date:', error, dateString);
    return 'Invalid Date';
  }
};

/**
 * Get relative time (e.g., "2 hours ago", "in 5 minutes")
 * @param dateString - UTC ISO string from database
 * @returns Relative time string
 */
export const getRelativeTime = (dateString: string | Date | null | undefined): string => {
  if (!dateString) {
    return 'N/A';
  }

  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffSeconds = Math.floor(Math.abs(diffMs) / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    const isPast = diffMs < 0;
    const prefix = isPast ? '' : 'in ';
    const suffix = isPast ? ' ago' : '';

    if (diffDays > 0) {
      return `${prefix}${diffDays} day${diffDays > 1 ? 's' : ''}${suffix}`;
    } else if (diffHours > 0) {
      return `${prefix}${diffHours} hour${diffHours > 1 ? 's' : ''}${suffix}`;
    } else if (diffMinutes > 0) {
      return `${prefix}${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}${suffix}`;
    } else {
      return 'just now';
    }
  } catch (error) {
    console.error('Error calculating relative time:', error);
    return 'Invalid Date';
  }
};

/**
 * Check if a date is in the past (considering timezone)
 * @param dateString - UTC ISO string from database
 * @returns true if date is in the past
 */
export const isPastDate = (dateString: string | Date | null | undefined): boolean => {
  if (!dateString) {
    return false;
  }

  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.getTime() < new Date().getTime();
  } catch (error) {
    console.error('Error checking if date is past:', error);
    return false;
  }
};

/**
 * Get current UTC time as ISO string (for database storage)
 * @returns UTC ISO string
 */
export const getCurrentUTCTime = (): string => {
  return new Date().toISOString();
};

/**
 * Format date for datetime-local input (converts UTC to local for input field)
 * @param utcDateString - UTC ISO string from database
 * @returns Local datetime string for datetime-local input (YYYY-MM-DDTHH:mm)
 */
export const formatForDateTimeLocal = (utcDateString: string | null | undefined): string => {
  if (!utcDateString) {
    return '';
  }

  try {
    const date = new Date(utcDateString);
    if (isNaN(date.getTime())) {
      return '';
    }

    // Get local date components
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (error) {
    console.error('Error formatting for datetime-local:', error);
    return '';
  }
};

/**
 * Convert datetime-local input value to UTC ISO string (for database storage)
 * @param localDateTimeString - Local datetime string from datetime-local input (YYYY-MM-DDTHH:mm)
 * @returns UTC ISO string
 */
export const convertDateTimeLocalToUTC = (localDateTimeString: string | null | undefined): string | null => {
  if (!localDateTimeString) {
    return null;
  }

  try {
    // Create date from local string (browser interprets as local time)
    const localDate = new Date(localDateTimeString);
    
    if (isNaN(localDate.getTime())) {
      console.error('Invalid datetime-local string:', localDateTimeString);
      return null;
    }

    // Convert to UTC ISO string
    return localDate.toISOString();
  } catch (error) {
    console.error('Error converting datetime-local to UTC:', error);
    return null;
  }
};

