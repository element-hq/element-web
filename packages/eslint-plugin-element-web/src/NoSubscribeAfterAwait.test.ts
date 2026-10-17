/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, it } from "vitest";
import { RuleTester } from "oxlint/plugins-dev";

import rule from "./NoSubscribeAfterAwait.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });

tester.run("no-subscribe-after-await", rule, {
    valid: [
        // Checks for unmount after the await
        `class Foo extends React.Component {
            public async componentDidMount(): Promise<void> {
                await this.load();
                if (this.unmounted) return;
                client.on(RoomEvent.Timeline, this.onTimeline);
            }
        }`,
        // Subscribes before the await
        `class Foo extends React.Component {
            public async componentDidMount(): Promise<void> {
                client.on(RoomEvent.Timeline, this.onTimeline);
                await this.load();
            }
        }`,
        // A loop which checks for unmount on each iteration
        `class Foo extends React.Component {
            public async poll(): Promise<void> {
                while (!this.unmounted) {
                    await sleep(1000);
                    store.on("change", this.onChange);
                }
            }
        }`,
        // Checks in a promise callback
        `class Foo extends React.Component {
            public componentDidMount(): void {
                void promise.then((request) => {
                    if (this.unmounted) return;
                    request.on(RequestEvent.Change, this.onChange);
                });
            }
        }`,
        // A disposable class checking whether it was destroyed
        `class Call {
            public async start(): Promise<void> {
                const api = await this.connect();
                if (this.destroyed) return;
                api.on("hangup", this.onHangup);
            }
            public destroy(): void { this.destroyed = true; }
        }`,
        // Long-lived class without a teardown phase
        `class Store {
            public async init(): Promise<void> {
                await this.load();
                client.on(ClientEvent.Sync, this.onSync);
            }
        }`,
    ],
    invalid: [
        {
            code: `class FilePanel extends React.Component {
                public async componentDidMount(): Promise<void> {
                    await this.updateTimelineSet();
                    client.on(RoomEvent.Timeline, this.onTimeline);
                }
            }`,
            errors: [{ messageId: "subscribeAfterAwait", data: { subscription: "listener for RoomEvent.Timeline" } }],
        },
        {
            // The check happens before the await, so it is stale by the time we subscribe
            code: `class Foo extends React.Component {
                public async componentDidMount(): Promise<void> {
                    if (this.unmounted) return;
                    const profile = await client.getProfileInfo(userId);
                    this.watcher = SettingsStore.watchSetting("layout", null, this.onLayout);
                }
            }`,
            errors: [{ messageId: "subscribeAfterAwait", data: { subscription: "setting watcher" } }],
        },
        {
            code: `class Dialog extends React.Component {
                public componentDidMount(): void {
                    void this.props.requestPromise.then((request) => {
                        request.on(RequestEvent.Change, this.onChange);
                    });
                }
            }`,
            errors: [{ messageId: "subscribeAfterAwait", data: { subscription: "listener for RequestEvent.Change" } }],
        },
    ],
});
