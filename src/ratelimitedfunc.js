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

/**
 * 'debounces' a function to only execute every n milliseconds.
 * Useful when react-sdk gets many, many events but only wants
 * to update the interface once for all of them.
 *
 * Note that the function must not take arguments, since the args
 * could be different for each invocarion of the function.
 */
module.exports = function(f, minIntervalMs) {
    this.lastCall = 0;
    this.scheduledCall = undefined;

    var self = this;
    return function() {
        var now = Date.now();

        if (self.lastCall < now - minIntervalMs) {
            f.apply(this);
            self.lastCall = now;
        } else if (self.scheduledCall === undefined) {
            self.scheduledCall = setTimeout(
                () => {
                    self.scheduledCall = undefined;
                    f.apply(this);
                    self.lastCall = now;
                },
                (self.lastCall + minIntervalMs) - now
            );
        }
    };
};

