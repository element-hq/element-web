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
var POKE_RATE_MS = 10 * 60 * 1000; // 10 min
var currentVersion = null;
var latestVersion = null;
var listener = function(){}; // NOP

module.exports = {
    setVersionListener: function(fn) { // invoked with fn(currentVer, newVer)
        listener = fn;
    },

    run: function() {
        var req = new XMLHttpRequest();
        req.addEventListener("load", function() {
            if (!req.responseText) {
                return;
            }
            var ver = req.responseText.trim();
            if (!currentVersion) {
                currentVersion = ver;
                listener(currentVersion, currentVersion);
            }

            if (ver !== latestVersion) {
                latestVersion = ver;
                if (module.exports.hasNewVersion()) {
                    console.log("Current=%s Latest=%s", currentVersion, latestVersion);
                    listener(currentVersion, latestVersion);
                }
            }
        });
        var cacheBuster = "?ts=" + new Date().getTime();
        req.open("GET", "version" + cacheBuster);
        req.send(); // can't suppress 404s from being logged.

        setTimeout(module.exports.run, POKE_RATE_MS);
    },

    getCurrentVersion: function() {
        return currentVersion;
    },

    hasNewVersion: function() {
        return currentVersion && latestVersion && (currentVersion !== latestVersion);
    }
};
