/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect } from "vitest";
import { fn } from "storybook/test";
import userEvent from "@testing-library/user-event";

import * as stories from "./GridFileList.stories";
import { BaseViewModel } from "../../core/viewmodel";
import type { FileShareViewModel, FileShareViewSnapshot } from "./Viewmodel";
import { FileListView } from "./FileList";

const { Default } = composeStories(stories);

class MockViewModel extends BaseViewModel<FileShareViewSnapshot, unknown> implements FileShareViewModel {
    public constructor(snapshot: FileShareViewSnapshot) {
        super(undefined, snapshot);
    }
    public loadFiles = fn();
    public setCurrentDirectory = fn();
    public goBackDirectory = fn();
    public onFileSelected = fn();
    public getThumbnailForFile = fn().mockResolvedValue(null);
    public setFileViewSetting = fn();
}

function renderView(initialSnapshot?: Partial<FileShareViewSnapshot>): [ReturnType<typeof render>, MockViewModel] {
    const snapshot: FileShareViewSnapshot = {
        currentDirectory: [],
        directories: [],
        files: [
            {
                id: "a_file",
                name: "myfile.txt",
            },
        ],
        selectedFiles: [],
        loading: false,
        sending: false,
        viewSetting: "list",
        ...initialSnapshot,
    };
    const vm = new MockViewModel(snapshot);
    const result = render(<FileListView vm={vm} />);
    return [result, vm];
}

describe("<FileListView />", () => {
    it("renders Default story", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });
    it("can select a file in details mode", async () => {
        const [{ getByLabelText }, vm] = renderView();
        await userEvent.click(getByLabelText("myfile.txt"));
        expect(vm.onFileSelected).toHaveBeenCalledWith("a_file");
    });
    it("can select a file in grid mode", async () => {
        const [{ getByLabelText }, vm] = renderView({ viewSetting: "grid" });
        await userEvent.click(getByLabelText("myfile.txt"));
        expect(vm.onFileSelected).toHaveBeenCalledWith("a_file");
    });
});
