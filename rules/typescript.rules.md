# TypeScript Project Rules for perplexica-sga

This document defines the TypeScript standards for ensuring type safety and code clarity.

### 1. Strict Mode & Type Safety

-   **Strict Mode**: `tsconfig.json` **must** have `"strict": true` enabled.
-   **No `any`**: The use of the `any` type is strictly forbidden. If a type is unknown, use `unknown` and perform type checking.
-   **Interfaces over Types**: Prefer `interface` over `type` for defining object shapes, as they are better for extension. Use `type` for unions, intersections, or primitives.

### 2. Naming Conventions

-   **Interfaces & Types**: Must be `PascalCase`.
-   **Enums**: Avoid traditional `enum`. Use string literal unions or `as const` objects instead for better tree-shaking and more readable JavaScript output.
    -   Example: `type Status = 'pending' | 'completed';`

### 3. Functions & Components

-   **Explicit Return Types**: All functions, including component functions, must have an explicit return type.
-   **Props Interfaces**: Define a dedicated `interface` for each component's props, named like `ComponentNameProps`.

### 4. Code Structure

-   **Type Imports**: Use `import type { ... } from '...'` when importing only types to allow build tools to optimize them away.
-   **Type Definitions**: For components, interfaces should be defined directly above the component function. For shared types, they should be in a dedicated `types.ts` or similar file.