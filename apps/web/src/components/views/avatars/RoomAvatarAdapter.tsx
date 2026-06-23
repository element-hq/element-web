/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type AriaRole, type JSX, type Ref, useEffect } from "react";
import classNames from "classnames";
import { type Room } from "matrix-js-sdk/src/matrix";
import { RoomAvatarView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { type IOOBData } from "../../../stores/ThreepidInviteStore";
import { RoomAvatarViewModel } from "../../../viewmodels/avatars/RoomAvatarViewModel";

interface Props {
    /**
     * The room whose avatar should be displayed.
     * When omitted, `oobData.avatarUrl` must be provided.
     */
    "room"?: Room;
    /**
     * Out-of-band data used when the room object is not yet available,
     * e.g. during a three-pid invite flow.
     */
    "oobData"?: IOOBData & {
        roomId?: string;
    };
    /**
     * When `true`, clicking the avatar opens a full-size lightbox.
     */
    "viewAvatarOnClick"?: boolean;
    /**
     * Custom click handler. Takes precedence over the lightbox when both are set.
     */
    "onClick"?(): void;
    /**
     * Rendered size of the avatar in CSS units. Defaults to `"36px"`.
     */
    "size"?: string;
    /**
     * Avatar shape override. When omitted the adapter derives the shape from
     * the room type (square for spaces, round otherwise).
     */
    "type"?: "round" | "square";
    /**
     * Optional additional CSS class names.
     */
    "className"?: string;
    /**
     * Accessible label. Defaults to `"Avatar"`.
     */
    "altText"?: string;
    /**
     * Browser tooltip shown on hover.
     */
    "title"?: string;
    /**
     * Tab index forwarded to the avatar element.
     */
    "tabIndex"?: number;
    /**
     * ARIA role override.
     */
    "role"?: AriaRole;
    /**
     * When `true`, hides the avatar from the accessibility tree.
     */
    "aria-hidden"?: boolean | "true" | "false";
    /**
     * Ref forwarded to the underlying avatar element.
     */
    "ref"?: Ref<HTMLButtonElement | HTMLSpanElement>;
}

/**
 * MVVM adapter for a room avatar.
 *
 * Wires a {@link RoomAvatarViewModel} to {@link RoomAvatarView} and
 * synchronises changing props into the ViewModel via targeted setters.
 * Consumers interact with this adapter exactly as they would with the
 * old `RoomAvatar` component – the MVVM split is an implementation detail.
 */
function RoomAvatarAdapter({
    room,
    viewAvatarOnClick,
    onClick,
    oobData,
    size = "36px",
    type,
    className,
    ...viewProps
}: Readonly<Props>): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(
        () => new RoomAvatarViewModel({ room, size, oobData, viewAvatarOnClick, onClick, type }),
    );

    useEffect(() => {
        vm.setRoom(room);
    }, [room, vm]);

    useEffect(() => {
        vm.setSize(size);
    }, [size, vm]);

    useEffect(() => {
        vm.setOobData(oobData);
    }, [oobData, vm]);

    useEffect(() => {
        vm.setViewAvatarOnClick(viewAvatarOnClick);
    }, [viewAvatarOnClick, vm]);

    useEffect(() => {
        vm.setOnClick(onClick);
    }, [onClick, vm]);

    useEffect(() => {
        vm.setType(type);
    }, [type, vm]);

    return <RoomAvatarView vm={vm} size={size} className={classNames("mx_BaseAvatar", className)} {...viewProps} />;
}

export default RoomAvatarAdapter;
