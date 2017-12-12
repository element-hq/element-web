/*
Copyright 2017 Vector Creations Ltd

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

import dis from '../dispatcher';

/**
 * Create an action creator that will dispatch actions asynchronously that
 * indicate the current status of promise returned by the given function, fn.
 * @param {string} id the id to give the dispatched actions. This is given a
 *                   suffix determining whether it is pending, successful or
 *                   a failure.
 * @param {function} fn the function to call with arguments given to the
 *                   returned function. This function should return a Promise.
 * @returns {function} a function that dispatches asynchronous actions when called.
 */
export function createPromiseActionCreator(id, fn) {
    return (...args) => {
        dis.dispatch({action: id + '.pending'});
        fn(...args).then((result) => {
            dis.dispatch({action: id + '.success', result});
        }).catch((err) => {
            dis.dispatch({action: id + '.failure', err});
        });
    };
}
