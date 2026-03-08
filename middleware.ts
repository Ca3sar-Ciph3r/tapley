import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // DEV BYPASS — remove before going live
  if (process.env.NODE_ENV === 'development') return NextResponse.next()

  // Public routes — no auth required
  const publicPaths = ['/tap', '/register', '/status', '/redeem', '/staff', '/login', '/auth/callback', '/api/tap', '/api/register', '/api/redeem', '/api/confirm']
  const isPublic = publicPaths.some((p) => pathname.startsWith(p))
  if (isPublic) return NextResponse.next()

  // Build a response to pass cookies through
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Not logged in — redirect to login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const role = user.user_metadata?.role as string | undefined

  // /dashboard/* — must be owner
  if (pathname.startsWith('/dashboard')) {
    if (role !== 'owner') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // /operator/* — must be operator
  if (pathname.startsWith('/operator')) {
    if (role !== 'operator') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
