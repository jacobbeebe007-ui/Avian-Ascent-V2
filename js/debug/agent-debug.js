/* Avian Ascent — agent/debug session logging (Step 7 Phase 2).
 * Development-only localStorage ring buffer; safe no-op fetch when ingest unavailable.
 */
function _agentDbgLog(location, message, data, hypothesisId) {
  const payload = { sessionId: '5e515f', location, message, data: data || {}, timestamp: Date.now(), hypothesisId: hypothesisId || '' };
  try {
    const k = 'avianAscent_dbg_5e515f';
    const arr = JSON.parse(localStorage.getItem(k) || '[]');
    arr.push(payload);
    if (arr.length > 300) arr.splice(0, arr.length - 300);
    localStorage.setItem(k, JSON.stringify(arr));
  } catch (_) {}
  try {
    fetch('http://127.0.0.1:7940/ingest/a2f9b3c2-6614-4231-b7d9-0c870302a25c', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '5e515f' },
      body: JSON.stringify(payload),
    }).catch(function () {});
  } catch (_) {}
}
globalThis._agentDbgLog = _agentDbgLog;

if (typeof Avian !== 'undefined' && Avian.debug) {
  Avian.debug.agentLog = _agentDbgLog;
}
