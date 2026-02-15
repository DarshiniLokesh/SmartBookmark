# 📚 Smart Library: AI-Powered Bookmark Manager

Your digital library, evolved. Smart Library isn't just a list of URLs; it's a personalized, intelligence-driven dashboard that learns your habits and adapts to your workflow.

---

## 🚀 The Vision
In a world of information overload, traditional bookmarking is dead. We created **Smart Library** to act as a second brain—a system that doesn't just store links, but intelligently surfaces what you need, exactly when you need it.

## 🛠️ Tech Stack
- **Framework**: Next.js (App Router)
- **Backend & Realtime**: [Supabase](https://supabase.com/) (Auth, PostgreSQL, Realtime)
- **Styling**: Tailwind CSS
- **Design System**: Custom Slate-based Premium Dashboard (Glassmorphism + Dark Mode)

## ✨ Key AI & Intelligence Features
- **Adaptive Recommendation Engine**: A "Next Best Action" card that analyzes your usage patterns (frequency + recency) to predict what you need next.
- **Real-Time Tab Synchronization**: Seamless data hydration across multiple tabs using Supabase Broadcast and the HTML5 Visibility API.
- **Deep Semantic Search**: A premium search experience featuring AI-inspired visual feedback and real-time category filtering.
- **Smart Title Extraction**: Intelligent URL parsing that auto-generates clean titles for a clutter-free library.
- **Dynamic Trending Logic**: Visual triggers (🔥) that highlight trending resources as they cross visit thresholds.

---

## 🧠 The Developer's Journey -  Struggles 
*A deep dive into the engineering challenges overcome during the build.*

### 1. The "AI-on-the-Edge" Challenge
**The Struggle:** Integrating recommendation logic without the overhead of a dedicated ML backend or heavy Python microservices.
**The Solution:** I engineered a client-side heuristic engine that calculates "relevance scores" by weighing visit frequency against time-decayed metadata. This achieves a low-latency, "intelligent" experience using only serverless architecture.

### 2. Solving the "Stale State" Problem
**The Struggle:** Keeping data consistent across multiple browser tabs is a common pain point in modern web apps. Users would add a bookmark in one tab, and the other would remain outdated.
**The Solution:** I implemented a dual-layer synchronization strategy:
- **Supabase Realtime**: For instant database-to-UI updates.
- **Visibility API Integration**: A custom hook that detects when a user switches back to the app tab, triggering a background "Silent Sync" to ensure the library is never stale.

### 3. Engineering for Resilience
**The Struggle:** During development, I faced several `PGRST204` schema cache errors when evolving the database.
**The Solution:** Instead of letting the app fail, I built a **Resilient Data Fetching Layer**. The application now intelligently detects if specific database columns (like tracking metrics) are unavailable and automatically falls back to a "Graceful Degradation" mode. This ensures 100% uptime for core bookmarking features regardless of background schema updates.




---

### 🛠️ Setup Instructions

1. **Clone & Install**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Create a `.env.local` with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   ```

3. **Database Setup**:
   Run the SQL provided in `supabase-schema.sql` in your Supabase SQL editor.

4. **Run Dev Server**:
   ```bash
   npm run dev
   ```

---

