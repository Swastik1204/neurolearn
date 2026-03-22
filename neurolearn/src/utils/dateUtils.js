import {
  format,
  startOfWeek,
  endOfWeek,
  subWeeks,
  isWithinInterval,
  parseISO,
  differenceInDays,
} from 'date-fns';

export function getWeekRange(date = new Date()) {
  const start = startOfWeek(date, { weekStartsOn: 1 }); // Monday
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return { start, end };
}

export function getWeekLabel(date = new Date()) {
  const { start, end } = getWeekRange(date);
  return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
}

export function getPastWeeks(count = 4) {
  const weeks = [];
  for (let i = 0; i < count; i++) {
    const date = subWeeks(new Date(), i);
    weeks.push({
      date,
      label: getWeekLabel(date),
      ...getWeekRange(date),
    });
  }
  return weeks;
}

export function formatDate(date) {
  if (typeof date === 'string') date = parseISO(date);
  return format(date, 'MMM d, yyyy');
}

export function formatTime(date) {
  if (typeof date === 'string') date = parseISO(date);
  return format(date, 'h:mm a');
}

export function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
}

export function daysAgo(date) {
  if (typeof date === 'string') date = parseISO(date);
  const diff = differenceInDays(new Date(), date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${diff} days ago`;
}
