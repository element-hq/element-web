/*
Copyright 2016 OpenMarket Ltd

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

/* total_memory must be a power of two, and at least twice the stack.
 *
 * We don't need a lot of stack, but we do need about 128K of heap to encrypt a
 * 64K event (enough to store the ciphertext and the plaintext, bearing in mind
 * that the plaintext can only be 48K because base64). We also have about 36K
 * of statics. So let's have 256K of memory.
 */
global.OLM_OPTIONS = {
    TOTAL_STACK: 64*1024,
    TOTAL_MEMORY: 256*1024,
};

require('olm/olm.js');
