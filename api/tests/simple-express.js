import express from 'express';

const app = express();
const PORT = 8080;

console.log('Starting simple Express server...');

app.get('/', (req, res) => {
  console.log('Received request to /');
  res.send('Hello from Express!');
});

app.listen(PORT, () => {
  console.log(`Simple Express server running on http://localhost:${PORT}`);
}); 