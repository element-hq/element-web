/* * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { type Meta, type StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { FileListView } from "./FileList";
import { withViewDocs } from "../../../.storybook/withViewDocs";
import type { FileShareActions, FileShareViewSnapshot } from "./Viewmodel";
import { useMockedViewModel } from "../../core/viewmodel";

const FileListWrapperImpl = (snapshot: FileShareViewSnapshot): JSX.Element => {
    const vm = useMockedViewModel<FileShareViewSnapshot, FileShareActions>(snapshot, {
        onFileSelected: fn(),
        setCurrentDirectory: fn(),
        setFileViewSetting: fn(),
        loadFiles: fn(),
        getThumbnailForFile: async () => null,
        goBackDirectory: fn(),
    });
    return <FileListView vm={vm} />;
};

const FileListWrapper = withViewDocs(FileListWrapperImpl, FileListView);

const meta = {
    title: "FileShare/FileList",
    component: FileListWrapper,
    tags: ["autodocs"],
    args: {
        currentDirectory: ["home", "user"],
        selectedFiles: [],
        files: [
            {
                id: "1",
                name: "testfile.txt",
                updatedAt: new Date(2026, 1, 15),
            },
            {
                id: "2",
                name: "image.png",
                updatedAt: new Date(2026, 1, 15),
            },
            {
                id: "3",
                name: "compressed.tar.gz",
                updatedAt: new Date(2026, 1, 15),
            },
            {
                id: "4",
                name: "no-extension",
                updatedAt: new Date(2026, 3, 15),
            },
            {
                id: "5",
                name: "no modified time",
            },
        ],
        directories: [
            {
                id: "1",
                name: "A directory",
            },
        ],
        loading: false,
        sending: false,
        viewSetting: "list",
    },
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/1UCf1hF507QaRus3CUBKGn/Nectcloud-File-Picker?node-id=2138-14865&t=njpHkpdk8tVhp7cr-0",
        },
    },
} satisfies Meta<typeof FileListWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AsGrid: Story = {
    args: {
        viewSetting: "grid",
    },
};
