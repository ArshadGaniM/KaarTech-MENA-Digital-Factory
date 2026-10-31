const hoursFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export const formatHours = (hours) => `${hoursFormat.format(hours)}h`;

export const STATUS_LABELS = {
  full: 'Fully utilized',
  partial: 'Partly utilized',
  unused: 'Not utilized',
  unstaffed: 'No one deployed',
};
