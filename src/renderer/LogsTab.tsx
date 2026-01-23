import React, { useState, useEffect, useRef } from 'react';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

export const LogsTab: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleLog = (data: { message: string; isError?: boolean }) => {
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      
      let level: LogEntry['level'] = 'info';
      const msg = data.message.trim();
      
      if (data.isError || msg.includes('[ERROR]') || msg.includes('error')) {
        level = 'error';
      } else if (msg.includes('[WARN]') || msg.includes('warn')) {
        level = 'warn';
      } else if (msg.includes('[DEBUG]') || msg.includes('debug')) {
        level = 'debug';
      }

      const entry: LogEntry = {
        timestamp,
        level,
        message: msg
      };

      setLogs(prev => [...prev.slice(-999), entry]); // Keep last 1000 logs
    };

    (window as any).bytecave.node.onLog(handleLog);

    return () => {
      (window as any).bytecave.node.removeLogListener();
    };
  }, []);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const clearLogs = () => {
    setLogs([]);
  };

  const filteredLogs = filter
    ? logs.filter(log => log.message.toLowerCase().includes(filter.toLowerCase()))
    : logs;

  const getLevelClass = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return 'log-error';
      case 'warn': return 'log-warn';
      case 'debug': return 'log-debug';
      default: return 'log-info';
    }
  };

  return (
    <div className="logs-panel">
      <div className="logs-controls">
        <input
          type="text"
          placeholder="Filter logs..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="log-filter"
        />
        <label className="auto-scroll-toggle">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          Auto-scroll
        </label>
        <button onClick={clearLogs} className="btn btn-secondary">
          Clear Logs
        </button>
        <span className="log-count">{filteredLogs.length} entries</span>
      </div>

      <div className="logs-container">
        {filteredLogs.length === 0 ? (
          <div className="logs-empty">
            {filter ? 'No logs match the filter' : 'No logs yet. Start the node to see logs.'}
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div key={index} className={`log-entry ${getLevelClass(log.level)}`}>
              <span className="log-timestamp">{log.timestamp}</span>
              <span className={`log-level log-level-${log.level}`}>{log.level.toUpperCase()}</span>
              <span className="log-message">{log.message}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};
