/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type AriaRole, type JSX, type Ref, useCallback, useEffect, useState } from "react";
import { Avatar } from "@vector-im/compound-web";

import { type ViewModel, useViewModel } from "../../../core/viewmodel";

/**
 * Data provided by the ViewModel to render a room avatar.
 */
export interface RoomAvatarViewSnapshot {
    /**
     * Display name of the room, used for the initial-letter fallback.
     */
    name: string;
    /**
     * Room ID (or DM user ID) used for consistent hash-colour generation.
     */
    idName?: string;
    /**
     * Priority-ordered list of avatar image URLs to try. The view cycles
     * through them on image load error.
     */
    urls: string[];
    /**
     * Avatar shape – round for regular rooms, square for spaces.
     */
    type: "round" | "square";
    /**
     * Whether the avatar should respond to clicks.
     */
    isClickable: boolean;
}

/**
 * Actions the host application can invoke on the room avatar ViewModel.
 */
export interface RoomAvatarViewActions {
    /**
     * Invoked when the user clicks the avatar.
     */
    onClick: () => void;
}

/**
 * Combined ViewModel type accepted by {@link RoomAvatarView}.
 */
export type RoomAvatarViewModel = ViewModel<RoomAvatarViewSnapshot, RoomAvatarViewActions>;

interface RoomAvatarViewProps {
    /**
     * ViewModel providing room avatar state and the click action.
     */
    "vm": RoomAvatarViewModel;
    /**
     * Rendered size of the avatar in CSS units, e.g. `"36px"`.
     */
    "size": string;
    /**
     * Optional additional CSS class names applied to the avatar element.
     */
    "className"?: string;
    /**
     * Accessible label announced by assistive technologies.
     * Defaults to `"Avatar"`.
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
     * ARIA role override for the avatar element.
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
 * Renders a room avatar image with initial-letter fallback.
 *
 * Rendering data (name, URLs, shape, click behaviour) is supplied through the
 * ViewModel; UI-only concerns such as size, CSS class, and accessibility
 * attributes are accepted as direct props.
 */
export function RoomAvatarView({
    vm,
    size,
    className,
    altText = "Avatar",
    title,
    tabIndex,
    role,
    "aria-hidden": ariaHidden,
    ref,
}: Readonly<RoomAvatarViewProps>): JSX.Element {
    const { name, idName, urls, type, isClickable } = useViewModel(vm);

    const [urlIndex, setUrlIndex] = useState(0);

    // Reset to the first URL whenever the list changes.
    useEffect(() => {
        setUrlIndex(0);
    }, [urls]);

    const onError = useCallback(() => {
        setUrlIndex((i) => i + 1);
    }, []);

    const src = urls[urlIndex];

    // Avatar's default role="img" is invalid ARIA once it renders as a <button> (onClick set).
    const extraProps: { "role"?: AriaRole; "aria-live"?: "off"; "aria-label"?: string } = {};
    if (role) {
        extraProps.role = role;
    } else if (isClickable) {
        extraProps.role = "button";
        extraProps["aria-live"] = "off";
    } else if (!src) {
        extraProps.role = "presentation";
        extraProps["aria-label"] = undefined;
    }

    return (
        <Avatar
            ref={ref}
            src={src}
            id={idName ?? ""}
            name={name}
            type={type}
            size={size}
            className={className}
            aria-label={altText}
            onError={onError}
            title={title}
            onClick={isClickable ? vm.onClick : undefined}
            tabIndex={tabIndex}
            aria-hidden={ariaHidden}
            data-testid="avatar-img"
            {...extraProps}
        />
    );
}
