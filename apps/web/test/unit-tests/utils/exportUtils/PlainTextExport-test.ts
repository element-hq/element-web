/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";

import { mocked } from "jest-mock-vitest-adapter";
import { saveAs } from "file-saver";

import { createTestClient, mkStubRoom, REPEATABLE_DATE } from "../../../test-utils";
import { ExportType, type IExportOptions } from "../../../../src/utils/exportUtils/exportUtils";
import PlainTextExporter from "../../../../src/utils/exportUtils/PlainTextExport";
import SettingsStore from "../../../../src/settings/SettingsStore";

jest.mock("file-saver", () => ({ saveAs: jest.fn() }));

class TestablePlainTextExporter extends PlainTextExporter {
    public async testCreateOutput(events: MatrixEvent[]): Promise<string> {
        return this.createOutput(events);
    }
}

describe("PlainTextExport", () => {
    let stubOptions: IExportOptions;
    let stubRoom: Room;
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(REPEATABLE_DATE);
        const roomName = "My / Test / Room: Welcome";
        const client = createTestClient();
        stubOptions = {
            attachmentsIncluded: false,
            maxSize: 50000000,
        };
        stubRoom = mkStubRoom("!myroom:example.org", roomName, client);
    });

    it("should start the exported file with a UTF-8 byte order mark", async () => {
        const exporter = new PlainTextExporter(stubRoom, ExportType.Timeline, stubOptions, () => {});

        await exporter.export();

        // Asserted as bytes rather than as text: the mark is what a reader looks at to know the
        // encoding, so what matters is that those three bytes lead the file.
        const saved = mocked(saveAs).mock.calls[0][0] as Blob;
        const bytes = new Uint8Array(await saved.arrayBuffer());
        expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    });

    it("should have an Element-branded destination file name", () => {
        const exporter = new PlainTextExporter(stubRoom, ExportType.Timeline, stubOptions, () => {});

        expect(exporter.destinationFileName).toMatchSnapshot();
    });

    it.each([
        [24, false, "Fri, Apr 16, 2021, 17:20:00 - @alice:example.com: Hello, world!\n"],
        [12, true, "Fri, Apr 16, 2021, 5:20:00 PM - @alice:example.com: Hello, world!\n"],
    ])("should return text with %i hr time format", async (hour: number, setting: boolean, expectedMessage: string) => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string): any =>
            settingName === "showTwelveHourTimestamps" ? setting : undefined,
        );
        const events: MatrixEvent[] = [
            new MatrixEvent({
                type: "m.room.message",
                content: {
                    body: "Hello, world!",
                },
                sender: "@alice:example.com",
                origin_server_ts: 1618593600000,
            }),
        ];
        const exporter = new TestablePlainTextExporter(stubRoom, ExportType.Timeline, stubOptions, () => {});
        const output = await exporter.testCreateOutput(events);
        expect(output).toBe(expectedMessage);
    });
});
