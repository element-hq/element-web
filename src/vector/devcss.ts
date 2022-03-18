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

/**
 * This code is removed on production builds.
 *
 * Webpack's `string-replace-loader` searches for the `use theming` string
 * in this specific file, and replaces it with CSS requires statements that
 * are specific to the themes we have enabled.
 *
 * Without this workaround, webpack would import the CSS of all themes, which
 * would defeat the purpose of hot-reloading since all themes would be compiled,
 * which would result in compilation times on the order of 30s, even on a
 * powerful machine.
 *
 * For more details, see webpack.config.js:184 (string-replace-loader)
 */
if (process.env.NODE_ENV === 'development') {
    ("use theming");
    /**
     * Clean up old hot-module script injections as they hog up memory
     * and anything other than the newest one is really not needed at all.
     * We don't need to do it more frequently than every half a minute or so,
     * but it's done to delay full page reload due to app slowness.
     */
    setInterval(() => {
        const elements = Array.from(document.querySelectorAll("script[src*=hot-update]"));
        if (elements.length > 1) {
            const oldInjects = elements.slice(0, elements.length - 1);
            oldInjects.forEach(e => e.remove());
        }
    }, 1000);
}

