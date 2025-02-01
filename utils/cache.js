import { Redis } from "@upstash/redis";

// Get the Upstash Redis URL and token from the environment variables (from Docker Compose)
const redisUrl = process.env.UPSTASH_REDIS_URL || '';
const redisToken = process.env.UPSTASH_REDIS_TOKEN || '';

// Create and configure the Upstash Redis client
export const redis = new Redis({
  url: redisUrl,
  token: redisToken,
});

// Example usage: Get a value from Redis

