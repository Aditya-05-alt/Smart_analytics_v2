import Link from "next/link";
import { SignOutButton } from "./SignOutButton";

type Props = {
  title: string;
  email?: string | null;
  showBack?: boolean;
  backHref?: string;
};

export function AppHeader({
  title,
  email,
  showBack,
  backHref = "/dashboard",
}: Props) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 shadow-sm">
      <div className="flex items-center gap-3">
        {showBack ? (
          <Link
            href={backHref}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            aria-label="Back"
          >
            ←
          </Link>
        ) : null}
        <h1 className="text-sm font-semibold text-zinc-900 sm:text-base">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-3">
        {email ? (
          <span className="hidden max-w-[200px] truncate text-sm text-zinc-600 sm:inline">
            {email}
          </span>
        ) : null}
        <SignOutButton />
      </div>
    </header>
  );
}
