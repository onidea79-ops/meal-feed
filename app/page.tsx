'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase, signInWithGoogle, signOut } from '@/lib/supabase'

const MEAL_COLORS: Record<string, string> = {
  breakfast: 'bg-emerald-100 text-emerald-800',
  lunch: 'bg-amber-100 text-amber-800',
  dinner: 'bg-purple-100 text-purple-800',
}

const T = {
  ko: {
    appName: '🍽️ 식단 피드', feed: '피드', upload: '올리기', logout: '로그아웃', login: '구글 로그인',
    all: '전체', breakfast: '아침', lunch: '점심', dinner: '저녁', mine: '내 피드', bookmarks: '북마크',
    latest: '최신순', likes: '좋아요순', calHigh: '칼로리 높은순', calLow: '칼로리 낮은순',
    mealType: '식사 종류', nickname: '닉네임', uploadPhoto: '사진을 클릭해서 올려주세요',
    analyzeBtn: '✨ AI로 분석하고 올리기', analyzing: '분석 중...',
    carbs: '탄수화물', protein: '단백질', fat: '지방',
    cheers: '응원 댓글', firstCheer: '첫 번째 응원을 남겨보세요!',
    commentPlaceholder: '응원 한마디...', send: '전송',
    loginToComment: '로그인 후 댓글을 남길 수 있어요',
    noPost: '아직 게시물이 없어요.', noPostSub: '로그인하고 첫 번째 식단을 올려보세요!',
  },
  en: {
    appName: '🍽️ Meal Feed', feed: 'Feed', upload: 'Upload', logout: 'Logout', login: 'Sign in with Google',
    all: 'All', breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', mine: 'My Feed', bookmarks: 'Bookmarks',
    latest: 'Latest', likes: 'Most Liked', calHigh: 'Highest Cal', calLow: 'Lowest Cal',
    mealType: 'Meal Type', nickname: 'Nickname', uploadPhoto: 'Click to upload a photo',
    analyzeBtn: '✨ Analyze with AI', analyzing: 'Analyzing...',
    carbs: 'Carbs', protein: 'Protein', fat: 'Fat',
    cheers: 'Comments', firstCheer: 'Be the first to comment!',
    commentPlaceholder: 'Write a comment...', send: 'Send',
    loginToComment: 'Please login to comment',
    noPost: 'No posts yet.', noPostSub: 'Login and share your first meal!',
  }
}

export default function Home() {
  const [tab, setTab] = useState<'feed' | 'upload'>('feed')
  const [posts, setPosts] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('latest')
  const [selectedMeal, setSelectedMeal] = useState('')
  const [nickname, setNickname] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<any>(null)
  const [comments, setComments] = useState<any[]>([])
  const [commentText, setCommentText] = useState('')
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [bookmarkIds, setBookmarkIds] = useState<Set<string>>(new Set())
  const [user, setUser] = useState<any>(null)
  const [lang, setLang] = useState<'ko' | 'en'>('ko')
  const fileRef = useRef<HTMLInputElement>(null)
  const t = T[lang]

  useEffect(() => {
    const browserLang = navigator.language.startsWith('ko') ? 'ko' : 'en'
    setLang(browserLang as 'ko' | 'en')
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) setNickname(user.user_metadata?.full_name || user.email || '')
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) setNickname(session.user.user_metadata?.full_name || session.user.email || '')
    })
  }, [])

  useEffect(() => { fetchPosts() }, [filter, sortBy])

  async function fetchPosts() {
    let query = supabase.from('posts').select('*')
    if (filter === 'mine' && user) query = query.eq('user_id', user.id)
    else if (filter === 'bookmarks' && user) {
      const { data: bms } = await supabase.from('bookmarks').select('post_id').eq('user_id', user.id)
      const ids = bms?.map(b => b.post_id) || []
      if (ids.length === 0) { setPosts([]); return }
      query = query.in('id', ids)
    }
    else if (filter !== 'all') query = query.eq('meal_type', filter)
    if (sortBy === 'latest') query = query.order('created_at', { ascending: false })
    else if (sortBy === 'likes') query = query.order('likes', { ascending: false })
    else if (sortBy === 'calories_high') query = query.order('calories', { ascending: false })
    else if (sortBy === 'calories_low') query = query.order('calories', { ascending: true })
    const { data } = await query
    setPosts(data || [])
  }

  function handleFile(file: File) {
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function handleSubmit() {
    if (!imageFile || !selectedMeal || !user) return
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('image', imageFile)
      formData.append('mealType', selectedMeal)
      formData.append('nickname', nickname || user.email || '익명')
      formData.append('userKey', user.id)
      formData.append('userLang', lang)
      const res = await fetch('/api/analyze', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      setTab('feed')
      setImageFile(null)
      setImagePreview('')
      setSelectedMeal('')
      fetchPosts()
    } catch (e) {
      alert(lang === 'ko' ? '오류가 발생했어요. 다시 시도해주세요.' : 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function toggleLike(postId: string) {
    if (!user) { alert(lang === 'ko' ? '좋아요는 로그인 후 가능해요!' : 'Please login to like!'); return }
    const post = posts.find(p => p.id === postId)
    if (!post) return
    if (likedIds.has(postId)) {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_key', user.id)
      const newLikes = Math.max(0, (post.likes || 1) - 1)
      await supabase.from('posts').update({ likes: newLikes }).eq('id', postId)
      setLikedIds(prev => { const s = new Set(prev); s.delete(postId); return s })
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: newLikes } : p))
    } else {
      await supabase.from('likes').insert({ post_id: postId, user_key: user.id })
      const newLikes = (post.likes || 0) + 1
      await supabase.from('posts').update({ likes: newLikes }).eq('id', postId)
      setLikedIds(prev => new Set([...prev, postId]))
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: newLikes } : p))
    }
  }

  async function toggleBookmark(postId: string) {
    if (!user) { alert(lang === 'ko' ? '북마크는 로그인 후 가능해요!' : 'Please login to bookmark!'); return }
    if (bookmarkIds.has(postId)) {
      await supabase.from('bookmarks').delete().eq('post_id', postId).eq('user_id', user.id)
      setBookmarkIds(prev => { const s = new Set(prev); s.delete(postId); return s })
    } else {
      await supabase.from('bookmarks').insert({ post_id: postId, user_id: user.id })
      setBookmarkIds(prev => new Set([...prev, postId]))
    }
  }

  async function fetchComments(postId: string) {
    const { data } = await supabase.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true })
    setComments(data || [])
  }

  async function submitComment() {
    if (!commentText.trim() || !user || !detail) return
    await supabase.from('comments').insert({
      post_id: detail.id,
      user_id: user.id,
      nickname: nickname || user.email || '익명',
      content: commentText.trim()
    })
    setCommentText('')
    fetchComments(detail.id)
  }

  async function deleteComment(commentId: string) {
    await supabase.from('comments').delete().eq('id', commentId)
    fetchComments(detail.id)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/" className="text-lg font-semibold hover:opacity-70 transition-opacity">{t.appName}</a>
          <div className="flex items-center gap-2">
            <button onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')} className="px-3 py-1.5 rounded-full text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer">
              {lang === 'ko' ? 'EN' : 'KO'}
            </button>
            {user ? (
              <>
                
                <button onClick={() => signOut()} className="px-3 py-1.5 rounded-full text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer">{t.logout}</button>
              </>
            ) : (
              <button onClick={() => signInWithGoogle()} className="px-4 py-1.5 rounded-full text-sm bg-black text-white hover:bg-gray-800 transition-colors cursor-pointer">{t.login}</button>
            )}
            
            {user && <a href="/stats" className="px-3 py-1.5 rounded-full text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer">통계</a>}
            <button onClick={() => setTab('feed')} className={`px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer ${tab === 'feed' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{t.feed}</button>
            {user && <button onClick={() => setTab('upload')} className={`px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer ${tab === 'upload' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{t.upload}</button>}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {tab === 'feed' && (
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex gap-2 flex-wrap">
                {['all', 'breakfast', 'lunch', 'dinner', 'mine', 'bookmarks'].map(f => (
                  <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-full text-sm border transition-colors cursor-pointer ${filter === f ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}>
                    {t[f as keyof typeof t]}
                  </button>
                ))}
              </div>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 outline-none bg-white text-gray-600">
                <option value="latest">{t.latest}</option>
                <option value="likes">{t.likes}</option>
                <option value="calories_high">{t.calHigh}</option>
                <option value="calories_low">{t.calLow}</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {posts.map(post => (
                <div key={post.id} onClick={() => { setDetail(post); fetchComments(post.id) }} className="bg-white rounded-2xl overflow-hidden border border-gray-100 cursor-pointer hover:border-gray-300 transition-all">
                  {post.image_url ? <img src={post.image_url} alt="식사" className="w-full aspect-square object-cover" /> : <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-4xl">🍽️</div>}
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MEAL_COLORS[post.meal_type]}`}>{t[post.meal_type as keyof typeof t]}</span>
                      <span className="text-xs text-gray-400">{new Date(post.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', { month: 'numeric', day: 'numeric' })}</span>
                    </div>
                    <div className="text-xl font-semibold">{post.calories}<span className="text-sm font-normal text-gray-500"> kcal</span></div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">{post.foods?.join(' · ')}</div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-400">{post.nickname}</span>
                      <div className="flex items-center gap-2">
                        <button onClick={e => { e.stopPropagation(); toggleLike(post.id) }} className={`flex items-center gap-1 text-xs transition-colors ${likedIds.has(post.id) ? 'text-pink-500' : 'text-gray-400 hover:text-pink-400'}`}>
                          ♥ {post.likes || 0}
                        </button>
                        <button onClick={e => { e.stopPropagation(); toggleBookmark(post.id) }} className={`text-xs transition-colors ${bookmarkIds.has(post.id) ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}>
                          🔖
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {posts.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                {t.noPost}<br/>{!user && t.noPostSub}
              </div>
            )}
          </div>
        )}

        {tab === 'upload' && user && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <p className="text-sm text-gray-500 mb-3">{t.mealType}</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[['breakfast', '☀️'], ['lunch', '🌤️'], ['dinner', '🌙']].map(([val, icon]) => (
                <button key={val} onClick={() => setSelectedMeal(val)} className={`py-3 rounded-xl border text-sm flex flex-col items-center gap-1 ${selectedMeal === val ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600'}`}>
                  <span className="text-xl">{icon}</span>{t[val as keyof typeof t]}
                </button>
              ))}
            </div>
            <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder={t.nickname} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-4 outline-none focus:border-gray-400" />
            {!imagePreview ? (
              <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-gray-300 mb-4">
                <div className="text-3xl mb-2">📷</div>
                <p className="text-sm text-gray-500">{t.uploadPhoto}</p>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>
            ) : (
              <div className="relative mb-4">
                <img src={imagePreview} alt="미리보기" className="w-full rounded-xl max-h-64 object-cover" />
                <button onClick={() => { setImageFile(null); setImagePreview('') }} className="absolute top-2 right-2 bg-white rounded-full w-7 h-7 flex items-center justify-center text-gray-600 border">✕</button>
              </div>
            )}
            <button onClick={handleSubmit} disabled={!imageFile || !selectedMeal || loading} className="w-full py-3 bg-black text-white rounded-xl text-sm font-medium disabled:opacity-40">
              {loading ? t.analyzing : t.analyzeBtn}
            </button>
          </div>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {detail.image_url && <img src={detail.image_url} alt="식사" className="w-full object-contain max-h-80" />}
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MEAL_COLORS[detail.meal_type]}`}>{t[detail.meal_type as keyof typeof t]}</span>
                <button onClick={() => setDetail(null)} className="text-gray-400 text-xl">✕</button>
              </div>
              <div className="text-3xl font-semibold mb-3">{detail.calories}<span className="text-base font-normal text-gray-500"> kcal</span></div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[[t.carbs, detail.carbs], [t.protein, detail.protein], [t.fat, detail.fat]].map(([label, val]) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <div className="text-base font-semibold">{val}g</div>
                    <div className="text-xs text-gray-500">{label}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1 mb-3">{detail.foods?.map((f: string) => <span key={f} className="text-xs bg-gray-100 px-2 py-1 rounded-full">{f}</span>)}</div>
              <p className="text-sm text-gray-600 leading-relaxed">{detail.description}</p>
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <span className="text-sm text-gray-400">{detail.nickname}</span>
                <button onClick={() => toggleLike(detail.id)} className={`flex items-center gap-1 text-sm ${likedIds.has(detail.id) ? 'text-pink-500' : 'text-gray-400'}`}>♥ {detail.likes || 0}</button>
                <button onClick={() => toggleBookmark(detail.id)} className={`flex items-center gap-1 text-sm ${bookmarkIds.has(detail.id) ? 'text-yellow-500' : 'text-gray-400'}`}>🔖 {bookmarkIds.has(detail.id) ? '저장됨' : '저장'}</button>
              </div>
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium text-gray-700 mb-3">{t.cheers}</p>
                <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                  {comments.length === 0 && <p className="text-xs text-gray-400 text-center py-2">{t.firstCheer}</p>}
                  {comments.map(c => (
                    <div key={c.id} className="flex items-start justify-between gap-2">
                      <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                        <span className={`text-xs font-medium ${c.user_id === detail.user_id ? 'text-red-400' : user && user.id === c.user_id ? 'text-blue-400' : 'text-gray-600'}`}>{c.nickname} </span>
                        <span className="text-xs text-gray-700">{c.content}</span>
                      </div>
                      {user && user.id === c.user_id && (
                        <button onClick={() => deleteComment(c.id)} className="text-gray-300 text-xs mt-1 hover:text-red-400">✕</button>
                      )}
                    </div>
                  ))}
                </div>
                {user ? (
                  <div className="flex gap-2">
                    <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitComment()} placeholder={t.commentPlaceholder} className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400" />
                    <button onClick={submitComment} className="px-4 py-2 bg-black text-white rounded-xl text-sm">{t.send}</button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center">{t.loginToComment}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}