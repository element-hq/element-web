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

import { MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import { createTestClient, mkStubRoom, REPEATABLE_DATE } from "../../test-utils";
import { ExportType, IExportOptions } from "../../../src/utils/exportUtils/exportUtils";
import PlainTextExporter from "../../../src/utils/exportUtils/PlainTextExport";
import SettingsStore from "../../../src/settings/SettingsStore";

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

    it("should have a Matrix-branded destination file name", () => {
        const exporter = new PlainTextExporter(stubRoom, ExportType.Timeline, stubOptions, () => {});

        expect(exporter.destinationFileName).toMatchSnapshot();
    });

    it.each([
        [24, false, "Fri, Apr 16, 2021, 17:20:00 - @alice:example.com: Hello, world!\n"],
        [12, true, "Fri, Apr 16, 2021, 5:20:00 PM - @alice:example.com: Hello, world!\n"],
    ])("should return text with %i hr time format", async (hour: number, setting: boolean, expectedMessage: string) => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) =>
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
