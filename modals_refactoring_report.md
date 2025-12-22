# Scan Screen Modal Refactoring Report

## Objectives

- Ensure all modals in `scan.tsx` adhere to premium design guidelines.
- Apply `PREMIUM_COLORS` consistently.
- Remove legacy theme variables and inline overrides.

## Changes Implemented

### 1. Scan Detail Modal

- **Background**: Updated to use `PREMIUM_COLORS.glass_bg` or specific status colors (error, warning, success) with transparency.
- **Borders**: Standardized to `PREMIUM_COLORS.glass_border` or status-specific colors.
- **Text**: Replaced `textColor`, `mutedColor` with `PREMIUM_COLORS.text_primary` and `PREMIUM_COLORS.text_muted`.
- **Inputs**: Updated usage of `borderColor` and `placeholderTextColor` to use premium constants.
- **Buttons**:
  - Primary actions: `PREMIUM_COLORS.accent_primary`.
  - Secondary actions: `PREMIUM_COLORS.glass_border` (outline) + `PREMIUM_COLORS.text_primary`.
  - Destructive/Warning actions: `PREMIUM_COLORS.error` (border) or `PREMIUM_COLORS.warning`.

### 2. Manual Registration Modal

- **Overlay**: Applied a dark backdrop (`rgba(15, 23, 42, 0.75)`).
- **Card**: Used `PREMIUM_COLORS.gradient_start` for a solid yet premium background.
- **Close Button**: Updated icon color to `PREMIUM_COLORS.text_muted`.
- **Inputs**: Standardized styling with premium borders and placeholder colors.
- **State Selection**: Updated "Etat" buttons to use premium selection states (`accent_primary` or `success` tints).

### 3. Camera & Manual Capture HUDs

- **Close Buttons**: Used `PREMIUM_COLORS.glass_bg` for button background and `PREMIUM_COLORS.text_primary` for text.
- **Action Buttons**: Updated "Prendre photo" (`accent_primary`) and "Continuer" (`success`) to use consistent palette.

### Code Cleanup

- Removed unused imports: `useThemeColor`.
- Removed unused theme variable definitions:
  - `textColor`, `inputTextColor`, `placeholderColor`
  - `buttonTextColor`, `highlightColor`
  - `manualActionColor`, `mutedColor`
  - `surfaceColor`, `borderColor`
  - `modalCardColor`, `modalOverlayColor`
- Fixed lint errors regarding unused variables and hook dependencies (where possible/safe).

## Verification

- Visual inspection of code confirms all inline styles in modals now reference `PREMIUM_COLORS` or hardcoded premium values.
- No legacy `useThemeColor` definitions remain in `scan.tsx`.
