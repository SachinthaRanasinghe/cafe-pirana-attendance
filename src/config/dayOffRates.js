export const defaultDayOffRates = {
    dailyRate: 100, // Default daily rate for deductions
    dailyBonus: 50  // Default daily bonus for unused days
  };
  
  // Function to get rates from localStorage or use defaults
  export const getDayOffRates = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dayOffRates');
      return saved ? JSON.parse(saved) : defaultDayOffRates;
    }
    return defaultDayOffRates;
  };
  
  // Function to save rates to localStorage
  export const saveDayOffRates = (rates) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dayOffRates', JSON.stringify(rates));
    }
  };