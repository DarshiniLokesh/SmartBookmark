'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

type Bookmark = {
    id: string
    title: string
    url: string
    created_at: string
    visit_count?: number
    last_visited_at?: string
}

export default function Home() {
    const [user, setUser] = useState<User | null>(null)
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
    const [title, setTitle] = useState('')
    const [url, setUrl] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('All')
    const [isRefreshing, setIsRefreshing] = useState(false)

    const categories = ['All', ...Array.from(new Set(bookmarks.map(b => {
        if (b.url.includes('github') || b.url.includes('stack') || b.url.includes('api')) return 'Dev Tools';
        if (b.url.includes('google') || b.url.includes('docs')) return 'Productivity';
        if (b.url.includes('youtube') || b.url.includes('twitter') || b.url.includes('social')) return 'Entertainment';
        return 'General';
    })))]
    const [loading, setLoading] = useState(true)
    const [isDarkMode, setIsDarkMode] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const fetchBookmarks = useCallback(async () => {
        if (!user) return
        setIsRefreshing(true)
        try {
            const { data, error } = await supabase
                .from('bookmarks')
                .select('*')
                .order('visit_count', { ascending: false })
                .order('created_at', { ascending: false })

            if (error) {
                const { data: fallbackData } = await supabase
                    .from('bookmarks')
                    .select('*')
                    .order('created_at', { ascending: false })
                if (fallbackData) setBookmarks(fallbackData as Bookmark[])
            } else if (data) {
                setBookmarks(data as Bookmark[])
            }
        } catch (err) {
            console.error('Fetch failed', err)
        } finally {
            setIsRefreshing(false)
        }
    }, [user, supabase])

    useEffect(() => {
        // Get initial user
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user)
            setLoading(false)
        })

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
        })

        // Check for saved theme preference
        const savedTheme = localStorage.getItem('theme')
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            setIsDarkMode(true)
        }

        return () => subscription.unsubscribe()
    }, [supabase.auth])

    useEffect(() => {
        const handleRefresh = () => {
            if (document.visibilityState === 'visible') {
                fetchBookmarks()
            }
        }
        window.addEventListener('visibilitychange', handleRefresh)
        window.addEventListener('focus', fetchBookmarks)
        return () => {
            window.removeEventListener('visibilitychange', handleRefresh)
            window.removeEventListener('focus', fetchBookmarks)
        }
    }, [user, fetchBookmarks])

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark')
            localStorage.setItem('theme', 'dark')
        } else {
            document.documentElement.classList.remove('dark')
            localStorage.setItem('theme', 'light')
        }
    }, [isDarkMode])



    useEffect(() => {
        if (!user) return
        fetchBookmarks()

        const channel = supabase
            .channel('bookmarks-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'bookmarks',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setBookmarks((current) => [payload.new as Bookmark, ...current])
                    } else if (payload.eventType === 'DELETE') {
                        setBookmarks((current) =>
                            current.filter((bookmark) => bookmark.id !== payload.old.id)
                        )
                    } else if (payload.eventType === 'UPDATE') {
                        setBookmarks((current) => {
                            const updated = current.map((bookmark) =>
                                bookmark.id === payload.new.id ? (payload.new as Bookmark) : bookmark
                            );
                            return [...updated].sort((a, b) => (b.visit_count || 0) - (a.visit_count || 0) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                        })
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [user, supabase, fetchBookmarks])

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const handleAddBookmark = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title || !url || !user) return

        let finalTitle = title;
        if (title.length < 3) {
            try {
                finalTitle = new URL(url).hostname.replace('www.', '');
            } catch {
                finalTitle = title;
            }
        }

        const { error } = await supabase.from('bookmarks').insert([
            {
                title: finalTitle,
                url,
                user_id: user.id,
            },
        ])

        if (error) {
            console.error('Error adding bookmark:', error)
            alert('Failed to add bookmark: ' + error.message)
        } else {
            setTitle('')
            setUrl('')
            fetchBookmarks()
        }
    }

    const handleDeleteBookmark = async (id: string) => {
        const { error } = await supabase.from('bookmarks').delete().eq('id', id)
        if (!error) {
            setBookmarks(current => current.filter(b => b.id !== id))
        }
    }

    const handleBookmarkVisit = async (id: string, currentCount: number) => {
        const now = new Date().toISOString();

        setBookmarks(current => {
            const updated = current.map(b => b.id === id ? { ...b, visit_count: (b.visit_count || 0) + 1, last_visited_at: now } : b);
            return [...updated].sort((a, b) => {
                if ((b.visit_count || 0) !== (a.visit_count || 0)) {
                    return (b.visit_count || 0) - (a.visit_count || 0);
                }
                return new Date(b.last_visited_at || 0).getTime() - new Date(a.last_visited_at || 0).getTime();
            });
        });

        try {
            await supabase
                .from('bookmarks')
                .update({
                    visit_count: (currentCount || 0) + 1,
                    last_visited_at: now
                })
                .eq('id', id)
        } catch (e) {
            console.error('Update failed', e)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="animate-bounce text-6xl mb-4">📚</div>
                <div className="animate-pulse text-xl font-bold text-blue-600">Initializing Smart Library...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen transition-colors duration-500">
            <div className="container mx-auto px-4 py-12 max-w-4xl">
                {/* Header */}
                <div className="flex justify-between items-center mb-12">
                    <div>
                        <h1 className="text-5xl font-black tracking-tight mb-2 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            Smart Library
                        </h1>
                        <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${isRefreshing ? 'bg-blue-400 animate-spin' : 'bg-green-500 animate-pulse'}`}></div>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-bold">
                                {isRefreshing ? 'Syncing...' : `AI synced for ${user?.email}`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all active:scale-95"
                        >
                            {isDarkMode ? '🌞' : '🌙'}
                        </button>
                        <button
                            onClick={handleSignOut}
                            className="px-6 py-3 bg-red-500 text-white rounded-2xl font-black text-sm hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all active:scale-95"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>

                {/* Add Form */}
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl shadow-blue-500/5 border border-slate-100 dark:border-slate-800 mb-12">
                    <h2 className="text-xl font-bold mb-6">Add New Resource</h2>
                    <form onSubmit={handleAddBookmark} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Title (AI auto-generates if short)"
                            className="px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                        />
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://..."
                            className="px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                            required
                        />
                        <button type="submit" className="md:col-span-2 py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all">
                            Add to Smart Library
                        </button>
                    </form>
                </div>

                {/* UI Filters */}
                <div className="flex gap-2 mb-10 overflow-x-auto pb-4 scrollbar-hide">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-6 py-2.5 rounded-full text-sm font-black transition-all border shrink-0 ${selectedCategory === cat
                                ? 'bg-blue-600 text-white border-blue-500 shadow-xl shadow-blue-500/30 -translate-y-0.5'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-blue-300'
                                }`}
                        >
                            {cat === 'All' ? '⚡ All' : cat}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative mb-12">
                    <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                        <span className={`text-xl transition-all duration-500 ${searchQuery ? 'scale-125 translate-x-1' : ''}`}>
                            {searchQuery ? '✨' : '🔍'}
                        </span>
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="AI Semantic Search..."
                        className="w-full pl-16 pr-6 py-5 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-lg font-medium"
                    />
                </div>

                {/* AI Card */}
                {bookmarks.length > 0 && selectedCategory === 'All' && !searchQuery && (
                    <div className="mb-12 p-8 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
                        <div className="absolute -bottom-10 -right-10 p-8 transform rotate-12 opacity-10 group-hover:scale-125 transition-transform duration-1000">
                            <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        </div>
                        <div className="relative z-10">
                            <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest mb-6">Adaptive Engine</span>
                            <h3 className="text-3xl font-black mb-2">Next Best Action</h3>
                            <p className="text-blue-100/80 mb-8 max-w-sm text-lg leading-snug">
                                We suggest returning to <span className="text-white font-black underline decoration-blue-300">{(bookmarks[0]?.visit_count || 0) > (bookmarks[1]?.visit_count || 0) ? bookmarks[0].title : bookmarks[1]?.title || bookmarks[0].title}</span> based on your usage patterns.
                            </p>
                            <button
                                onClick={() => {
                                    const target = (bookmarks[0]?.visit_count || 0) > (bookmarks[1]?.visit_count || 0) ? bookmarks[0] : (bookmarks[1] || bookmarks[0]);
                                    handleBookmarkVisit(target.id, target.visit_count || 0);
                                    window.open(target.url, '_blank');
                                }}
                                className="px-10 py-4 bg-white text-blue-700 rounded-2xl font-black shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95 flex items-center gap-3"
                            >
                                Jump In <span className="text-xl">🚀</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* List */}
                <div className="space-y-6">
                    {bookmarks
                        .filter(b => {
                            const matchesSearch = b.title.toLowerCase().includes(searchQuery.toLowerCase()) || b.url.toLowerCase().includes(searchQuery.toLowerCase());
                            const cat = b.url.includes('github') ? 'Dev Tools' : b.url.includes('google') ? 'Productivity' : 'General';
                            const matchesCat = selectedCategory === 'All' || cat === selectedCategory;
                            return matchesSearch && matchesCat;
                        })
                        .map(b => (
                            <div key={b.id} className="group bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h4 className="text-xl font-black text-slate-800 dark:text-slate-100">{b.title}</h4>
                                        {b.visit_count! >= 5 && (
                                            <span className="bg-orange-500 text-[10px] text-white px-2 py-1 rounded-full font-black animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.4)]">🔥 TRENDING</span>
                                        )}
                                    </div>
                                    <a
                                        href={b.url}
                                        target="_blank"
                                        onClick={() => handleBookmarkVisit(b.id, b.visit_count || 0)}
                                        className="text-blue-500 hover:underline text-sm font-medium truncate block max-w-sm mb-4"
                                    >
                                        {b.url}
                                    </a>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2">
                                        Added {new Date(b.created_at).toLocaleDateString()} • {b.visit_count || 0} VISITS
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleDeleteBookmark(b.id)}
                                    className="p-4 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all opacity-0 group-hover:opacity-100"
                                >
                                    🗑️
                                </button>
                            </div>
                        ))}
                    {bookmarks.length === 0 && (
                        <div className="text-center py-20 bg-slate-100 dark:bg-slate-900/50 rounded-[3rem] border-4 border-dashed border-slate-200 dark:border-slate-800">
                            <p className="text-slate-400 font-black text-xl">Your Smart Library is Empty 📥</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
