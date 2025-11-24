import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export const defaultDayOffRates = {
  maxDaysOff: 4, // Maximum days off before deduction
  deductionPerDay: 500, // Amount deducted per day when > 4 days off
  bonusPerDay: 300, // Bonus amount per day when < 4 days off
  updatedAt: new Date().toISOString()
};

// Function to get rates from Firestore or use defaults
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

// Function to save rates to Firestore
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

// Function to calculate monthly days off from weekly availability
export const calculateMonthlyDaysOff = async (staffUid, month) => {
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
      weekEndDate.setDate(weekEndDate.getDate() + 6); // End of week (Sunday)
      
      // Check if this week overlaps with the month
      if (weekEndDate >= startDate && weekStartDate <= endDate) {
        countedWeeks.add(data.weekStartDate);
        const availabilities = data.availabilities || {};
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        
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
    
    // Also check current availability if it's for the current month
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
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            
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
    
    return totalDaysOff;
  } catch (error) {
    console.error('Error calculating monthly days off:', error);
    return 0;
  }
};