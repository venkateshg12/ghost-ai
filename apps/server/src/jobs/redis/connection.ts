import Redis from "ioredis";
import { getRedisConfig } from "../../config/redis";

export const redisConnection = new Redis(getRedisConfig());

redisConnection.on("connect", () => {
  console.log("Connected to redis successfully!");
});

redisConnection.on("error", (err) => {
  console.error("Redis connection error", err);
});
