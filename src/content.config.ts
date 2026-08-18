import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: ["**/*.md", "!_*.md"], base: "./src/content/blog" }),
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
    // Campos para blogs de alto valor
    takeaways: z.array(z.string()).optional().default([]),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).optional().default([]),
    relatedPosts: z.array(z.string()).optional().default([]),
  }),
});

export const collections = { blog };