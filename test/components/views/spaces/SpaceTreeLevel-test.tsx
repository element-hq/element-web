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
// eslint-disable-next-line deprecate/import
import { mount } from "enzyme";

import { stubClient, mkRoom } from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import defaultDispatcher from "../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../src/dispatcher/actions";
import { SpaceButton } from "../../../../src/components/views/spaces/SpaceTreeLevel";
import { MetaSpace, SpaceKey } from "../../../../src/stores/spaces";
import SpaceStore from "../../../../src/stores/spaces/SpaceStore";

jest.mock("../../../../src/stores/spaces/SpaceStore", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const EventEmitter = require("events");
    class MockSpaceStore extends EventEmitter {
        activeSpace: SpaceKey = "!space1";
        setActiveSpace = jest.fn();
    }

    return { instance: new MockSpaceStore() };
});

describe("SpaceButton", () => {
    stubClient();
    const space = mkRoom(MatrixClientPeg.get(), "!1:example.org");
    DMRoomMap.makeShared();

    const dispatchSpy = jest.spyOn(defaultDispatcher, "dispatch");

    afterEach(jest.clearAllMocks);

    describe("real space", () => {
        it("activates the space on click", () => {
            const button = mount(<SpaceButton space={space} selected={false} label="My space" />);

            expect(SpaceStore.instance.setActiveSpace).not.toHaveBeenCalled();
            button.simulate("click");
            expect(SpaceStore.instance.setActiveSpace).toHaveBeenCalledWith("!1:example.org");
        });

        it("navigates to the space home on click if already active", () => {
            const button = mount(<SpaceButton space={space} selected={true} label="My space" />);

            expect(dispatchSpy).not.toHaveBeenCalled();
            button.simulate("click");
            expect(dispatchSpy).toHaveBeenCalledWith({ action: Action.ViewRoom, room_id: "!1:example.org" });
        });
    });

    describe("metaspace", () => {
        it("activates the metaspace on click", () => {
            const button = mount(<SpaceButton spaceKey={MetaSpace.People} selected={false} label="People" />);

            expect(SpaceStore.instance.setActiveSpace).not.toHaveBeenCalled();
            button.simulate("click");
            expect(SpaceStore.instance.setActiveSpace).toHaveBeenCalledWith(MetaSpace.People);
        });

        it("does nothing on click if already active", () => {
            const button = mount(<SpaceButton spaceKey={MetaSpace.People} selected={true} label="People" />);

            button.simulate("click");
            expect(dispatchSpy).not.toHaveBeenCalled();
            // Re-activating the metaspace is a no-op
            expect(SpaceStore.instance.setActiveSpace).toHaveBeenCalledWith(MetaSpace.People);
        });
    });
});
