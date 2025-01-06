/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import EditorModel from "../../../src/editor/model";
import { createPartCreator, createRenderer } from "./mock";

describe("editor/position", function () {
    it("move first position backward in empty model", function () {
        const model = new EditorModel([], createPartCreator(), createRenderer());
        const pos = model.positionForOffset(0, true);
        const pos2 = pos.backwardsWhile(model, () => true);
        expect(pos).toBe(pos2);
    });
    it("move first position forwards in empty model", function () {
        const model = new EditorModel([], createPartCreator(), createRenderer());
        const pos = model.positionForOffset(0, true);
        const pos2 = pos.forwardsWhile(model, () => true);
        expect(pos).toBe(pos2);
    });
    it("move forwards within one part", function () {
        const pc = createPartCreator();
        const model = new EditorModel([pc.plain("hello")], pc, createRenderer());
        const pos = model.positionForOffset(1);
        let n = 3;
        const pos2 = pos.forwardsWhile(model, () => {
            n -= 1;
            return n >= 0;
        });
        expect(pos2.index).toBe(0);
        expect(pos2.offset).toBe(4);
    });
    it("move forwards crossing to other part", function () {
        const pc = createPartCreator();
        const model = new EditorModel([pc.plain("hello"), pc.plain(" world")], pc, createRenderer());
        const pos = model.positionForOffset(4);
        let n = 3;
        const pos2 = pos.forwardsWhile(model, () => {
            n -= 1;
            return n >= 0;
        });
        expect(pos2.index).toBe(1);
        expect(pos2.offset).toBe(2);
    });
    it("move backwards within one part", function () {
        const pc = createPartCreator();
        const model = new EditorModel([pc.plain("hello")], pc, createRenderer());
        const pos = model.positionForOffset(4);
        let n = 3;
        const pos2 = pos.backwardsWhile(model, () => {
            n -= 1;
            return n >= 0;
        });
        expect(pos2.index).toBe(0);
        expect(pos2.offset).toBe(1);
    });
    it("move backwards crossing to other part", function () {
        const pc = createPartCreator();
        const model = new EditorModel([pc.plain("hello"), pc.plain(" world")], pc, createRenderer());
        const pos = model.positionForOffset(7);
        let n = 3;
        const pos2 = pos.backwardsWhile(model, () => {
            n -= 1;
            return n >= 0;
        });
        expect(pos2.index).toBe(0);
        expect(pos2.offset).toBe(4);
    });
});
