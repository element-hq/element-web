/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import JSONExporter from "../../../../src/utils/exportUtils/JSONExport";
import { createTestClient, mkStubRoom, REPEATABLE_DATE } from "../../../test-utils";
import { ExportType, type IExportOptions } from "../../../../src/utils/exportUtils/exportUtils";

describe("JSONExport", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(REPEATABLE_DATE);
    });

    it("should have a Matrix-branded destination file name", () => {
        const roomName = "My / Test / Room: Welcome";
        const client = createTestClient();
        const stubOptions: IExportOptions = {
            attachmentsIncluded: false,
            maxSize: 50000000,
        };
        const stubRoom = mkStubRoom("!myroom:example.org", roomName, client);
        const exporter = new JSONExporter(stubRoom, ExportType.Timeline, stubOptions, () => {});

        expect(exporter.destinationFileName).toMatchSnapshot();
    });
});
