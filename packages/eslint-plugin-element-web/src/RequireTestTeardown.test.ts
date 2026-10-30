/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, it } from "vitest";
import { RuleTester } from "oxlint/plugins-dev";

import rule from "./RequireTestTeardown.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });
const options = [{ classes: "(Store|ViewModel)$" }];
const methods = "`destroy`, `dispose`, `stop`, `close`";

tester.run("require-test-teardown", rule, {
    valid: [
        // Torn down in the same test
        {
            code: `it("works", async () => {
                const store = new FooStore(dispatcher);
                await store.start();
                store.destroy();
            });`,
            options,
        },
        // Torn down in afterEach, through optional chaining
        {
            code: `describe("Foo", () => {
                let vm: FooViewModel | undefined;
                afterEach(() => { vm?.dispose(); });
                it("works", () => { vm = new FooViewModel(props); });
            });`,
            options,
        },
        // Torn down by onTestFinished
        {
            code: `it("works", () => {
                const vm = new FooViewModel(props);
                onTestFinished(() => vm.dispose());
            });`,
            options,
        },
        // Passed to a teardown helper, on its own or as it is created
        {
            code: `it("works", () => {
                const vm = new FooViewModel({
                    props,
                });
                tearDownAfterTest(vm);
                const other = tearDownAfterTest(new FooViewModel(props));
            });`,
            options: [{ ...options[0], helpers: ["tearDownAfterTest"] }],
        },
        // Returned by a helper, so the caller is responsible for it
        {
            code: `function setup() {
                const store = new FooStore(dispatcher);
                return { store };
            }`,
            options,
        },
        // A class which does not match the option
        { code: `it("works", () => { new FooHelper(); });`, options },
        // An ignored class
        { code: `it("works", () => { new PlainStore(); });`, options: [{ classes: "Store$", ignore: ["PlainStore"] }] },
        // A custom teardown method
        {
            code: `it("works", () => { const store = new FooStore(); store.reset(); });`,
            options: [{ classes: "Store$", methods: ["reset"] }],
        },
    ],
    invalid: [
        {
            code: `it("works", () => { new FooViewModel(props); });`,
            options,
            errors: [{ messageId: "discarded", data: { className: "FooViewModel", methods } }],
        },
        {
            code: `it("works", async () => {
                const store = new FooStore(dispatcher);
                await store.start();
            });`,
            options,
            errors: [{ messageId: "missingTeardown", data: { name: "store", methods } }],
        },
        {
            // Tearing down a different instance does not count
            code: `it("works", () => {
                const first = new FooStore();
                const second = new FooStore();
                first.destroy();
            });`,
            options,
            errors: [{ messageId: "missingTeardown", data: { name: "second", methods } }],
        },
        {
            // Only the configured helpers tear down what is passed to them
            code: `it("works", () => {
                const vm = new FooViewModel(props);
                console.log(vm);
            });`,
            options: [{ ...options[0], helpers: ["tearDownAfterTest"] }],
            errors: [{ messageId: "missingTeardown", data: { name: "vm", methods } }],
        },
        {
            // Torn down in another test, rather than an after hook
            code: `describe("Foo", () => {
                it("a", () => { const vm = new FooViewModel(props); });
                it("b", () => { const vm = new FooViewModel(props); vm.dispose(); });
            });`,
            options,
            errors: [{ messageId: "missingTeardown", data: { name: "vm", methods } }],
        },
    ],
});
