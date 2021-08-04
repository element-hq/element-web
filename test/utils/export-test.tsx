/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { MatrixClient, Room } from "matrix-js-sdk";
import { MatrixClientPeg } from "../../src/MatrixClientPeg";
import { textForFormat, IExportOptions, ExportTypes } from "../../src/utils/exportUtils/exportUtils";
import '../skinned-sdk';
import PlainTextExporter from "../../src/utils/exportUtils/PlainTextExport";
import * as TestUtilsMatrix from '../test-utils';
import { stubClient } from '../test-utils';

let client: MatrixClient;

const MY_USER_ID = "@me:here";

function generateRoomId() {
    return '!' + Math.random().toString().slice(2, 10) + ':domain';
}

describe('export', function() {
    stubClient();
    client = MatrixClientPeg.get();
    client.getUserId = () => {
        return MY_USER_ID;
    };

    const mockExportOptions: IExportOptions = {
        numberOfMessages: 5,
        maxSize: 100 * 1024 * 1024,
        attachmentsIncluded: false,
    };

    const invalidExportOptions: IExportOptions[] = [
        {
            numberOfMessages: 10**9,
            maxSize: 1024 * 1024 * 1024,
            attachmentsIncluded: false,
        },
        {
            numberOfMessages: -1,
            maxSize: 4096 * 1024 * 1024,
            attachmentsIncluded: false,
        },
        {
            numberOfMessages: 0,
            maxSize: 0,
            attachmentsIncluded: false,
        },
    ];

    const events = mkEvents();
    const room = createRoom();
    console.log(events, room);
    function createRoom() {
        const room = new Room(generateRoomId(), null, client.getUserId());
        return room;
    }

    function mkEvents() {
        const events = [];
        const ts0 = Date.now();
        for (let i = 0; i < 10; i++) {
            events.push(TestUtilsMatrix.mkMessage({
                    event: true, room: "!room:id", user: "@user:id",
                    ts: ts0 + i * 1000,
            }));
        }
        return events;
    }

    it('checks if the export format is valid', function() {
        expect(textForFormat('HTML')).toBeTruthy();
        expect(textForFormat('JSON')).toBeTruthy();
        expect(textForFormat('PLAIN_TEXT')).toBeTruthy();
        try {
            textForFormat('PDF');
            throw new Error("Expected to throw an error");
        } catch (e) {
            expect(e.message).toBe("Unknown format");
        }
    });

    it('checks if the export options are valid', function() {
        for (const exportOption of invalidExportOptions) {
            try {
                new PlainTextExporter(room, ExportTypes.BEGINNING, exportOption, null);
                throw new Error("Expected to throw an error");
            } catch (e) {
                expect(e.message).toBe("Invalid export options");
            }
        }
    });

    it('tests the file extension splitter', function() {
        const exporter = new PlainTextExporter(room, ExportTypes.BEGINNING, mockExportOptions, null);
        const fileNameWithExtensions = {
            "": ["", ""],
            "name": ["name", ""],
            "name.txt": ["name", ".txt"],
            ".htpasswd": ["", ".htpasswd"],
            "name.with.many.dots.myext": ["name.with.many.dots", ".myext"],
        };
        for (const fileName in fileNameWithExtensions) {
            expect(exporter.splitFileName(fileName)).toStrictEqual(fileNameWithExtensions[fileName]);
        }
    });

    // it('checks if the reply regex executes correctly', function() {
    //     const eventContents = [
    //         {
    //             "msgtype": "m.text",
    //             "body": "> <@me:here> Testing....\n\nTest",
    //             "expectedText": "",
    //         },
    //     ];
    // });
});

