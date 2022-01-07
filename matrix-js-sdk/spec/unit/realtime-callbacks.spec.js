import * as callbacks from "../../src/realtime-callbacks";

let wallTime = 1234567890;
jest.useFakeTimers();

describe("realtime-callbacks", function() {
    function tick(millis) {
        wallTime += millis;
        jest.advanceTimersByTime(millis);
    }

    beforeEach(function() {
        callbacks.setNow(() => wallTime);
    });

    afterEach(function() {
        callbacks.setNow();
    });

    describe("setTimeout", function() {
        it("should call the callback after the timeout", function() {
            const callback = jest.fn();
            callbacks.setTimeout(callback, 100);

            expect(callback).not.toHaveBeenCalled();
            tick(100);
            expect(callback).toHaveBeenCalled();
        });

        it("should default to a zero timeout", function() {
            const callback = jest.fn();
            callbacks.setTimeout(callback);

            expect(callback).not.toHaveBeenCalled();
            tick(0);
            expect(callback).toHaveBeenCalled();
        });

        it("should pass any parameters to the callback", function() {
            const callback = jest.fn();
            callbacks.setTimeout(callback, 0, "a", "b", "c");
            tick(0);
            expect(callback).toHaveBeenCalledWith("a", "b", "c");
        });

        it("should set 'this' to the global object", function() {
            let passed = false;
            const callback = function() {
                expect(this).toBe(global); // eslint-disable-line @babel/no-invalid-this
                expect(this.console).toBeTruthy(); // eslint-disable-line @babel/no-invalid-this
                passed = true;
            };
            callbacks.setTimeout(callback);
            tick(0);
            expect(passed).toBe(true);
        });

        it("should handle timeouts of several seconds", function() {
            const callback = jest.fn();
            callbacks.setTimeout(callback, 2000);

            expect(callback).not.toHaveBeenCalled();
            for (let i = 0; i < 4; i++) {
                tick(500);
            }
            expect(callback).toHaveBeenCalled();
        });

        it("should call multiple callbacks in the right order", function() {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            const callback3 = jest.fn();
            callbacks.setTimeout(callback2, 200);
            callbacks.setTimeout(callback1, 100);
            callbacks.setTimeout(callback3, 300);

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();
            expect(callback3).not.toHaveBeenCalled();
            tick(100);
            expect(callback1).toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();
            expect(callback3).not.toHaveBeenCalled();
            tick(100);
            expect(callback1).toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled();
            expect(callback3).not.toHaveBeenCalled();
            tick(100);
            expect(callback1).toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled();
            expect(callback3).toHaveBeenCalled();
        });

        it("should treat -ve timeouts the same as a zero timeout", function() {
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            // check that cb1 is called before cb2
            callback1.mockImplementation(function() {
                expect(callback2).not.toHaveBeenCalled();
            });

            callbacks.setTimeout(callback1);
            callbacks.setTimeout(callback2, -100);

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();
            tick(0);
            expect(callback1).toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled();
        });

        it("should not get confused by chained calls", function() {
            const callback2 = jest.fn();
            const callback1 = jest.fn(function() {
                callbacks.setTimeout(callback2, 0);
                expect(callback2).not.toHaveBeenCalled();
            });

            callbacks.setTimeout(callback1);
            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();
            tick(0);
            expect(callback1).toHaveBeenCalled();
            // the fake timer won't actually run callbacks registered during
            // one tick until the next tick.
            tick(1);
            expect(callback2).toHaveBeenCalled();
        });

        it("should be immune to exceptions", function() {
            const callback1 = jest.fn(function() {
                throw new Error("prepare to die");
            });
            const callback2 = jest.fn();
            callbacks.setTimeout(callback1, 0);
            callbacks.setTimeout(callback2, 0);

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();
            tick(0);
            expect(callback1).toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled();
        });
    });

    describe("cancelTimeout", function() {
        it("should cancel a pending timeout", function() {
            const callback = jest.fn();
            const k = callbacks.setTimeout(callback);
            callbacks.clearTimeout(k);
            tick(0);
            expect(callback).not.toHaveBeenCalled();
        });

        it("should not affect sooner timeouts", function() {
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            callbacks.setTimeout(callback1, 100);
            const k = callbacks.setTimeout(callback2, 200);
            callbacks.clearTimeout(k);

            tick(100);
            expect(callback1).toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();

            tick(150);
            expect(callback2).not.toHaveBeenCalled();
        });
    });
});
