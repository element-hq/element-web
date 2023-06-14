/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MatrixClient, Room } from "matrix-js-sdk/src/matrix";

import BasicMessageComposer from "../../../../src/components/views/rooms/BasicMessageComposer";
import * as TestUtils from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import EditorModel from "../../../../src/editor/model";
import { createPartCreator, createRenderer } from "../../../editor/mock";
import SettingsStore from "../../../../src/settings/SettingsStore";

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
