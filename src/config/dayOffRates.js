import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export const defaultDayOffRates = {
  maxDaysOff: 4, // Maximum days off before deduction
  deductionPerDay: 500, // Amount deducted per day when > 4 days off
  bonusPerDay: 300, // Bonus amount per day when < 4 days off
  updatedAt: new Date().toISOString()
};

// Function to get global default rates from Firestore or use defaults
export const getDayOffRates = async () => {
  try {
    const docRef = doc(db, 'systemConfig', 'dayOffRates');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      // Initialize with defaults if not exists
      await setDoc(docRef, defaultDayOffRates);
      return defaultDayOffRates;
    }
  } catch (error) {
    console.error('Error fetching day-off rates:', error);
    return defaultDayOffRates;
  }
};

// Function to save global default rates to Firestore
export const saveDayOffRates = async (rates) => {
  try {
    const docRef = doc(db, 'systemConfig', 'dayOffRates');
    await setDoc(docRef, {
      ...rates,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Error saving day-off rates:', error);
    return false;
  }
};

// Function to get individual staff day-off configuration
export const getStaffDayOffConfig = async (staffUid) => {
  try {
    const docRef = doc(db, 'staffDayOffConfig', staffUid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      // Return null to indicate no custom config exists
      return null;
    }
  } catch (error) {
    console.error('Error fetching staff day-off config:', error);
    return null;
  }
};

// Function to save individual staff day-off configuration
export const saveStaffDayOffConfig = async (staffUid, config) => {
  try {
    const docRef = doc(db, 'staffDayOffConfig', staffUid);
    await setDoc(docRef, {
      ...config,
      staffUid,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Error saving staff day-off config:', error);
    return false;
  }
};

// Function to delete individual staff day-off configuration (revert to default)
export const deleteStaffDayOffConfig = async (staffUid) => {
  try {
    const docRef = doc(db, 'staffDayOffConfig', staffUid);
    await setDoc(docRef, {
      staffUid,
      useDefault: true,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Error deleting staff day-off config:', error);
    return false;
  }
};

// Function to get effective day-off config for a staff member (individual or default)
export const getEffectiveDayOffConfig = async (staffUid) => {
  try {
    // First try to get staff-specific config
    const staffConfig = await getStaffDayOffConfig(staffUid);
    
    // If staff has custom config and not set to use default, return it
    if (staffConfig && !staffConfig.useDefault) {
      return {
        maxDaysOff: staffConfig.maxDaysOff ?? 4,
        deductionPerDay: staffConfig.deductionPerDay ?? 500,
        bonusPerDay: staffConfig.bonusPerDay ?? 300,
        isCustom: true
      };
    }
    
    // Otherwise, get and return global default
    const defaultConfig = await getDayOffRates();
    return {
      maxDaysOff: defaultConfig.maxDaysOff ?? 4,
      deductionPerDay: defaultConfig.deductionPerDay ?? 500,
      bonusPerDay: defaultConfig.bonusPerDay ?? 300,
      isCustom: false
    };
  } catch (error) {
    console.error('Error getting effective day-off config:', error);
    return {
      maxDaysOff: 4,
      deductionPerDay: 500,
      bonusPerDay: 300,
      isCustom: false
    };
  }
};

// Function to get the start of the week (Sunday)
export const getWeekStart = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
  d.setDate(d.getDate() - day); // Go back to Sunday
  d.setHours(0, 0, 0, 0);
  return d;
};

// Function to calculate monthly days off from weekly availability
// includeCurrent: if true, includes current week's partial data
export const calculateMonthlyDaysOff = async (staffUid, month, includeCurrent = true) => {
  try {
    // Get start and end dates for the month
    const [year, monthNum] = month.split('-');
    const startDate = new Date(year, parseInt(monthNum) - 1, 1);
    const endDate = new Date(year, parseInt(monthNum), 0);
    
    // Query weekly availability records for this staff
    const weeklyQuery = query(
      collection(db, 'weeklyAvailability'),
      where('staffUid', '==', staffUid)
    );
    
    const snapshot = await getDocs(weeklyQuery);
    let totalDaysOff = 0;
    const countedWeeks = new Set();
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (!data.weekStartDate) return;
      
      const weekStartDate = new Date(data.weekStartDate);
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekEndDate.getDate() + 6); // End of week (Saturday)
      
      // Check if this week overlaps with the month
      if (weekEndDate >= startDate && weekStartDate <= endDate) {
        countedWeeks.add(data.weekStartDate);
        const availabilities = data.availabilities || {};
        // Week starts on Sunday now
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        days.forEach((day, index) => {
          const dayDate = new Date(weekStartDate);
          dayDate.setDate(dayDate.getDate() + index);
          
          // Only count days that fall within the month
          if (dayDate >= startDate && dayDate <= endDate) {
            const dayData = availabilities[day];
            if (!dayData || !dayData.available) {
              totalDaysOff++;
            }
          }
        });
      }
    });
    
    // Also check current availability if requested and it's for the current month
    if (includeCurrent) {
      const currentMonth = new Date().toISOString().substring(0, 7);
      if (month === currentMonth) {
        try {
          const currentAvailabilityRef = doc(db, 'availabilities', staffUid);
          const currentAvailabilitySnap = await getDoc(currentAvailabilityRef);
          
          if (currentAvailabilitySnap.exists()) {
            const currentData = currentAvailabilitySnap.data();
            const currentWeekStart = currentData.currentWeek || new Date().toISOString().split('T')[0];
            const weekStartDate = new Date(currentWeekStart);
            const today = new Date();
            
            // Only count if current week is in this month and not already counted
            if (weekStartDate >= startDate && weekStartDate <= endDate && !countedWeeks.has(currentWeekStart)) {
              const availabilities = currentData.availabilities || {};
              const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
              
              days.forEach((day, index) => {
                const dayDate = new Date(weekStartDate);
                dayDate.setDate(dayDate.getDate() + index);
                
                // Only count days up to today in current week
                if (dayDate >= startDate && dayDate <= endDate && dayDate <= today) {
                  const dayData = availabilities[day];
                  if (!dayData || !dayData.available) {
                    totalDaysOff++;
                  }
                }
              });
            }
          }
        } catch (error) {
          console.error('Error checking current availability:', error);
        }
      }
    }
    
    return totalDaysOff;
  } catch (error) {
    console.error('Error calculating monthly days off:', error);
    return 0;
  }
};

// Function to calculate previous month's days off for all staff (for monthly report)
export const calculatePreviousMonthDaysOffForAllStaff = async (staffList) => {
  try {
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = previousMonth.getFullYear();
    const month = previousMonth.getMonth() + 1;
    const monthString = `${year}-${month.toString().padStart(2, '0')}`;

    const results = [];

    for (const staff of staffList) {
      const daysOff = await calculateMonthlyDaysOff(staff.staffUid, monthString, false);
      const config = await getEffectiveDayOffConfig(staff.staffUid);
      
      let adjustment = 0;
      let status = 'at-threshold';
      
      if (daysOff > config.maxDaysOff) {
        const excessDays = daysOff - config.maxDaysOff;
        adjustment = -(excessDays * config.deductionPerDay);
        status = 'deduction';
      } else if (daysOff < config.maxDaysOff) {
        const bonusDays = config.maxDaysOff - daysOff;
        adjustment = bonusDays * config.bonusPerDay;
        status = 'bonus';
      }

      results.push({
        staffUid: staff.staffUid,
        staffName: staff.staffName,
        staffId: staff.staffId,
        daysOff,
        threshold: config.maxDaysOff,
        adjustment,
        status,
        isCustom: config.isCustom,
        deductionPerDay: config.deductionPerDay,
        bonusPerDay: config.bonusPerDay
      });
    }

    return results;
  } catch (error) {
    console.error('Error calculating previous month days off:', error);
    return [];
  }
};

// Function to get current month running days off (for staff dashboard warning only)
// Does NOT calculate adjustment - only shows if exceeding limit
export const getCurrentMonthRunningDaysOff = async (staffUid) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthString = `${year}-${month.toString().padStart(2, '0')}`;

    const daysOff = await calculateMonthlyDaysOff(staffUid, monthString, true);
    const config = await getEffectiveDayOffConfig(staffUid);

    let status = 'on-track';
    
    if (daysOff > config.maxDaysOff) {
      status = 'over-limit';
    } else if (daysOff < config.maxDaysOff) {
      status = 'under-limit';
    } else {
      status = 'at-limit';
    }

    return {
      daysOff,
      threshold: config.maxDaysOff,
      excessDays: daysOff > config.maxDaysOff ? daysOff - config.maxDaysOff : 0,
      status,
      isCustom: config.isCustom,
      deductionPerDay: config.deductionPerDay,
      bonusPerDay: config.bonusPerDay
    };
  } catch (error) {
    console.error('Error getting current month running days off:', error);
    return {
      daysOff: 0,
      threshold: 4,
      excessDays: 0,
      status: 'error',
      isCustom: false
    };
  }
};

// Check if today is the 1st day of the month
export const isFirstDayOfMonth = () => {
  const today = new Date();
  return today.getDate() === 1;
};