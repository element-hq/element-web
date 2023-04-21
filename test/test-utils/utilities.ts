/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import EventEmitter from "events";

import { ActionPayload } from "../../src/dispatcher/payloads";
import defaultDispatcher from "../../src/dispatcher/dispatcher";
import { DispatcherAction } from "../../src/dispatcher/actions";
import Modal from "../../src/Modal";

export const emitPromise = (e: EventEmitter, k: string | symbol) => new Promise((r) => e.once(k, r));

/**
 * Waits for a certain payload to be dispatched.
 * @param waitForAction The action string to wait for or the callback which is invoked for every dispatch. If this returns true, stops waiting.
 * @param timeout The max time to wait before giving up and stop waiting. If 0, no timeout.
 * @param dispatcher The dispatcher to listen on.
 * @returns A promise which resolves when the callback returns true. Resolves with the payload that made it stop waiting.
 * Rejects when the timeout is reached.
 */
export function untilDispatch(
    waitForAction: DispatcherAction | ((payload: ActionPayload) => boolean),
    dispatcher = defaultDispatcher,
    timeout = 1000,
): Promise<ActionPayload> {
    const callerLine = new Error().stack!.toString().split("\n")[2];
    if (typeof waitForAction === "string") {
        const action = waitForAction;
        waitForAction = (payload) => {
            return payload.action === action;
        };
    }
    const callback = waitForAction as (payload: ActionPayload) => boolean;
    return new Promise((resolve, reject) => {
        let fulfilled = false;
        let timeoutId: number;
        // set a timeout handler if needed
        if (timeout > 0) {
            timeoutId = window.setTimeout(() => {
                if (!fulfilled) {
                    reject(new Error(`untilDispatch: timed out at ${callerLine}`));
                    fulfilled = true;
                }
            }, timeout);
        }
        // listen for dispatches
        const token = dispatcher.register((p: ActionPayload) => {
            const finishWaiting = callback(p);
            if (finishWaiting || fulfilled) {
                // wait until we're told or we timeout
                // if we haven't timed out, resolve now with the payload.
                if (!fulfilled) {
                    resolve(p);
                    fulfilled = true;
                }
                // cleanup
                dispatcher.unregister(token);
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
            }
        });
    });
}

/**
 * Waits for a certain event to be emitted.
 * @param emitter The EventEmitter to listen on.
 * @param eventName The event string to wait for.
 * @param check Optional function which is invoked when the event fires. If this returns true, stops waiting.
 * @param timeout The max time to wait before giving up and stop waiting. If 0, no timeout.
 * @returns A promise which resolves when the callback returns true or when the event is emitted if
 * no callback is provided. Rejects when the timeout is reached.
 */
export function untilEmission(
    emitter: EventEmitter,
    eventName: string,
    check?: (...args: any[]) => boolean,
    timeout = 1000,
): Promise<void> {
    const callerLine = new Error().stack!.toString().split("\n")[2];
    return new Promise((resolve, reject) => {
        let fulfilled = false;
        let timeoutId: number;
        // set a timeout handler if needed
        if (timeout > 0) {
            timeoutId = window.setTimeout(() => {
                if (!fulfilled) {
                    reject(new Error(`untilEmission: timed out at ${callerLine}`));
                    fulfilled = true;
                }
            }, timeout);
        }
        const callback = (...args: any[]) => {
            // if they supplied a check function, call it now. Bail if it returns false.
            if (check) {
                if (!check(...args)) {
                    return;
                }
            }
            // we didn't time out, resolve. Otherwise, we already rejected so don't resolve now.
            if (!fulfilled) {
                resolve();
                fulfilled = true;
            }
            // cleanup
            emitter.off(eventName, callback);
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
        // listen for emissions
        emitter.on(eventName, callback);
    });
}

export const flushPromises = async () => await new Promise<void>((resolve) => window.setTimeout(resolve));

// with jest's modern fake timers process.nextTick is also mocked,
// flushing promises in the normal way then waits for some advancement
// of the fake timers
// https://gist.github.com/apieceofbart/e6dea8d884d29cf88cdb54ef14ddbcc4?permalink_comment_id=4018174#gistcomment-4018174
export const flushPromisesWithFakeTimers = async (): Promise<void> => {
    const promise = new Promise((resolve) => process.nextTick(resolve));
    jest.advanceTimersByTime(1);
    await promise;
};

/**
 * Call fn before calling componentDidUpdate on a react component instance, inst.
 * @param {React.Component} inst an instance of a React component.
 * @param {number} updates Number of updates to wait for. (Defaults to 1.)
 * @returns {Promise} promise that resolves when componentDidUpdate is called on
 *                    given component instance.
 */
export function waitForUpdate(inst: React.Component, updates = 1): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const cdu = inst.componentDidUpdate;

        console.log(`Waiting for ${updates} update(s)`);

        inst.componentDidUpdate = (prevProps, prevState, snapshot) => {
            updates--;
            console.log(`Got update, ${updates} remaining`);

            if (updates == 0) {
                inst.componentDidUpdate = cdu;
                resolve();
            }

            if (cdu) cdu(prevProps, prevState, snapshot);
        };
    });
}

/**
 * Advance jests fake timers and Date.now mock by ms
 * Useful for testing code using timeouts or intervals
 * that also checks timestamps
 */
export const advanceDateAndTime = (ms: number) => {
    jest.spyOn(global.Date, "now").mockReturnValue(Date.now() + ms);
    jest.advanceTimersByTime(ms);
};

/**
 * A horrible hack necessary to wait enough time to ensure any modal is shown after a
 * `Modal.createDialog(...)` call. We have to contend with the Modal code which renders
 * things asyncronhously and has weird sleeps which we should strive to remove.
 */
export const waitEnoughCyclesForModal = async ({
    useFakeTimers = false,
}: {
    useFakeTimers?: boolean;
} = {}): Promise<void> => {
    // XXX: Maybe in the future with Jest 29.5.0+, we could use `runAllTimersAsync` instead.
    const flushFunc = useFakeTimers ? flushPromisesWithFakeTimers : flushPromises;

    await flushFunc();
    await flushFunc();
    await flushFunc();
};

/**
 * A horrible hack necessary to make sure modals don't leak and pollute tests.
 * `@testing-library/react` automatic cleanup function does not pick up the async modal
 * rendering and the modals don't unmount when the component unmounts. We should strive
 * to fix this.
 */
export const clearAllModals = async (): Promise<void> => {
    // Prevent modals from leaking and polluting other tests
    let keepClosingModals = true;
    while (keepClosingModals) {
        keepClosingModals = Modal.closeCurrentModal("End of test (clean-up)");

        // Then wait for the screen to update (probably React rerender and async/await).
        // Important for tests using Jest fake timers to not get into an infinite loop
        // of removing the same modal because the promises don't flush otherwise.
        //
        // XXX: Maybe in the future with Jest 29.5.0+, we could use `runAllTimersAsync` instead.

        // this is called in some places where timers are not faked
        // which causes a lot of noise in the console
        // to make a hack even hackier check if timers are faked using a weird trick from github
        // then call the appropriate promise flusher
        // https://github.com/facebook/jest/issues/10555#issuecomment-1136466942
        const jestTimersFaked = setTimeout.name === "setTimeout";
        if (jestTimersFaked) {
            await flushPromisesWithFakeTimers();
        } else {
            await flushPromises();
        }
    }
};
