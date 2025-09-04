---
type: "agent_requested"
description: "Example description"
---

# Tailwind CSS Project Rules for perplexica-sga

This document specifies the rules for using Tailwind CSS to maintain a consistent and maintainable styling system.

### 1. Utility-First Principle

-   **Primary Method**: All styling **must** be done using Tailwind's utility classes directly in the JSX.
-   **No Custom CSS**: Do not write custom CSS files or use `<style>` tags for component-specific styles. All styling logic should be achievable with Tailwind utilities. The only exception is for global base styles in `globals.css`.
-   **No `@apply`**: The `@apply` directive is forbidden in this project to maintain the purity of the utility-first approach and prevent the creation of premature abstractions.

### 2. Design System & Theming

-   **Configuration**: All colors, spacing, font sizes, etc., should be defined in `tailwind.config.ts`. Do not use arbitrary values in class names (e.g., `top-[13px]`).
-   **Responsive Design**: Adopt a mobile-first approach. Use responsive prefixes (`sm:`, `md:`, `lg:`) to adapt styles for larger screens.

### 3. Readability & Maintainability

-   **Class Order**: While not strictly enforced by a linter yet, try to group related classes together (e.g., layout, spacing, typography, colors) to improve readability.
-   **Conditional Classes**: Use a library like `clsx` or `classnames` to conditionally apply classes in a clean and readable way. Avoid complex ternary operators within the `className` string.

### 4. Accessibility

-   **Focus States**: Ensure all interactive elements have clear and visible focus states using `focus:` utilities.
-   **Dark Mode**: Implement dark mode using Tailwind’s `dark:` variant.