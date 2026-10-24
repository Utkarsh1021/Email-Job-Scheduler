export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] px-4">
      <div className="w-[380px] rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
        <h1 className="text-center text-xl font-bold tracking-tight text-gray-900">
          Login
        </h1>

        <a
          href="/auth/google"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 py-2.5 px-4 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
        >
          <GoogleIcon />
          <span>Login with Google</span>
        </a>

        <div className="relative my-6 text-center text-xs text-gray-400">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100" />
          </div>
          <span className="relative bg-white px-2">or sign up through email</span>
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="space-y-3">
          <div>
            <input
              type="email"
              placeholder="Email ID"
              className="w-full rounded-lg border border-gray-100 bg-gray-50/70 px-3.5 py-2.5 text-xs text-gray-800 outline-none transition focus:border-emerald-500 focus:bg-white"
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              className="w-full rounded-lg border border-gray-100 bg-gray-50/70 px-3.5 py-2.5 text-xs text-gray-800 outline-none transition focus:border-emerald-500 focus:bg-white"
            />
          </div>

          <a
            href="/auth/google"
            className="mt-2 block w-full rounded-lg bg-[#009A49] py-2.5 text-center text-xs font-semibold text-white shadow-sm transition hover:bg-[#00833e]"
          >
            Login
          </a>
        </form>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.7 7.1l6.3 5.3C38.2 37.3 44 32 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
