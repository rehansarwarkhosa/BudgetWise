export const success = (res, data, status = 200) => {
  res.status(status).json({ success: true, data });
};

export const error = (res, message, status = 400) => {
  res.status(status).json({ success: false, error: message });
};

// Round to 2 decimal places — prevents floating point drift in currency calculations
export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
