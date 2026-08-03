import { MessengerM3 } from "@/components/messenger-m3";

type MessagePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function MessagePage({
  params,
}: MessagePageProps) {
  const { id } = await params;

  return <MessengerM3 conversationId={id} />;
}