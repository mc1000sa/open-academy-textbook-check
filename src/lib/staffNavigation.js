export const getDefaultStaffView = (role) => {
  return role === 'admin' ? 'teachersAdmin' : 'attendance';
};
