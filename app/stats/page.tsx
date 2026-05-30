'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

export default function Stats() {
  const [user, setUser] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [period, setPeriod] = useState<'week' | 'month'>('week')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) fetchPosts(user.id)
    })
  }, [])

  async function fetchPosts(userId: string) {
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    setPosts(data || [])
  }

  function getChartData() {
    const days = period === 'week' ? 7 : 30
    const result = []
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const dayPosts = posts.filter(p => p.created_at.startsWith(dateStr))
      const totalCalories = dayPosts.reduce((sum, p) => sum + (p.calories || 0), 0)
      result.push({
        date: date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }),
        칼로리: totalCalories,
        단백질: dayPosts.reduce((sum, p) => sum + (p.protein || 0), 0),
        탄수화물: dayPosts.reduce((sum, p) => sum + (p.carbs || 0), 0),
        지방: dayPosts.reduce((sum, p) => sum + (p.fat || 0), 0),
      })
    }
    return result
  }

  const chartData = getChartData()
  const totalPosts = posts.length
  const avgCalories = posts.length > 0 ? Math.round(posts.reduce((sum, p) => sum + (p.calories || 0), 0) / posts.length) : 0
  const avgProtein = posts.length > 0 ? Math.round(posts.reduce((sum, p) => sum + (p.protein || 0), 0) / posts.length) : 0
  const maxCaloriePost = posts.reduce((max, p) => (p.calories > (max?.calories || 0) ? p : max), null)

  if (!user) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400">로그인 후 통계를 볼 수 있어요</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">📊 내 식단 통계</h1>
          <a href="/" className="px-3 py-1.5 rounded-full text-sm bg-gray-100 text-gray-600 hover:bg-gray-200">← 피드</a>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* 요약 카드 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '총 기록', value: `${totalPosts}회`, icon: '📝' },
            { label: '평균 칼로리', value: `${avgCalories}kcal`, icon: '🔥' },
            { label: '평균 단백질', value: `${avgProtein}g`, icon: '💪' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
              <div className="text-2xl mb-1">{icon}</div>
              <div className="text-lg font-semibold">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>

        {/* 기간 선택 */}
        <div className="flex gap-2">
          {[['week', '7일'], ['month', '30일']].map(([val, label]) => (
            <button key={val} onClick={() => setPeriod(val as 'week' | 'month')}
              className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${period === val ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* 칼로리 바 차트 */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">🔥 일별 칼로리</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="칼로리" fill="#000" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 영양소 라인 차트 */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">💊 일별 영양소</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="단백질" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="탄수화물" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="지방" stroke="#ef4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-3 justify-center">
            {[['단백질', '#3b82f6'], ['탄수화물', '#f59e0b'], ['지방', '#ef4444']].map(([label, color]) => (
              <div key={label} className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-gray-500">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 최고 칼로리 식사 */}
        {maxCaloriePost && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">🏆 최고 칼로리 식사</h2>
            <div className="flex gap-3 items-center">
              {maxCaloriePost.image_url && <img src={maxCaloriePost.image_url} className="w-16 h-16 rounded-xl object-cover" />}
              <div>
                <div className="text-xl font-semibold">{maxCaloriePost.calories} kcal</div>
                <div className="text-xs text-gray-500">{maxCaloriePost.foods?.join(' · ')}</div>
                <div className="text-xs text-gray-400 mt-1">{new Date(maxCaloriePost.created_at).toLocaleDateString('ko-KR')}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}