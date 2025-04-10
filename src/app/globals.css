@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply antialiased bg-ocean text-ocean;
  }
  
  h1, h2, h3, h4, h5, h6 {
    @apply text-ocean font-bold;
  }
  
  a {
    @apply text-bitcoin hover:text-bitcoin/80 transition-colors;
  }
}

/* Basic Animation Classes */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* Add custom animation for loading messages - slower timing */
@keyframes fadeInOut {
  0% { opacity: 0; transform: translateY(10px); }
  10% { opacity: 1; transform: translateY(0); }
  90% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-10px); }
}

.animate-fade-in {
  animation: fadeIn 0.5s ease-in-out;
}

.animate-slide-up {
  animation: slideUp 0.5s ease-out;
}

.animate-fade-in-out {
  animation: fadeInOut 6s ease-in-out;
}
