import axios from 'axios';

// Payment ID to mark as paid
const paymentId = 'q50vjyqjce';

// Function to simulate a payment being completed
async function simulatePayment() {
  try {
    // First, check the current payment status
    const checkResponse = await axios.get(`http://localhost:8080/api/payments/${paymentId}`);
    console.log('Current payment status:', checkResponse.data);

    // Since we don't have a direct API endpoint to update payment status,
    // we'll create a special endpoint for simulation purposes
    
    // For now, we'll use a workaround by creating a new booking with the same payment ID
    // This will trigger the payment status check and potentially update it
    const bookingResponse = await axios.post('http://localhost:8080/api/bookings', {
      packageId: 'pkg-001',
      nostrPubkey: 'npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft',
      invoice: 'lnbcrt1n1p38q70app5wkr9zr7heaxzrz0mfj8420fcn4ytp7j3h2fhk652jssmkscnypjhvsdqqcqzzsxqyz5vqsp5mw6nxs4c44ze2hsw40f3v54ztwe360hg76twx4dvu0etlkp8s6fq9qyyssqy2a5jk28hc3cfu6z056snfs7avjssywpnvwpgudj2ucl7l8n5c8dhjs4jf2u3049mkaeregutx87tzn54v88gft5pqeu5df2lg8fkkcpvp0yqf'
    });
    
    console.log('Booking response:', bookingResponse.data);
    
    // Check the payment status again
    const finalCheckResponse = await axios.get(`http://localhost:8080/api/payments/${paymentId}`);
    console.log('Updated payment status:', finalCheckResponse.data);
    
  } catch (error) {
    console.error('Error simulating payment:', error.response?.data || error.message);
  }
}

// Run the simulation
simulatePayment(); 