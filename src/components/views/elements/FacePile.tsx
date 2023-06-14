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
import { RoomMember } from "matrix-js-sdk/src/models/room-member";

import MemberAvatar from "../avatars/MemberAvatar";
import TooltipTarget from "./TooltipTarget";
import TextWithTooltip from "./TextWithTooltip";

interface IProps extends HTMLAttributes<HTMLSpanElement> {
    members: RoomMember[];
    faceSize: number;
    overflow: boolean;
    tooltip?: ReactNode;
    children?: ReactNode;
}

const FacePile: FC<IProps> = ({ members, faceSize, overflow, tooltip, children, ...props }) => {
    const faces = members.map(
        tooltip
            ? (m) => <MemberAvatar key={m.userId} member={m} width={faceSize} height={faceSize} hideTitle />
            : (m) => (
                  <TooltipTarget key={m.userId} label={m.name}>
                      <MemberAvatar
                          member={m}
                          width={faceSize}
                          height={faceSize}
                          viewUserOnClick={!props.onClick}
                          hideTitle
                      />
                  </TooltipTarget>
              ),
    );

    const pileContents = (
        <>
            {overflow ? <span className="mx_FacePile_more" /> : null}
            {faces}
        </>
    );

    return (
        <div {...props} className="mx_FacePile">
            {tooltip ? (
                <TextWithTooltip class="mx_FacePile_faces" tooltip={tooltip}>
                    {pileContents}
                </TextWithTooltip>
            ) : (
                <div className="mx_FacePile_faces">{pileContents}</div>
            )}
            {children}
        </div>
    );
};

export default FacePile;
