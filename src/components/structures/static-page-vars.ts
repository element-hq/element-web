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

// We're importing via require specifically so the svg becomes a URI rather than a DOM element.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const matrixSvg = require("../../../res/img/matrix.svg").default;

/**
 * Intended to replace $matrixLogo in the welcome page.
 */
export const MATRIX_LOGO_HTML = `<a href="https://matrix.org" target="_blank" rel="noreferrer noopener">
    <img width="79" height="34" alt="Matrix" style="padding-left: 1px;vertical-align: middle" src="${matrixSvg}"/>
</a>`;
