# Smart Bookmark App - Architecture

This document explains the architecture and design decisions of the Smart Bookmark application.

## Overview

The Smart Bookmark app is a full-stack web application built with Next.js 14 (App Router) and Supabase. It demonstrates modern web development practices including:

- Server-side rendering (SSR)
- Client-side interactivity
- Real-time data synchronization
- Secure authentication
- Row-level security

## Technology Stack

### Frontend
- **Next.js 14**: React framework with App Router
- **React 18**: UI library
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework

### Backend
- **Supabase**: Backend-as-a-Service (BaaS)
  - PostgreSQL database
  - Authentication (Google OAuth)
  - Real-time subscriptions
  - Row Level Security (RLS)

## Architecture Layers

### 1. Presentation Layer (UI)

**Location**: `app/` directory

- **`app/page.tsx`**: Main bookmarks page (Client Component)
  - Displays bookmark list
  - Add bookmark form
  - Real-time updates
  - User authentication state

- **`app/login/page.tsx`**: Login page (Client Component)
  - Google OAuth sign-in button
  - Redirects to main page after authentication

- **`app/layout.tsx`**: Root layout (Server Component)
  - Global HTML structure
  - Metadata configuration
  - Global styles

- **`app/globals.css`**: Global styles
  - Tailwind directives
  - CSS custom properties
  - Dark mode support

### 2. Authentication Layer

**Location**: `app/auth/callback/route.ts`, `middleware.ts`

- **OAuth Callback Handler**: Exchanges OAuth code for session
- **Middleware**: Protects routes and refreshes sessions
- **Session Management**: Automatic cookie-based sessions

### 3. Data Access Layer

**Location**: `lib/supabase/`

- **`client.ts`**: Browser-side Supabase client
  - Used in Client Components
  - Handles real-time subscriptions
  - Manages client-side queries

- **`server.ts`**: Server-side Supabase client
  - Used in Server Components and API routes
  - Handles cookie-based authentication
  - Server-side data fetching

- **`middleware.ts`**: Middleware helper
  - Session refresh logic
  - Route protection
  - Cookie management

### 4. Database Layer

**Location**: Supabase (PostgreSQL)

- **`bookmarks` table**:
  - `id`: UUID (primary key)
  - `user_id`: UUID (foreign key to auth.users)
  - `title`: TEXT
  - `url`: TEXT
  - `created_at`: TIMESTAMP

- **Row Level Security (RLS)**:
  - Users can only see their own bookmarks
  - Users can only insert their own bookmarks
  - Users can only delete their own bookmarks

- **Real-time Publication**:
  - Bookmarks table is added to `supabase_realtime` publication
  - Enables real-time subscriptions

## Data Flow

### Authentication Flow

```
1. User clicks "Continue with Google"
   ↓
2. Supabase redirects to Google OAuth
   ↓
3. User authorizes the app
   ↓
4. Google redirects to /auth/callback with code
   ↓
5. Callback handler exchanges code for session
   ↓
6. Session stored in cookies
   ↓
7. User redirected to main page
```

### Add Bookmark Flow

```
1. User fills form and submits
   ↓
2. Client calls supabase.from('bookmarks').insert()
   ↓
3. Supabase validates user_id matches auth.uid() (RLS)
   ↓
4. Bookmark inserted into database
   ↓
5. Real-time event triggered
   ↓
6. All subscribed clients receive INSERT event
   ↓
7. UI updates automatically
```

### Delete Bookmark Flow

```
1. User clicks delete button
   ↓
2. Client calls supabase.from('bookmarks').delete()
   ↓
3. Supabase validates user owns bookmark (RLS)
   ↓
4. Bookmark deleted from database
   ↓
5. Real-time event triggered
   ↓
6. All subscribed clients receive DELETE event
   ↓
7. UI updates automatically
```

## Security

### Authentication
- Google OAuth 2.0 for secure sign-in
- No passwords stored in the database
- Session tokens stored in HTTP-only cookies

### Authorization
- Row Level Security (RLS) enforced at database level
- Users can only access their own data
- Policies checked on every query

### Data Protection
- HTTPS in production
- Environment variables for secrets
- CORS configured by Supabase

## Real-time Architecture

### Subscription Setup

```typescript
const channel = supabase
  .channel('bookmarks-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'bookmarks',
    filter: `user_id=eq.${user.id}`
  }, (payload) => {
    // Handle changes
  })
  .subscribe()
```

### How It Works

1. Client establishes WebSocket connection to Supabase
2. Subscribes to changes on `bookmarks` table
3. Filter ensures only user's bookmarks are received
4. When database changes, Supabase sends event via WebSocket
5. Client updates UI optimistically

## State Management

### Client State
- React `useState` for local UI state
- Supabase real-time for shared state
- No additional state management library needed

### Server State
- Supabase handles all server state
- Automatic synchronization via real-time
- Optimistic updates for better UX

## Performance Considerations

### Optimizations
- Server Components for static content
- Client Components only where needed
- Real-time subscriptions instead of polling
- Indexed database queries
- Tailwind CSS for minimal CSS bundle

### Scalability
- Supabase handles database scaling
- Next.js can be deployed to edge
- Real-time connections managed by Supabase
- RLS policies prevent data leaks

## File Structure

```
SmartBookmark/
├── app/                      # Next.js App Router
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts      # OAuth callback
│   ├── login/
│   │   └── page.tsx          # Login page
│   ├── globals.css           # Global styles
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Main page
├── lib/
│   └── supabase/             # Supabase clients
│       ├── client.ts         # Browser client
│       ├── server.ts         # Server client
│       └── middleware.ts     # Auth middleware
├── middleware.ts             # Next.js middleware
├── .env.local.example        # Environment template
├── .gitignore                # Git ignore rules
├── next.config.mjs           # Next.js config
├── package.json              # Dependencies
├── postcss.config.js         # PostCSS config
├── supabase-schema.sql       # Database schema
├── tailwind.config.ts        # Tailwind config
└── tsconfig.json             # TypeScript config
```

## Design Patterns

### Separation of Concerns
- UI components separate from data logic
- Server and client code clearly separated
- Authentication handled by middleware

### Dependency Injection
- Supabase clients created via factory functions
- Easy to test and mock

### Real-time First
- UI updates automatically
- No manual refresh needed
- Optimistic updates for better UX

## Future Enhancements

Potential improvements:
- Add bookmark tags/categories
- Search and filter functionality
- Bookmark sharing
- Import/export bookmarks
- Browser extension
- Bookmark screenshots/previews
- Folders/collections
- Collaborative bookmarks
