# Home Components Directory

This directory contains React components specifically used on the MadTrips home page.

## Contents

- [`FunchalMap.tsx`](#funchapmaptsx) - Interactive Funchal map component
- [`Hero.tsx`](#herotsx) - Main hero section component
- [`CallToAction.tsx`](#calltoactiontsx) - CTA section component
- [`FeaturedPackages.tsx`](#featuredpackagestsx) - Featured travel packages component

## FunchalMap.tsx

Interactive map component showcasing Funchal, Madeira.

### Key Features
- Interactive map visualization
- Points of interest highlighting
- Location information display
- Responsive design

### Props
- `className?: string` - Optional CSS class name
- `height?: number` - Map height in pixels
- `interactive?: boolean` - Whether map is interactive

## Hero.tsx

The main hero section displayed at the top of the home page.

### Key Features
- Engaging headline and subtext
- Background image or video
- Call to action buttons
- Responsive design for all devices

### Props
- `title?: string` - Main headline text
- `subtitle?: string` - Secondary description text
- `backgroundImage?: string` - URL to background image
- `buttonText?: string` - Primary button text

## CallToAction.tsx

Component for conversion-focused call to action sections.

### Key Features
- Bold headlines
- Action-oriented buttons
- Visual emphasis
- Conversion tracking

### Props
- `headline: string` - Main CTA text
- `buttonText: string` - Button text
- `buttonLink: string` - Button destination URL
- `theme?: 'light' | 'dark'` - Color theme

## FeaturedPackages.tsx

Component displaying highlighted travel packages.

### Key Features
- Package card display
- Pricing information
- Featured imagery
- Quick booking options

### Props
- `packages: Package[]` - Array of package data
- `title?: string` - Section title
- `subtitle?: string` - Section description
- `maxItems?: number` - Maximum number of packages to display

## Usage

These components are typically composed together on the home page:

```tsx
import { Hero, FunchalMap, FeaturedPackages, CallToAction } from '../components/home';

function HomePage() {
  return (
    <div className="home-page">
      <Hero 
        title="Discover Madeira" 
        subtitle="Experience the pearl of the Atlantic"
      />
      
      <FeaturedPackages 
        title="Popular Experiences" 
        packages={featuredPackages}
      />
      
      <FunchalMap interactive height={500} />
      
      <CallToAction 
        headline="Ready for your Madeira adventure?" 
        buttonText="Book Now"
        buttonLink="/packages"
      />
    </div>
  );
}
```

## Design Guidelines

- Maintain visual consistency with the overall MadTrips brand
- Ensure all components are fully responsive
- Optimize images for fast loading
- Use consistent typography and spacing
- Include appropriate animations and transitions 