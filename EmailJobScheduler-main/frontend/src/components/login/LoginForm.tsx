"use client";

import { signIn } from "next-auth/react";
import { GoogleIcon } from "@/components/icons";

export function LoginForm() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Login</h1>

        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-emerald-100"
        >
          <GoogleIcon className="h-5 w-5" />
          Login with Google
        </button>

        <div className="mt-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">or sign up through email</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <form className="mt-6 space-y-3">
          <input
            type="email"
            placeholder="Email ID"
            className="w-full rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
          />

          <button
            type="button"
            className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
          >
            Login
          </button>
        </form>
      </div>
    </main>
  );
}
