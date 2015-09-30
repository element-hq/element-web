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

/**
 * The modulator stores 'modules': classes that provide
 * functionality and are not React UI components.
 * Modules go into named slots, eg. a conference calling
 * module goes into the 'conference' slot. If two modules
 * that use the same slot are loaded, this is considered
 * to be an error.
 *
 * There are some module slots that the react SDK knows
 * about natively: these have explicit getters.
 *
 * A module must define:
 *  - 'slot' (string): The name of the slot it goes into
 * and may define:
 *  - 'start' (function): Called on module load
 *  - 'stop' (function): Called on module unload
 */
class Modulator {
    constructor() {
        this.modules = {};
    }

    getModule(name) {
        var m = this.getModuleOrNull(name);
        if (m === null) {
            throw new Error("No such module: "+name);
        }
        return m;
    }

    getModuleOrNull(name) {
        if (this.modules == {}) {
            throw new Error(
                "Attempted to get a module before a skin has been loaded."+
                "This is probably because a component has called "+
                "getModule at the root level."
            );
        }
        var module = this.modules[name];
        if (module) {
            return module;
        }
        return null;
    }

    hasModule(name) {
        var m = this.getModuleOrNull(name);
        return m !== null;
    }

    loadModule(moduleObject) {
        if (!moduleObject.slot) {
            throw new Error(
                "Attempted to load something that is not a module "+
                "(does not have a slot name)"
            );
        }
        if (this.modules[moduleObject.slot] !== undefined) {
            throw new Error(
                "Cannot load module: slot '"+moduleObject.slot+"' is occupied!"
            );
        }
        this.modules[moduleObject.slot] = moduleObject;
    }

    reset() {
        var keys = Object.keys(this.modules);
        for (var i = 0; i < keys.length; ++i) {
            var k = keys[i];
            var m = this.modules[k];

            if (m.stop) m.stop();
        }
        this.modules = {};
    }

    // ***********
    // known slots
    // ***********

    getConferenceHandler() {
        return this.getModule('conference');
    }

    hasConferenceHandler() {
        return this.hasModule('conference');
    }
}

// Define one Modulator globally (see Skinner.js)
if (global.mxModulator === undefined) {
    global.mxModulator = new Modulator();
}
module.exports = global.mxModulator;

