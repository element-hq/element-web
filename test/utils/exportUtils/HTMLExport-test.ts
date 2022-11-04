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

import { mocked } from "jest-mock";

import { createTestClient, mkStubRoom, REPEATABLE_DATE } from "../../test-utils";
import { ExportType, IExportOptions } from "../../../src/utils/exportUtils/exportUtils";
import SdkConfig from "../../../src/SdkConfig";
import HTMLExporter from "../../../src/utils/exportUtils/HtmlExport";

describe("HTMLExport", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(REPEATABLE_DATE);
    });

    afterEach(() => {
        mocked(SdkConfig.get).mockRestore();
    });

    it("should have an SDK-branded destination file name", () => {
        const roomName = "My / Test / Room: Welcome";
        const client = createTestClient();
        const stubOptions: IExportOptions = {
            attachmentsIncluded: false,
            maxSize: 50000000,
        };
        const stubRoom = mkStubRoom("!myroom:example.org", roomName, client);
        const exporter = new HTMLExporter(stubRoom, ExportType.Timeline, stubOptions, () => {});

        expect(exporter.destinationFileName).toMatchSnapshot();

        jest.spyOn(SdkConfig, "get").mockImplementation(() => {
            return { brand: "BrandedChat/WithSlashes/ForFun" };
        });

        expect(exporter.destinationFileName).toMatchSnapshot();
    });
});
