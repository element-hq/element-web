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
var extend = require("./extend");

var MatrixDispatcher = function() {
    flux.Dispatcher.call(this);
};

extend(MatrixDispatcher.prototype, flux.Dispatcher.prototype);
MatrixDispatcher.prototype.dispatch = function(payload) {
    if (this.dispatching) {
        setTimeout(flux.Dispatcher.prototype.dispatch.bind(this, payload), 0);
    } else {
        this.dispatching = true;
        flux.Dispatcher.prototype.dispatch.call(this, payload);
        this.dispatching = false;
    }
}

module.exports = new MatrixDispatcher();
