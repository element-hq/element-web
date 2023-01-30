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

import { fireEvent, getByTestId, render } from "@testing-library/react";
import { MatrixClient, PendingEventOrdering } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import React from "react";
import { act } from "react-dom/test-utils";

import MemberAvatar from "../../../../src/components/views/avatars/MemberAvatar";
import RoomContext from "../../../../src/contexts/RoomContext";
import { mediaFromMxc } from "../../../../src/customisations/Media";
import { ViewUserPayload } from "../../../../src/dispatcher/payloads/ViewUserPayload";
import defaultDispatcher from "../../../../src/dispatcher/dispatcher";
import { SettingLevel } from "../../../../src/settings/SettingLevel";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { getRoomContext } from "../../../test-utils/room";
import { stubClient } from "../../../test-utils/test-utils";
import { Action } from "../../../../src/dispatcher/actions";

type Props = React.ComponentPropsWithoutRef<typeof MemberAvatar>;

describe("MemberAvatar", () => {
    const ROOM_ID = "roomId";

    let mockClient: MatrixClient;
    let room: Room;
    let member: RoomMember;

    function getComponent(props: Partial<Props>) {
        return (
            <RoomContext.Provider value={getRoomContext(room, {})}>
                <MemberAvatar member={null} width={35} height={35} {...props} />
            </RoomContext.Provider>
        );
    }

    beforeEach(() => {
        mockClient = stubClient();

        room = new Room(ROOM_ID, mockClient, mockClient.getUserId() ?? "", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        member = new RoomMember(ROOM_ID, "@bob:example.org");
        jest.spyOn(room, "getMember").mockReturnValue(member);
    });

    it("supports 'null' members", () => {
        const { container } = render(getComponent({ member: null }));

        expect(container.querySelector("img")).not.toBeNull();
    });

    it("matches the snapshot", () => {
        jest.spyOn(member, "getMxcAvatarUrl").mockReturnValue("http://placekitten.com/400/400");
        const { container } = render(
            getComponent({
                member,
                fallbackUserId: "Fallback User ID",
                title: "Hover title",
                style: {
                    color: "pink",
                },
            }),
        );

        expect(container).toMatchSnapshot();
    });

    it("shows an avatar for useOnlyCurrentProfiles", () => {
        jest.spyOn(member, "getMxcAvatarUrl").mockReturnValue("http://placekitten.com/400/400");

        SettingsStore.setValue("useOnlyCurrentProfiles", null, SettingLevel.DEVICE, true);

        const { container } = render(getComponent({}));

        const avatar = getByTestId<HTMLImageElement>(container, "avatar-img");
        expect(avatar).toBeInTheDocument();
        expect(avatar.getAttribute("src")).not.toBe("");
    });

    it("uses the member's configured avatar", () => {
        const mxcUrl = "mxc://example.com/avatars/user.tiff";
        jest.spyOn(member, "getMxcAvatarUrl").mockReturnValue(mxcUrl);

        const { container } = render(getComponent({ member }));

        const img = container.querySelector("img");
        expect(img).not.toBeNull();
        expect(img!.src).toBe(mediaFromMxc(mxcUrl).srcHttp);
    });

    it("uses a fallback when the member has no avatar", () => {
        jest.spyOn(member, "getMxcAvatarUrl").mockReturnValue(undefined);

        const { container } = render(getComponent({ member }));

        const img = container.querySelector(".mx_BaseAvatar_image");
        expect(img).not.toBeNull();
    });

    it("dispatches on click", () => {
        const { container } = render(getComponent({ member, viewUserOnClick: true }));

        const spy = jest.spyOn(defaultDispatcher, "dispatch");

        act(() => {
            fireEvent.click(container.querySelector(".mx_BaseAvatar")!);
        });

        expect(spy).toHaveBeenCalled();
        const [payload] = spy.mock.lastCall!;
        expect(payload).toStrictEqual<ViewUserPayload>({
            action: Action.ViewUser,
            member,
            push: false,
        });
    });
});
