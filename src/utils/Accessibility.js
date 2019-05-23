/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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
 * Automatically focuses the captured reference when receiving a non-null
 * object. Useful in scenarios where componentDidMount does not have a
 * useful reference to an element, but one needs to focus the element on
 * first render. Example usage: ref={focusCapturedRef}
 * @param {function} ref The React reference to focus on, if not null
 */
export function focusCapturedRef(ref) {
    if (ref) {
        ref.focus();
    }
}
