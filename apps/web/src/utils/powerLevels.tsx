/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2017, 2018 Vector Creations Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import Modal from "../Modal";
import QuestionDialog from "../components/views/dialogs/QuestionDialog.tsx";
import { _t } from "../languageHandler.tsx";

export const warnSelfDemote = async (isSpace: boolean): Promise<boolean> => {
    const { finished } = Modal.createDialog(QuestionDialog, {
        title: _t("user_info|demote_self_confirm_title"),
        description: (
            <div>
                {isSpace
                    ? _t("user_info|demote_self_confirm_description_space")
                    : _t("user_info|demote_self_confirm_room")}
            </div>
        ),
        button: _t("user_info|demote_button"),
    });

    const [confirmed] = await finished;
    return !!confirmed;
};
