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
 * This code will be autoremoved on production builds.
 * The purpose of this code is that the webpack's `string-replace-loader`
 * pretty much search for this string in this specific file and replaces it
 * like a macro before any previous compilations, which allows us to inject
 * some css requires statements that are specific to the themes we have turned
 * on by ourselves. Without that very specific workaround, webpack would just
 * import all the CSSes, which would make the whole thing useless, as on my
 * machine with i9 the recompilation for all themes turned ou would take way
 * over 30s, which is definitely too high for nice css reloads speed.
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

