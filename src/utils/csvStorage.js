// CSV Storage utility for Alphabet Learning sessions
// Stores CSV data locally instead of downloading

const CSV_STORAGE_KEY = 'neurolearn_alphabet_sessions';

export function saveAlphabetSessionCSV(csvContent, letter, sessionId) {
  try {
    // Get existing sessions
    const existingSessions = getStoredSessions();

    // Add new session
    const newSession = {
      id: sessionId,
      letter,
      timestamp: new Date().toISOString(),
      csvData: csvContent,
    };

    existingSessions.push(newSession);

    // Keep only last 50 sessions to prevent storage bloat
    if (existingSessions.length > 50) {
      existingSessions.splice(0, existingSessions.length - 50);
    }

    // Store in localStorage
    localStorage.setItem(CSV_STORAGE_KEY, JSON.stringify(existingSessions));

    console.log(`Session ${sessionId} saved locally for letter ${letter}`);
    return true;
  } catch (error) {
    console.error('Failed to save session CSV:', error);
    return false;
  }
}

export function getStoredSessions() {
  try {
    const stored = localStorage.getItem(CSV_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to retrieve stored sessions:', error);
    return [];
  }
}

export function getSessionsForLetter(letter) {
  const allSessions = getStoredSessions();
  return allSessions.filter(session => session.letter === letter);
}

export function exportAllSessions() {
  const sessions = getStoredSessions();
  if (sessions.length === 0) {
    alert('No sessions to export');
    return;
  }

  // Create a combined CSV with session metadata
  const headers = ['session_id', 'letter', 'timestamp', 'csv_data'];
  const csvRows = sessions.map(session => [
    session.id,
    session.letter,
    session.timestamp,
    `"${session.csvData.replace(/"/g, '""')}"` // Escape quotes in CSV data
  ]);

  const csvContent = [headers, ...csvRows]
    .map(row => row.join(','))
    .join('\n');

  // Download the combined CSV
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `neurolearn_alphabet_sessions_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function clearAllSessions() {
  localStorage.removeItem(CSV_STORAGE_KEY);
  console.log('All stored sessions cleared');
}