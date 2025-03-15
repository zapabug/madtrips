'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// Activity categories and the activities within each category
const activityCategories = [
  {
    id: 'culinary',
    name: 'Culinary Experiences',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    activities: [
      { id: 'dining-tour', name: 'Michelin-Quality Bitcoin Dining Tour', duration: '1 day', price: 0.01, description: 'A progressive dinner across Chef Júlio Pereira\'s exclusive restaurants' },
      { id: 'wine-cheese', name: 'Natural Wine & Local Cheese Tasting', duration: '3 hours', price: 0.005, description: 'Private tasting session of natural wines paired with Azorean artisanal cheeses' },
      { id: 'cooking-class', name: 'Madeiran Cooking Workshop', duration: '4 hours', price: 0.0075, description: 'Learn to cook traditional Madeiran dishes with local ingredients' },
    ]
  },
  {
    id: 'adventure',
    name: 'Outdoor Adventures',
    color: 'bg-green-100 text-green-800 border-green-200',
    activities: [
      { id: 'yacht-day', name: 'Luxury Bitcoin Yacht Day', duration: '1 day', price: 0.02, description: 'Full-day private yacht charter with stops at secluded beaches' },
      { id: 'adrenaline', name: 'Adrenaline Seeker\'s Package', duration: '1 day', price: 0.015, description: 'Experience climbing, canyoning and other extreme sports with professional guides' },
      { id: 'golf-retreat', name: 'Premium Bitcoin Golf Retreat', duration: '4 hours', price: 0.01, description: 'Golf at one of Madeira\'s most scenic courses' },
      { id: 'hiking', name: 'Guided Levada Walk', duration: '6 hours', price: 0.007, description: 'Hike along Madeira\'s famous levada water channels with stunning views' },
    ]
  },
  {
    id: 'wellness',
    name: 'Wellness & Relaxation',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    activities: [
      { id: 'wellness-journey', name: 'Bitcoin Wellness Journey', duration: '1 day', price: 0.018, description: 'A full day of wellness treatments, yoga sessions, and holistic health consultations' },
      { id: 'beauty-day', name: 'Beauty & Relaxation Day', duration: '5 hours', price: 0.012, description: 'Full-day beauty and wellness treatments at premium providers' },
      { id: 'yoga', name: 'Sunrise Yoga Session', duration: '1.5 hours', price: 0.003, description: 'Early morning yoga with ocean views' },
    ]
  },
  {
    id: 'cultural',
    name: 'Cultural Experiences',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    activities: [
      { id: 'artisan-tour', name: 'Traditional Madeira Artisan Tour', duration: '4 hours', price: 0.008, description: 'Hands-on workshops with traditional artisans' },
      { id: 'photography', name: 'Bitcoin Foodie Photography Tour', duration: '6 hours', price: 0.01, description: 'Guided food tour with professional photography instruction' },
      { id: 'history', name: 'Funchal Historical Tour', duration: '3 hours', price: 0.005, description: 'Guided walking tour of Funchal\'s historic sites' },
    ]
  },
]

// Package durations options
const durationOptions = [
  { id: '1-day', name: '1 Day Experience', nights: 0 },
  { id: '2-days', name: '2 Days / 1 Night', nights: 1 },
  { id: '3-days', name: '3 Days / 2 Nights', nights: 2 },
  { id: '5-days', name: '5 Days / 4 Nights', nights: 4 },
  { id: '7-days', name: '7 Days / 6 Nights', nights: 6 },
]

// Accommodation options
const accommodationOptions = [
  { id: 'none', name: 'No Accommodation', pricePerNight: 0 },
  { id: 'standard', name: 'Standard Bitcoin-Friendly Hotel', pricePerNight: 0.005 },
  { id: 'premium', name: 'Premium Hotel or Villa', pricePerNight: 0.01 },
  { id: 'luxury', name: 'Luxury Resort', pricePerNight: 0.02 },
]

export default function CustomPackageBuilder() {
  const [selectedDuration, setSelectedDuration] = useState(durationOptions[1].id)
  const [selectedAccommodation, setSelectedAccommodation] = useState(accommodationOptions[1].id)
  const [selectedActivities, setSelectedActivities] = useState<string[]>([])
  const [totalPrice, setTotalPrice] = useState(0)
  
  // Calculate the total price based on selections
  useEffect(() => {
    let price = 0
    
    // Add activity prices
    selectedActivities.forEach(activityId => {
      for (const category of activityCategories) {
        const activity = category.activities.find(a => a.id === activityId)
        if (activity) {
          price += activity.price
          break
        }
      }
    })
    
    // Add accommodation price
    const selectedDurationObj = durationOptions.find(d => d.id === selectedDuration)
    const selectedAccommodationObj = accommodationOptions.find(a => a.id === selectedAccommodation)
    
    if (selectedDurationObj && selectedAccommodationObj) {
      price += selectedDurationObj.nights * selectedAccommodationObj.pricePerNight
    }
    
    setTotalPrice(price)
  }, [selectedDuration, selectedAccommodation, selectedActivities])
  
  const toggleActivity = (activityId: string) => {
    setSelectedActivities(prev => 
      prev.includes(activityId) 
        ? prev.filter(id => id !== activityId) 
        : [...prev, activityId]
    )
  }
  
  const getDuration = () => {
    return durationOptions.find(d => d.id === selectedDuration)?.name || ''
  }
  
  const getAccommodation = () => {
    return accommodationOptions.find(a => a.id === selectedAccommodation)?.name || ''
  }
  
  const getSelectedActivitiesDetails = () => {
    return selectedActivities.map(activityId => {
      for (const category of activityCategories) {
        const activity = category.activities.find(a => a.id === activityId)
        if (activity) {
          return {
            ...activity,
            category: category.name
          }
        }
      }
      return null
    }).filter(Boolean)
  }
  
  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Selection Section */}
      <div className="w-full lg:w-2/3 space-y-8">
        {/* Duration Selection */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-sand/20 dark:border-gray-700 shadow-sm">
          <h2 className="text-xl font-semibold text-ocean dark:text-white mb-4">Trip Duration</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {durationOptions.map((option) => (
              <button
                key={option.id}
                className={`p-3 rounded-lg border ${
                  selectedDuration === option.id
                    ? 'bg-bitcoin/10 dark:bg-bitcoin/20 border-bitcoin text-bitcoin font-medium'
                    : 'border-sand/40 dark:border-gray-600 text-forest dark:text-gray-300 hover:border-bitcoin/30 dark:hover:border-bitcoin/50'
                } transition-colors`}
                onClick={() => setSelectedDuration(option.id)}
              >
                {option.name}
              </button>
            ))}
          </div>
        </div>
        
        {/* Accommodation Selection */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-sand/20 dark:border-gray-700 shadow-sm">
          <h2 className="text-xl font-semibold text-ocean dark:text-white mb-4">Accommodation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {accommodationOptions.map((option) => (
              <button
                key={option.id}
                className={`p-3 rounded-lg border ${
                  selectedAccommodation === option.id
                    ? 'bg-bitcoin/10 dark:bg-bitcoin/20 border-bitcoin text-bitcoin font-medium'
                    : 'border-sand/40 dark:border-gray-600 text-forest dark:text-gray-300 hover:border-bitcoin/30 dark:hover:border-bitcoin/50'
                } transition-colors text-left`}
                onClick={() => setSelectedAccommodation(option.id)}
              >
                <div className="flex justify-between items-center">
                  <span>{option.name}</span>
                  {option.pricePerNight > 0 && (
                    <span className="text-bitcoin font-semibold">{option.pricePerNight} BTC/night</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
        
        {/* Activities Selection */}
        <div className="space-y-6">
          {activityCategories.map((category) => (
            <div key={category.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-sand/20 dark:border-gray-700 shadow-sm">
              <h2 className="text-xl font-semibold text-ocean dark:text-white mb-4">{category.name}</h2>
              <div className="space-y-3">
                {category.activities.map((activity) => (
                  <div 
                    key={activity.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedActivities.includes(activity.id)
                        ? 'bg-bitcoin/10 dark:bg-bitcoin/20 border-bitcoin'
                        : 'border-sand/40 dark:border-gray-600 hover:border-bitcoin/30 dark:hover:border-bitcoin/50'
                    }`}
                    onClick={() => toggleActivity(activity.id)}
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                      <div className="flex-1">
                        <h3 className="font-medium text-forest dark:text-white">
                          {activity.name}
                          {selectedActivities.includes(activity.id) && (
                            <span className="ml-2 text-bitcoin">✓</span>
                          )}
                        </h3>
                        <p className="text-forest/70 dark:text-gray-400 text-sm mt-1">{activity.description}</p>
                        <div className="mt-2 flex items-center gap-3">
                          <span className="text-xs bg-sand/50 dark:bg-gray-700 text-forest/80 dark:text-gray-300 px-2 py-1 rounded">
                            {activity.duration}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 sm:mt-0 sm:ml-4 text-bitcoin font-semibold">
                        {activity.price} BTC
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Summary Section - Fixed on desktop */}
      <div className="w-full lg:w-1/3">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-sand dark:border-gray-700 shadow-md sticky top-6">
          <h2 className="text-xl font-semibold text-ocean dark:text-white mb-4">Your Custom Package</h2>
          
          {/* Package Details */}
          <div className="space-y-4 mb-6">
            <div>
              <h3 className="text-sm text-forest/70 dark:text-gray-400">Duration:</h3>
              <p className="font-medium text-forest dark:text-white">{getDuration()}</p>
            </div>
            
            <div>
              <h3 className="text-sm text-forest/70 dark:text-gray-400">Accommodation:</h3>
              <p className="font-medium text-forest dark:text-white">{getAccommodation()}</p>
            </div>
            
            <div>
              <h3 className="text-sm text-forest/70 dark:text-gray-400">Selected Activities:</h3>
              {selectedActivities.length === 0 ? (
                <p className="text-forest/60 dark:text-gray-500 italic">No activities selected yet</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {getSelectedActivitiesDetails().map((activity, index) => (
                    <li key={index} className="flex justify-between text-sm">
                      <span className="text-forest dark:text-gray-300">{activity?.name}</span>
                      <span className="text-bitcoin">{activity?.price} BTC</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
          {/* Total Price */}
          <div className="border-t border-sand dark:border-gray-700 pt-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-forest dark:text-white">Total:</span>
              <span className="text-xl font-bold text-bitcoin">{totalPrice.toFixed(4)} BTC</span>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              className={`w-full py-3 px-4 rounded-lg font-medium text-white bg-bitcoin hover:bg-bitcoin/90 transition-colors ${
                selectedActivities.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={selectedActivities.length === 0}
            >
              Proceed to Booking
            </button>
            
            <button className="w-full py-3 px-4 rounded-lg font-medium text-bitcoin bg-white dark:bg-gray-800 border border-bitcoin hover:bg-bitcoin/5 dark:hover:bg-bitcoin/10 transition-colors">
              Save Package for Later
            </button>
          </div>
          
          {/* Requires at least one selection */}
          {selectedActivities.length === 0 && (
            <p className="text-center text-forest/60 dark:text-gray-500 text-sm mt-4">
              Please select at least one activity to create your package
            </p>
          )}
        </div>
      </div>
    </div>
  )
} 