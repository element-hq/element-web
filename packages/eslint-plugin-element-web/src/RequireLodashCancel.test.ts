/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, it } from "vitest";
import { RuleTester } from "oxlint/plugins-dev";

import rule from "./RequireLodashCancel.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });

tester.run("require-lodash-cancel", rule, {
    valid: [
        // Class component cancelling a class field
        `import { throttle } from "lodash";
        class Foo extends React.Component {
            private onUpdate = throttle(() => {}, 500);
            public componentWillUnmount(): void { this.onUpdate.cancel(); }
        }`,
        // Disposable class cancelling a field assigned in the constructor
        `import debounce from "lodash/debounce";
        class FooViewModel {
            private onUpdate;
            public constructor() { this.onUpdate = debounce(() => {}, 500); }
            public dispose(): void { this.onUpdate.cancel(); }
        }`,
        // Hook cancelling a memoised throttle in an effect cleanup
        `import { throttle } from "lodash";
        function useFoo() {
            const update = useMemo(() => throttle(() => {}, 500), []);
            useEffect(() => () => update.cancel(), [update]);
        }`,
        // Factory with a block body, and a ref holding the throttle
        `import { debounce } from "lodash";
        function Foo() {
            const update = useCallback(debounce(() => {}, 500), []);
            const ref = useRef(debounce(() => {}, 500));
            useEffect(() => () => { update.cancel(); ref.current?.cancel(); }, []);
        }`,
        // Namespace import
        `import _ from "lodash";
        class Foo extends PureComponent {
            private onUpdate = _.throttle(() => {}, 500);
            public componentWillUnmount(): void { this.onUpdate.cancel(); }
        }`,
        // View model cancelling through its disposables
        `import { debounce } from "lodash";
        class FooViewModel extends BaseViewModel<Snapshot, Props> {
            private onResize = debounce(() => {}, 500);
            public constructor() { super(); this.disposables.track(() => this.onResize.cancel()); }
        }`,
        // Cancelled by a method which the teardown calls
        `import { throttle } from "lodash";
        class Foo extends React.Component {
            private onUpdate = throttle(() => {}, 500);
            public componentWillUnmount(): void { this.stop(); }
            private stop(): void { this.onUpdate.cancel(); }
        }`,
        // No trailing call means nothing is left pending
        `import { throttle } from "lodash";
        class Foo extends React.Component {
            private onUpdate = throttle(() => {}, 500, { leading: true, trailing: false });
        }`,
        // Long-lived class without a teardown phase
        `import { throttle } from "lodash";
        class FooStore {
            private onUpdate = throttle(() => {}, 500);
        }`,
        // Module level throttle has no owner to tear it down
        `import { throttle } from "lodash";
        const onUpdate = throttle(() => {}, 500);`,
        // Not lodash
        `import { throttle } from "./utils";
        class Foo extends React.Component {
            private onUpdate = throttle(() => {}, 500);
        }`,
    ],
    invalid: [
        {
            code: `import { throttle } from "lodash";
            class Foo extends React.Component {
                private onUpdate = throttle(() => {}, 500);
            }`,
            errors: [{ messageId: "missingCancel", data: { target: "this.onUpdate", method: "throttle" } }],
        },
        {
            code: `import debounce from "lodash/debounce";
            class FooViewModel {
                private onUpdate;
                public constructor() { this.onUpdate = debounce(() => {}, 500); }
                public dispose(): void {}
            }`,
            errors: [{ messageId: "missingCancel", data: { target: "this.onUpdate", method: "debounce" } }],
        },
        {
            // Cancelled during normal operation, but never at teardown
            code: `import { debounce } from "lodash";
            class FooViewModel extends BaseViewModel<Snapshot, Props> {
                private compute = debounce(() => {}, 500);
                public setContent(content: string): void {
                    if (!content) this.compute.cancel();
                    else this.compute();
                }
            }`,
            errors: [{ messageId: "missingCancel", data: { target: "this.compute", method: "debounce" } }],
        },
        {
            // Cancelled in the effect body rather than its cleanup
            code: `import { throttle } from "lodash";
            function useFoo() {
                const update = useMemo(() => throttle(() => {}, 500), []);
                useEffect(() => { update.cancel(); update(); }, [update]);
            }`,
            errors: [{ messageId: "missingCancel", data: { target: "update", method: "throttle" } }],
        },
        {
            // View models inherit dispose() from their base class
            code: `import { debounce } from "lodash";
            class FooViewModel extends BaseViewModel<Snapshot, Props> {
                private onResize = debounce(() => {}, 500);
            }`,
            errors: [{ messageId: "missingCancel", data: { target: "this.onResize", method: "debounce" } }],
        },
        {
            // The original flake: a memoised throttle in a hook which is never cancelled
            code: `import { throttle } from "lodash";
            function useMemberList() {
                const loadMembers = useMemo(() => throttle(async () => {}, 500, { leading: true, trailing: true }), []);
                useEffect(() => { loadMembers(); }, [loadMembers]);
            }`,
            errors: [{ messageId: "missingCancel", data: { target: "loadMembers", method: "throttle" } }],
        },
        {
            // Cancelling a different throttle does not count
            code: `import { debounce } from "lodash";
            function Foo() {
                const a = useMemo(() => { return debounce(() => {}, 500); }, []);
                const b = useMemo(() => debounce(() => {}, 500), []);
                useEffect(() => () => b.cancel(), [b]);
            }`,
            errors: [{ messageId: "missingCancel", data: { target: "a", method: "debounce" } }],
        },
        {
            code: `import { throttle } from "lodash";
            function Foo() {
                const ref = useRef(throttle(() => {}, 500));
            }`,
            errors: [{ messageId: "missingCancel", data: { target: "ref.current", method: "throttle" } }],
        },
    ],
});
