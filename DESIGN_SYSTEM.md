# BrokerIQ — Mobile Design System & UI Specification

## 1. Design Philosophy & Broker Ergonomics

The BrokerIQ mobile design system is purpose-built for Indian real-estate brokers operating in dynamic, high-urgency field conditions. Brokers constantly transition between outdoor construction sites, client walkthroughs in bright direct sunlight, busy road travel, and office meetings. Every interface element is engineered according to three foundational ergonomic tenets:

1. **High Sunlight Contrast**: Authoritative **Deep Teal** and **Emerald** brand anchors paired with high-contrast Slate neutral typography (`#0F172A`) over clean white and Slate-50 surfaces, guaranteeing full legibility in bright Indian daylight.
2. **One-Tap Action Triggers**: High-frequency communication actions (Call Client, WhatsApp Message, Schedule Site Visit) are elevated to prominent single-tap tactile buttons on cards, eliminating deep multi-level navigation.
3. **Information Density with Breathing Room**: Visual grouping utilizing a strict 4pt/8pt spatial grid, card elevations, and distinct status color pills allows brokers to quickly scan lead stages, property prices in INR Lakhs/Crores, and overdue follow-up counts.

---

## 2. Color Palette & Token Architecture

The design token system is configured in `apps/mobile/tailwind.config.js` and exposed to components via NativeWind utility classes.

### 2.1 Primary Brand Scale (Deep Teal & Emerald)
The primary brand scale evokes financial credibility, growth, and trust:

| Token | Hex Value | Semantic Usage |
|---|---|---|
| `primary-950` | `#022C22` | Deepest emerald container text, dark mode surfaces |
| `primary-900` | `#064E3B` | High-contrast dark headers, active navigation indicators |
| `primary-800` | `#065F46` | Pressed states for primary buttons |
| `primary-700` | `#047857` | Deep Emerald, prominent CTAs, selected filter chips |
| `primary-600` | `#0D9488` | Deep Teal brand anchor, active tab icons |
| `primary-500` | `#059669` | Default Emerald primary, verified badges |
| `primary-400` | `#10B981` | Accent highlights, success indicators |
| `primary-300` | `#6EE7B7` | Subtle border accents, interactive focus rings |
| `primary-200` | `#A7F3D0` | Badge borders, muted highlights |
| `primary-100` | `#D1FAE5` | Mint background tints for positive metric cards |
| `primary-50`  | `#ECFDF5` | Soft card background fills, subtle highlights |

### 2.2 Neutral Surface & Typography Tokens
Neutral tokens rely on a crisp Slate scale to maintain modern, clean contrast:

| Token | Hex Value | Semantic Usage |
|---|---|---|
| `surface-bg` | `#F8FAFC` | App screen background (Slate-50) |
| `surface-card` | `#FFFFFF` | Card surface, bottom sheets, dialog modals |
| `surface-subtle` | `#F1F5F9` | Secondary card fills, inactive input backgrounds |
| `surface-border` | `#E2E8F0` | Dividers, hairline card borders, input borders |
| `surface-border-strong` | `#CBD5E1` | Focused input borders, active outlines |
| `text-primary` | `#0F172A` | Primary typography, headlines, active labels (Slate-900) |
| `text-secondary` | `#475569` | Subtitles, metadata, secondary body text (Slate-600) |
| `text-muted` | `#94A3B8` | Placeholder text, disabled labels, timestamps (Slate-400) |
| `text-inverse` | `#FFFFFF` | Text on dark buttons, filled badges |

### 2.3 Semantic Status Scale
Standardized status colors communicate pipeline stages and system states instantly:

| Status Token | Hex Value | Background Tint | Usage Scenario |
|---|---|---|---|
| `status-new` | `#2563EB` (Blue-600) | `#EFF6FF` (Blue-50) | `NEW` lead ingestion |
| `status-contacted` | `#0284C7` (Sky-600) | `#F0F9FF` (Sky-50) | `CONTACTED` stage |
| `status-interested`| `#0D9488` (Teal-600) | `#F0FDFA` (Teal-50) | `INTERESTED` stage |
| `status-followup` | `#D97706` (Amber-600)| `#FFFBEB` (Amber-50) | `FOLLOW_UP` pending |
| `status-visit` | `#7C3AED` (Violet-600) | `#F5F3FF` (Violet-50) | `SITE_VISIT` scheduled |
| `status-negotiation`| `#C026D3` (Fuchsia-600) | `#FDF4FF` (Fuchsia-50) | `NEGOTIATION` active |
| `status-won` | `#059669` (Emerald-600) | `#ECFDF5` (Emerald-50) | `WON` deal closed |
| `status-lost` | `#DC2626` (Red-600) | `#FEF2F2` (Red-50) | `LOST` or dropped deal |
| `status-inactive` | `#64748B` (Slate-500) | `#F8FAFC` (Slate-50) | `NOT_INTERESTED` / Inactive |

---

## 3. Typography Hierarchy (Inter Font)

BrokerIQ standardizes on the **Inter** font family across both iOS and Android. Font weights and line heights are strictly enforced:

| Hierarchy Level | Font Size | Weight | Line Height | Letter Spacing | Usage Context |
|---|---|---|---|---|---|
| **Display** | 32px | Bold (700) | 40px | -0.5px | Hero metrics, login welcome titles |
| **Page Title** | 26px | Bold (700) | 32px | -0.3px | Top navigation headers, modal titles |
| **Section** | 20px | Semi-Bold (600) | 26px | -0.2px | Dashboard section headers, list group titles |
| **Card Title** | 16px | Semi-Bold (600) | 22px | 0px | Lead name, property title, metric card label |
| **Body** | 15px | Regular (400) | 22px | 0px | Messages, descriptions, form input text |
| **Secondary** | 14px | Medium (500) / Regular (400) | 20px | 0px | Sub-labels, metadata, timestamps, addresses |
| **Caption** | 12px | Medium (500) / Semi-Bold (600) | 16px | +0.2px | Status badge pills, micro-counters, tab labels |

---

## 4. Spacing, Layout & Touch Target Standards

### 4.1 8-Point Spatial Grid
All layout paddings, margins, and gaps are multiples of 4px and 8px:
- `space-1` (4px): Micro-gaps between badge icon and text.
- `space-2` (8px): Spacing between tight rows, chip gaps.
- `space-3` (12px): Standard inner card padding for dense lists.
- `space-4` (16px): Screen horizontal padding, standard card padding.
- `space-6` (24px): Section separation margin.
- `space-8` (32px): Modal and authentication form spacing.

### 4.2 Elevation & Border Radii
- **Hairline Borders**: `1px` solid `#E2E8F0` on cards and inputs to provide crisp definition on high-DPI retina screens.
- **Corner Radii**:
  - `rounded-md` (8px): Inputs, buttons, status badges.
  - `rounded-xl` (12px): Metric cards, lead cards, property cards.
  - `rounded-2xl` (16px): Bottom sheets, modals.
  - `rounded-full` (9999px): Avatar pills, quick-action circular buttons.
- **Touch Targets**: Minimum **44 × 44 points** for all interactive targets to comply with Apple Human Interface Guidelines and Google Material Design.

---

## 5. Reusable Component Catalog (All 21 Components)

BrokerIQ features **21 specialized UI components** located in `apps/mobile/components/ui/`.

### 1. `Screen`
- **Purpose**: Root screen layout wrapper managing safe area boundaries, status bar theming, and pull-to-refresh.
- **Props**:
  ```typescript
  interface ScreenProps {
    children: React.ReactNode;
    scrollable?: boolean;
    header?: React.ReactNode;
    backgroundColor?: string;
    safeArea?: boolean;
    refreshControl?: React.ReactElement;
  }
  ```
- **Behavior**: Adapts to iOS notch/Dynamic Island and Android hardware navigation bars. Integrates keyboard-avoiding views automatically.

### 2. `Header`
- **Purpose**: Authoritative top screen navigation bar.
- **Props**:
  ```typescript
  interface HeaderProps {
    title: string;
    subtitle?: string;
    showBack?: boolean;
    onBack?: () => void;
    rightAction?: React.ReactNode;
    searchable?: boolean;
    onSearch?: (query: string) => void;
  }
  ```
- **Behavior**: Fixed height (56px), Page Title typography (26px/700), back navigation arrow with minimum 44px tap zone.

### 3. `Card`
- **Purpose**: Container for grouping related content with elevation or outline styling.
- **Props**:
  ```typescript
  interface CardProps {
    children: React.ReactNode;
    variant?: 'elevated' | 'outlined' | 'flat';
    onPress?: () => void;
    className?: string;
  }
  ```
- **Behavior**: Renders `#FFFFFF` background, 12px border radius, subtle border (`#E2E8F0`), and Reanimated opacity press feedback.

### 4. `LeadCard`
- **Purpose**: High-density card displaying buyer/seller lead summary with 1-tap call/WhatsApp triggers.
- **Props**:
  ```typescript
  interface LeadCardProps {
    lead: {
      id: string;
      name: string;
      phone: string;
      stage: LeadStage;
      budgetMin?: number;
      budgetMax?: number;
      currency?: string;
      propertyType?: string;
      preferredBhk?: string;
      preferredLocation?: string;
      score?: number;
      createdAt: string;
    };
    onPress: () => void;
    onCall: () => void;
    onWhatsApp: () => void;
  }
  ```
- **Behavior**: Displays name, stage pill, formatted budget in INR (e.g. `₹1.4 Cr - ₹1.7 Cr`), BHK chip, location, and dedicated Call (`#059669`) and WhatsApp (`#25D366`) quick-trigger buttons.

### 5. `PropertyCard`
- **Purpose**: Visual presentation of real-estate inventory items.
- **Props**:
  ```typescript
  interface PropertyCardProps {
    property: {
      id: string;
      title: string;
      price: number;
      currency?: string;
      bhk: number;
      areaSqft: number;
      locality: string;
      city: string;
      propertyType: PropertyType;
      furnishing: FurnishingStatus;
      status: PropertyStatus;
      imageUrl?: string;
    };
    onPress: () => void;
  }
  ```
- **Behavior**: Thumbnail image with fallback blueprint icon, price formatted in Lakhs/Crores, specification badges (3 BHK • 1,850 sq.ft • Semi-Furnished), and locality breadcrumb.

### 6. `MetricCard`
- **Purpose**: Visual KPI card for operational metrics.
- **Props**:
  ```typescript
  interface MetricCardProps {
    title: string;
    value: string | number;
    icon: string;
    trend?: { value: number; isPositive: boolean };
    accentColor?: string;
    onPress?: () => void;
  }
  ```
- **Behavior**: Display typography for value, 20px colored icon circle, and optional green/red percentage change badge.

### 7. `StatusBadge`
- **Purpose**: Semantic status pill for lead stages, property availability, and subscriptions.
- **Props**:
  ```typescript
  interface StatusBadgeProps {
    status: LeadStage | PropertyStatus | SubscriptionStatus | FollowUpStatus;
    size?: 'sm' | 'md';
  }
  ```
- **Behavior**: Resolves background tint and text color from the semantic status palette with 12px Medium typography.

### 8. `Button`
- **Purpose**: Core interactive call-to-action button.
- **Props**:
  ```typescript
  interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    disabled?: boolean;
    icon?: React.ReactNode;
    fullWidth?: boolean;
  }
  ```
- **Behavior**: Reanimated scale feedback on press (`withSpring(0.97)`), integrated ActivityIndicator on loading state.

### 9. `IconButton`
- **Purpose**: Compact circular or rounded-square button for icons.
- **Props**:
  ```typescript
  interface IconButtonProps {
    icon: React.ReactNode;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    accessibilityLabel: string;
  }
  ```
- **Behavior**: Enforces minimum 44 × 44 point tap target regardless of icon visual dimensions.

### 10. `Search`
- **Purpose**: Dedicated search input bar with debounce and clear triggers.
- **Props**:
  ```typescript
  interface SearchProps {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    onClear?: () => void;
  }
  ```
- **Behavior**: Includes magnifying glass icon, automatic clear button ('X') when input has text, and 300ms debounce support.

### 11. `Input`
- **Purpose**: Standard form input for text, numbers, phone, and passwords.
- **Props**:
  ```typescript
  interface InputProps {
    label?: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    error?: string;
    helperText?: string;
    secureTextEntry?: boolean;
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
  }
  ```
- **Behavior**: Highlighting border in `#059669` on focus, `#DC2626` on error. Password toggle icon for obscured text.

### 12. `Select`
- **Purpose**: Dropdown trigger opening a bottom-sheet selection picker.
- **Props**:
  ```typescript
  interface SelectOption { label: string; value: string; }
  interface SelectProps {
    label?: string;
    options: SelectOption[];
    selectedValue: string;
    onSelect: (value: string) => void;
    placeholder?: string;
  }
  ```
- **Behavior**: Triggers BottomSheet presenting radio options with instant selection feedback.

### 13. `BottomSheet`
- **Purpose**: Sliding modal drawer for actions, filters, and forms.
- **Props**:
  ```typescript
  interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    snapPoints?: string[];
  }
  ```
- **Behavior**: Reanimated slide-up animation from screen bottom, backdrop blur / dark scrim (`#00000080`), swipe-to-dismiss gesture.

### 14. `FilterSheet`
- **Purpose**: Specialized multi-criteria filter sheet for leads and inventory.
- **Props**:
  ```typescript
  interface FilterSectionConfig {
    id: string;
    title: string;
    type: 'chips' | 'range' | 'radio';
    options: Array<{ label: string; value: string }>;
  }
  interface FilterSheetProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (filters: Record<string, any>) => void;
    onReset: () => void;
    filterSections: FilterSectionConfig[];
  }
  ```
- **Behavior**: Sticky footer with "Reset Filters" and "Apply Filters (N)" CTA buttons.

### 15. `EmptyState`
- **Purpose**: User guidance when lists or queries return zero records.
- **Props**:
  ```typescript
  interface EmptyStateProps {
    title: string;
    description: string;
    icon?: string;
    actionLabel?: string;
    onAction?: () => void;
  }
  ```
- **Behavior**: Centered layout with themed vector icon, secondary description text, and primary creation action button.

### 16. `Skeleton`
- **Purpose**: Shimmering layout placeholder during asynchronous data loading.
- **Props**:
  ```typescript
  interface SkeletonProps {
    width?: number | string;
    height?: number | string;
    borderRadius?: number;
    className?: string;
  }
  ```
- **Behavior**: Repeating 0.4 -> 1.0 -> 0.4 opacity pulse animation via Reanimated, matching the exact dimensions of final content.

### 17. `Timeline`
- **Purpose**: Chronological activity feed for leads, follow-ups, and customer touchpoints.
- **Props**:
  ```typescript
  interface TimelineEvent {
    id: string;
    title: string;
    subtitle?: string;
    timestamp: string;
    icon?: string;
    status?: string;
  }
  interface TimelineProps {
    events: TimelineEvent[];
  }
  ```
- **Behavior**: Vertical connecting rule line (`#E2E8F0`), node markers colored by activity type, and formatted relative timestamps.

### 18. `WhatsAppComposer`
- **Purpose**: In-app message composer for WhatsApp threads with quick template insertion and AI replies.
- **Props**:
  ```typescript
  interface WhatsAppComposerProps {
    recipientPhone: string;
    onSend: (message: string, templateId?: string) => void;
    suggestedReplies?: string[];
    templates?: Array<{ id: string; name: string; preview: string }>;
  }
  ```
- **Behavior**: Auto-expanding text input, quick template carousel drawer, AI smart reply chips, and green send button.

### 19. `AIInsight`
- **Purpose**: Highlighting AI-extracted preferences, lead scoring rationales, or deal probabilities.
- **Props**:
  ```typescript
  interface AIInsightProps {
    title: string;
    insight: string;
    confidence?: number;
    recommendations?: string[];
    onApplyAction?: (action: string) => void;
  }
  ```
- **Behavior**: Purple/Emerald gradient border (`#7C3AED` to `#059669`), sparkle icon badge, and actionable recommendation pills.

### 20. `SubscriptionCard`
- **Purpose**: Display of current active plan, renewal date, and upgrade CTA.
- **Props**:
  ```typescript
  interface SubscriptionCardProps {
    planName: string;
    price: string;
    billingCycle: 'monthly' | 'yearly';
    status: SubscriptionStatus;
    renewalDate: string;
    isCurrentPlan: boolean;
    onUpgrade?: () => void;
  }
  ```
- **Behavior**: Displays plan tier badge, pricing in INR, renewal countdown, and "Manage Subscription" action.

### 21. `UsageProgress`
- **Purpose**: Visual quota progress bar tracking active consumption against plan limits.
- **Props**:
  ```typescript
  interface UsageProgressProps {
    label: string;
    used: number;
    limit: number;
    unit?: string;
    warningThreshold?: number;
  }
  ```
- **Behavior**: Calculates percentage. Shifts bar color from Emerald (`< 80%`) to Amber (`80% - 99%`) to Red (`>= 100%`). Handles unlimited plans (`limit = -1`) gracefully.

---

## 6. Reanimated Animation Specifications

Animations in BrokerIQ are strictly governed by performance and restraint, avoiding visual lag on budget Android devices.

### Timing & Physics Constants
- **Micro-Interactions (Button Press, Checkbox, Switch)**:
  - Duration: **150ms**
  - Easing: `Easing.out(Easing.ease)`
  - Spring Feedback: `withSpring(scale, { damping: 15, stiffness: 200 })`
- **Modal Transitions & Bottom Sheets**:
  - Duration: **250ms–300ms**
  - Easing: `Easing.bezier(0.25, 0.1, 0.25, 1)`
  - Backdrop Scrim Opacity: `0.0` -> `0.5`
- **Stage Change Pulse**:
  - Duration: **300ms** scale pulse (`1.0` -> `1.08` -> `1.0`) when lead stage shifts.

---

## 7. NativeWind Configuration Specification

The `apps/mobile/tailwind.config.js` configures theme extensions:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#10B981',
          500: '#059669',
          600: '#0D9488',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
          950: '#022C22',
        },
        surface: {
          bg: '#F8FAFC',
          card: '#FFFFFF',
          subtle: '#F1F5F9',
          border: '#E2E8F0',
        },
        broker: {
          teal: '#0F766E',
          emerald: '#059669',
          mint: '#D1FAE5',
          dark: '#0F172A',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      spacing: {
        '4.5': '18px',
      }
    },
  },
  plugins: [],
};
```
