"use client";

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type ChatHeaderProps = {
  profile: Profile | null;
  isOnline: boolean;
  isTyping: boolean;
  onBack: () => void;
};

function getInitials(profile: Profile | null) {
  const value = profile?.full_name || profile?.username || "U";

  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function ChatHeader({
  profile,
  isOnline,
  isTyping,
  onBack,
}: ChatHeaderProps) {
  return (
    <header className="flex items-center gap-3 border-b p-4">
      <button
        type="button"
        onClick={onBack}
        className="rounded-lg border px-3 py-2"
        aria-label="Înapoi la conversații"
      >
        ←
      </button>

      <div className="relative">
        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-emerald-600 font-bold text-white">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            getInitials(profile)
          )}
        </div>

        <span
          className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white ${
            isOnline ? "bg-green-500" : "bg-gray-400"
          }`}
          aria-label={isOnline ? "Online" : "Offline"}
          title={isOnline ? "Online" : "Offline"}
        />
      </div>

      <div>
        <h1 className="font-bold text-gray-900">
          {profile?.full_name || profile?.username || "Conversație"}
        </h1>

        <p
          className={`text-sm ${
            isTyping
              ? "text-lime-400"
              : isOnline
                ? "text-green-600"
                : "text-gray-500"
          }`}
        >
          {isTyping ? "Scrie..." : isOnline ? "Online" : "Offline"}
        </p>
      </div>
    </header>
  );
}