/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import React, {ReactNode} from 'react';
import classNames from 'classnames';

import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import {_t} from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import {SetRightPanelPhasePayload} from "../../../dispatcher/payloads/SetRightPanelPhasePayload";
import {Action} from "../../../dispatcher/actions";
import {RightPanelPhases} from "../../../stores/RightPanelStorePhases";

interface IProps {
    header?: ReactNode;
    footer?: ReactNode;
    className?: string;
    withoutScrollContainer?: boolean;
    previousPhase?: RightPanelPhases;
    onClose?(): void;
}

interface IGroupProps {
    className?: string;
    title: string;
}

export const Group: React.FC<IGroupProps> = ({ className, title, children }) => {
    return <div className={classNames("mx_BaseCard_Group", className)}>
        <h1>{title}</h1>
        {children}
    </div>;
};

const BaseCard: React.FC<IProps> = ({
    onClose,
    className,
    header,
    footer,
    withoutScrollContainer,
    previousPhase,
    children,
}) => {
    let backButton;
    if (previousPhase) {
        const onBackClick = () => {
            defaultDispatcher.dispatch<SetRightPanelPhasePayload>({
                action: Action.SetRightPanelPhase,
                phase: previousPhase,
            });
        };
        backButton = <AccessibleButton className="mx_BaseCard_back" onClick={onBackClick} title={_t("Back")} />;
    }

    let closeButton;
    if (onClose) {
        closeButton = <AccessibleButton className="mx_BaseCard_close" onClick={onClose} title={_t("Close")} />;
    }

    if (!withoutScrollContainer) {
        children = <AutoHideScrollbar>
            { children }
        </AutoHideScrollbar>;
    }

    return (
        <div className={classNames("mx_BaseCard", className)}>
            <div className="mx_BaseCard_header">
                { backButton }
                { closeButton }
                { header }
            </div>
            { children }
            { footer && <div className="mx_BaseCard_footer">{ footer }</div> }
        </div>
    );
};

export default BaseCard;
