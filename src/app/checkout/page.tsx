import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Checkout | MadTrips',
  description: 'Complete your booking with Bitcoin',
}

export default function CheckoutPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Checkout</h1>
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          {/* Booking form and payment details will go here */}
        </div>
      </div>
    </main>
  )
} 