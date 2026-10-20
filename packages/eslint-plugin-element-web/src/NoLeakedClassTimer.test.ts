/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, it } from "vitest";
import { RuleTester } from "oxlint/plugins-dev";

import rule from "./NoLeakedClassTimer.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });

tester.run("no-leaked-class-timer", rule, {
    valid: [
        // Cleared in componentWillUnmount
        `class Foo extends React.Component {
            public componentDidMount(): void { this.timer = window.setTimeout(this.onTimer, 1000); }
            public componentWillUnmount(): void { clearTimeout(this.timer); }
        }`,
        // Cleared through the view model's disposables
        `class FooViewModel extends BaseViewModel<S, P> {
            public constructor() { super(); this.disposables.track(() => clearInterval(this.interval)); }
            private start(): void { this.interval = setInterval(this.tick, 1000); }
        }`,
        // Cleared by a method which dispose calls
        `class Behaviour {
            private onCall = (): void => { this.timeout = setTimeout(this.collapse, 100); };
            public dispose = (): void => { this.stop(); };
            private stop(): void { window.clearTimeout(this.timeout); }
        }`,
        // Animation frames
        `class Foo extends React.PureComponent {
            private scheduleFrame(): void { this.frame = requestAnimationFrame(this.draw); }
            public componentWillUnmount(): void { cancelAnimationFrame(this.frame!); }
        }`,
        // Singleton with only a static reset
        `class Store {
            private onResize = (): void => { this.timeoutId = window.setTimeout(this.done, 1000); };
            public static destroy(): void {}
        }`,
        // Not stored on the instance
        `class Foo extends React.Component {
            private onClick = (): void => { setTimeout(this.focus, 0); };
        }`,
    ],
    invalid: [
        {
            code: `class Foo extends React.Component {
                private onChange = (): void => { this.debounce = window.setTimeout(this.complete, 200); };
                public componentWillUnmount(): void { this.autocompleter.destroy(); }
            }`,
            errors: [{ messageId: "missingClear", data: { target: "this.debounce", timer: "setTimeout" } }],
        },
        {
            // Cleared before rescheduling, but never at teardown
            code: `class Foo extends React.Component {
                private show(): void {
                    if (this.timer) clearTimeout(this.timer);
                    this.timer = setTimeout(this.hide, 2000);
                }
            }`,
            errors: [{ messageId: "missingClear", data: { target: "this.timer", timer: "setTimeout" } }],
        },
        {
            code: `class Behaviour {
                private onCall = (): void => { this.callStartedTimeout = window.setTimeout(this.collapse, 100); };
                public dispose = (): void => { this.store.off("call", this.onCall); };
            }`,
            errors: [{ messageId: "missingClear", data: { target: "this.callStartedTimeout", timer: "setTimeout" } }],
        },
    ],
});
