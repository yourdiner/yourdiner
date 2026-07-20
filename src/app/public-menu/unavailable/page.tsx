export default function MenuUnavailablePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#fcf9f8] px-6 py-16 text-center">
      <div className="w-full max-w-md rounded-2xl border border-black/[0.08] bg-white px-6 py-10 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)]">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Menu unavailable</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-500">
          This restaurant&apos;s subscription has expired. Please check back later.
        </p>
      </div>
    </div>
  );
}
