# Example UI style guide

An example a project can adapt, for instance a web studio UI. The values were copied from a production app that uses Vuetify 3.7.18 with the Material Design 3 blueprint. Many of them are Vuetify defaults. The app has no Tailwind configuration.

The default theme name is `light`. The app allows a light/dark toggle. A second light theme and a second dark theme sit beside that pair. Deployment-specific key names from that second pair are omitted here; the hex values are unchanged.

Machine-readable copies: [tokens.json](tokens.json) and [tokens.css](tokens.css). `tokens.css` is an illustrative example stylesheet. The default block is the light theme. `data-theme="dark"`, `data-theme="alternate-light"`, and `data-theme="alternate-dark"` switch the other three.

In the source app, theme colors are stored as RGB channels and read as `rgb(var(--v-theme-primary))` and `rgba(var(--v-theme-primary), 0.12)`. The token files list the same colors as hex and as space-separated channels. A saved theme color in that app is `#` plus six hex digits.

On-colors the app does not set are filled at runtime. Those results are not stored as hex, so they are not in this guide.

## Color

### Default light theme

Set by the app:

| Token | Hex | Notes |
| --- | --- | --- |
| `primary` | `#1967C0` | App primary |
| `secondary` | `#424242` | App secondary |
| `error` | `#FF5252` | Semantic |
| `info` | `#2196F3` | Semantic. Same hex as the Vuetify 3.7.18 base light theme |
| `success` | `#4CAF50` | Semantic. Same hex as the Vuetify base light theme |
| `warning` | `#FB8C00` | Semantic. Same hex as the Vuetify base light theme |
| `background` | `#FFFFFF` | Same hex as the Vuetify base light theme |
| `surface` | `#FFFFFF` | Same hex as the Vuetify base light theme |
| `surface-variant` | `#F5F5F5` | |
| `on-surface-variant` | `#424242` | |

Left in place because the app does not set them. These are Vuetify 3.7.18 defaults, except `tertiary`, which comes from the Material Design 3 blueprint:

| Token | Hex | Notes |
| --- | --- | --- |
| `surface-bright` | `#FFFFFF` | Base light theme |
| `surface-light` | `#EEEEEE` | Base light theme |
| `primary-darken-1` | `#1F5592` | Darken of the library primary `#1867C0`, not of the app primary `#1967C0` |
| `secondary-darken-1` | `#018786` | Darken of the library secondary `#48A9A6`, not of the app secondary `#424242` |
| `tertiary` | `#7d5260` | Material Design 3 blueprint. The light theme is the one that receives this key. The blueprint does not define a dark theme |

`on-primary`, `on-secondary`, `on-background`, `on-surface`, `on-error`, `on-info`, `on-success`, and `on-warning` are not set for this theme.

### Default dark theme

Set by the app:

| Token | Hex | Notes |
| --- | --- | --- |
| `primary` | `#1967C0` | Same primary as light |
| `secondary` | `#424242` | Same secondary as light |
| `error` | `#FF5252` | |
| `info` | `#2196F3` | Same hex as the Vuetify 3.7.18 base dark theme |
| `success` | `#4CAF50` | Same hex as the Vuetify base dark theme |
| `warning` | `#FB8C00` | Same hex as the Vuetify base dark theme |
| `background` | `#121212` | Same hex as the Vuetify base dark theme |
| `surface` | `#212121` | Same hex as the Vuetify base dark theme |
| `surface-variant` | `#373737` | |
| `on-background` | `#E0E0E0` | |
| `on-surface` | `#E0E0E0` | |
| `on-surface-variant` | `#CCCCCC` | |

Left in place because the app does not set them. These are Vuetify 3.7.18 base dark theme values:

| Token | Hex | Notes |
| --- | --- | --- |
| `surface-bright` | `#ccbfd6` | Base dark theme |
| `surface-light` | `#424242` | Base dark theme |
| `primary-darken-1` | `#277CC1` | Darken of the library dark primary `#2196F3`, not of `#1967C0` |
| `secondary-darken-1` | `#48A9A6` | Darken of the library dark secondary `#54B6B2`, not of `#424242` |

Other `on-*` colors are filled at runtime.

### Alternate light theme

| Token | Hex |
| --- | --- |
| `primary` | `#2D2E38` |
| `secondary` | `#FFE600` |
| `error` | `#FF5252` |
| `info` | `#2196F3` |
| `success` | `#4CAF50` |
| `warning` | `#FB8C00` |
| `background` | `#FFFFFF` |
| `surface` | `#FFFFFF` |
| `surface-variant` | `#F5F5F5` |
| `surface-bright` | `#FFFFFF` |
| `surface-dim` | `#F5F5F5` |
| `surface-container` | `#FAFAFA` |
| `surface-container-high` | `#F0F0F0` |
| `surface-container-highest` | `#E8E8E8` |
| `surface-container-low` | `#FCFCFC` |
| `surface-container-lowest` | `#FFFFFF` |
| `on-primary` | `#FFFFFF` |
| `on-secondary` | `#2D2E38` |
| `on-background` | `#2D2E38` |
| `on-surface` | `#2D2E38` |
| `on-surface-variant` | `#6B6B6B` |
| `on-error` | `#FFFFFF` |
| `on-info` | `#FFFFFF` |
| `on-success` | `#FFFFFF` |
| `on-warning` | `#FFFFFF` |
| `extended-yellow` | `#FFE600` |
| `extended-gray` | `#2D2E38` |
| `extended-light-gray` | `#F5F5F5` |
| `extended-medium-gray` | `#6B6B6B` |
| `extended-dark-gray` | `#1A1A1A` |
| `accent-purple` | `#744C9E` |
| `accent-teal` | `#00BCB4` |
| `accent-orange` | `#FF6900` |
| `app-bar` | `#2D2E38` |
| `outline` | `#6B6B6B` |
| `outline-variant` | `#C4C4C4` |
| `inverse-on-surface` | `#F5F5F5` |
| `inverse-surface` | `#2D2E38` |
| `inverse-primary` | `#FFE600` |

Keys this object does not set still come from the base light theme, including `primary-darken-1` and `secondary-darken-1`.

### Alternate dark theme

| Token | Hex |
| --- | --- |
| `primary` | `#FFE600` |
| `secondary` | `#2D2E38` |
| `error` | `#FF5252` |
| `info` | `#2196F3` |
| `success` | `#4CAF50` |
| `warning` | `#FB8C00` |
| `background` | `#121212` |
| `surface` | `#1E1E1E` |
| `surface-variant` | `#2D2E38` |
| `surface-bright` | `#3A3A3A` |
| `surface-dim` | `#121212` |
| `surface-container` | `#1A1A1A` |
| `surface-container-high` | `#2D2E38` |
| `surface-container-highest` | `#3A3A3A` |
| `surface-container-low` | `#1A1A1A` |
| `surface-container-lowest` | `#0F0F0F` |
| `on-primary` | `#2D2E38` |
| `on-secondary` | `#FFE600` |
| `on-background` | `#FFFFFF` |
| `on-surface` | `#FFFFFF` |
| `on-surface-variant` | `#C4C4C4` |
| `on-error` | `#FFFFFF` |
| `on-info` | `#FFFFFF` |
| `on-success` | `#FFFFFF` |
| `on-warning` | `#FFFFFF` |
| `extended-yellow` | `#FFE600` |
| `extended-gray` | `#2D2E38` |
| `extended-light-gray` | `#3A3A3A` |
| `extended-medium-gray` | `#6B6B6B` |
| `extended-dark-gray` | `#1A1A1A` |
| `accent-purple` | `#9A6BBF` |
| `accent-teal` | `#33C9C1` |
| `accent-orange` | `#FF8533` |
| `app-bar` | `#2D2E38` |
| `outline` | `#6B6B6B` |
| `outline-variant` | `#3A3A3A` |
| `inverse-on-surface` | `#2D2E38` |
| `inverse-surface` | `#FFFFFF` |
| `inverse-primary` | `#2D2E38` |

Keys this object does not set still come from the base dark theme, including `primary-darken-1` (`#277CC1`), `secondary-darken-1` (`#48A9A6`), and `surface-light` (`#424242`).

### Runtime defaults

These defaults are painted onto the live light and dark themes. `accent` is not a key in the static light or dark objects.

| Field | Default | Painted onto |
| --- | --- | --- |
| primary | `#1967C0` | `primary` |
| secondary | `#424242` | `secondary` |
| accent | `#82B1FF` | `accent` |
| error | `#FF5252` | `error` |
| success | `#4CAF50` | `success` |
| warning | `#FB8C00` | `warning` |
| info | `#2196F3` | `info` |
| background, light | `#FFFFFF` | light `background` |
| surface, light | `#FFFFFF` | light `surface` |
| background, dark | `#121212` | dark `background` |
| surface, dark | `#212121` | dark `surface` |
| default theme | `light` | active theme name |
| theme toggle | allowed | |
| font family | unset | see Typography |

### State, border, and emphasis

Vuetify 3.7.18 base theme variables. The app does not override them.

Light:

| Variable | Value |
| --- | --- |
| `border-color` | `#000000` |
| `border-opacity` | `0.12` |
| `high-emphasis-opacity` | `0.87` |
| `medium-emphasis-opacity` | `0.60` |
| `disabled-opacity` | `0.38` |
| `idle-opacity` | `0.04` |
| `hover-opacity` | `0.04` |
| `focus-opacity` | `0.12` |
| `selected-opacity` | `0.08` |
| `activated-opacity` | `0.12` |
| `pressed-opacity` | `0.12` |
| `dragged-opacity` | `0.08` |
| `theme-kbd` | `#212529` |
| `theme-on-kbd` | `#FFFFFF` |
| `theme-code` | `#F5F5F5` |
| `theme-on-code` | `#000000` |

Dark values that differ:

| Variable | Value |
| --- | --- |
| `border-color` | `#FFFFFF` |
| `border-opacity` | `0.12` |
| `high-emphasis-opacity` | `1` |
| `medium-emphasis-opacity` | `0.70` |
| `disabled-opacity` | `0.50` |
| `idle-opacity` | `0.10` |
| `hover-opacity` | `0.04` |
| `focus-opacity` | `0.12` |
| `selected-opacity` | `0.08` |
| `activated-opacity` | `0.12` |
| `pressed-opacity` | `0.16` |
| `dragged-opacity` | `0.08` |
| `theme-kbd` | `#212529` |
| `theme-on-kbd` | `#FFFFFF` |
| `theme-code` | `#343434` |
| `theme-on-code` | `#CCCCCC` |

Border form used in the app: `rgba(var(--v-border-color), var(--v-border-opacity))`.

Border opacity steps, also Vuetify defaults: `0` = 0, default = 0.12, `25` = 0.25, `50` = 0.5, `75` = 0.75, `100` = 1.

## Typography

Vuetify 3.7.18 type settings. The app does not override these Sass variables.

| Token | Value |
| --- | --- |
| Body family | `'Roboto', sans-serif` |
| Heading family | `'Roboto', sans-serif` |
| Root size | `1rem` |
| Root line height | `1.5` |

The runtime font family defaults to unset. When a font is saved, the app sets `--v-font-family` and the document element's `font-family`. When it is unset, those declarations are removed and the stylesheet family applies. The app shell does not load a Roboto font file. An admin font field shows the text `'Roboto', 'Open Sans', sans-serif`. That text is the field contents, not the family in use.

Weights: thin 100, light 300, regular 400, medium 500, bold 700, black 900. Layouts use medium and bold utility classes.

The source app's classes are `text-h1` through `text-h6`, `text-subtitle-1`, `text-subtitle-2`, `text-body-1`, `text-body-2`, `text-button`, `text-caption`, and `text-overline`. Sizes are rem, with root `1rem`. Headings use the heading family. Subtitle, body, button, caption, and overline use the body family.

| Role | Size | Weight | Line height | Letter spacing | Transform |
| --- | --- | --- | --- | --- | --- |
| h1 | `6rem` | 300 | 1 | `-0.015625em` | none |
| h2 | `3.75rem` | 300 | 1 | `-0.0083333333em` | none |
| h3 | `3rem` | 400 | 1.05 | `normal` | none |
| h4 | `2.125rem` | 400 | 1.175 | `0.0073529412em` | none |
| h5 | `1.5rem` | 400 | 1.333 | `normal` | none |
| h6 | `1.25rem` | 500 | 1.6 | `0.0125em` | none |
| subtitle-1 | `1rem` | normal | 1.75 | `0.009375em` | none |
| subtitle-2 | `0.875rem` | 500 | 1.6 | `0.0071428571em` | none |
| body-1 | `1rem` | 400 | 1.5 | `0.03125em` | none |
| body-2 | `0.875rem` | 400 | 1.425 | `0.0178571429em` | none |
| button | `0.875rem` | 500 | 2.6 | `0.0892857143em` | uppercase |
| caption | `0.75rem` | 400 | 1.667 | `0.0333333333em` | none |
| overline | `0.75rem` | 500 | 2.667 | `0.1666666667em` | uppercase |

Occurrences in the app's templates, highest first: `text-caption` 712, `text-body-2` 708, `text-h6` 469, `text-body-1` 365, `text-subtitle-1` 362, `text-subtitle-2` 296, `text-h5` 205, `text-h4` 176, `text-h1` 28. Page headers use `text-h5`. App-bar labels use `text-body-2` at medium weight. Menu names use `text-subtitle-1` at bold weight. Emails in that menu use `text-caption`. Alerts use `text-subtitle-1` at medium weight plus `text-body-2`.

Local stacks, used by individual surfaces rather than the global scale:

| Role | Stack |
| --- | --- |
| Preview surface | `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` |
| Dialog and chat panel | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` |
| Preview monospace | `'Courier New', Courier, monospace` |
| Comment monospace | `'Courier New', monospace` |
| JSON viewer | `'Monaco', 'Menlo', 'Consolas', monospace` |
| Log row | `'Roboto Mono', monospace` |
| Query and asset-explorer inputs | `monospace` |

Command-palette section labels are a local style: `0.75rem`, weight 600, letter spacing `0.5px`, uppercase. List titles there are `0.95rem` at weight 400. Weight 600 is not one of the named weights above.

## Spacing

Vuetify 3.7.18 spacer. The app does not redefine it. The base step is `4px`. Steps `0` through `16` are `4px * n`. Negative steps `n1` through `n16` run from `-4px` through `-64px`.

| Step | Value |
| --- | --- |
| 0 | `0px` |
| 1 | `4px` |
| 2 | `8px` |
| 3 | `12px` |
| 4 | `16px` |
| 5 | `20px` |
| 6 | `24px` |
| 7 | `28px` |
| 8 | `32px` |
| 9 | `36px` |
| 10 | `40px` |
| 11 | `44px` |
| 12 | `48px` |
| 13 | `52px` |
| 14 | `56px` |
| 15 | `60px` |
| 16 | `64px` |

Utility class pattern in the source app: `{property}{direction}-{step}`. `pa-4` is `16px` of padding on all sides. `ma-4` is the margin equivalent. Directions are `t`, `b`, `s` (inline start), `e` (inline end), `x`, `y`, or none for all sides. Layouts use `pa-4`, `pa-6`, `mb-4`, `mb-3`, `mb-2`, `me-2`, `me-3`, `ms-2`, `mx-2`, `my-2`, `py-2`, and `mr-3`.

| Token | Value |
| --- | --- |
| Grid columns | `12` |
| Grid gutter | `24px` (step 6) |
| Form grid gutter | `8px` (step 2) |
| Container padding, inline | `16px` (step 4) |
| Gutter `xs` | `2px` |
| Gutter `sm` | `4px` |
| Gutter `md` | `8px` |
| Gutter `lg` | `16px` |
| Gutter `xl` | `24px` |

Named gutters are not the breakpoint widths. Container max widths, from `breakpoint * 0.9375`: `md` `900px`, `lg` `1200px`, `xl` `1800px`, `xxl` `2400px`. `xs` and `sm` are unset.

Layout spacing written in pixels or rem, outside the scale:

| Role | Value |
| --- | --- |
| Step content and footer padding | `16px` |
| Gap between header actions | `1rem` |
| Selector margin | `8px` |
| Command-palette field margin | `16px 16px 12px 16px` |
| Mega-menu container padding | `24px 32px` |
| Mega-menu column padding | `16px` |

## Radius

Vuetify 3.7.18 radius scale. The root radius is `4px`.

| Token | Value | Source-app class or prop |
| --- | --- | --- |
| `0` | `0` | `rounded="0"` |
| `sm` | `2px` | `rounded="sm"` |
| default | `4px` | `rounded` |
| `lg` | `8px` | `rounded="lg"` |
| `xl` | `24px` | `rounded="xl"` |
| `pill` | `9999px` | `rounded="pill"` |
| `circle` | `50%` | `rounded="circle"` |
| `shaped` | `24px 0` | `rounded="shaped"` |

Material Design 3 blueprint defaults the app passes through: buttons and button groups `xl` (`24px`), cards `lg` (`8px`), chips `sm` (`2px`), bottom sheets `rounded-t-xl`.

Recorded overrides:

| Role | Value |
| --- | --- |
| Page header card | `8px` |
| Text field | `8px` |
| Command palette dialog and card | `12px` |
| Command palette input | `8px` |
| Active navigation underline | `3px 3px 0 0` |
| Status dot, `4px` | `50%` |

## Shadow

Vuetify 3.7.18 elevations, levels `0` through `24`. Each level is three layers. The source variables and their fallbacks are:

| Layer | Value |
| --- | --- |
| umbra | `var(--v-shadow-key-umbra-opacity, rgba(0, 0, 0, 0.2))` |
| penumbra | `var(--v-shadow-key-penumbra-opacity, rgba(0, 0, 0, 0.14))` |
| ambient | `var(--v-shadow-key-ambient-opacity, rgba(0, 0, 0, 0.12))` |

Append the layer's opacity to its geometry. Elevation 2 umbra is `0px 3px 1px -2px var(--v-shadow-key-umbra-opacity, rgba(0, 0, 0, 0.2))`. The prop form is `elevation="2"`. The class form is `elevation-1`. [tokens.json](tokens.json) and [tokens.css](tokens.css) list every level. Levels the layouts set:

| Level | Umbra | Penumbra | Ambient | Where |
| --- | --- | --- | --- | --- |
| 0 | `0px 0px 0px 0px` | `0px 0px 0px 0px` | `0px 0px 0px 0px` | Some tables use `elevation-0` |
| 1 | `0px 2px 1px -1px` | `0px 1px 1px 0px` | `0px 1px 3px 0px` | Rare on cards |
| 2 | `0px 3px 1px -2px` | `0px 2px 2px 0px` | `0px 1px 5px 0px` | App bars |
| 3 | `0px 3px 3px -2px` | `0px 3px 4px 0px` | `0px 1px 8px 0px` | Profile menu |
| 4 | `0px 2px 4px -1px` | `0px 4px 5px 0px` | `0px 1px 10px 0px` | Command palette card and mega menu |

Of 3094 card opening tags, 3028 leave elevation unset. Explicit card elevations that do appear: `2` (38), `3` (11), `0` (7), `4` (5), `1` (3).

Other shadows written in the app:

| Role | Shadow |
| --- | --- |
| Company menu and profile menu | `0 4px 20px rgba(0, 0, 0, 0.1)` |
| Command palette card | `0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)` |
| Field hover | `0 4px 25px 0 rgba(var(--v-theme-primary), 0.1)` |

Some forms also use one-off shadows, including `0 1px 3px 0 rgba(0, 0, 0, 0.1)` and a focus ring `0 0 0 3px rgba(59, 130, 246, 0.1)`. Those are not theme tokens. `rgba(59, 130, 246, 0.1)` is not a theme color.

## Motion

Vuetify 3.7.18 motion settings:

| Token | Value |
| --- | --- |
| Standard easing | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Decelerated easing | `cubic-bezier(0.0, 0, 0.2, 1)` |
| Accelerated easing | `cubic-bezier(0.4, 0, 1, 1)` |
| Root transition duration | `0.3s` |

Field hover uses a separate transition: `all 0.3s ease`.

## Breakpoints

Vuetify 3.7.18 thresholds. The app does not pass a display option, so these widths and `mobileBreakpoint: 'lg'` apply. `mobile` is true when the width is below `1280`.

| Name | Min width | True when |
| --- | --- | --- |
| `xs` | `0` | width `< 600` |
| `sm` | `600px` | `600 <= width < 960` |
| `md` | `960px` | `960 <= width < 1280` |
| `lg` | `1280px` | `1280 <= width < 1920` |
| `xl` | `1920px` | `1920 <= width < 2560` |
| `xxl` | `2560px` | width `>= 2560` |

Helper flags used in the app: `xs`, `smAndDown`, `mdAndDown`, `mdAndUp`, `lgAndUp`, `xlAndUp`, `mobile`. Display classes used: `d-none`, `d-sm-flex`, `d-sm-inline`, `d-md-flex`, `d-md-none`, `d-md-block`, `flex-column`, `flex-md-row`.

App measurements beside the scale: a `max-width: 600px` query, which is the same edge as `sm`; a `max-width: 768px` query on the page header, which is not a library breakpoint; and a `64px` offset equal to the app-bar height.

## Component patterns

Icons use the Material Design Icons set (`mdi`). Counts below are opening-tag attributes in the app. An unset prop keeps the blueprint default.

Blueprint defaults the app passes through:

| Component | Default |
| --- | --- |
| App bar | `flat` |
| Autocomplete, combobox, select, textarea, text field | variant `filled` |
| Banner | color `primary` |
| Button | color `primary`, rounded `xl` (`24px`) |
| Button group | rounded `xl` |
| Card | rounded `lg` (`8px`) |
| Checkbox | color `secondary`, `inset` |
| Chip | rounded `sm` (`2px`) |
| Slider | color `primary` |
| Tabs | color `primary` |
| Toolbar button | color cleared (`null`) |

### Buttons

Observed `variant` counts: `text` 829, unset 447, `outlined` 235, `elevated` 72, `tonal` 56, `flat` 31, `plain` 5. Color when set: `primary` 596, `error` 167, `success` 37, `grey` 36, `secondary` 35. This token set has no hex for `grey`. Size when set: `small` 467, `large` 49, `x-small` 32, `x-large` 15.

| Role | Pattern |
| --- | --- |
| App-bar action | `variant="text"`, often an `mdi` icon |
| Primary step | `color="primary"`, no variant, so the blueprint elevated primary button |
| Secondary step | `variant="outlined"`, `color="primary"`, leading icon `mdi-arrow-left` |
| Header create or add | `variant="outlined"`, `color="primary"`, leading icon |
| Header navigation | `variant="text"`, leading icon |
| Icon action in a table | `size="small"`, `variant="text"`, icon such as `mdi-eye` |
| Alert action | `color="primary"` or `color="error"`, `variant="text"`, `size="small"` |

The button type style is uppercase. Profile and company controls set `text-transform: none`, `letter-spacing: normal`, and height `36px`. Many other buttons add a class that turns the uppercase transform off.

### Inputs

The blueprint variant is `filled`. On text fields, textareas, selects, autocompletes, and comboboxes, the observed variants are `outlined` 515 and unset 293. Density: unset 406, `compact` 217, `comfortable` 192.

Shared field skin:

| Property | Value |
| --- | --- |
| Radius | `8px` |
| Min height | `48px` |
| Margin bottom | `8px` |
| Padding top | `4px` |
| Hover | `translateY(-2px)` and `box-shadow: 0 4px 25px 0 rgba(var(--v-theme-primary), 0.1)` |
| Filled background | `rgba(var(--v-theme-primary), 0.05)` |
| Transition | `all 0.3s ease` |

Command palette field: `variant="outlined"`, `density="compact"`, details hidden, radius `8px`, input padding `8px 12px`.

### Cards

Blueprint radius is `lg` (`8px`). Observed variants when set: `outlined` 387, `tonal` 53, `flat` 19. Nested panels often use `outlined`.

Page header: bottom margin `16px` (`mb-4`), padding `16px` (`pa-4`), title `text-h5`, optional primary icon with `12px` of inline end margin (`me-3`), actions in a row with `gap: 1rem`, radius `8px`. Below `768px` the actions stack.

Profile menu: min width `260px`, elevation `3`, rounded `lg`. The list is `density="compact"` and `nav`. Items are rounded `lg` with `8px` inline margin and `4px` bottom margin (`mx-2 mb-1`).

| State | Background |
| --- | --- |
| Active item | `rgba(var(--v-theme-primary), 0.1)` and text `rgb(var(--v-theme-primary))` |
| Hover | `rgba(var(--v-theme-surface-variant), 0.4)` |
| Menu border | `1px solid rgba(var(--v-border-color), var(--v-border-opacity))` |

### Navigation

Dashboard shell:

| Piece | Pattern |
| --- | --- |
| Bar | color `primary`, elevation `2` |
| Drawer | rail on desktop, permanent when not mobile, temporary when `mobile` (width `< 1280`) |
| Menu | `nav` list, item and group color `primary`, items carry an `mdi` icon |

Rail items set list indent, prepend width, and indent padding to `0px`, with `padding-inline-start: calc(8px + var(--indent-padding))`.

Public header: the same bar, color `primary` and elevation `2`. Links are text buttons with `4px` horizontal margin and white text. The active item uses `background-color: rgba(255, 255, 255, 0.15)` and a white underline `30px` by `3px`, radius `3px 3px 0 0`. The mobile drawer is temporary and on the right. The mega menu is elevation `4` under an `rgba(0, 0, 0, 0.05)` overlay, with container padding `24px 32px` and column padding `16px`.

### Tables

Data tables, including the server variant. A compact table uses `elevation-0`, `density="compact"`, and 10 rows per page, inside a card. Header cells can set `white-space: nowrap`.

| Cell | Pattern |
| --- | --- |
| Identifier link | no underline, medium weight, primary color |
| Status chip | `size="small"`, `variant="tonal"` or `variant="outlined"` |
| Row action | `size="small"`, `variant="text"`, an `mdi` icon |
| Empty state | icon `48px`, centered, `16px` of block padding |

Status chips use theme color names (`error`, `warning`, `info`, `success`, `primary`, `grey`). There is no single shared severity map. One map uses critical = `error`, high = `warning`, medium = `info`, low = `success`. Another uses critical = `error`, high = `error-lighten-1`, medium = `warning`, low = `info`, info = `primary`. `error-lighten-1` has no hex in this token set.

### Alerts

Observed variants: `tonal` 301, unset 168, `outlined` 8. Types: `error` 167, `info` 152, `warning` 72, `success` 18.

A closable alert uses `variant="tonal"`, `border="start"`, `16px` of block margin, an icon at `24px` with `12px` of inline end margin, a title at `text-subtitle-1` medium weight, and a body at `text-body-2`. Its type is `warning` or `error`. A step error uses `type="error"`, `variant="tonal"`, icon `mdi-alert-circle`, and margin `16px` inline with `8px` bottom.
