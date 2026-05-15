/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { TimelineRenderingType } from "../../../src/contexts/RoomContext";
import { Action } from "../../../src/dispatcher/actions";
import type { MatrixDispatcher } from "../../../src/dispatcher/dispatcher";
import { type ComposerInsertPayload, ComposerType } from "../../../src/dispatcher/payloads/ComposerInsertPayload";
import { ComposerApi } from "../../../src/modules/ComposerApi";

describe("ComposerApi", () => {
    it("should be able to insert text via insertTextIntoComposer()", () => {
        const dispatcher = {
            dispatch: jest.fn(),
        } as unknown as MatrixDispatcher;
        const api = new ComposerApi(dispatcher);
        api.insertPlaintextIntoComposer("Hello world", { view: "room" });
        expect(dispatcher.dispatch).toHaveBeenCalledWith({
            action: Action.ComposerInsert,
            text: "Hello world",
            timelineRenderingType: TimelineRenderingType.Room,
            composerType: ComposerType.Send,
        } satisfies ComposerInsertPayload);
    });
});
