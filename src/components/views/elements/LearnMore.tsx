/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import InfoDialog from "../dialogs/InfoDialog";
import AccessibleButton, { type ButtonProps } from "./AccessibleButton";

type Props = Omit<ButtonProps<"div">, "element" | "kind" | "onClick" | "className"> & {
    title: string;
    description: string | React.ReactNode;
};

const LearnMore: React.FC<Props> = ({ title, description, ...rest }) => {
    const onClick = (): void => {
        Modal.createDialog(InfoDialog, {
            title,
            description,
            button: _t("action|got_it"),
            hasCloseButton: true,
        });
    };

    return (
        <AccessibleButton {...rest} kind="link_inline" onClick={onClick} className="mx_LearnMore_button">
            {_t("action|learn_more")}
        </AccessibleButton>
    );
};

export default LearnMore;
