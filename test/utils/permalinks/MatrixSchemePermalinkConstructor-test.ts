/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { PermalinkParts } from "../../../src/utils/permalinks/PermalinkConstructor";
import MatrixSchemePermalinkConstructor from "../../../src/utils/permalinks/MatrixSchemePermalinkConstructor";

describe("MatrixSchemePermalinkConstructor", () => {
    const peramlinkConstructor = new MatrixSchemePermalinkConstructor();

    describe("parsePermalink", () => {
        it("should strip ?action=chat from user links", () => {
            expect(peramlinkConstructor.parsePermalink("matrix:u/user:example.com?action=chat")).toEqual(
                new PermalinkParts(null, null, "@user:example.com", null),
            );
        });
    });
});
