/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, it } from "vitest";
import { RuleTester } from "oxlint/plugins-dev";

import rule from "./NoLeakedEmitterListener.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });

tester.run("no-leaked-emitter-listener", rule, {
    valid: [
        // Removed in componentWillUnmount, through a differently spelt emitter
        `class Foo extends React.Component {
            public componentDidMount(): void { this.props.verifier.on(VerifierEvent.Cancel, this.onCancel); }
            public componentWillUnmount(): void { this.props.verifier?.removeListener(VerifierEvent.Cancel, this.onCancel); }
        }`,
        // Removed in dispose
        `class FooViewModel {
            public constructor(private room: Room) { room.on(RoomEvent.Name, this.onName); }
            public dispose(): void { this.room.off(RoomEvent.Name, this.onName); }
        }`,
        // Removed by clearing the whole emitter
        `class Foo extends React.Component {
            public componentDidMount(): void { this.emitter.on("change", () => {}); }
            public componentWillUnmount(): void { this.emitter.removeAllListeners(); }
        }`,
        // Removed in the effect cleanup
        `function Foo({ room }) {
            useEffect(() => {
                room.on(RoomEvent.Name, onName);
                return () => { room.off(RoomEvent.Name, onName); };
            }, [room]);
        }`,
        // Event computed by a call, with a differently spelt argument on removal
        `class Foo extends React.Component {
            public componentDidMount(): void { store.on(Store.emissionForRoom(room), this.onUpdate); }
            public componentWillUnmount(): void { store.off(Store.emissionForRoom(this.state.room), this.onUpdate); }
        }`,
        // Removed by a cleanup closure the class stores and runs on dispose
        `class FooViewModel extends BaseViewModel<S, P> {
            private cleanups: (() => void)[] = [];
            public constructor(room: Room) {
                super();
                room.on(RoomEvent.Name, this.onName);
                this.cleanups.push(() => room.off(RoomEvent.Name, this.onName));
            }
        }`,
        // Removed by a method handed to disposables.track
        `class FooViewModel extends BaseViewModel<S, P> {
            public constructor() { super(); this.watch(); this.disposables.track(this.unwatch); }
            private watch(): void { this.event.on(MatrixEventEvent.Replaced, this.onReplaced); }
            private unwatch = (): void => { this.event.off(MatrixEventEvent.Replaced, this.onReplaced); };
        }`,
        // Removed by a setter which componentWillUnmount assigns to
        `class Foo extends React.Component {
            public componentWillUnmount(): void { this.user = null; }
            private set user(user) {
                this._user?.off(UserEvent.Presence, this.onPresence);
                this._user = user;
                user?.on(UserEvent.Presence, this.onPresence);
            }
        }`,
        // Removed in close(), which a base class's destroy() calls
        `class FooCall extends Call {
            public start(): void { this.widgetApi.on("action:hangup", this.onHangup); }
            public close(): void { this.widgetApi.off("action:hangup", this.onHangup); }
            public destroy(): void {}
        }`,
        // Scoped to one function and removed in its finally block
        `class Foo extends React.Component {
            public async wait(): Promise<void> {
                store.on("ready", this.onReady);
                try { await promise; } finally { store.off("ready", this.onReady); }
            }
        }`,
        // A class's own on() which forwards to an inner emitter
        `class Recording {
            public on(event, listener): this { this.inner.on(event, listener); return this; }
            public destroy(): void {}
        }`,
        // The return value is an unsubscribe function
        `class Foo extends React.Component {
            public componentDidMount(): void { this.unsubscribe = store.on("change", this.onChange); }
        }`,
        // Long-lived class without a teardown phase
        `class FooStore {
            public constructor() { client.on(ClientEvent.Sync, this.onSync); }
        }`,
        // Listener added outside an effect is left to other tooling
        `function useFoo(room) { room.on(RoomEvent.Name, onName); }`,
        // Nested callback in a class, which may belong to another object's lifetime
        `class Foo extends React.Component {
            public componentDidMount(): void { promise.then(() => { other.on("x", this.onX); }); }
        }`,
        // DOM events are covered by react-web-api/no-leaked-event-listener
        `function Foo() { useEffect(() => { window.addEventListener("resize", onResize); }, []); }`,
    ],
    invalid: [
        {
            code: `class Foo extends React.Component {
                public componentDidMount(): void {
                    this.props.verifier.on(VerifierEvent.ShowSas, this.onShowSas);
                    this.props.verifier.on(VerifierEvent.Cancel, this.onCancel);
                }
                public componentWillUnmount(): void {
                    this.props.verifier.removeListener(VerifierEvent.ShowSas, this.onShowSas);
                }
            }`,
            errors: [{ messageId: "missingRemoval", data: { event: "VerifierEvent.Cancel", method: "on" } }],
        },
        {
            // A new bound function is created for each call, so `off` never matches the `on`
            code: `class Foo extends React.Component {
                public componentDidMount(): void { poll.on(PollEvent.Relations, this.render.bind(this)); }
                public componentWillUnmount(): void { poll.off(PollEvent.Relations, this.render.bind(this)); }
            }`,
            errors: [{ messageId: "inlineHandler", data: { event: "PollEvent.Relations" } }],
        },
        {
            code: `class FooViewModel {
                public constructor(room: Room) { room.addListener(RoomEvent.Name, (name) => {}); }
                public dispose(): void {}
            }`,
            errors: [{ messageId: "inlineHandler", data: { event: "RoomEvent.Name" } }],
        },
        {
            code: `function Foo({ room }) {
                useLayoutEffect(() => {
                    room.on(RoomEvent.Name, onName);
                }, [room]);
            }`,
            errors: [{ messageId: "missingRemoval", data: { event: "RoomEvent.Name", method: "on" } }],
        },
        {
            // Removed when switching to another emitter, but never at teardown
            code: `class FooViewModel extends BaseViewModel<S, P> {
                public setSpace(space: Room): void {
                    this.space?.off(RoomEvent.Name, this.onName);
                    this.space = space;
                    this.space.on(RoomEvent.Name, this.onName);
                }
            }`,
            errors: [{ messageId: "missingRemoval", data: { event: "RoomEvent.Name", method: "on" } }],
        },
        {
            // Removed in the effect body rather than its cleanup
            code: `function Foo({ room }) {
                useEffect(() => {
                    room.off(RoomEvent.Name, onName);
                    room.on(RoomEvent.Name, onName);
                }, [room]);
            }`,
            errors: [{ messageId: "missingRemoval", data: { event: "RoomEvent.Name", method: "on" } }],
        },
        {
            // Removing a different handler does not count
            code: `function Foo({ room }) {
                useEffect(() => {
                    room.on(RoomEvent.Name, onName);
                    return () => room.off(RoomEvent.Name, onOther);
                }, [room]);
            }`,
            errors: [{ messageId: "missingRemoval", data: { event: "RoomEvent.Name", method: "on" } }],
        },
    ],
});
