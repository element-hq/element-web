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

import React from "react";

export interface IComponents {
    [key: string]: React.Component;
}

export interface ISkinObject {
    components: IComponents;
}

export class Skinner {
    public components: IComponents = null;

    public getComponent(name: string): React.Component {
        if (!name) throw new Error(`Invalid component name: ${name}`);
        if (this.components === null) {
            throw new Error(
                `Attempted to get a component (${name}) before a skin has been loaded.`+
                " This is probably because either:"+
                " a) Your app has not called sdk.loadSkin(), or"+
                " b) A component has called getComponent at the root level",
            );
        }

        const doLookup = (components: IComponents): React.Component => {
            if (!components) return null;
            let comp = components[name];
            // XXX: Temporarily also try 'views.' as we're currently
            // leaving the 'views.' off views.
            if (!comp) {
                comp = components['views.' + name];
            }
            return comp;
        };

        // Check the skin first
        const comp = doLookup(this.components);

        // Just return nothing instead of erroring - the consumer should be smart enough to
        // handle this at this point.
        if (!comp) {
            return null;
        }

        // components have to be functions or forwardRef objects with a render function.
        const validType = typeof comp === 'function' || comp.render;
        if (!validType) {
            throw new Error(`Not a valid component: ${name} (type = ${typeof(comp)}).`);
        }
        return comp;
    }

    public load(skinObject: ISkinObject): void {
        if (this.components !== null) {
            throw new Error(
                "Attempted to load a skin while a skin is already loaded"+
                "If you want to change the active skin, call resetSkin first");
        }
        this.components = {};
        const compKeys = Object.keys(skinObject.components);
        for (let i = 0; i < compKeys.length; ++i) {
            const comp = skinObject.components[compKeys[i]];
            this.addComponent(compKeys[i], comp);
        }

        // Now that we have a skin, load our components too
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const idx = require("./component-index");
        if (!idx || !idx.components) throw new Error("Invalid react-sdk component index");
        for (const c in idx.components) {
            if (!this.components[c]) this.components[c] = idx.components[c];
        }
    }

    public addComponent(name: string, comp: any) {
        let slot = name;
        if (comp.replaces !== undefined) {
            if (comp.replaces.indexOf('.') > -1) {
                slot = comp.replaces;
            } else {
                slot = name.substr(0, name.lastIndexOf('.') + 1) + comp.replaces.split('.').pop();
            }
        }
        this.components[slot] = comp;
    }

    public reset(): void {
        this.components = null;
    }
}

// We define one Skinner globally, because the intention is
// very much that it is a singleton. Relying on there only being one
// copy of the module can be dicey and not work as browserify's
// behaviour with multiple copies of files etc. is erratic at best.
// XXX: We can still end up with the same file twice in the resulting
// JS bundle which is nonideal.
// See https://derickbailey.com/2016/03/09/creating-a-true-singleton-in-node-js-with-es6-symbols/
// or https://nodejs.org/api/modules.html#modules_module_caching_caveats
// ("Modules are cached based on their resolved filename")
if (window.mxSkinner === undefined) {
    window.mxSkinner = new Skinner();
}
export default window.mxSkinner;

