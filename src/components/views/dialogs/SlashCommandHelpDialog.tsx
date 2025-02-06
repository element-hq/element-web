/*
Copyright 2024 New Vector Ltd.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../../../languageHandler";
import { type Command, CommandCategories, Commands } from "../../../SlashCommands";
import InfoDialog from "./InfoDialog";
import { MatrixClientPeg } from "../../../MatrixClientPeg";

interface IProps {
    onFinished(): void;
}

const SlashCommandHelpDialog: React.FC<IProps> = ({ onFinished }) => {
    const categories: Record<string, Command[]> = {};
    Commands.forEach((cmd) => {
        if (!cmd.isEnabled(MatrixClientPeg.get())) return;
        if (!categories[cmd.category]) {
            categories[cmd.category] = [];
        }
        categories[cmd.category].push(cmd);
    });

    const body = Object.values(CommandCategories)
        .filter((c) => categories[c])
        .map((category) => {
            const rows = [
                <tr key={"_category_" + category} className="mx_SlashCommandHelpDialog_headerRow">
                    <td colSpan={3}>
                        <h2>{_t(category)}</h2>
                    </td>
                </tr>,
            ];

            categories[category].forEach((cmd) => {
                rows.push(
                    <tr key={cmd.command}>
                        <td>
                            <strong>{cmd.getCommand()}</strong>
                        </td>
                        <td>{cmd.args}</td>
                        <td>{_t(cmd.description)}</td>
                    </tr>,
                );
            });

            return rows;
        });

    return (
        <InfoDialog
            className="mx_SlashCommandHelpDialog"
            title={_t("slash_command|help_dialog_title")}
            description={
                <table>
                    <tbody>{body}</tbody>
                </table>
            }
            hasCloseButton={true}
            onFinished={onFinished}
        />
    );
};

export default SlashCommandHelpDialog;
