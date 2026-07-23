"use client";

type Message = {
  id: number;
  conversation_id: number;
  sender_id: string;
  content: string;
  created_at: string;
  seen_at: string | null;
};

type Props = {
  messages: Message[];
  currentUserId: string;
};

export default function ChatMessages({
  messages,
  currentUserId,
}: Props) {
  const lastMessageSentByMeId =
    [...messages]
      .reverse()
      .find((message) => message.sender_id === currentUserId)?.id ?? null;

  return (
    <section className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4">
      {messages.length === 0 && (
        <p className="py-10 text-center text-gray-500">
          Nu există mesaje încă.
        </p>
      )}

      {messages.map((message) => {
        const mine = message.sender_id === currentUserId;

        const showSeen =
          mine &&
          message.id === lastMessageSentByMeId &&
          Boolean(message.seen_at);

        return (
          <div
            key={message.id}
            className={`flex ${mine ? "justify-end" : "justify-start"}`}
          >
            <div className="max-w-[75%]">
              <div
                className={`rounded-2xl px-4 py-2 ${
                  mine
                    ? "bg-emerald-600 text-white"
                    : "border bg-white text-gray-900"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">
                  {message.content}
                </p>

                <p
                  className={`mt-1 text-xs ${
                    mine ? "text-emerald-100" : "text-gray-400"
                  }`}
                >
                  {new Date(message.created_at).toLocaleTimeString("ro-RO", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              {showSeen && (
                <p className="mt-1 text-right text-xs text-lime-400">
                  ✓ Văzut
                </p>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}