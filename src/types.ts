/**
 * @z-os/apps v4.2.0 - Type definitions
 */

export interface AppProps {
  onClose?: () => void;
  className?: string;
}

export interface CalculatorState {
  display: string;
  previousValue: number | null;
  operation: string | null;
  waitingForOperand: boolean;
}

export interface TerminalEntry {
  id: string;
  command?: string;
  output?: string;
  isError?: boolean;
}

export interface TerminalProps extends AppProps {
  fontSize?: number;
  theme?: 'dark' | 'light' | 'dracula' | 'nord' | 'monokai';
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotesProps extends AppProps {
  initialNotes?: NoteItem[];
  onNotesChange?: (notes: NoteItem[]) => void;
}

export interface StickyNote {
  id: string;
  content: string;
  color: 'yellow' | 'pink' | 'green' | 'blue' | 'purple';
  position: { x: number; y: number };
}

export interface ClockProps extends AppProps {
  timezone?: string;
  format?: '12h' | '24h';
}

export interface CalendarProps extends AppProps {
  selectedDate?: Date;
  onDateChange?: (date: Date) => void;
}

export interface WeatherProps extends AppProps {
  location?: string;
  units?: 'metric' | 'imperial';
}

export interface PhotoItem {
  id: string;
  src: string;
  alt: string;
  date?: Date;
}

export interface PhotosProps extends AppProps {
  photos?: PhotoItem[];
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  src?: string;
}

export interface MusicProps extends AppProps {
  playlist?: MusicTrack[];
}

export interface SystemPreferencesProps extends AppProps {
  section?: 'general' | 'appearance' | 'dock' | 'display';
}
