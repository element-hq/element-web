/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    addPendingComposerAttachments,
    removePendingComposerAttachment,
} from "../../../../../../src/components/views/rooms/composer/PendingComposerAttachments";

describe("PendingComposerAttachments", () => {
    const firstFile = new File(["first"], "first.png", { type: "image/png" });
    const secondFile = new File(["second"], "second.jpg", { type: "image/jpeg" });

    it("adds selected image files as pending attachments with stable ids", () => {
        const createObjectURL = jest.fn((file: File) => `blob:${file.name}`);

        const pending = addPendingComposerAttachments([], [firstFile, secondFile], {
            createObjectURL,
            createId: (file, index) => `${file.name}-${index}`,
        });

        expect(pending).toEqual([
            { id: "first.png-0", file: firstFile, objectUrl: "blob:first.png" },
            { id: "second.jpg-1", file: secondFile, objectUrl: "blob:second.jpg" },
        ]);
        expect(pending[0]).not.toHaveProperty("caption");
        expect(pending[1]).not.toHaveProperty("caption");
        expect(createObjectURL).toHaveBeenCalledWith(firstFile);
        expect(createObjectURL).toHaveBeenCalledWith(secondFile);
    });

    it("removes a pending attachment by id and revokes its object url", () => {
        const revokeObjectURL = jest.fn();
        const pending = [
            { id: "keep", file: firstFile, objectUrl: "blob:keep" },
            { id: "remove", file: secondFile, objectUrl: "blob:remove" },
        ];

        const updated = removePendingComposerAttachment(pending, "remove", { revokeObjectURL });

        expect(updated).toEqual([{ id: "keep", file: firstFile, objectUrl: "blob:keep" }]);
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:remove");
    });
});
