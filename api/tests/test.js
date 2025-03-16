// A simple test HTTP server
import http from 'http';

console.log('Starting test server...');

const server = http.createServer((req, res) => {
  console.log(`Received request: ${req.method} ${req.url}`);
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World\n');
});

const PORT = 8080;

console.log(`Attempting to listen on port ${PORT}...`);

server.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
}); 