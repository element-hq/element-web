/*
 * Copyright 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";

import { I18nApi } from "./I18nApi";

describe("I18nApi", () => {
    it("can register a translation and use it", () => {
        const i18n = new I18nApi();
        i18n.register({
            ["hello.world" as TranslationKey]: {
                en: "Hello, World!",
            },
        });

        expect(i18n.translate("hello.world" as TranslationKey)).toBe("Hello, World!");
    });

    it("can register a translation and use it with tags", () => {
        const i18n = new I18nApi();
        i18n.register({
            ["hello.world" as TranslationKey]: {
                en: "Hello, <Bold>World!</Bold>",
            },
        });

        expect(
            i18n.translate("hello.world" as TranslationKey, {}, { Bold: (sub) => <strong>{sub}</strong> }),
        ).toStrictEqual(
            <span>
                Hello, <strong>World!</strong>
            </span>,
        );
    });

    describe("registerLanguage", () => {
        it("registers under the app's key for the language", () => {
            const i18n = new I18nApi();
            i18n.registerLanguage("en_EN", { "register.language": "Hello from en_EN" });

            expect(i18n.translate("register.language")).toBe("Hello from en_EN");
        });

        it("supports nested keys", () => {
            const i18n = new I18nApi();
            i18n.registerLanguage("en", { "register.group": { greeting: "Hello from a group" } });

            expect(i18n.translate("register.group|greeting")).toBe("Hello from a group");
        });

        it("nests translations under the namespace", () => {
            const i18n = new I18nApi();
            i18n.namespaced("module.language").registerLanguage("en", { greeting: "Hello from a module" });

            expect(i18n.translate("module.language|greeting")).toBe("Hello from a module");
        });
    });

    describe("namespaced", () => {
        it("keeps translations in different namespaces apart", () => {
            const i18n = new I18nApi();
            const moduleA = i18n.namespaced("module.a");
            const moduleB = i18n.namespaced("module.b");
            moduleA.register({ greeting: { en: "Hello from A" } });
            moduleB.register({ greeting: { en: "Hello from B" } });

            expect(moduleA.translate("greeting")).toBe("Hello from A");
            expect(moduleB.translate("greeting")).toBe("Hello from B");
            expect(i18n.translate("module.a|greeting")).toBe("Hello from A");
        });

        it("nests namespaces when called on a namespaced API", () => {
            const i18n = new I18nApi();
            const nested = i18n.namespaced("outer").namespaced("inner");
            nested.register({ greeting: { en: "Hello, nested" } });

            expect(nested.translate("greeting")).toBe("Hello, nested");
            expect(i18n.translate("outer|inner|greeting")).toBe("Hello, nested");
        });

        it("interpolates variables and tags", () => {
            const moduleApi = new I18nApi().namespaced("module.tags");
            moduleApi.register({ greeting: { en: "Hello, <Bold>%(name)s</Bold>" } });

            expect(
                moduleApi.translate("greeting", { name: "World" }, { Bold: (sub) => <strong>{sub}</strong> }),
            ).toStrictEqual(
                <span>
                    Hello, <strong>World</strong>
                </span>,
            );
        });

        it("humanizes times through the un-namespaced API", () => {
            const root = new I18nApi();
            const translate = vi.spyOn(root, "translate");

            root.namespaced("outer").namespaced("inner").humanizeTime(Date.now());

            expect(translate).toHaveBeenCalledWith("time|few_seconds_ago");
        });
    });
});
