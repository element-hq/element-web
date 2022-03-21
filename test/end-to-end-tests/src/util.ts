/*
Copyright 2018 New Vector Ltd
Copyright 2019 - 2022 The Matrix.org Foundation C.I.C.

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

import { ConsoleMessage } from "puppeteer";
import { padEnd } from "lodash";

import { ElementSession } from "./session";

export const range = function(start: number, amount: number, step = 1): Array<number> {
    const r = [];
    for (let i = 0; i < amount; ++i) {
        r.push(start + (i * step));
    }
    return r;
};

export const delay = function(ms): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

export const measureStart = function(session: ElementSession, name: string): Promise<void> {
    return session.page.evaluate(_name => {
        window.mxPerformanceMonitor.start(_name);
    }, name);
};

export const measureStop = function(session: ElementSession, name: string): Promise<void> {
    return session.page.evaluate(_name => {
        window.mxPerformanceMonitor.stop(_name);
    }, name);
};

// TODO: Proper types on `config` - for some reason won't accept an import of ConfigOptions.
export async function applyConfigChange(session: ElementSession, config: any): Promise<void> {
    await session.page.evaluate((_config) => {
        // note: we can't *set* the object because the window version is effectively a pointer.
        for (const [k, v] of Object.entries(_config)) {
            // @ts-ignore - for some reason it's not picking up on global.d.ts types.
            window.mxReactSdkConfig[k] = v;
        }
    }, config);
}

export async function serializeLog(msg: ConsoleMessage): Promise<string> {
    // 9 characters padding is somewhat arbitrary ("warning".length + some)
    let s = `${new Date().toISOString()} | ${ padEnd(msg.type(), 9, ' ')}| ${msg.text()} `; // trailing space is intentional
    const args = msg.args();
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        let val;
        try {
            val = await arg.jsonValue();
        } catch (error) {
            val = `<error: ${error}>`;
        }

        // We handle strings a bit differently because the `jsonValue` will be in a weird-looking
        // shape ("JSHandle:words are here"). Weirdly, `msg.text()` also catches text nodes that
        // we can't with our parsing, so we trust that it's correct whenever we can.
        if (typeof val === 'string') {
            if (i === 0) {
                // if it's a string, just ignore it because it should have already been caught
                // by the `msg.text()` in the initial `s` construction.
                continue;
            }

            // evaluate the arg as a string by running it through the page context
            s += `${await arg.evaluate(a => a.toString())} `; // trailing space is intentional
            continue;
        }

        // Try and parse the value as an error object first (which will be an empty JSON
        // object). Otherwise, parse the object to a string.
        //
        // Note: we have to run the checks against the object in the page context, so call
        // evaluate instead of just doing it ourselves.
        const stringyArg: string = await arg.evaluate((argInContext: any) => {
            // sometimes the argument will be `null` or similar - treat it safely.
            if (argInContext?.stack || (argInContext instanceof Error)) {
                // probably an error - toString it and append any properties which might not be
                // caught. For example, on HTTP errors the JSON stringification will capture the
                // status code.
                //
                // String format is a bit weird, but basically we're trying to get away from the
                // stack trace so the context doesn't blend in but is otherwise indented correctly.
                return `${argInContext.toString()}\n\n    Error context: ${JSON.stringify(argInContext)}`;
            }

            // not an error, as far as we're concerned - return it as human-readable JSON
            let ret;
            try {
                ret = JSON.stringify(argInContext, null, 4);
            } catch (error) {
                ret = `<error: ${error}>`;
            }
            return ret;
        });
        s += `${stringyArg} `; // trailing space is intentional
    }
    return s;
}
