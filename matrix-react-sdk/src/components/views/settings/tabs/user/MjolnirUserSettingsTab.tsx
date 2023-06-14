/*
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

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

import React, { ChangeEvent, SyntheticEvent } from "react";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../../../languageHandler";
import SdkConfig from "../../../../../SdkConfig";
import { Mjolnir } from "../../../../../mjolnir/Mjolnir";
import { ListRule } from "../../../../../mjolnir/ListRule";
import { BanList, RULE_SERVER, RULE_USER } from "../../../../../mjolnir/BanList";
import Modal from "../../../../../Modal";
import { MatrixClientPeg } from "../../../../../MatrixClientPeg";
import ErrorDialog from "../../../dialogs/ErrorDialog";
import QuestionDialog from "../../../dialogs/QuestionDialog";
import AccessibleButton from "../../../elements/AccessibleButton";
import Field from "../../../elements/Field";
import SettingsTab from "../SettingsTab";
import { SettingsSection } from "../../shared/SettingsSection";
import SettingsSubsection, { SettingsSubsectionText } from "../../shared/SettingsSubsection";

interface IState {
    busy: boolean;
    newPersonalRule: string;
    newList: string;
}

export default class MjolnirUserSettingsTab extends React.Component<{}, IState> {
    public constructor(props: {}) {
        super(props);

        this.state = {
            busy: false,
            newPersonalRule: "",
            newList: "",
        };
    }

    private onPersonalRuleChanged = (e: ChangeEvent<HTMLInputElement>): void => {
        this.setState({ newPersonalRule: e.target.value });
    };

    private onNewListChanged = (e: ChangeEvent<HTMLInputElement>): void => {
        this.setState({ newList: e.target.value });
    };

    private onAddPersonalRule = async (e: SyntheticEvent): Promise<void> => {
        e.preventDefault();
        e.stopPropagation();

        let kind = RULE_SERVER;
        if (this.state.newPersonalRule.startsWith("@")) {
            kind = RULE_USER;
        }

        this.setState({ busy: true });
        try {
            const list = await Mjolnir.sharedInstance().getOrCreatePersonalList();
            await list.banEntity(kind, this.state.newPersonalRule, _t("Ignored/Blocked"));
            this.setState({ newPersonalRule: "" }); // this will also cause the new rule to be rendered
        } catch (e) {
            logger.error(e);

            Modal.createDialog(ErrorDialog, {
                title: _t("Error adding ignored user/server"),
                description: _t("Something went wrong. Please try again or view your console for hints."),
            });
        } finally {
            this.setState({ busy: false });
        }
    };

    private onSubscribeList = async (e: SyntheticEvent): Promise<void> => {
        e.preventDefault();
        e.stopPropagation();

        this.setState({ busy: true });
        try {
            const room = await MatrixClientPeg.get().joinRoom(this.state.newList);
            await Mjolnir.sharedInstance().subscribeToList(room.roomId);
            this.setState({ newList: "" }); // this will also cause the new rule to be rendered
        } catch (e) {
            logger.error(e);

            Modal.createDialog(ErrorDialog, {
                title: _t("Error subscribing to list"),
                description: _t("Please verify the room ID or address and try again."),
            });
        } finally {
            this.setState({ busy: false });
        }
    };

    private async removePersonalRule(rule: ListRule): Promise<void> {
        this.setState({ busy: true });
        try {
            const list = Mjolnir.sharedInstance().getPersonalList();
            await list!.unbanEntity(rule.kind, rule.entity);
        } catch (e) {
            logger.error(e);

            Modal.createDialog(ErrorDialog, {
                title: _t("Error removing ignored user/server"),
                description: _t("Something went wrong. Please try again or view your console for hints."),
            });
        } finally {
            this.setState({ busy: false });
        }
    }

    private async unsubscribeFromList(list: BanList): Promise<void> {
        this.setState({ busy: true });
        try {
            await Mjolnir.sharedInstance().unsubscribeFromList(list.roomId);
            await MatrixClientPeg.get().leave(list.roomId);
        } catch (e) {
            logger.error(e);

            Modal.createDialog(ErrorDialog, {
                title: _t("Error unsubscribing from list"),
                description: _t("Please try again or view your console for hints."),
            });
        } finally {
            this.setState({ busy: false });
        }
    }

    private viewListRules(list: BanList): void {
        const room = MatrixClientPeg.get().getRoom(list.roomId);
        const name = room ? room.name : list.roomId;

        const renderRules = (rules: ListRule[]): JSX.Element => {
            if (rules.length === 0) return <i>{_t("None")}</i>;

            const tiles: JSX.Element[] = [];
            for (const rule of rules) {
                tiles.push(
                    <li key={rule.kind + rule.entity}>
                        <code>{rule.entity}</code>
                    </li>,
                );
            }
            return <ul>{tiles}</ul>;
        };

        Modal.createDialog(QuestionDialog, {
            title: _t("Ban list rules - %(roomName)s", { roomName: name }),
            description: (
                <div>
                    <h3>{_t("Server rules")}</h3>
                    {renderRules(list.serverRules)}
                    <h3>{_t("User rules")}</h3>
                    {renderRules(list.userRules)}
                </div>
            ),
            button: _t("Close"),
            hasCancelButton: false,
        });
    }

    private renderPersonalBanListRules(): JSX.Element {
        const list = Mjolnir.sharedInstance().getPersonalList();
        const rules = list ? [...list.userRules, ...list.serverRules] : [];
        if (!list || rules.length <= 0) return <i>{_t("You have not ignored anyone.")}</i>;

        const tiles: JSX.Element[] = [];
        for (const rule of rules) {
            tiles.push(
                <li key={rule.entity} className="mx_MjolnirUserSettingsTab_listItem">
                    <AccessibleButton
                        kind="danger_sm"
                        onClick={() => this.removePersonalRule(rule)}
                        disabled={this.state.busy}
                    >
                        {_t("Remove")}
                    </AccessibleButton>
                    &nbsp;
                    <code>{rule.entity}</code>
                </li>,
            );
        }

        return (
            <div>
                <p>{_t("You are currently ignoring:")}</p>
                <ul>{tiles}</ul>
            </div>
        );
    }

    private renderSubscribedBanLists(): JSX.Element {
        const personalList = Mjolnir.sharedInstance().getPersonalList();
        const lists = Mjolnir.sharedInstance().lists.filter((b) => {
            return personalList ? personalList.roomId !== b.roomId : true;
        });
        if (!lists || lists.length <= 0) return <i>{_t("You are not subscribed to any lists")}</i>;

        const tiles: JSX.Element[] = [];
        for (const list of lists) {
            const room = MatrixClientPeg.get().getRoom(list.roomId);
            const name = room ? (
                <span>
                    {room.name} (<code>{list.roomId}</code>)
                </span>
            ) : (
                <code>list.roomId</code>
            );
            tiles.push(
                <li key={list.roomId} className="mx_MjolnirUserSettingsTab_listItem">
                    <AccessibleButton
                        kind="danger_sm"
                        onClick={() => this.unsubscribeFromList(list)}
                        disabled={this.state.busy}
                    >
                        {_t("Unsubscribe")}
                    </AccessibleButton>
                    &nbsp;
                    <AccessibleButton
                        kind="primary_sm"
                        onClick={() => this.viewListRules(list)}
                        disabled={this.state.busy}
                    >
                        {_t("View rules")}
                    </AccessibleButton>
                    &nbsp;
                    {name}
                </li>,
            );
        }

        return (
            <div>
                <p>{_t("You are currently subscribed to:")}</p>
                <ul>{tiles}</ul>
            </div>
        );
    }

    public render(): React.ReactNode {
        const brand = SdkConfig.get().brand;

        return (
            <SettingsTab>
                <SettingsSection heading={_t("Ignored users")}>
                    <SettingsSubsectionText>
                        <span className="warning">{_t("⚠ These settings are meant for advanced users.")}</span>
                        <p>
                            {_t(
                                "Add users and servers you want to ignore here. Use asterisks " +
                                    "to have %(brand)s match any characters. For example, <code>@bot:*</code> " +
                                    "would ignore all users that have the name 'bot' on any server.",
                                { brand },
                                { code: (s) => <code>{s}</code> },
                            )}
                        </p>
                        <p>
                            {_t(
                                "Ignoring people is done through ban lists which contain rules for " +
                                    "who to ban. Subscribing to a ban list means the users/servers blocked by " +
                                    "that list will be hidden from you.",
                            )}
                        </p>
                    </SettingsSubsectionText>
                    <SettingsSubsection
                        heading={_t("Personal ban list")}
                        description={_t(
                            "Your personal ban list holds all the users/servers you personally don't " +
                                "want to see messages from. After ignoring your first user/server, a new room " +
                                "will show up in your room list named '%(myBanList)s' - stay in this room to keep " +
                                "the ban list in effect.",
                            {
                                myBanList: _t("My Ban List"),
                            },
                        )}
                    >
                        {this.renderPersonalBanListRules()}
                        <form onSubmit={this.onAddPersonalRule} autoComplete="off">
                            <Field
                                type="text"
                                label={_t("Server or user ID to ignore")}
                                placeholder={_t("eg: @bot:* or example.org")}
                                value={this.state.newPersonalRule}
                                onChange={this.onPersonalRuleChanged}
                            />
                            <AccessibleButton
                                type="submit"
                                kind="primary"
                                onClick={this.onAddPersonalRule}
                                disabled={this.state.busy}
                            >
                                {_t("Ignore")}
                            </AccessibleButton>
                        </form>
                    </SettingsSubsection>
                    <SettingsSubsection
                        heading={_t("Subscribed lists")}
                        description={
                            <>
                                <span className="warning">
                                    {_t("Subscribing to a ban list will cause you to join it!")}
                                </span>
                                &nbsp;
                                <span>
                                    {_t("If this isn't what you want, please use a different tool to ignore users.")}
                                </span>
                            </>
                        }
                    >
                        {this.renderSubscribedBanLists()}
                        <form onSubmit={this.onSubscribeList} autoComplete="off">
                            <Field
                                type="text"
                                label={_t("Room ID or address of ban list")}
                                value={this.state.newList}
                                onChange={this.onNewListChanged}
                            />
                            <AccessibleButton
                                type="submit"
                                kind="primary"
                                onClick={this.onSubscribeList}
                                disabled={this.state.busy}
                            >
                                {_t("Subscribe")}
                            </AccessibleButton>
                        </form>
                    </SettingsSubsection>
                </SettingsSection>
            </SettingsTab>
        );
    }
}
