/*
Copyright 2022 - 2023 The Matrix.org Foundation C.I.C.

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

import { ExtensibleEventType, IPartialEvent } from "../../../src/@types/extensible_events";
import { ExtensibleEvent } from "../../../src/extensible_events_v1/ExtensibleEvent";

class MockEvent extends ExtensibleEvent<any> {
    public constructor(wireEvent: IPartialEvent<any>) {
        super(wireEvent);
    }

    public serialize(): IPartialEvent<object> {
        throw new Error("Not implemented for tests");
    }

    public isEquivalentTo(primaryEventType: ExtensibleEventType): boolean {
        throw new Error("Not implemented for tests");
    }
}

describe("ExtensibleEvent", () => {
    it("should expose the wire event directly", () => {
        const input: IPartialEvent<any> = { type: "org.example.custom", content: { hello: "world" } };
        const event = new MockEvent(input);
        expect(event.wireFormat).toBe(input);
        expect(event.wireContent).toBe(input.content);
    });
});
