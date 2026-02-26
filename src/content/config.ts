import { defineCollection, z } from "astro:content";

// Optional: keep your topic IDs consistent.
// If you later add src/config/topics.ts exporting TOPIC_IDS,
// you can replace `z.string()` with `z.enum(TOPIC_IDS)`
// import { TOPIC_IDS } from "../config/topics";

const posts = defineCollection({
  type: "content",
  schema: z.object({
    // Core
    title: z.string(),
    description: z.string().default(""),
    pubDate: z.coerce.date(),

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
    // If you use a fixed topic system, swap to: z.enum(TOPIC_IDS)
    topic: z.string().default("two-of-us"),

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
