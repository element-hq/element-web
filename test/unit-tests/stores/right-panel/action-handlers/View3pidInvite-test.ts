/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MockedObject } from "jest-mock";
import { EventType, MatrixEvent } from "matrix-js-sdk/src/matrix";

import { Action } from "../../../../../src/dispatcher/actions";
import { onView3pidInvite } from "../../../../../src/stores/right-panel/action-handlers";
import type RightPanelStore from "../../../../../src/stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../../../../src/stores/right-panel/RightPanelStorePhases";

describe("onView3pidInvite()", () => {
    let rightPanelStore!: MockedObject<RightPanelStore>;

    beforeEach(() => {
        rightPanelStore = {
            pushCard: jest.fn(),
            showOrHidePhase: jest.fn(),
        } as unknown as MockedObject<RightPanelStore>;
    });

    it("should display room member list when payload has a falsy event", () => {
        const payload = {
            action: Action.View3pidInvite,
        };
        onView3pidInvite(payload, rightPanelStore);

        expect(rightPanelStore.showOrHidePhase).toHaveBeenCalledWith(RightPanelPhases.MemberList);
        expect(rightPanelStore.pushCard).not.toHaveBeenCalled();
    });

    it("should push a 3pid member card on the right panel stack when payload has an event", () => {
        const payload = {
            action: Action.View3pidInvite,
            event: new MatrixEvent({ type: EventType.RoomThirdPartyInvite }),
        };
        onView3pidInvite(payload, rightPanelStore);

        expect(rightPanelStore.showOrHidePhase).not.toHaveBeenCalled();
        expect(rightPanelStore.pushCard).toHaveBeenCalledWith({
            phase: RightPanelPhases.ThreePidMemberInfo,
            state: { memberInfoEvent: payload.event },
        });
    });
});
