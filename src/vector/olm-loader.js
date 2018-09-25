/*
Copyright 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd

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

import olm from 'olm/olm.js';

/* a very thin shim for loading olm.js: just sets the global OLM_OPTIONS and
 * requires the actual olm.js library.
 *
 * olm.js reads global.OLM_OPTIONS and defines global.Olm. The latter is fine for us,
 * but we need to prepare the former.
 *
 * We can't use webpack's definePlugin to do this, because we tell webpack not
 * to parse olm.js. We also can't put this code in index.js, because olm and
 * index.js are loaded in parallel, and we need to make sure OLM_OPTIONS is set
 * before olm.js is loaded.
 */

/* Tell the Olm js to look for its wasm file at the same level as index.html.
 * It really should be in the same place as the js, ie. in the bundle directory,
 * to avoid caching issues, but as far as I can tell this is completely impossible
 * with webpack.
 */
global.OLM_OPTIONS = {
    locateFile: () => 'olm.wasm',
};
