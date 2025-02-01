
'use client'
import { useState } from 'react';

export default function CodeRunner() {
  const [code, setCode] = useState('print("Hello World!")');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      
      const data = await response.json();
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="code-runner">
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter Python code"
      />
      <button onClick={handleRun} disabled={loading}>
        {loading ? 'Running...' : 'Execute Code'}
      </button>
      
      {result && (
        <div className="result">
          <h3>{result.success ? 'Success!' : 'Failed'}</h3>
          <pre>Output: {result.output}</pre>
          {!result.success && (
            <div className="error">
              <p>Error: {result.error?.type}</p>
              <p>{result.error?.message}</p>
            </div>
          )}
          <p>Attempts: {result.attempts}</p>
        </div>
      )}
    </div>
  );
}