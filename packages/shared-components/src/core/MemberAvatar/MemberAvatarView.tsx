/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { Avatar } from "@vector-im/compound-web";

import { useViewModel, type ViewModel } from "../viewmodel";

export interface MemberAvatarViewSnapshot {
    /**
     * The display name of this member.
     */
    name: string;
    /**
     * The mxid of this member.
     */
    id: string;
    /**
     * The avatar url.
     */
    url?: string;
    /**
     * Size of the avatar.
     */
    size: string;
    /**
     * Title passed to the avatar container (button or span).
     */
    title?: string;
}

export type MemberAvatarViewModel = ViewModel<MemberAvatarViewSnapshot>;

interface MemberAvatarViewProps {
    vm: MemberAvatarViewModel;

    /**
     * Additional class names for this component.
     */
    classNames?: string;
}

/**
 * View for rendering the avatar for a given member.
 */
export function MemberAvatarView(props: MemberAvatarViewProps): React.ReactNode {
    const { name, id, url, size } = useViewModel(props.vm);

    return <Avatar className={props.classNames} name={name} id={id} src={url} size={size} />;
}
