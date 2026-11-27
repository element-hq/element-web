/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, it } from "vitest";
import { RuleTester } from "oxlint/plugins-dev";

import rule from "./NoLeakedSubscription.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });

tester.run("no-leaked-subscription", rule, {
    valid: [
        // Settings watcher released in componentWillUnmount
        `class Foo extends React.Component {
            private watcherRef?: string;
            public componentDidMount(): void { this.watcherRef = SettingsStore.watchSetting("theme", null, this.onChange); }
            public componentWillUnmount(): void { SettingsStore.unwatchSetting(this.watcherRef); }
        }`,
        // Dispatcher registration released in a store's destroy
        `class FooStore extends AsyncStoreWithClient<S> {
            private dispatcherRef: string;
            public constructor() { super(); this.dispatcherRef = defaultDispatcher.register(this.onAction); }
            public destroy(): void { defaultDispatcher.unregister(this.dispatcherRef); super.destroy(); }
        }`,
        // Handles kept in an array literal and released together
        `class Foo extends React.Component {
            public componentDidMount(): void {
                this.watchers = [
                    SettingsStore.watchSetting("a", null, this.onChange),
                    SettingsStore.watchSetting("b", null, this.onChange),
                ];
            }
            public componentWillUnmount(): void { this.watchers.forEach((ref) => SettingsStore.unwatchSetting(ref)); }
        }`,
        // Handles pushed onto a list and released by passing the method along
        `class FooState {
            private refs: string[] = [];
            public constructor() { this.refs.push(SettingsStore.watchSetting("a", null, this.onChange)); }
            public destroy(): void { this.refs.forEach(SettingsStore.unwatchSetting); }
        }`,
        // Released by a cleanup closure handed to disposables.track
        `class FooViewModel extends BaseViewModel<S, P> {
            public constructor() {
                super();
                const ref = SettingsStore.watchSetting("a", null, this.onChange);
                this.disposables.track(() => SettingsStore.unwatchSetting(ref));
            }
        }`,
        // Released in the effect cleanup
        `function Foo() {
            useEffect(() => {
                const ref = SettingsStore.watchSetting("a", null, onChange);
                return () => SettingsStore.unwatchSetting(ref);
            }, []);
        }`,
        // Released in onNotReady, as a store subscribed in onReady
        `class FooStore extends AsyncStoreWithClient<S> {
            protected async onReady(): Promise<void> { this.ref = SettingsStore.watchSetting("a", null, this.onChange); }
            protected async onNotReady(): Promise<void> { SettingsStore.unwatchSetting(this.ref); }
        }`,
        // Long-lived class without a teardown phase
        `class FooSingleton {
            public constructor() { SettingsStore.watchSetting("a", null, this.onChange); }
        }`,
        // The handle is returned to the caller, which is responsible for it
        `class Foo extends React.Component {
            public watch(): string { return SettingsStore.watchSetting("a", null, this.onChange); }
        }`,
        // Not a dispatcher
        `class Foo extends React.Component {
            public componentDidMount(): void { registry.register(this.thing); }
        }`,
    ],
    invalid: [
        {
            code: `class FooStore extends AsyncStoreWithClient<S> {
                public constructor() { super(); SettingsStore.watchSetting("a", null, () => this.onChange()); }
            }`,
            errors: [{ messageId: "discarded", data: { method: "watchSetting", remove: "unwatchSetting" } }],
        },
        {
            code: `class FooViewModel extends BaseViewModel<S, P> {
                public constructor() { super(); dis.register(this.onAction); }
            }`,
            errors: [{ messageId: "discarded", data: { method: "register", remove: "unregister" } }],
        },
        {
            code: `class Foo extends React.Component {
                public componentDidMount(): void { this.ref = SettingsStore.watchSetting("a", null, this.onChange); }
                public componentWillUnmount(): void {}
            }`,
            errors: [
                {
                    messageId: "missingRelease",
                    data: { name: "ref", method: "watchSetting", remove: "unwatchSetting" },
                },
            ],
        },
        {
            // Releasing a different handle does not count
            code: `class FooState {
                public constructor() {
                    this.a = SettingsStore.watchSetting("a", null, this.onChange);
                    this.b = SettingsStore.watchSetting("b", null, this.onChange);
                }
                public destroy(): void { SettingsStore.unwatchSetting(this.a); }
            }`,
            errors: [
                {
                    messageId: "missingRelease",
                    data: { name: "b", method: "watchSetting", remove: "unwatchSetting" },
                },
            ],
        },
        {
            code: `function Foo() {
                useEffect(() => {
                    SettingsStore.watchSetting("a", null, onChange);
                }, []);
            }`,
            errors: [{ messageId: "discarded", data: { method: "watchSetting", remove: "unwatchSetting" } }],
        },
    ],
});
