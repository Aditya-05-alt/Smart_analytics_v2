export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-100 px-4 py-12">
      {children}
    </div>
  );
}
