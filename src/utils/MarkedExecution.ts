/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
 * A utility to ensure that a function is only called once triggered with
 * a mark applied. Multiple marks can be applied to the function, however
 * the function will only be called once upon trigger().
 *
 * The function starts unmarked.
 */
export class MarkedExecution {
    private marked = false;

    /**
     * Creates a MarkedExecution for the provided function.
     * @param fn The function to be called upon trigger if marked.
     */
    constructor(private fn: () => void) {
    }

    /**
     * Resets the mark without calling the function.
     */
    public reset() {
        this.marked = false;
    }

    /**
     * Marks the function to be called upon trigger().
     */
    public mark() {
        this.marked = true;
    }

    /**
     * If marked, the function will be called, otherwise this does nothing.
     */
    public trigger() {
        if (!this.marked) return;
        this.reset(); // reset first just in case the fn() causes a trigger()
        this.fn();
    }

    /**
     * Triggers the function if a mark() call would mark it. If the function
     * has already been marked this will do nothing.
     */
    public triggerIfWillMark() {
        if (!this.marked) {
            this.mark();
            this.trigger();
        }
    }
}
