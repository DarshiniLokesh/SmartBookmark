'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

type Bookmark = {
    id: string
    title: string
    url: string
    created_at: string
}

export default function Home() {
    const [user, setUser] = useState<User | null>(null)
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
    const [title, setTitle] = useState('')
    const [url, setUrl] = useState('')
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    const supabase = createClient()

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

        return () => subscription.unsubscribe()
    }, [supabase.auth])

    useEffect(() => {
        if (!user) return

        // Fetch bookmarks
        const fetchBookmarks = async () => {
            const { data } = await supabase
                .from('bookmarks')
                .select('*')
                .order('created_at', { ascending: false })

            if (data) setBookmarks(data)
        }

        fetchBookmarks()

        // Subscribe to realtime changes
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
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [user, supabase])

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const handleAddBookmark = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title || !url || !user) return

        const { error } = await supabase.from('bookmarks').insert([
            {
                title,
                url,
                user_id: user.id,
            },
        ])

        if (!error) {
            // Manually refetch bookmarks to update UI immediately
            const { data } = await supabase
                .from('bookmarks')
                .select('*')
                .order('created_at', { ascending: false })

            if (data) setBookmarks(data)

            setTitle('')
            setUrl('')
        }
    }

    const handleDeleteBookmark = async (id: string) => {
        const { error } = await supabase.from('bookmarks').delete().eq('id', id)

        if (!error) {
            // Manually refetch bookmarks to update UI immediately
            const { data } = await supabase
                .from('bookmarks')
                .select('*')
                .order('created_at', { ascending: false })

            if (data) setBookmarks(data)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-xl">Loading...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                            📚 Smart Bookmarks
                        </h1>
                        <p className="text-gray-600 dark:text-gray-300">
                            Welcome, {user?.email}
                        </p>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                        Sign Out
                    </button>
                </div>

                {/* Add Bookmark Form */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                        Add New Bookmark
                    </h2>
                    <form onSubmit={handleAddBookmark} className="space-y-4">
                        <div>
                            <label
                                htmlFor="title"
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                            >
                                Title
                            </label>
                            <input
                                type="text"
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                placeholder="My Awesome Website"
                                required
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="url"
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                            >
                                URL
                            </label>
                            <input
                                type="url"
                                id="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                placeholder="https://example.com"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                            Add Bookmark
                        </button>
                    </form>
                </div>

                {/* Bookmarks List */}
                <div className="space-y-4">
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                        Your Bookmarks ({bookmarks.length})
                    </h2>
                    {bookmarks.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
                            <p className="text-gray-500 dark:text-gray-400">
                                No bookmarks yet. Add your first one above!
                            </p>
                        </div>
                    ) : (
                        bookmarks.map((bookmark) => (
                            <div
                                key={bookmark.id}
                                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 flex items-start justify-between hover:shadow-xl transition-shadow"
                            >
                                <div className="flex-1">
                                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                        {bookmark.title}
                                    </h3>
                                    <a
                                        href={bookmark.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                                    >
                                        {bookmark.url}
                                    </a>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                        Added {new Date(bookmark.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleDeleteBookmark(bookmark.id)}
                                    className="ml-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex-shrink-0"
                                >
                                    Delete
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
