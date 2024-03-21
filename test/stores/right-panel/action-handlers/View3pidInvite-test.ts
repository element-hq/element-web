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

import { MockedObject } from "jest-mock";
import { EventType, MatrixEvent } from "matrix-js-sdk/src/matrix";

import { Action } from "../../../../src/dispatcher/actions";
import { onView3pidInvite } from "../../../../src/stores/right-panel/action-handlers";
import RightPanelStore from "../../../../src/stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../../../src/stores/right-panel/RightPanelStorePhases";

describe("onView3pidInvite()", () => {
    let rightPanelStore!: MockedObject<RightPanelStore>;

    beforeEach(() => {
        rightPanelStore = {
            pushCard: jest.fn(),
            showOrHidePanel: jest.fn(),
        } as unknown as MockedObject<RightPanelStore>;
    });

    it("should display room member list when payload has a falsy event", () => {
        const payload = {
            action: Action.View3pidInvite,
        };
        onView3pidInvite(payload, rightPanelStore);

        expect(rightPanelStore.showOrHidePanel).toHaveBeenCalledWith(RightPanelPhases.RoomMemberList);
        expect(rightPanelStore.pushCard).not.toHaveBeenCalled();
    });

    it("should push a 3pid member card on the right panel stack when payload has an event", () => {
        const payload = {
            action: Action.View3pidInvite,
            event: new MatrixEvent({ type: EventType.RoomThirdPartyInvite }),
        };
        onView3pidInvite(payload, rightPanelStore);

        expect(rightPanelStore.showOrHidePanel).not.toHaveBeenCalled();
        expect(rightPanelStore.pushCard).toHaveBeenCalledWith({
            phase: RightPanelPhases.Room3pidMemberInfo,
            state: { memberInfoEvent: payload.event },
        });
    });
});
