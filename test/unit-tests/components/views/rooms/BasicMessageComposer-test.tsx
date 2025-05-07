/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { type MatrixClient, Room } from "matrix-js-sdk/src/matrix";

import BasicMessageComposer from "../../../../../src/components/views/rooms/BasicMessageComposer";
import * as TestUtils from "../../../../test-utils";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import EditorModel from "../../../../../src/editor/model";
import { createPartCreator, createRenderer } from "../../../editor/mock";
import SettingsStore from "../../../../../src/settings/SettingsStore";

describe("BasicMessageComposer", () => {
    const renderer = createRenderer();
    const pc = createPartCreator();

    TestUtils.stubClient();

    const client: MatrixClient = MatrixClientPeg.safeGet();

    const roomId = "!1234567890:domain";
    const userId = client.getSafeUserId();
    const room = new Room(roomId, client, userId);

    it("should allow a user to paste a URL without it being mangled", async () => {
        const model = new EditorModel([], pc, renderer);
        render(<BasicMessageComposer model={model} room={room} />);
        const testUrl = "https://element.io";
        const mockDataTransfer = generateMockDataTransferForString(testUrl);
        await userEvent.paste(mockDataTransfer);

        expect(model.parts).toHaveLength(1);
        expect(model.parts[0].text).toBe(testUrl);
        expect(screen.getByText(testUrl)).toBeInTheDocument();
    });

    it("should replaceEmoticons properly", async () => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
            return settingName === "MessageComposerInput.autoReplaceEmoji";
        });
        userEvent.setup();
        const model = new EditorModel([], pc, renderer);
        render(<BasicMessageComposer model={model} room={room} />);

        const tranformations = [
            { before: "4:3 video", after: "4:3 video" },
            { before: "regexp 12345678", after: "regexp 12345678" },
            { before: "--:--)", after: "--:--)" },

            { before: "we <3 matrix", after: "we ❤️ matrix" },
            { before: "hello world :-)", after: "hello world 🙂" },
            { before: ":) hello world", after: "🙂 hello world" },
            { before: ":D 4:3 video :)", after: "😄 4:3 video 🙂" },

            { before: ":-D", after: "😄" },
            { before: ":D", after: "😄" },
            { before: ":3", after: "😽" },
            { before: "=-]", after: "🙂" },
        ];
        const input = screen.getByRole("textbox");

        for (const { before, after } of tranformations) {
            await userEvent.clear(input);
            //add a space after the text to trigger the replacement
            await userEvent.type(input, before + " ");
            const transformedText = model.parts.map((part) => part.text).join("");
            expect(transformedText).toBe(after + " ");
        }
    });

    it("should not mangle shift-enter when the autocomplete is open", async () => {
        const model = new EditorModel([], pc, renderer);
        render(<BasicMessageComposer model={model} room={room} />);

        const input = screen.getByRole("textbox");

        await userEvent.type(input, "/plain foobar");
        await userEvent.type(input, "{Shift>}{Enter}{/Shift}");
        const transformedText = model.parts.map((part) => part.text).join("");
        expect(transformedText).toBe("/plain foobar\n");
    });

    it("should escape single quote in placeholder", async () => {
        const model = new EditorModel([], pc, renderer);
        const composer = render(<BasicMessageComposer placeholder="Don't" model={model} room={room} />);
        const input = composer.queryAllByRole("textbox");
        const placeholder = input[0].style.getPropertyValue("--placeholder");
        expect(placeholder).toMatch("'Don\\'t'");
    });

    it("should escape backslash in placeholder", async () => {
        const model = new EditorModel([], pc, renderer);
        const composer = render(<BasicMessageComposer placeholder={"w\\e"} model={model} room={room} />);
        const input = composer.queryAllByRole("textbox");
        const placeholder = input[0].style.getPropertyValue("--placeholder");
        expect(placeholder).toMatch("'w\\\\e'");
    });
});

function generateMockDataTransferForString(string: string): DataTransfer {
    return {
        getData: (type) => {
            if (type === "text/plain") {
                return string;
            }
            return "";
        },
        dropEffect: "link",
        effectAllowed: "link",
        files: {} as FileList,
        items: {} as DataTransferItemList,
        types: [],
        clearData: () => {},
        setData: () => {},
        setDragImage: () => {},
    };
}
