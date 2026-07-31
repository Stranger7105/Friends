export const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"] as const;

export type ReactionValue = (typeof REACTIONS)[number];

export type Profile = {
  id?: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export type Post = {
  id: number;
  content: string;
  user_id: string;
  image_path: string | null;
  shared_post_id: number | null;
  created_at: string;
  updated_at: string | null;
  profiles: Profile | null;
  shared_post: {
    id: number;
    content: string;
    user_id: string;
    image_path: string | null;
    created_at: string;
    profiles: Profile | null;
  } | null;
};

export type Reaction = {
  id: number;
  post_id: number;
  user_id: string;
  reaction: ReactionValue;
};

export type Comment = {
  id: number;
  post_id: number;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string | null;
  profiles: Profile | null;
};
