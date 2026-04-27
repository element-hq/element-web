/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, fireEvent } from "jest-matrix-react";
import { useMockedViewModel } from "@element-hq/web-shared-components";

import FileDropTarget from "../../../../src/components/structures/FileDropTarget.tsx";
import {
    RoomUploadContext,
    type RoomUploadViewActions,
    type RoomUploadViewModel,
    type RoomUploadViewSnapshot,
} from "../../../../src/viewmodels/room/RoomUploadViewModel.tsx";

function FileDropTargetWrapped({
    element,
    snapshot,
    actions,
}: {
    element: HTMLDivElement;
    snapshot: RoomUploadViewSnapshot;
    actions: Partial<RoomUploadViewActions>;
}) {
    const mockVm = useMockedViewModel<RoomUploadViewSnapshot, RoomUploadViewActions>(
        snapshot,
        actions as RoomUploadViewActions,
    );
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
            <FileDropTargetWrapped
                element={element}
                snapshot={{ mayUpload: true }}
                actions={{ initiateViaDataTransfer: onFileDrop }}
            />,
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render drop file prompt on mouse over with file if permissions allow", () => {
        const element = document.createElement("div");
        const onFileDrop = jest.fn();
        const { asFragment } = render(
            <FileDropTargetWrapped
                element={element}
                snapshot={{ mayUpload: true }}
                actions={{ initiateViaDataTransfer: onFileDrop }}
            />,
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
        const { asFragment } = render(
            <FileDropTargetWrapped
                element={element}
                snapshot={{ mayUpload: false }}
                actions={{ initiateViaDataTransfer: onFileDrop }}
            />,
        );
        fireEvent.dragEnter(element, {
            dataTransfer: {
                types: ["Files"],
            },
        });
        expect(asFragment()).toMatchSnapshot();
    });
});
