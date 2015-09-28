/*
Copyright 2015 OpenMarket Ltd

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
    dispatch(payload) {
        if (this.dispatching) {
            setTimeout(super.dispatch.bind(this, payload), 0);
        } else {
            this.dispatching = true;
            super.dispatch(payload);
            this.dispatching = false;
        }
    }
};

if (global.mxDispatcher === undefined) {
    global.mxDispatcher = new MatrixDispatcher();
}
module.exports = global.mxDispatcher;
