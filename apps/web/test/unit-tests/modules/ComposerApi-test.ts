/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Action } from "../../../src/dispatcher/actions";
import type { MatrixDispatcher } from "../../../src/dispatcher/dispatcher";
import { ComposerApi } from "../../../src/modules/ComposerApi";

describe("ComposerApi", () => {
    it("should be able to insert text via insertTextIntoComposer()", () => {
        const dispatcher = {
            dispatch: jest.fn(),
        } as unknown as MatrixDispatcher;
        const api = new ComposerApi(dispatcher);
        api.insertTextIntoComposer("Hello world");
        expect(dispatcher.dispatch).toHaveBeenCalledWith({
            action: Action.ComposerInsert,
            text: "Hello world",
        });
    });
});
