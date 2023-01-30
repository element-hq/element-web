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

import { fireEvent, render } from "@testing-library/react";
import { ClientEvent, PendingEventOrdering } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import React from "react";
import { act } from "react-dom/test-utils";
import { SyncState } from "matrix-js-sdk/src/sync";

import type { MatrixClient } from "matrix-js-sdk/src/client";
import RoomContext from "../../../../src/contexts/RoomContext";
import { getRoomContext } from "../../../test-utils/room";
import { stubClient } from "../../../test-utils/test-utils";
import BaseAvatar from "../../../../src/components/views/avatars/BaseAvatar";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";

type Props = React.ComponentPropsWithoutRef<typeof BaseAvatar>;

describe("<BaseAvatar />", () => {
    let client: MatrixClient;
    let room: Room;
    let member: RoomMember;

    function getComponent(props: Partial<Props>) {
        return (
            <MatrixClientContext.Provider value={client}>
                <RoomContext.Provider value={getRoomContext(room, {})}>
                    <BaseAvatar name="" {...props} />
                </RoomContext.Provider>
            </MatrixClientContext.Provider>
        );
    }

    function failLoadingImg(container: HTMLElement): void {
        const img = container.querySelector<HTMLImageElement>("img")!;
        expect(img).not.toBeNull();
        act(() => {
            fireEvent.error(img);
        });
    }

    function emitReconnect(): void {
        act(() => {
            client.emit(ClientEvent.Sync, SyncState.Prepared, SyncState.Reconnecting);
        });
    }

    beforeEach(() => {
        client = stubClient();

        room = new Room("!room:example.com", client, client.getUserId() ?? "", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        member = new RoomMember(room.roomId, "@bob:example.org");
        jest.spyOn(room, "getMember").mockReturnValue(member);
    });

    it("renders with minimal properties", () => {
        const { container } = render(getComponent({}));

        expect(container.querySelector(".mx_BaseAvatar")).not.toBeNull();
    });

    it("matches snapshot (avatar)", () => {
        const { container } = render(
            getComponent({
                name: "CoolUser22",
                title: "Hover title",
                url: "https://example.com/images/avatar.gif",
                className: "mx_SomethingArbitrary",
            }),
        );

        expect(container).toMatchSnapshot();
    });

    it("matches snapshot (avatar + click)", () => {
        const { container } = render(
            getComponent({
                name: "CoolUser22",
                title: "Hover title",
                url: "https://example.com/images/avatar.gif",
                className: "mx_SomethingArbitrary",
                onClick: () => {},
            }),
        );

        expect(container).toMatchSnapshot();
    });

    it("matches snapshot (no avatar)", () => {
        const { container } = render(
            getComponent({
                name: "xX_Element_User_Xx",
                title: ":kiss:",
                defaultToInitialLetter: true,
                className: "big-and-bold",
            }),
        );

        expect(container).toMatchSnapshot();
    });

    it("matches snapshot (no avatar + click)", () => {
        const { container } = render(
            getComponent({
                name: "xX_Element_User_Xx",
                title: ":kiss:",
                defaultToInitialLetter: true,
                className: "big-and-bold",
                onClick: () => {},
            }),
        );

        expect(container).toMatchSnapshot();
    });

    it("uses fallback images", () => {
        const images = [...Array(10)].map((_, i) => `https://example.com/images/${i}.webp`);

        const { container } = render(
            getComponent({
                url: images[0],
                urls: images.slice(1),
            }),
        );

        for (const image of images) {
            expect(container.querySelector("img")!.src).toBe(image);
            failLoadingImg(container);
        }
    });

    it("re-renders on reconnect", () => {
        const primary = "https://example.com/image.jpeg";
        const fallback = "https://example.com/fallback.png";
        const { container } = render(
            getComponent({
                url: primary,
                urls: [fallback],
            }),
        );

        failLoadingImg(container);
        expect(container.querySelector("img")!.src).toBe(fallback);

        emitReconnect();
        expect(container.querySelector("img")!.src).toBe(primary);
    });

    it("renders with an image", () => {
        const url = "https://example.com/images/small/avatar.gif?size=realBig";
        const { container } = render(getComponent({ url }));

        const img = container.querySelector("img");
        expect(img!.src).toBe(url);
    });

    it("renders the initial letter", () => {
        const { container } = render(getComponent({ name: "Yellow", defaultToInitialLetter: true }));

        const avatar = container.querySelector<HTMLSpanElement>(".mx_BaseAvatar_initial")!;
        expect(avatar.innerHTML).toBe("Y");
    });

    it.each([{}, { name: "CoolUser22" }, { name: "XxElement_FanxX", defaultToInitialLetter: true }])(
        "includes a click handler",
        (props: Partial<Props>) => {
            const onClick = jest.fn();

            const { container } = render(
                getComponent({
                    ...props,
                    onClick,
                }),
            );

            act(() => {
                fireEvent.click(container.querySelector(".mx_BaseAvatar")!);
            });

            expect(onClick).toHaveBeenCalled();
        },
    );
});
