/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type Ref, useEffect } from "react";
import classNames from "classnames";
import { type Room } from "matrix-js-sdk/src/matrix";
import {
    RoomAvatarView as RoomAvatarPresentationView,
    type RoomAvatarViewSnapshot,
    useCreateAutoDisposedViewModel,
} from "@element-hq/web-shared-components";

import { type IOOBData } from "../../../stores/ThreepidInviteStore";
import { RoomAvatarViewModel } from "../../../viewmodels/avatars/RoomAvatarViewModel";

interface Props {
    /**
     * The room whose avatar should be displayed.
     * When omitted, `oobData.avatarUrl` must be provided.
     */
    room?: Room;
    /**
     * Out-of-band data used when the room object is not yet available,
     * e.g. during a three-pid invite flow.
     */
    oobData?: IOOBData & {
        roomId?: string;
    };
    /**
     * When `true`, clicking the avatar opens a full-size lightbox.
     * Defaults to `false`; `false` and `undefined` are equivalent.
     */
    viewAvatarOnClick?: boolean;
    /**
     * Custom click handler. Takes precedence over the lightbox when both are set.
     */
    "onClick"?(): void;
    /**
     * Rendered size of the avatar in CSS units. Defaults to `"36px"`.
     */
    size?: string;
    /**
     * Avatar shape override. When omitted, the ViewModel derives `"square"` for
     * spaces and `"round"` for all other rooms and invites.
     */
    type?: "round" | "square";
    /**
     * Optional additional CSS class names.
     */
    className?: string;
    /**
     * Accessible label announced by assistive technologies.
     */
    altText?: string;
    /**
     * Browser tooltip shown on hover.
     */
    title?: string;
    /**
     * Tab index forwarded to the avatar element.
     */
    tabIndex?: number;
    /**
     * ARIA role override for the avatar element.
     */
    role?: RoomAvatarViewSnapshot["role"];
    /**
     * When `true`, hides the avatar from the accessibility tree.
     */
    "aria-hidden"?: boolean;
    /**
     * Ref forwarded to the underlying avatar element.
     */
    ref?: Ref<HTMLButtonElement | HTMLSpanElement>;
}

/**
 * Public room avatar component backed by MVVM.
 *
 * Wires a {@link RoomAvatarViewModel} to the shared room avatar view and
 * synchronises changing props into the ViewModel via targeted setters.
 * The MVVM split is an implementation detail for consumers.
 */
function RoomAvatar({
    room,
    viewAvatarOnClick = false,
    onClick,
    oobData,
    size = "36px",
    type,
    className,
    altText,
    title,
    tabIndex,
    role,
    "aria-hidden": ariaHidden,
    ref,
}: Readonly<Props>): JSX.Element {
    const avatarClassName = classNames("mx_BaseAvatar", className);
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new RoomAvatarViewModel({
                room,
                size,
                oobData,
                viewAvatarOnClick,
                onClick,
                type,
                className: avatarClassName,
                altText,
                title,
                tabIndex,
                role,
                ariaHidden,
            }),
    );

    useEffect(() => {
        vm.setRoom(room);
    }, [room, vm]);

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

    useEffect(() => {
        vm.setViewProps({
            size,
            className: avatarClassName,
            altText,
            title,
            tabIndex,
            role,
            ariaHidden,
        });
    }, [size, avatarClassName, altText, title, tabIndex, role, ariaHidden, vm]);

    return <RoomAvatarPresentationView vm={vm} ref={ref} />;
}

export default RoomAvatar;
