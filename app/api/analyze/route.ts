import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('image') as File
    const mealType = formData.get('mealType') as string
    const nickname = formData.get('nickname') as string
    const userKey = formData.get('userKey') as string

    // 1일 1건 제한 체크
    const today = new Date().toISOString().split('T')[0]
    const { count } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userKey)
      .gte('created_at', `${today}T00:00:00`)

    if (count && count >= 1) {
      return NextResponse.json({ error: '오늘은 이미 1건 분석했어요. 내일 다시 시도해주세요!' }, { status: 429 })
    }

    // 이미지 Supabase 업로드
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const fileName = `${userKey}_${Date.now()}.jpg`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('meal-images')
      .upload(fileName, buffer, { contentType: file.type })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('meal-images')
      .getPublicUrl(fileName)

    // Anthropic 분석
    const base64 = buffer.toString('base64')
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: file.type as 'image/jpeg', data: base64 } },
          { type: 'text', text: '이 음식 사진을 분석해서 반드시 JSON만 응답하세요: {"total_calories":숫자,"protein":숫자,"carbs":숫자,"fat":숫자,"foods":["음식명"],"description":"2문장 한국어 평가"}' }
        ]
      }]
    })

    const text = response.content.map((c: any) => c.text || '').join('')
    const result = JSON.parse(text.replace(/```json|```/g, '').trim())

    // DB 저장
    const { data: post, error: dbError } = await supabase.from('posts').insert({
      user_id: userKey,
      nickname: nickname || '익명',
      meal_type: mealType,
      image_url: publicUrl,
      calories: Math.round(result.total_calories),
      protein: Math.round(result.protein),
      carbs: Math.round(result.carbs),
      fat: Math.round(result.fat),
      foods: result.foods,
      description: result.description,
    }).select().single()

    if (dbError) throw dbError

    return NextResponse.json({ success: true, post })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}