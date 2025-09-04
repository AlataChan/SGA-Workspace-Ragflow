# React Project Rules for perplexica-sga

This document outlines the specific rules and best practices for React development.

### 1. Component Architecture & Philosophy

-   **Functional Components**: All components **must** be functional components. Class components are forbidden.
-   **Hooks**: Utilize React Hooks for state and lifecycle management.
-   **Composition over Inheritance**: Always favor component composition to share code between components.
-   **DRY (Don't Repeat Yourself)**: Abstract reusable logic into custom hooks (`use...`) and shared utility functions.

### 2. State Management

-   **Minimize `useEffect` and `useState`**: State should be managed at the lowest possible level in the component tree. Lift state up only when necessary.
-   **URL as State**: For global state that needs to be persistent and shareable (e.g., filters, search queries), use URL search parameters as the source of truth, managed via `nuqs`.
-   **Complex Local State**: For complex state within a component, `useReducer` is preferred over multiple `useState` calls.

### 3. Performance

-   **Memoization**: Use `React.memo` for components that render often with the same props.
-   **`useCallback` & `useMemo`**: Memoize functions and values to prevent unnecessary re-renders, especially when passed as props to optimized child components.
-   **Keys in Lists**: Always use stable and unique keys (like a database ID) for items in a list. **Do not use the array index as a key.**
-   **Code Splitting**: Use `React.lazy` and `Suspense` for lazy-loading components that are not critical for the initial render.

### 4. Code Quality & Conventions

-   **Props Typing**: All components must have their props typed using TypeScript interfaces.
-   **Event Handlers**: Name event handlers with a `handle` prefix (e.g., `handleClick`, `handleSubmit`).
-   **Boolean Props**: Name boolean props with a verb prefix (e.g., `isLoading`, `hasError`).
-   **Complete Implementation**: All submitted code must be fully functional. No `TODO` comments, placeholders, or incomplete logic is allowed.