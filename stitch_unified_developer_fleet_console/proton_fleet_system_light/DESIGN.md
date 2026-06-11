---
name: Proton Fleet System (Light)
colors:
  surface: '#f9f9ff'
  surface-dim: '#d3daea'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eefe'
  surface-container-high: '#e2e8f8'
  surface-container-highest: '#dce2f3'
  on-surface: '#151c27'
  on-surface-variant: '#3d4947'
  inverse-surface: '#2a313d'
  inverse-on-surface: '#ebf1ff'
  outline: '#6d7a77'
  outline-variant: '#bcc9c6'
  surface-tint: '#006a61'
  primary: '#00685f'
  on-primary: '#ffffff'
  primary-container: '#008378'
  on-primary-container: '#f4fffc'
  inverse-primary: '#6bd8cb'
  secondary: '#4648d4'
  on-secondary: '#ffffff'
  secondary-container: '#6063ee'
  on-secondary-container: '#fffbff'
  tertiary: '#924628'
  on-tertiary: '#ffffff'
  tertiary-container: '#b05e3d'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#89f5e7'
  primary-fixed-dim: '#6bd8cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#005049'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#ffdbce'
  tertiary-fixed-dim: '#ffb59a'
  on-tertiary-fixed: '#370e00'
  on-tertiary-fixed-variant: '#773215'
  background: '#f9f9ff'
  on-background: '#151c27'
  surface-variant: '#dce2f3'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  title-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  code:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style
The design system focuses on precision, clarity, and a high-end utilitarian aesthetic. It is tailored for logistics and fleet management professionals who require deep focus and rapid data processing.

The style is **Modern Corporate**, drawing inspiration from technical documentation and premium hardware interfaces. It prioritizes a sense of "airiness" through generous whitespace and a disciplined color application. The emotional response should be one of reliability and calm efficiency, achieved through a structured grid and subtle elevation changes rather than aggressive decorative elements.

## Colors
The palette is rooted in a "cool-neutral" foundation to maintain a professional atmosphere. 

- **Primary (#0d9488):** A refined teal used for primary actions, success states, and brand identifiers.
- **Surface (#f9fafb):** The global background color, providing a soft contrast against the hardware screen.
- **Surface Bright (#ffffff):** Used exclusively for elevated containers, cards, and input fields to create a clear "layering" effect.
- **Text (#111827):** High-contrast dark slate to ensure AA/AAA accessibility compliance across all data-heavy views.
- **Secondary (#6366f1):** An indigo reserved for data visualization and secondary accents to differentiate from primary navigation.

## Typography
This design system utilizes **Inter** exclusively to leverage its exceptional legibility in data-heavy environments. 

The type scale is strictly hierarchical. Headlines use tighter letter-spacing and semi-bold weights to appear authoritative and "locked-in." Body text uses standard tracking for maximum readability. For data labels and micro-copy, a medium weight (500) is used at smaller sizes to ensure the text doesn't disappear against the light background.

## Layout & Spacing
The layout follows a **Fixed-Fluid Hybrid** model. Large desktop views utilize a 12-column grid with a maximum content width of 1440px, while tablet and mobile views transition to 8 and 4 columns respectively.

Spacing is built on a 4px baseline grid. Internal component padding should favor the `md` (16px) unit for a breathable feel. For dashboard layouts, use `lg` (24px) gaps between cards to maintain the "airy" aesthetic inspired by modern documentation sites.

## Elevation & Depth
Depth is communicated through **Tonal Layering** and **Ambient Shadows**. 

The base layer is `surface` (#f9fafb). Interactive or content-heavy elements are placed on `surface-bright` (#ffffff). To separate these layers, use a very soft, diffused shadow: `y: 4px, blur: 12px, color: rgba(0, 0, 0, 0.05)`. 

Avoid heavy borders; instead, use 1px subtle strokes in a light gray (#e5e7eb) to define boundaries where shadows might feel too heavy. This creates a clean, "Stripe-like" precision.

## Shapes
The shape language is consistently **Rounded-LG**. A standard radius of 8px (0.5rem) is applied to buttons, input fields, and small cards. Larger containers or modals may scale up to 12px or 16px to maintain visual harmony. This choice softens the professional aesthetic, making the complex data feel more approachable and modern.

## Components

- **Buttons:** Primary buttons use the teal primary color with white text. Use a "subtle" variant for secondary actions: a white background with a 1px border (#d1d5db) and dark text.
- **Input Fields:** Use `surface-bright` for the background. When focused, the border should transition to `primary` with a 2px outer glow (ring) of the same color at 10% opacity.
- **Cards:** White background, 8px radius, and a 1px border (#f3f4f6). Use a slight shadow on hover to indicate interactivity.
- **Chips/Badges:** Use a light tint of the status color (e.g., light teal for "Active") with high-contrast text. Keep corners slightly more rounded (pill-style) than standard buttons.
- **Data Tables:** Remove vertical borders. Use 1px horizontal dividers only. Header cells should use `label-md` typography in a muted gray (#6b7280).
- **Navigation:** Use a sidebar layout with a white background and a 1px right border. Active links should be signaled by a small vertical teal bar on the left edge.