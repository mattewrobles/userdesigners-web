import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    category: z.string().optional(),
    author: z.string().optional().default("UserDesigners"),
    tags: z.array(z.string()).optional().default([]),
    heroImage: z.string().optional(),
    ogImage: z.string().optional(),
    date: z.string(),
    updatedDate: z.string().optional(),
    readTime: z.string().optional(),
  }),
});

export const collections = { blog };