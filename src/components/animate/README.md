# Animate Component Library

A collection of animation components and utilities based on Framer Motion, designed to provide easy-to-use animation solutions.

## Directory Structure

```
animate/
├── motion-container.tsx    # General animation container component
├── motion-lazy.tsx        # Lazy loading animation component
├── types.ts              # Type definitions
└── variants/            # Animation variants (container, bounce, transition)
```

## Component Documentation

### MotionContainer

A general-purpose animation container component that wraps content with animation effects.

```tsx
import MotionContainer from '@/components/animate/motion-container';

// Usage example
<MotionContainer>
  <YourComponent />
</MotionContainer>
```

Features:
- Automatically applies initial, animate, and exit states
- Supports custom className for styling
- Implements animation using the variants system
- Inherits animation properties to child components
- Provides consistent animation behavior across the application

Props:
- `children`: React nodes to be animated
- `className`: Optional CSS class name
- `...MotionProps`: All Framer Motion props are supported

### MotionLazy

A component for lazy loading animation features to reduce bundle size.

```tsx
import { MotionLazy } from '@/components/animate/motion-lazy';

// Usage example
<MotionLazy>
  <YourComponent />
</MotionLazy>
```

Features:
- Dynamically loads animation features on demand
- Reduces initial bundle size
- Supports strict mode for better development experience
- Wraps content in a full-height container
- Uses domMax features for optimal performance

Props:
- `children`: React nodes to be wrapped in lazy loading context

## Animation Variants

The `variants` directory contains predefined animation variants that can be used with these components. These variants provide consistent animation patterns across the application.

Available variants:
- `varContainer`: stagger children animations
- `varBounce`: bounce in/out
- `varTranEnter` / `varTranExit`: enter / exit transitions

To use custom variants:
```tsx
import { varContainer } from './variants/container';

const customVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

<MotionContainer variants={customVariants}>
  <YourComponent />
</MotionContainer>
```
