# Shadcn/ui Migration Design

## 1. Overview
The goal of this migration is to replace LinearCard's custom UI primitives (`Button`, `Card`, `Input`, `Label`) with the standard `shadcn/ui` framework. This ensures scalability, accessibility, and standard component patterns, while perfectly preserving the existing "Linear-style" visual identity (dark mode, glassmorphism, brand blue accents).

## 2. Architecture & Setup
- **CLI Initialization**: Initialize `shadcn/ui` using `npx shadcn@latest init`. The project currently uses Tailwind v4, which the latest Shadcn CLI natively supports.
- **Theme Mapping**: Shadcn/ui expects specific CSS variables (e.g., `--background`, `--primary`, `--border`). Instead of overriding these in every component, we will map them directly to LinearCard's existing variables in `app/globals.css`.
  - `--background` maps to `--color-canvas`
  - `--foreground` maps to `--color-ink-dark`
  - `--primary` maps to `--color-brand-blue`
  - `--primary-foreground` maps to `#ffffff`
  - `--border` maps to `--color-border-subtle`
  - `--muted` maps to `--color-surface-bone`
  - `--muted-foreground` maps to `--color-ink-muted`
  - `--input` maps to `--color-border-subtle`
  - `--ring` maps to `--color-brand-blue`

## 3. Component Migration Strategy
We will execute an **in-place file replacement (Big Bang)** approach.

1. **Delete Custom Primitives**: Remove `components/ui/Button.tsx`, `components/ui/Card.tsx`, `components/ui/Input.tsx`, and `components/ui/Label.tsx`.
2. **Install Shadcn Primitives**: Execute `npx shadcn@latest add button card input label`.
3. **Global Refactor**:
   - **Button**: Shadcn's Button uses `class-variance-authority`.
     - Update `<Button variant="primary">` to `<Button variant="default">`.
     - Update direct utility usages: `className={clsx(buttonBaseClass, buttonVariants.primary)}` -> `className={buttonVariants({ variant: "default" })}`.
     - Update `<Button variant="secondary">` to `<Button variant="outline">` or `<Button variant="secondary">` depending on visual mapping.
   - **Card, Input, Label**: These will function as direct drop-in replacements. We will review all usages across `/dashboard`, `/enroll`, and `/login` to verify that any custom `className` props applied to them don't conflict with Shadcn's base classes.

## 4. Error Prevention & Testing
- The migration will touch multiple cross-functional features (dashboard CRM, enrollment flow, login). 
- We will rely on Next.js build (`npm run build`) to catch typing or import path errors (e.g., if a component imported `buttonBaseClass` which no longer exists).
- After the build passes, we will manually verify the visual fidelity in both Light Mode and Dark Mode to ensure the CSS variable mapping holds up under the Next-Themes or custom theme toggle logic.

## 5. Scope Boundaries
- **In Scope**: Replacing the 4 core UI primitives, updating all imports, adjusting `globals.css` for theme compatibility.
- **Out of Scope**: Introducing new components (like Dialog, Select, etc.) unless strictly necessary to fix broken layouts. Refactoring complex page layouts (like `LiveActivitySidebar`) unless they break due to the component swap.
