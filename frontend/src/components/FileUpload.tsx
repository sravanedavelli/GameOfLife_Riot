import { useRef, useState } from 'react';

interface FileUploadProps {
  onLoad: (content: string) => void | Promise<void>;
  onExport: () => Promise<string>;
}

export function FileUpload({ onLoad, onExport }: FileUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [readError, setReadError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReadError(null);
    try {
      const text = await file.text();
      await onLoad(text);
    } catch {
      setReadError('Could not read file. Please try again.');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleExport = async () => {
    const content = await onExport();
    if (!content) return;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'game_of_life.life';
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadSampleGlider = () => {
    onLoad(`#Life 1.06
0 1
1 2
2 0
2 1
2 2
-2000000000000 -2000000000000
-2000000000001 -2000000000001
-2000000000000 -2000000000001`);
  };

  return (
    <div style={styles.container}>
      {readError && <span style={styles.error}>{readError}</span>}
      <input
        ref={fileRef}
        type="file"
        accept=".life,.txt"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <button style={styles.btn} onClick={() => fileRef.current?.click()}>
        Load File
      </button>
      <button style={styles.btn} onClick={handleExport}>
        Export
      </button>
      <button style={styles.btn} onClick={loadSampleGlider}>
        Load Sample
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '7px 20px',
    background: '#0d0b08',
    borderBottom: '1px solid #2a2218',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  btn: {
    padding: '5px 16px',
    background: '#1a1510',
    color: '#c8b896',
    border: '1px solid #3a3020',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
  },
  error: {
    color: '#e05050',
    fontSize: '12px',
    alignSelf: 'center',
  },
};
