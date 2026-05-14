/* * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Meta, type StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { GridFileListView } from "./GridFileList";
import img from "../../../static/tallImage.png";

const meta = {
    title: "FileShare/GridFileList",
    component: GridFileListView,
    tags: ["autodocs"],
    args: {
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
        onFileSelected: fn(),
        onDirectoryChange: fn(),
        previewEngine: async (id) => {
            if (id === "2") {
                return img;
            }
            return null;
        },
    },
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/1UCf1hF507QaRus3CUBKGn/Nectcloud-File-Picker?node-id=2138-14865&t=njpHkpdk8tVhp7cr-0",
        },
        a11y: {
            config: {
                rules: [
                    {
                        // TODO: We need a new folder icon, the current one is a emoji and we
                        // can't determine the contrast.
                        id: "color-contrast",
                        enabled: false,
                    },
                    {
                        // So that we can hide the button which is just a bigger target for the checkbox.
                        id: "aria-hidden-focus",
                        enabled: false,
                    },
                ],
            },
        },
    },
} satisfies Meta<typeof GridFileListView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
