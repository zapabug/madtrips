# MadTrips Layout & Design System

## Page Layouts

### 1. Root Layout (app/layout.tsx)
```tsx
<html lang="en">
  <body>
    <Providers>
      <Navigation />
      <main>{children}</main>
      <Footer />
      <NostrLoginButton />
    </Providers>
  </body>
</html>
```

### 2. Page Structure
Each page follows a consistent structure:
```tsx
<div className="container mx-auto px-4 py-12">
  <header>
    <h1>Page Title</h1>
    <p>Page description</p>
  </header>
  <main>
    {/* Page content */}
  </main>
</div>
```

## Component Architecture

### 1. Navigation Component
```tsx
/components/layout/Navigation.tsx
- Fixed position header
- Responsive menu
- Profile integration
- Theme toggle
- Dynamic route handling
```

### 2. Community Layout
```tsx
/components/community/
- Social graph visualization
- Feed components
- Profile components
- Interactive elements
```

### 3. Map Layout
```tsx
/components/map/
- Full-width map
- Business listings
- Interactive markers
- Search functionality
```

## Design System

### 1. Colors
```css
:root {
  --color-bitcoin: #F7931A;
  --color-sand: #F5F5DC;
  --color-ocean: #1E3A8A;
  --color-forest: #2F4F4F;
  --color-error: #EF4444;
  --color-success: #10B981;
}
```

### 2. Typography
```css
/* Font Scale */
.text-xs: 0.75rem
.text-sm: 0.875rem
.text-base: 1rem
.text-lg: 1.125rem
.text-xl: 1.25rem
.text-2xl: 1.5rem
.text-3xl: 1.875rem
.text-4xl: 2.25rem
```

### 3. Spacing System
```css
/* Spacing Scale */
.space-1: 0.25rem
.space-2: 0.5rem
.space-3: 0.75rem
.space-4: 1rem
.space-6: 1.5rem
.space-8: 2rem
.space-12: 3rem
.space-16: 4rem
```

### 4. Component Patterns

#### Button Styles
```css
.btn-primary {
  @apply bg-bitcoin text-white px-4 py-2 rounded-md
  hover:bg-bitcoin/90 transition-colors;
}

.btn-secondary {
  @apply bg-ocean text-white px-4 py-2 rounded-md
  hover:bg-ocean/90 transition-colors;
}
```

#### Card Styles
```css
.card {
  @apply bg-white dark:bg-gray-800 rounded-lg shadow-md
  border border-sand/20 dark:border-gray-700
  p-6;
}
```

## Responsive Design

### 1. Breakpoints
```css
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large screens */
```

### 2. Container Sizes
```css
.container {
  width: 100%;
  margin-left: auto;
  margin-right: auto;
  padding-left: 1rem;
  padding-right: 1rem;
  
  @screen sm { max-width: 640px; }
  @screen md { max-width: 768px; }
  @screen lg { max-width: 1024px; }
  @screen xl { max-width: 1280px; }
}
```

## Animation System

### 1. Transitions
```css
.transition-base {
  @apply transition-all duration-200 ease-in-out;
}

.transition-smooth {
  @apply transition-all duration-300 ease-in-out;
}
```

### 2. Loading States
```css
.loading-spinner {
  @apply animate-spin h-5 w-5 text-bitcoin;
}

.loading-pulse {
  @apply animate-pulse bg-gray-200 dark:bg-gray-700;
}
```

## Dark Mode

### 1. Color Mapping
```css
/* Light mode */
.bg-primary { @apply bg-white; }
.text-primary { @apply text-gray-900; }

/* Dark mode */
.dark .bg-primary { @apply bg-gray-900; }
.dark .text-primary { @apply text-gray-100; }
```

### 2. Component Variants
```css
.card {
  @apply bg-white dark:bg-gray-800
         text-gray-900 dark:text-gray-100
         border-gray-200 dark:border-gray-700;
}
```

## Accessibility

### 1. Focus States
```css
.focus-visible {
  @apply outline-none ring-2 ring-bitcoin ring-offset-2
         dark:ring-offset-gray-900;
}
```

### 2. Screen Reader
```css
.sr-only {
  @apply absolute w-px h-px p-0 -m-px overflow-hidden
         whitespace-nowrap border-0;
}
```

## Layout Patterns

### 1. Grid System
```css
.grid-auto-fit {
  @apply grid grid-cols-1
         sm:grid-cols-2
         lg:grid-cols-3
         xl:grid-cols-4
         gap-6;
}
```

### 2. Flex Patterns
```css
.flex-center {
  @apply flex items-center justify-center;
}

.flex-between {
  @apply flex items-center justify-between;
}
```

## Component Examples

### 1. Profile Card
```tsx
<div className="card flex items-start space-x-4">
  <img className="w-12 h-12 rounded-full" src={profile.picture} />
  <div>
    <h3 className="text-lg font-semibold">{profile.name}</h3>
    <p className="text-sm text-gray-600 dark:text-gray-400">
      {profile.about}
    </p>
  </div>
</div>
```

### 2. Action Button
```tsx
<button className="btn-primary flex items-center space-x-2">
  <span>Connect Wallet</span>
  <svg className="w-4 h-4" {...props} />
</button>
```

## Implementation Notes

1. Use Tailwind CSS for consistent styling
2. Implement dark mode with next-themes
3. Use CSS variables for dynamic values
4. Maintain consistent spacing
5. Follow accessibility guidelines
6. Optimize for performance
7. Support responsive layouts
8. Implement proper loading states 