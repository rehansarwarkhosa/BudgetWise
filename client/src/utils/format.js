export const formatPKR = (amount) => {
  return `PKR ${Number(amount || 0).toLocaleString('en-PK')}`;
};

export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    timeZone: 'Asia/Karachi',
    day: 'numeric', month: 'short', year: 'numeric',
  });
};

export const formatDateTime = (date) => {
  return new Date(date).toLocaleString('en-US', {
    timeZone: 'Asia/Karachi',
    day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit',
    hour12: true,
  });
};

export const formatTime = (date) => {
  return new Date(date).toLocaleTimeString('en-US', {
    timeZone: 'Asia/Karachi',
    hour: 'numeric', minute: '2-digit',
    hour12: true,
  });
};

export const monthName = (month) => {
  const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[month] || '';
};
