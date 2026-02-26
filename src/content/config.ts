import { defineCollection, z } from "astro:content";
import { DEFAULT_TOPIC_SLUG, TOPIC_IDS } from "../config/topics";

const posts = defineCollection({
  type: "content",
  schema: z.object({
    // Core
    title: z.string(),
    description: z.string().default(""),
    pubDate: z.coerce.date(),
    postedAt: z.string().optional(),
    postedTimezone: z.string().optional(),

    // Cover image (usually in /public/photos/<photoDir>/cover.jpg or cover.png)
    cover: z.string(),

    // Drop your images in /public/photos/<photoDir>/01.jpg .. N
    photoDir: z.string(),
    photoCount: z.coerce.number().int().nonnegative().default(0),
    pinned: z.boolean().optional(),
    pinnedPriority: z.coerce.number().int().nonnegative().optional(),
    pinnedUntil: z.string().optional(),
    pinnedStyle: z.string().optional(),

    // Topic / category (for your top navigation)
    topic: z.enum(TOPIC_IDS).default(DEFAULT_TOPIC_SLUG),

    // Minimal meta (shown as separate cards)
    author: z.string().default(""),
    location: z.string().default(""),
    eventTime: z.string().default(""),
    writtenAt: z.string().default(""),
    photoTime: z.string().default(""),

    // Tags + draft
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),

    // Optional short “side note” card (separate from the main text)
    sideNote: z.string().optional(),

    // Optional media
    voiceMemo: z.string().optional(),
    voiceMemoTitle: z.string().optional(),
    videoUrl: z.string().optional(),
    videoPoster: z.string().optional(),
  }),
});

export const collections = { posts };
