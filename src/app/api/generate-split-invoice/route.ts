import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { amount, option, lnAddress1, lnAddress2, split } = data;
    
    if (!amount || !option || !lnAddress1) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // This is a placeholder for a real invoice generation
    // In a real implementation, you would integrate with an actual Lightning service
    // to create a split invoice or use a service like ZapSplit
    
    // For demonstration purposes, we'll just return a mock invoice
    // In production, you would generate real invoices via LNBits, BTCPay Server, or other solutions
    
    const mockInvoice = `lnbc${amount}n1pj8vj28pp5yztkwjcz5ftk8p3x2fv38xvlt7z52yry88zymq7qlm63v54f5n7qdq5w3jhytnrdakj7thwdaexqcjqvfjk2epkxzgrydsnxvennscqzpgxqyz5vqsp5usw4xxtw3xep3ky6tz4584ha6c5wgydxxl5wl9lwa4t5vw3ndnq9qyyssqy5zurf7lj8pgvmjfsl85nz8qewj6t5tmy95hdglk37njsl4jtkss4h3gt0wt7v3n5kjsmq8p20pynhm5p3rkxev8y2tmhs4w3jre7gqq${option}`;
    
    // Add latency to simulate a real API call
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return NextResponse.json({ invoice: mockInvoice });
  } catch (error) {
    console.error('Error generating invoice:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 