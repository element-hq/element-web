/*
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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

import React from "react";

import { _t } from "../../../languageHandler";
import { Command, CommandCategories, Commands } from "../../../SlashCommands";
import InfoDialog from "./InfoDialog";

interface IProps {
    onFinished(): void;
}

const SlashCommandHelpDialog: React.FC<IProps> = ({ onFinished }) => {
    const categories: Record<string, Command[]> = {};
    Commands.forEach((cmd) => {
        if (!cmd.isEnabled()) return;
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
                        <td>{cmd.description}</td>
                    </tr>,
                );
            });

            return rows;
        });

    return (
        <InfoDialog
            className="mx_SlashCommandHelpDialog"
            title={_t("Command Help")}
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
