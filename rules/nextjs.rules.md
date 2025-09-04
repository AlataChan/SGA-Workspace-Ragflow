# Next.js Project Rules for perplexica-sga

This document outlines the specific rules and best practices for Next.js development in this project. All development must adhere to these guidelines to ensure performance, consistency, and maintainability.

### 1. Core Architecture: App Router First

-   **Primary Paradigm**: All new development **must** use the App Router. The `pages` directory should only be used for existing API routes or specific legacy cases if any.
-   **Server Components by Default**: Components should be React Server Components (RSC) by default. Maximize server-side logic to reduce the client-side JavaScript bundle and improve load times.
-   **Client Component Scoping**: Only use the `'use client'` directive when absolutely necessary (e.g., for event listeners `onClick`, `onChange`, or hooks like `useState`, `useEffect`).
-   **Leaf Components**: Client components should be pushed as far down the component tree as possible (i.e., be "leaf" components) to minimize the size of the client-side bundle.

### 2. Data Fetching

-   **Server-Side Fetching**: Data fetching should primarily occur within Server Components.
-   **Loading and Error States**: All components that fetch data **must** implement and display clear loading states (e.g., using Suspense with a loading skeleton) and error states (e.g., using Error Boundaries). This is non-negotiable for providing a good user experience.
-   **URL State Management**: For state that should be shareable or bookmarkable (e.g., search queries, filters, pagination), it **must** be managed via URL search parameters. The `nuqs` library is the recommended tool for this.

### 3. Performance Optimization

-   **Image Optimization**: All images **must** be rendered using the `next/image` component. Use the WebP format where possible and ensure `width` and `height` attributes are set to prevent layout shift.
-   **Dynamic Imports**: For large components or libraries that are not critical for the initial page load, **must** use dynamic imports (`next/dynamic`) with `React.lazy` and `Suspense`.
-   **Web Vitals**: Actively monitor and optimize for Core Web Vitals (LCP, CLS, FID).

### 4. UI and Styling

-   **Component Library**: Use **Shadcn UI** and **Radix UI** as the foundation for UI components.
-   **Styling**: All styling **must** be done using **Tailwind CSS** utility classes. Do not use separate `.css` files for component-specific styles or inline styles.

### 5. Code Quality and Conventions

-   **File Naming**: All component files and directories **must** use `kebab-case`. For example: `user-profile.tsx` inside a `user-profile/` directory.
-   **No Placeholders**: All code must be fully implemented. Do not leave `TODOs`, placeholders, or incomplete functionality in pull requests.