import { Queue } from "bullmq";
import { QUEUE_NAMES } from "../../constants/queue";
import { redisConnection } from "../redis/connection";


/*  this file is about creating a BullMQ Queue object that represents the queue 
    named "email-queue"and is ready to interact with Redis.
 */

    
export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: 'exponential',
            delay: 3000,
        },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
    },
});