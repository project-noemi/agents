# UI style guide for contributors

This guide is for contributors adding a user interface to a tool in this repository. Follow it as the default so new screens share the same colors, type, spacing, and components, unless that tool already has a reason to differ.

The CSS custom properties are in [ui-tokens.css](ui-tokens.css).

## Color

Primary and semantic colors stay the same in light and dark. Switch the neutrals with the theme.

| Role | Light | Dark |
| --- | --- | --- |
| primary | `#1967C0` | `#1967C0` |
| secondary | `#424242` | `#424242` |
| error | `#FF5252` | `#FF5252` |
| info | `#2196F3` | `#2196F3` |
| success | `#4CAF50` | `#4CAF50` |
| warning | `#FB8C00` | `#FB8C00` |
| background | `#FFFFFF` | `#121212` |
| surface | `#FFFFFF` | `#212121` |
| surface-variant | `#F5F5F5` | `#373737` |
| text | `#424242` | `#E0E0E0` |
| muted text | `#424242` | `#CCCCCC` |

Text on a filled primary or semantic color is `#FFFFFF`.

On light surfaces, high-emphasis content uses opacity `0.87` and medium emphasis uses `0.60`. On dark surfaces those opacities are `1` and `0.70`. Disabled content uses opacity `0.38` on light surfaces and `0.50` on dark. Hover overlays use opacity `0.04`. Focus overlays use opacity `0.12`.

Borders use black on light surfaces and white on dark surfaces, both at opacity `0.12`.

## Type

Use Roboto, then the system fonts:

`'Roboto', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

Root size is `1rem`. Body line height is `1.5`. Weights in use are regular `400`, medium `500`, and bold `700`.

| Role | Size | Weight | Line height | Use |
| --- | --- | --- | --- | --- |
| page title | `1.5rem` | 400 | 1.333 | Page headers |
| section | `1.25rem` | 500 | 1.6 | Section headings |
| body | `1rem` | 400 | 1.5 | Default copy |
| body small | `0.875rem` | 400 | 1.425 | Secondary copy, app-bar labels |
| caption | `0.75rem` | 400 | 1.667 | Meta text, emails in a menu |

Page headers use the page-title row. Alert titles use `1rem` at medium weight, with the body in body small.

## Spacing

The base step is `4px`. Step `n` is `4px` times `n`, from `0` through `16`.

| Step | Value | Typical use |
| --- | --- | --- |
| 1 | `4px` | Tight gaps |
| 2 | `8px` | Related controls, field margin |
| 3 | `12px` | Icon gap |
| 4 | `16px` | Page and card padding |
| 6 | `24px` | Section gap, grid gutter |
| 8 | `32px` | Large separation |

Card and page padding are `16px`. Space between header actions is `1rem`. Below `768px`, stack those actions. `768px` is a layout measure, not one of the breakpoints below.

The grid has 12 columns and a `24px` gutter. Inline container padding is `16px`.

| From | Container max width |
| --- | --- |
| `960px` | `900px` |
| `1280px` | `1200px` |
| `1920px` | `1800px` |
| `2560px` | `2400px` |

Below `960px` the container max width is unset.

## Radius

| Token | Value | Use |
| --- | --- | --- |
| sm | `2px` | Chips |
| md | `4px` | Default |
| lg | `8px` | Cards and fields |
| xl | `24px` | Buttons |

## Elevation

Each level is three layers. Layer opacities are `0.20`, `0.14`, and `0.12`. Leave a surface flat unless the role below applies.

| Level | Use | Shadow |
| --- | --- | --- |
| 0 | Tables and flat panels | none |
| 2 | App bar | `0px 3px 1px -2px rgba(0, 0, 0, 0.2), 0px 2px 2px 0px rgba(0, 0, 0, 0.14), 0px 1px 5px 0px rgba(0, 0, 0, 0.12)` |
| 3 | Menus | `0px 3px 3px -2px rgba(0, 0, 0, 0.2), 0px 3px 4px 0px rgba(0, 0, 0, 0.14), 0px 1px 8px 0px rgba(0, 0, 0, 0.12)` |
| 4 | Overlays | `0px 2px 4px -1px rgba(0, 0, 0, 0.2), 0px 4px 5px 0px rgba(0, 0, 0, 0.14), 0px 1px 10px 0px rgba(0, 0, 0, 0.12)` |

## Breakpoints

| Name | Min width |
| --- | --- |
| sm | `600px` |
| md | `960px` |
| lg | `1280px` |
| xl | `1920px` |
| xxl | `2560px` |

`xs` starts at `0`. Treat widths below `1280px` as mobile.

## Components

### Buttons

- The main action is filled primary, with `#FFFFFF` text and the xl radius (`24px`).
- A second action is outlined in primary.
- App-bar, navigation, and table icon actions are text buttons. Table actions are small.
- Leave button labels in sentence case. Compact controls are `36px` tall.

### Form fields

- Use an outlined field, radius `8px`, minimum height `48px`, with `8px` below the field.
- Focus is the primary color at opacity `0.12`. Keep that indicator visible.
- Hover may move the field up by `2px`.

### Cards

- Radius `8px`, padding `16px`.
- The title uses the page-title or section size.
- Nested panels are outlined, with no elevation.
- A menu uses elevation 3. An overlay uses elevation 4.

### App bar and navigation

- The bar is primary, elevation 2, `64px` tall, with `#FFFFFF` text and text buttons.
- The active item uses white at opacity `0.15`.
- From `1280px` up, keep the drawer on screen. Below that, make it temporary.

### Tables

- Use a compact table at elevation 0.
- Status is a small chip in a semantic color, with the status word still visible.
- An identifier link is primary, medium weight, and not underlined.
- Row actions are small text buttons with an icon.

### Alerts

- Use a tonal alert in `error`, `warning`, `info`, or `success`.
- The title is `1rem` at medium weight. The body is body small.
- A blocking step error uses the error type.

## Accessibility

- Put `#424242` text on light surfaces and `#E0E0E0` text on dark surfaces. Muted dark text is `#CCCCCC`.
- Put `#FFFFFF` text on primary and on the semantic fills.
- A control that can receive focus shows the primary color at opacity `0.12`. Keep that indicator visible.
- Disabled content uses the disabled opacities above.
- Status uses a word as well as a color.

## Using with a component library

In Vuetify, map the colors onto the theme keys `primary`, `secondary`, `error`, `info`, `success`, `warning`, `background`, `surface`, and `surface-variant`. Map the button radius to `xl`, card and field radius to `lg`, and the app bar elevation to `2`.

In plain CSS, use the custom properties in [ui-tokens.css](ui-tokens.css). Set `data-theme="dark"` on an ancestor to switch the neutrals.
