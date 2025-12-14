"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-700 text-white">
      <div className="text-center px-4">
        <h1 className="text-6xl font-bold mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-4">Project Not Found</h2>
        <p className="text-lg opacity-90 mb-8">
          The project you&apos;re looking for doesn&apos;t exist or is inactive.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/"
            className="px-6 py-3 bg-white text-orange-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
          >
            Go to Home
          </Link>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 font-semibold rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}



