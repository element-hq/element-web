/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";

import serializer from "./css-module-class-serializer";

// Registered globally in vitest.config.ts; added here too so this file doesn't depend on that wiring.
expect.addSnapshotSerializer(serializer);

describe("css-module-class-serializer", () => {
    it("strips the hash and line number from CSS module classes on elements", () => {
        const div = document.createElement("div");
        div.className = "_layoutGroup_19o20_194 mx_EventTile _toolbar_item_x3k2a_12";

        expect(div).toMatchInlineSnapshot(`
          <div
            class="_layoutGroup mx_EventTile _toolbar_item"
          />
        `);
    });

    it("strips them from string snapshots", () => {
        const html = '<li class="_root_8sevw_9 mx_EventTile"><div class="_flex_4dswl_9">hi</div></li>';

        expect(html).toMatchInlineSnapshot(`"<li class="_root mx_EventTile"><div class="_flex">hi</div></li>"`);
    });

    it("only touches class attributes", () => {
        const html = '<p title="_layoutGroup_19o20_194">_layoutGroup_19o20_194</p><p class="mx_EventTile_line">hi</p>';

        expect(html).toMatchInlineSnapshot(
            `"<p title="_layoutGroup_19o20_194">_layoutGroup_19o20_194</p><p class="mx_EventTile_line">hi</p>"`,
        );
    });

    it("leaves class names that are not CSS module names alone", () => {
        const div = document.createElement("div");
        div.className = "mx_EventTile_line _layoutGroup _layoutGroup_19o20";

        expect(div).toMatchInlineSnapshot(`
          <div
            class="mx_EventTile_line _layoutGroup _layoutGroup_19o20"
          />
        `);
    });

    it("only handles elements and strings containing a class attribute", () => {
        expect(serializer.test("_layoutGroup_19o20_194")).toBe(false);
        expect(serializer.test(42)).toBe(false);
    });
});
