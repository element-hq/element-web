/*
Copyright 2019 Tulir Asokan <tulir@maunium.net>

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

const REACTION_COUNT = JSON.parse(window.localStorage.mx_reaction_count || '{}');
let sorted = null;

export function add(emoji) {
    const [count] = REACTION_COUNT[emoji] || [0];
    REACTION_COUNT[emoji] = [count + 1, Date.now()];
    window.localStorage.mx_reaction_count = JSON.stringify(REACTION_COUNT);
    sorted = null;
}

export function get(limit = 24) {
    if (sorted === null) {
        sorted = Object.entries(REACTION_COUNT)
            .sort(([, [count1, date1]], [, [count2, date2]]) =>
                count2 === count1 ? date2 - date1 : count2 - count1)
            .map(([emoji, count]) => emoji);
    }
    return sorted.slice(0, limit);
}
