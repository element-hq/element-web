/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, fireEvent } from "jest-matrix-react";
import { useMockedViewModel } from "@element-hq/web-shared-components";

import FileDropTarget from "../../../../src/components/structures/FileDropTarget.tsx";
import { RoomUploadContext, type RoomUploadViewModel } from "../../../../src/viewmodels/room/RoomUploadViewModel.tsx";

function FileDropTargetWrapped({
    element,
    mayDragAndDropFile = false,
    onFileDrop,
}: {
    element: HTMLDivElement;
    mayDragAndDropFile?: boolean;
    onFileDrop: RoomUploadViewModel["initiateViaDataTransfer"];
}) {
    const mockVm = useMockedViewModel<
        { mayDragAndDropFile: boolean },
        Pick<RoomUploadViewModel, "initiateViaDataTransfer">
    >({ mayDragAndDropFile }, { initiateViaDataTransfer: onFileDrop });
    return (
        <RoomUploadContext.Provider value={mockVm as RoomUploadViewModel}>
            <FileDropTarget parent={element} />
        </RoomUploadContext.Provider>
    );
}

describe("FileDropTarget", () => {
    it("should render nothing when idle", () => {
        const element = document.createElement("div");
        const onFileDrop = jest.fn();

        const { asFragment } = render(
            <FileDropTargetWrapped element={element} mayDragAndDropFile onFileDrop={onFileDrop} />,
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render drop file prompt on mouse over with file if permissions allow", () => {
        const element = document.createElement("div");
        const onFileDrop = jest.fn();
        const { asFragment } = render(
            <FileDropTargetWrapped element={element} mayDragAndDropFile onFileDrop={onFileDrop} />,
        );
        fireEvent.dragEnter(element, {
            dataTransfer: {
                types: ["Files"],
            },
        });
        expect(asFragment()).toMatchSnapshot();
    });

    it("should not render drop file prompt on mouse over with file if permissions do not allow", () => {
        const element = document.createElement("div");
        const onFileDrop = jest.fn();
        const { asFragment } = render(<FileDropTargetWrapped element={element} onFileDrop={onFileDrop} />);
        fireEvent.dragEnter(element, {
            dataTransfer: {
                types: ["Files"],
            },
        });
        expect(asFragment()).toMatchSnapshot();
    });
});
