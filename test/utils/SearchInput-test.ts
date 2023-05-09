/*
Copyright 2023 Boluwatife Omosowon <boluomosowon@gmail.com>

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

import { parsePermalink } from "../../src/utils/permalinks/Permalinks";
import { transformSearchTerm } from "../../src/utils/SearchInput";

jest.mock("../../src/utils/permalinks/Permalinks");

describe("transforming search term", () => {
    it("should return the primaryEntityId if the search term was a permalink", () => {
        const roomLink = "https://matrix.to/#/#element-dev:matrix.org";
        const parsedPermalink = "#element-dev:matrix.org";

        mocked(parsePermalink).mockReturnValue({
            primaryEntityId: parsedPermalink,
            roomIdOrAlias: parsedPermalink,
            eventId: "",
            userId: "",
            viaServers: [],
            sigil: "",
        });

        expect(transformSearchTerm(roomLink)).toBe(parsedPermalink);
    });

    it("should return the original search term if the search term is a permalink and the primaryEntityId is null", () => {
        const searchTerm = "https://matrix.to/#/#random-link:matrix.org";

        mocked(parsePermalink).mockReturnValue({
            primaryEntityId: null,
            roomIdOrAlias: null,
            eventId: null,
            userId: null,
            viaServers: null,
            sigil: "?",
        });

        expect(transformSearchTerm(searchTerm)).toBe(searchTerm);
    });

    it("should return the original search term if the search term was not a permalink", () => {
        const searchTerm = "search term";
        mocked(parsePermalink).mockReturnValue(null);
        expect(transformSearchTerm(searchTerm)).toBe(searchTerm);
    });
});
