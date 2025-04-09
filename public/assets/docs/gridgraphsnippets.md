# GridGraph Component - LLM Recreation Snippets

This document contains prompts and code snippets for recreating the GridGraph component from scratch using an LLM.

## Complete Component Generation Prompt

```
Create a React component called GridGraph that displays community members in a responsive grid layout.

Requirements:
- Use TypeScript with React
- Component should accept graph data containing nodes that represent community members
- Each node should display a profile picture (with fallback) and name
- Core community members should be highlighted with an orange badge
- Sort members by importance (val property)
- Support dark/light mode with appropriate styling
- Handle empty states gracefully
- Allow configuring maximum number of nodes to display
- Use TailwindCSS for styling
- Make the grid responsive with different column counts for mobile/tablet/desktop
- Add a vertical scrollbar when there are many members
- Add the 'use client' directive at the top for Next.js compatibility

The component should accept these props:
- graphData: GraphData | null (contains nodes with member information)
- profiles: Map<string, ProfileData> (additional profile information keyed by npub)
- maxNodes?: number (default: 50)
- className?: string (optional additional CSS classes)

Each node should have these properties:
- id: string
- name?: string
- npub?: string
- picture?: string
- isCoreNode?: boolean
```

## Interface Definitions

```typescript
// GraphNode interface
interface GraphNode {
  id: string;
  name?: string;
  npub?: string;
  picture?: string;
  isCoreNode?: boolean;
  val?: number;
  // ... other properties
}

// GraphData interface
interface GraphData {
  nodes: GraphNode[];
  links: any[];
  // ... other properties
}

// ProfileData interface
interface ProfileData {
  displayName?: string;
  name?: string;
  picture?: string;
  // ... other properties
}

// Component props interface
interface GridGraphProps {
  graphData: GraphData | null;
  profiles: Map<string, ProfileData>;
  maxNodes?: number;
  className?: string;
}
```

## Component Structure Outline

```
1. Handle empty or null graphData case
2. Sort nodes by val property (descending)
3. Apply maxNodes limit
4. Render each node:
   - Profile picture (with fallback)
   - Name (with fallbacks from profile data)
   - Core badge for core members
5. Style with Tailwind:
   - Responsive grid (2 cols mobile, 3 cols tablet, 4 cols medium, 6 cols large)
   - Scrollable container with max height
   - Card-like styling for each member
   - Rounded profile pictures
```

## Key CSS Classes

```
Container: "bg-white dark:bg-gray-700 rounded-lg shadow-sm"
Header: "px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
Grid container: "max-h-[300px] overflow-y-auto p-4"
Grid layout: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3"
Member card: "bg-gray-50 dark:bg-gray-800 rounded-lg p-3 flex flex-col items-center hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
Profile image container: "w-12 h-12 rounded-full overflow-hidden mb-2 bg-gray-200 border-2 border-white dark:border-gray-700 shadow-sm"
Name display: "font-medium text-xs truncate"
Core badge: "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-100 text-xs px-1.5 py-0.5 rounded-full inline-block mt-1"
```

## Profile Image Logic

```jsx
{node.picture || (profile && profile.picture) ? (
  <img 
    src={node.picture || profile?.picture}
    alt={node.name || 'Profile'} 
    className="w-full h-full object-cover"
  />
) : (
  <div className="w-full h-full flex items-center justify-center text-sm">
    👤
  </div>
)}
```

## Name Display Logic

```jsx
{node.name || profile?.displayName || profile?.name || 'Unknown'}
```

## Integration Example

```jsx
import { GridGraph } from '../../components/community/graph';

// In your page component:
<GridGraph
  graphData={graphData}
  profiles={profiles}
  maxNodes={50}
/>
``` 