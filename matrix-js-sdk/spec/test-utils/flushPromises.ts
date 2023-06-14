/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

// Jest now uses @sinonjs/fake-timers which exposes tickAsync() and a number of
// other async methods which break the event loop, letting scheduled promise
// callbacks run. Unfortunately, Jest doesn't expose these, so we have to do
// it manually (this is what sinon does under the hood). We do both in a loop
// until the thing we expect happens: hopefully this is the least flakey way
// and avoids assuming anything about the app's behaviour.
const realSetTimeout = setTimeout;
export function flushPromises() {
    return new Promise((r) => {
        realSetTimeout(r, 1);
    });
}
