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

import React, { ReactElement } from "react";
import { JoinRule } from "matrix-js-sdk/src/matrix";

import Dropdown from "./Dropdown";
import { NonEmptyArray } from "../../../@types/common";
import { Icon as AskToJoinIcon } from "../../../../res/img/element-icons/ask-to-join.svg";

interface IProps {
    value: JoinRule;
    label: string;
    width?: number;
    labelInvite: string;
    labelKnock?: string;
    labelPublic: string;
    labelRestricted?: string; // if omitted then this option will be hidden, e.g if unsupported
    onChange(value: JoinRule): void;
}

const JoinRuleDropdown: React.FC<IProps> = ({
    label,
    labelInvite,
    labelKnock,
    labelPublic,
    labelRestricted,
    value,
    width = 448,
    onChange,
}) => {
    const options = [
        <div key={JoinRule.Invite} className="mx_JoinRuleDropdown_invite">
            {labelInvite}
        </div>,
        <div key={JoinRule.Public} className="mx_JoinRuleDropdown_public">
            {labelPublic}
        </div>,
    ] as NonEmptyArray<ReactElement & { key: string }>;

    if (labelKnock) {
        options.unshift(
            (
                <div key={JoinRule.Knock} className="mx_JoinRuleDropdown_knock">
                    <AskToJoinIcon className="mx_Icon mx_Icon_16 mx_JoinRuleDropdown_icon" />
                    {labelKnock}
                </div>
            ) as ReactElement & { key: string },
        );
    }

    if (labelRestricted) {
        options.unshift(
            (
                <div key={JoinRule.Restricted} className="mx_JoinRuleDropdown_restricted">
                    {labelRestricted}
                </div>
            ) as ReactElement & { key: string },
        );
    }

    return (
        <Dropdown
            id="mx_JoinRuleDropdown"
            className="mx_JoinRuleDropdown"
            onOptionChange={onChange}
            menuWidth={width}
            value={value}
            label={label}
        >
            {options}
        </Dropdown>
    );
};

export default JoinRuleDropdown;
