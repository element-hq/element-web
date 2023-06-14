// This file had a function whose name is all caps, which displeases eslint
/* eslint new-cap: "off" */

import { defer, IDeferred } from "../../src/utils";
import { MatrixError } from "../../src/http-api";
import { MatrixScheduler } from "../../src/scheduler";
import * as utils from "../test-utils/test-utils";
import { MatrixEvent } from "../../src";

jest.useFakeTimers();

describe("MatrixScheduler", function () {
    let scheduler: MatrixScheduler<Record<string, boolean>>;
    let retryFn: Function | null;
    let queueFn: ((event: MatrixEvent) => string | null) | null;
    let deferred: IDeferred<Record<string, boolean>>;
    const roomId = "!foo:bar";
    const eventA = utils.mkMessage({
        user: "@alice:bar",
        room: roomId,
        event: true,
    });
    const eventB = utils.mkMessage({
        user: "@alice:bar",
        room: roomId,
        event: true,
    });

    beforeEach(function () {
        scheduler = new MatrixScheduler(
            function (ev, attempts, err) {
                if (retryFn) {
                    return retryFn(ev, attempts, err);
                }
                return -1;
            },
            function (event) {
                if (queueFn) {
                    return queueFn(event);
                }
                return null;
            },
        );
        retryFn = null;
        queueFn = null;
        deferred = defer();
    });

    it("should process events in a queue in a FIFO manner", async function () {
        retryFn = function () {
            return 0;
        };
        queueFn = function () {
            return "one_big_queue";
        };
        const deferA = defer<Record<string, boolean>>();
        const deferB = defer<Record<string, boolean>>();
        let yieldedA = false;
        scheduler.setProcessFunction(function (event) {
            if (yieldedA) {
                // eslint-disable-next-line jest/no-conditional-expect
                expect(event).toEqual(eventB);
                return deferB.promise;
            } else {
                yieldedA = true;
                // eslint-disable-next-line jest/no-conditional-expect
                expect(event).toEqual(eventA);
                return deferA.promise;
            }
        });
        const abPromise = Promise.all([scheduler.queueEvent(eventA), scheduler.queueEvent(eventB)]);
        deferB.resolve({ b: true });
        deferA.resolve({ a: true });
        const [a, b] = await abPromise;
        expect(a!.a).toEqual(true);
        expect(b!.b).toEqual(true);
    });

    it("should invoke the retryFn on failure and wait the amount of time specified", async function () {
        const waitTimeMs = 1500;
        const retryDefer = defer();
        retryFn = function () {
            retryDefer.resolve();
            return waitTimeMs;
        };
        queueFn = function () {
            return "yep";
        };

        let procCount = 0;
        scheduler.setProcessFunction(function (ev) {
            procCount += 1;
            if (procCount === 1) {
                // eslint-disable-next-line jest/no-conditional-expect
                expect(ev).toEqual(eventA);
                return deferred.promise;
            } else if (procCount === 2) {
                // don't care about this deferred
                return new Promise(() => {});
            }
            expect(procCount).toBeLessThan(3);
            return new Promise(() => {});
        });

        scheduler.queueEvent(eventA);
        // as queueing doesn't start processing synchronously anymore (see commit bbdb5ac)
        // wait just long enough before it does
        await Promise.resolve();
        expect(procCount).toEqual(1);
        deferred.reject({});
        await retryDefer.promise;
        expect(procCount).toEqual(1);
        jest.advanceTimersByTime(waitTimeMs);
        await Promise.resolve();
        expect(procCount).toEqual(2);
    });

    it("should give up if the retryFn on failure returns -1", async function () {
        // Queue A & B.
        // Reject A and return -1 on retry.
        // Expect B to be tried next and the promise for A to be rejected.
        retryFn = function () {
            return -1;
        };
        queueFn = function () {
            return "yep";
        };

        const deferA = defer<Record<string, boolean>>();
        const deferB = defer<Record<string, boolean>>();
        let procCount = 0;
        scheduler.setProcessFunction(function (ev) {
            procCount += 1;
            if (procCount === 1) {
                // eslint-disable-next-line jest/no-conditional-expect
                expect(ev).toEqual(eventA);
                return deferA.promise;
            } else if (procCount === 2) {
                // eslint-disable-next-line jest/no-conditional-expect
                expect(ev).toEqual(eventB);
                return deferB.promise;
            }
            expect(procCount).toBeLessThan(3);
            return new Promise<Record<string, boolean>>(() => {});
        });

        const queuedA = scheduler.queueEvent(eventA);
        const queuedB = scheduler.queueEvent(eventB);
        await Promise.resolve();
        deferA.reject(new Error("Testerror"));
        // as queueing doesn't start processing synchronously anymore (see commit bbdb5ac)
        // wait just long enough before it does
        await expect(queuedA).rejects.toThrow("Testerror");
        await expect(queuedB).rejects.toThrow("Testerror");
        expect(procCount).toEqual(1);
    });

    it("should treat each queue separately", async () => {
        // Queue messages A B C D.
        // Bucket A&D into queue_A
        // Bucket B&C into queue_B
        // Expect to have processFn invoked for A&B.
        // Resolve A.
        // Expect to have processFn invoked for D.
        const eventC = utils.mkMessage({ user: "@a:bar", room: roomId, event: true });
        const eventD = utils.mkMessage({ user: "@b:bar", room: roomId, event: true });

        const buckets: Record<string, string> = {};
        buckets[eventA.getId()!] = "queue_A";
        buckets[eventD.getId()!] = "queue_A";
        buckets[eventB.getId()!] = "queue_B";
        buckets[eventC.getId()!] = "queue_B";

        retryFn = function () {
            return 0;
        };
        queueFn = function (event) {
            return buckets[event.getId()!];
        };

        const expectOrder = [eventA.getId(), eventB.getId(), eventD.getId()];
        const deferA = defer<Record<string, boolean>>();
        const allExpectedEventsSeenInOrderPromise = new Promise((resolve) => {
            scheduler.setProcessFunction(function (event) {
                const id = expectOrder.shift();
                expect(id).toEqual(event.getId());
                if (expectOrder.length === 0) {
                    resolve(null);
                }
                return id === eventA.getId() ? deferA.promise : deferred.promise;
            });
        });
        scheduler.queueEvent(eventA);
        scheduler.queueEvent(eventB);
        scheduler.queueEvent(eventC);
        scheduler.queueEvent(eventD);

        // wait a bit then resolve A and we should get D (not C) next.
        setTimeout(function () {
            deferA.resolve({});
        }, 1000);
        jest.advanceTimersByTime(1000);
        await allExpectedEventsSeenInOrderPromise;
    });

    describe("queueEvent", function () {
        it("should return null if the event shouldn't be queued", function () {
            queueFn = function () {
                return null;
            };
            expect(scheduler.queueEvent(eventA)).toEqual(null);
        });

        it("should return a Promise if the event is queued", function () {
            queueFn = function () {
                return "yep";
            };
            const prom = scheduler.queueEvent(eventA);
            expect(prom).toBeTruthy();
            expect(prom!.then).toBeTruthy();
        });
    });

    describe("getQueueForEvent", function () {
        it("should return null if the event doesn't map to a queue name", function () {
            queueFn = function () {
                return null;
            };
            expect(scheduler.getQueueForEvent(eventA)).toBe(null);
        });

        it("should return null if the mapped queue doesn't exist", function () {
            queueFn = function () {
                return "yep";
            };
            expect(scheduler.getQueueForEvent(eventA)).toBe(null);
        });

        it(
            "should return a list of events in the queue and modifications to" +
                " the list should not affect the underlying queue.",
            function () {
                queueFn = function () {
                    return "yep";
                };
                scheduler.queueEvent(eventA);
                scheduler.queueEvent(eventB);
                const queue = scheduler.getQueueForEvent(eventA);
                expect(queue).toHaveLength(2);
                expect(queue).toEqual([eventA, eventB]);
                // modify the queue
                const eventC = utils.mkMessage({ user: "@a:bar", room: roomId, event: true });
                queue!.push(eventC);
                const queueAgain = scheduler.getQueueForEvent(eventA);
                expect(queueAgain).toHaveLength(2);
            },
        );

        it(
            "should return a list of events in the queue and modifications to" +
                " an event in the queue should affect the underlying queue.",
            function () {
                queueFn = function () {
                    return "yep";
                };
                scheduler.queueEvent(eventA);
                scheduler.queueEvent(eventB);
                const queue = scheduler.getQueueForEvent(eventA)!;
                queue[1].event.content!.body = "foo";
                const queueAgain = scheduler.getQueueForEvent(eventA)!;
                expect(queueAgain[1].event.content?.body).toEqual("foo");
            },
        );
    });

    describe("removeEventFromQueue", function () {
        it("should return false if the event doesn't map to a queue name", function () {
            queueFn = function () {
                return null;
            };
            expect(scheduler.removeEventFromQueue(eventA)).toBe(false);
        });

        it("should return false if the event isn't in the queue", function () {
            queueFn = function () {
                return "yep";
            };
            expect(scheduler.removeEventFromQueue(eventA)).toBe(false);
        });

        it("should return true if the event was removed", function () {
            queueFn = function () {
                return "yep";
            };
            scheduler.queueEvent(eventA);
            expect(scheduler.removeEventFromQueue(eventA)).toBe(true);
        });
    });

    describe("setProcessFunction", function () {
        it("should call the processFn if there are queued events", async () => {
            queueFn = function () {
                return "yep";
            };
            let procCount = 0;
            scheduler.queueEvent(eventA);
            scheduler.setProcessFunction(function (ev) {
                procCount += 1;
                expect(ev).toEqual(eventA);
                return deferred.promise;
            });
            // as queueing doesn't start processing synchronously anymore (see commit bbdb5ac)
            // wait just long enough before it does
            await Promise.resolve();
            expect(procCount).toEqual(1);
        });

        it("should not call the processFn if there are no queued events", function () {
            queueFn = function () {
                return "yep";
            };
            let procCount = 0;
            scheduler.setProcessFunction(function (ev) {
                procCount += 1;
                return deferred.promise;
            });
            expect(procCount).toEqual(0);
        });
    });

    describe("QUEUE_MESSAGES", function () {
        it("should queue m.room.message events only", function () {
            expect(MatrixScheduler.QUEUE_MESSAGES(eventA)).toEqual("message");
            expect(
                MatrixScheduler.QUEUE_MESSAGES(
                    utils.mkMembership({
                        user: "@alice:bar",
                        room: roomId,
                        mship: "join",
                        event: true,
                    }),
                ),
            ).toEqual(null);
        });
    });

    describe("RETRY_BACKOFF_RATELIMIT", function () {
        it("should wait at least the time given on M_LIMIT_EXCEEDED", function () {
            const res = MatrixScheduler.RETRY_BACKOFF_RATELIMIT(
                eventA,
                1,
                new MatrixError({
                    errcode: "M_LIMIT_EXCEEDED",
                    retry_after_ms: 5000,
                }),
            );
            expect(res >= 500).toBe(true);
        });

        it("should give up after 5 attempts", function () {
            const res = MatrixScheduler.RETRY_BACKOFF_RATELIMIT(eventA, 5, new MatrixError({}));
            expect(res).toBe(-1);
        });

        it("should do exponential backoff", function () {
            const error = new MatrixError({});
            expect(MatrixScheduler.RETRY_BACKOFF_RATELIMIT(eventA, 1, error)).toEqual(2000);
            expect(MatrixScheduler.RETRY_BACKOFF_RATELIMIT(eventA, 2, error)).toEqual(4000);
            expect(MatrixScheduler.RETRY_BACKOFF_RATELIMIT(eventA, 3, error)).toEqual(8000);
            expect(MatrixScheduler.RETRY_BACKOFF_RATELIMIT(eventA, 4, error)).toEqual(16000);
        });
    });
});
