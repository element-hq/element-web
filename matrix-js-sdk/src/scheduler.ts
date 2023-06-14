/*
Copyright 2015 - 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/**
 * This is an internal module which manages queuing, scheduling and retrying
 * of requests.
 */
import { logger } from "./logger";
import { MatrixEvent } from "./models/event";
import { EventType } from "./@types/event";
import { defer, IDeferred, removeElement } from "./utils";
import { ConnectionError, MatrixError } from "./http-api";
import { ISendEventResponse } from "./@types/requests";

const DEBUG = false; // set true to enable console logging.

interface IQueueEntry<T> {
    event: MatrixEvent;
    defer: IDeferred<T>;
    attempts: number;
}

/**
 * The function to invoke to process (send) events in the queue.
 * @param event - The event to send.
 * @returns Resolved/rejected depending on the outcome of the request.
 */
type ProcessFunction<T> = (event: MatrixEvent) => Promise<T>;

// eslint-disable-next-line camelcase
export class MatrixScheduler<T = ISendEventResponse> {
    /**
     * Retries events up to 4 times using exponential backoff. This produces wait
     * times of 2, 4, 8, and 16 seconds (30s total) after which we give up. If the
     * failure was due to a rate limited request, the time specified in the error is
     * waited before being retried.
     * @param attempts - Number of attempts that have been made, including the one that just failed (ie. starting at 1)
     * @see retryAlgorithm
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public static RETRY_BACKOFF_RATELIMIT(event: MatrixEvent | null, attempts: number, err: MatrixError): number {
        if (err.httpStatus === 400 || err.httpStatus === 403 || err.httpStatus === 401) {
            // client error; no amount of retrying with save you now.
            return -1;
        }
        if (err instanceof ConnectionError) {
            return -1;
        }

        // if event that we are trying to send is too large in any way then retrying won't help
        if (err.name === "M_TOO_LARGE") {
            return -1;
        }

        if (err.name === "M_LIMIT_EXCEEDED") {
            const waitTime = err.data.retry_after_ms;
            if (waitTime > 0) {
                return waitTime;
            }
        }
        if (attempts > 4) {
            return -1; // give up
        }
        return 1000 * Math.pow(2, attempts);
    }

    /**
     * Queues `m.room.message` events and lets other events continue
     * concurrently.
     * @see queueAlgorithm
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public static QUEUE_MESSAGES(event: MatrixEvent): string | null {
        // enqueue messages or events that associate with another event (redactions and relations)
        if (event.getType() === EventType.RoomMessage || event.hasAssociation()) {
            // put these events in the 'message' queue.
            return "message";
        }
        // allow all other events continue concurrently.
        return null;
    }

    // queueName: [{
    //  event: MatrixEvent,  // event to send
    //  defer: Deferred,  // defer to resolve/reject at the END of the retries
    //  attempts: Number  // number of times we've called processFn
    // }, ...]
    private readonly queues: Record<string, IQueueEntry<T>[]> = {};
    private activeQueues: string[] = [];
    private procFn: ProcessFunction<T> | null = null;

    /**
     * Construct a scheduler for Matrix. Requires
     * {@link MatrixScheduler#setProcessFunction} to be provided
     * with a way of processing events.
     * @param retryAlgorithm - Optional. The retry
     * algorithm to apply when determining when to try to send an event again.
     * Defaults to {@link MatrixScheduler.RETRY_BACKOFF_RATELIMIT}.
     * @param queueAlgorithm - Optional. The queuing
     * algorithm to apply when determining which events should be sent before the
     * given event. Defaults to {@link MatrixScheduler.QUEUE_MESSAGES}.
     */
    public constructor(
        /**
         * The retry algorithm to apply when retrying events. To stop retrying, return
         * `-1`. If this event was part of a queue, it will be removed from
         * the queue.
         * @param event - The event being retried.
         * @param attempts - The number of failed attempts. This will always be \>= 1.
         * @param err - The most recent error message received when trying
         * to send this event.
         * @returns The number of milliseconds to wait before trying again. If
         * this is 0, the request will be immediately retried. If this is
         * `-1`, the event will be marked as
         * {@link EventStatus.NOT_SENT} and will not be retried.
         */
        public readonly retryAlgorithm = MatrixScheduler.RETRY_BACKOFF_RATELIMIT,
        /**
         * The queuing algorithm to apply to events. This function must be idempotent as
         * it may be called multiple times with the same event. All queues created are
         * serviced in a FIFO manner. To send the event ASAP, return `null`
         * which will not put this event in a queue. Events that fail to send that form
         * part of a queue will be removed from the queue and the next event in the
         * queue will be sent.
         * @param event - The event to be sent.
         * @returns The name of the queue to put the event into. If a queue with
         * this name does not exist, it will be created. If this is `null`,
         * the event is not put into a queue and will be sent concurrently.
         */
        public readonly queueAlgorithm = MatrixScheduler.QUEUE_MESSAGES,
    ) {}

    /**
     * Retrieve a queue based on an event. The event provided does not need to be in
     * the queue.
     * @param event - An event to get the queue for.
     * @returns A shallow copy of events in the queue or null.
     * Modifying this array will not modify the list itself. Modifying events in
     * this array <i>will</i> modify the underlying event in the queue.
     * @see MatrixScheduler.removeEventFromQueue To remove an event from the queue.
     */
    public getQueueForEvent(event: MatrixEvent): MatrixEvent[] | null {
        const name = this.queueAlgorithm(event);
        if (!name || !this.queues[name]) {
            return null;
        }
        return this.queues[name].map(function (obj) {
            return obj.event;
        });
    }

    /**
     * Remove this event from the queue. The event is equal to another event if they
     * have the same ID returned from event.getId().
     * @param event - The event to remove.
     * @returns True if this event was removed.
     */
    public removeEventFromQueue(event: MatrixEvent): boolean {
        const name = this.queueAlgorithm(event);
        if (!name || !this.queues[name]) {
            return false;
        }
        let removed = false;
        removeElement(this.queues[name], (element) => {
            if (element.event.getId() === event.getId()) {
                // XXX we should probably reject the promise?
                // https://github.com/matrix-org/matrix-js-sdk/issues/496
                removed = true;
                return true;
            }
            return false;
        });
        return removed;
    }

    /**
     * Set the process function. Required for events in the queue to be processed.
     * If set after events have been added to the queue, this will immediately start
     * processing them.
     * @param fn - The function that can process events
     * in the queue.
     */
    public setProcessFunction(fn: ProcessFunction<T>): void {
        this.procFn = fn;
        this.startProcessingQueues();
    }

    /**
     * Queue an event if it is required and start processing queues.
     * @param event - The event that may be queued.
     * @returns A promise if the event was queued, which will be
     * resolved or rejected in due time, else null.
     */
    public queueEvent(event: MatrixEvent): Promise<T> | null {
        const queueName = this.queueAlgorithm(event);
        if (!queueName) {
            return null;
        }
        // add the event to the queue and make a deferred for it.
        if (!this.queues[queueName]) {
            this.queues[queueName] = [];
        }
        const deferred = defer<T>();
        this.queues[queueName].push({
            event: event,
            defer: deferred,
            attempts: 0,
        });
        debuglog("Queue algorithm dumped event %s into queue '%s'", event.getId(), queueName);
        this.startProcessingQueues();
        return deferred.promise;
    }

    private startProcessingQueues(): void {
        if (!this.procFn) return;
        // for each inactive queue with events in them
        Object.keys(this.queues)
            .filter((queueName) => {
                return this.activeQueues.indexOf(queueName) === -1 && this.queues[queueName].length > 0;
            })
            .forEach((queueName) => {
                // mark the queue as active
                this.activeQueues.push(queueName);
                // begin processing the head of the queue
                debuglog("Spinning up queue: '%s'", queueName);
                this.processQueue(queueName);
            });
    }

    private processQueue = (queueName: string): void => {
        // get head of queue
        const obj = this.peekNextEvent(queueName);
        if (!obj) {
            this.disableQueue(queueName);
            return;
        }
        debuglog("Queue '%s' has %s pending events", queueName, this.queues[queueName].length);
        // fire the process function and if it resolves, resolve the deferred. Else
        // invoke the retry algorithm.

        // First wait for a resolved promise, so the resolve handlers for
        // the deferred of the previously sent event can run.
        // This way enqueued relations/redactions to enqueued events can receive
        // the remove id of their target before being sent.
        Promise.resolve()
            .then(() => {
                return this.procFn!(obj.event);
            })
            .then(
                (res) => {
                    // remove this from the queue
                    this.removeNextEvent(queueName);
                    debuglog("Queue '%s' sent event %s", queueName, obj.event.getId());
                    obj.defer.resolve(res);
                    // keep processing
                    this.processQueue(queueName);
                },
                (err) => {
                    obj.attempts += 1;
                    // ask the retry algorithm when/if we should try again
                    const waitTimeMs = this.retryAlgorithm(obj.event, obj.attempts, err);
                    debuglog(
                        "retry(%s) err=%s event_id=%s waitTime=%s",
                        obj.attempts,
                        err,
                        obj.event.getId(),
                        waitTimeMs,
                    );
                    if (waitTimeMs === -1) {
                        // give up (you quitter!)
                        logger.info("Queue '%s' giving up on event %s", queueName, obj.event.getId());
                        // remove this from the queue
                        this.clearQueue(queueName, err);
                    } else {
                        setTimeout(this.processQueue, waitTimeMs, queueName);
                    }
                },
            );
    };

    private disableQueue(queueName: string): void {
        // queue is empty. Mark as inactive and stop recursing.
        const index = this.activeQueues.indexOf(queueName);
        if (index >= 0) {
            this.activeQueues.splice(index, 1);
        }
        logger.info("Stopping queue '%s' as it is now empty", queueName);
    }

    private clearQueue(queueName: string, err: unknown): void {
        logger.info("clearing queue '%s'", queueName);
        let obj: IQueueEntry<T> | undefined;
        while ((obj = this.removeNextEvent(queueName))) {
            obj.defer.reject(err);
        }
        this.disableQueue(queueName);
    }

    private peekNextEvent(queueName: string): IQueueEntry<T> | undefined {
        const queue = this.queues[queueName];
        if (!Array.isArray(queue)) {
            return undefined;
        }
        return queue[0];
    }

    private removeNextEvent(queueName: string): IQueueEntry<T> | undefined {
        const queue = this.queues[queueName];
        if (!Array.isArray(queue)) {
            return undefined;
        }
        return queue.shift();
    }
}

/* istanbul ignore next */
function debuglog(...args: any[]): void {
    if (DEBUG) {
        logger.log(...args);
    }
}
