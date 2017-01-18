/*
Copyright 2015, 2016 OpenMarket Ltd

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

'use strict';

var flux = require("flux");

class MatrixDispatcher extends flux.Dispatcher {
    /**
     * @param {Object} payload Required. The payload to dispatch.
     *        Must contain at least an 'action' key.
     * @param {boolean} sync Optional. Pass true to dispatch
     *        synchronously. This is useful for anything triggering
     *        an operation that the browser requires user interaction
     *        for.
     */
    dispatch(payload, sync) {
        console.log("Dispatch: "+payload.action);
        if (sync) {
            super.dispatch(payload);
        } else {
            // Unless the caller explicitly asked for us to dispatch synchronously,
            // we always set a timeout to do this: The flux dispatcher complains
            // if you dispatch from within a dispatch, so rather than action
            // handlers having to worry about not calling anything that might
            // then dispatch, we just do dispatches asynchronously.
            setTimeout(super.dispatch.bind(this, payload), 0);
        }
    }
};

if (global.mxDispatcher === undefined) {
    global.mxDispatcher = new MatrixDispatcher();
}
module.exports = global.mxDispatcher;
