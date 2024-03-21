/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, { FC, HTMLAttributes, ReactNode } from "react";
import { RoomMember } from "matrix-js-sdk/src/matrix";
import { AvatarStack, Tooltip } from "@vector-im/compound-web";

import MemberAvatar from "../avatars/MemberAvatar";
import AccessibleButton, { ButtonEvent } from "./AccessibleButton";

interface IProps extends HTMLAttributes<HTMLSpanElement> {
    members: RoomMember[];
    size: string;
    overflow: boolean;
    tooltipLabel?: string;
    tooltipShortcut?: string;
    children?: ReactNode;
    viewUserOnClick?: boolean;
    onClick?: (e: ButtonEvent) => void | Promise<void>;
}

const FacePile: FC<IProps> = ({
    members,
    size,
    overflow,
    tooltipLabel,
    tooltipShortcut,
    children,
    viewUserOnClick = true,
    ...props
}) => {
    const faces = members.map(
        tooltipLabel
            ? (m) => <MemberAvatar key={m.userId} member={m} size={size} hideTitle />
            : (m) => (
                  <Tooltip key={m.userId} label={m.name} caption={tooltipShortcut}>
                      <MemberAvatar
                          member={m}
                          size={size}
                          viewUserOnClick={!props.onClick && viewUserOnClick}
                          hideTitle
                      />
                  </Tooltip>
              ),
    );

    const pileContents = (
        <>
            {faces}
            {overflow ? <span className="mx_FacePile_more" /> : null}
        </>
    );

    const content = (
        <AccessibleButton className="mx_FacePile" onClick={props.onClick ?? null}>
            <AvatarStack>{pileContents}</AvatarStack>
            {children}
        </AccessibleButton>
    );

    return tooltipLabel ? (
        <Tooltip label={tooltipLabel} caption={tooltipShortcut}>
            {content}
        </Tooltip>
    ) : (
        content
    );
};

export default FacePile;
