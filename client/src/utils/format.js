export const formatPKR = (amount) => {
  return `PKR ${Number(amount || 0).toLocaleString('en-PK')}`;
};

export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-PK', {
    timeZone: 'Asia/Karachi',
    day: 'numeric', month: 'short', year: 'numeric',
  });
};

export const formatDateTime = (date) => {
  return new Date(date).toLocaleString('en-PK', {
    timeZone: 'Asia/Karachi',
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
};

export const monthName = (month) => {
  const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[month] || '';
};
