import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')

  if (code) {
    const response = NextResponse.redirect(origin)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && user) {
      const role = user.user_metadata?.role
      const slug = user.user_metadata?.business_slug

      if (role === 'operator') {
        return NextResponse.redirect(`${origin}/operator`)
      } else if (role === 'owner' && slug) {
        return NextResponse.redirect(`${origin}/dashboard/${slug}`)
      }
    }
  }

  // Fallback — back to login
  return NextResponse.redirect(`${origin}/login`)
}
