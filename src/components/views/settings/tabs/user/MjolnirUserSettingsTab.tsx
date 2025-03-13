/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEvent, type SyntheticEvent } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { type EmptyObject } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../../../languageHandler";
import SdkConfig from "../../../../../SdkConfig";
import { Mjolnir } from "../../../../../mjolnir/Mjolnir";
import { type ListRule } from "../../../../../mjolnir/ListRule";
import { type BanList, RULE_SERVER, RULE_USER } from "../../../../../mjolnir/BanList";
import Modal from "../../../../../Modal";
import { MatrixClientPeg } from "../../../../../MatrixClientPeg";
import ErrorDialog from "../../../dialogs/ErrorDialog";
import QuestionDialog from "../../../dialogs/QuestionDialog";
import AccessibleButton from "../../../elements/AccessibleButton";
import Field from "../../../elements/Field";
import SettingsTab from "../SettingsTab";
import { SettingsSection } from "../../shared/SettingsSection";
import { SettingsSubsection, SettingsSubsectionText } from "../../shared/SettingsSubsection";

interface IState {
    busy: boolean;
    newPersonalRule: string;
    newList: string;
}

export default class MjolnirUserSettingsTab extends React.Component<EmptyObject, IState> {
    public constructor(props: EmptyObject) {
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
            await list.banEntity(kind, this.state.newPersonalRule, _t("labs_mjolnir|ban_reason"));
            this.setState({ newPersonalRule: "" }); // this will also cause the new rule to be rendered
        } catch (e) {
            logger.error(e);

            Modal.createDialog(ErrorDialog, {
                title: _t("labs_mjolnir|error_adding_ignore"),
                description: _t("labs_mjolnir|something_went_wrong"),
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
            const room = await MatrixClientPeg.safeGet().joinRoom(this.state.newList);
            await Mjolnir.sharedInstance().subscribeToList(room.roomId);
            this.setState({ newList: "" }); // this will also cause the new rule to be rendered
        } catch (e) {
            logger.error(e);

            Modal.createDialog(ErrorDialog, {
                title: _t("labs_mjolnir|error_adding_list_title"),
                description: _t("labs_mjolnir|error_adding_list_description"),
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
                title: _t("labs_mjolnir|error_removing_ignore"),
                description: _t("labs_mjolnir|something_went_wrong"),
            });
        } finally {
            this.setState({ busy: false });
        }
    }

    private async unsubscribeFromList(list: BanList): Promise<void> {
        this.setState({ busy: true });
        try {
            await Mjolnir.sharedInstance().unsubscribeFromList(list.roomId);
            await MatrixClientPeg.safeGet().leave(list.roomId);
        } catch (e) {
            logger.error(e);

            Modal.createDialog(ErrorDialog, {
                title: _t("labs_mjolnir|error_removing_list_title"),
                description: _t("labs_mjolnir|error_removing_list_description"),
            });
        } finally {
            this.setState({ busy: false });
        }
    }

    private viewListRules(list: BanList): void {
        const room = MatrixClientPeg.safeGet().getRoom(list.roomId);
        const name = room ? room.name : list.roomId;

        const renderRules = (rules: ListRule[]): JSX.Element => {
            if (rules.length === 0) return <i>{_t("labs_mjolnir|rules_empty")}</i>;

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
            title: _t("labs_mjolnir|rules_title", { roomName: name }),
            description: (
                <div>
                    <h3>{_t("labs_mjolnir|rules_server")}</h3>
                    {renderRules(list.serverRules)}
                    <h3>{_t("labs_mjolnir|rules_user")}</h3>
                    {renderRules(list.userRules)}
                </div>
            ),
            button: _t("action|close"),
            hasCancelButton: false,
        });
    }

    private renderPersonalBanListRules(): JSX.Element {
        const list = Mjolnir.sharedInstance().getPersonalList();
        const rules = list ? [...list.userRules, ...list.serverRules] : [];
        if (!list || rules.length <= 0) return <i>{_t("labs_mjolnir|personal_empty")}</i>;

        const tiles: JSX.Element[] = [];
        for (const rule of rules) {
            tiles.push(
                <li key={rule.entity} className="mx_MjolnirUserSettingsTab_listItem">
                    <AccessibleButton
                        kind="danger_sm"
                        onClick={() => this.removePersonalRule(rule)}
                        disabled={this.state.busy}
                    >
                        {_t("action|remove")}
                    </AccessibleButton>
                    &nbsp;
                    <code>{rule.entity}</code>
                </li>,
            );
        }

        return (
            <div>
                <p>{_t("labs_mjolnir|personal_section")}</p>
                <ul>{tiles}</ul>
            </div>
        );
    }

    private renderSubscribedBanLists(): JSX.Element {
        const personalList = Mjolnir.sharedInstance().getPersonalList();
        const lists = Mjolnir.sharedInstance().lists.filter((b) => {
            return personalList ? personalList.roomId !== b.roomId : true;
        });
        if (!lists || lists.length <= 0) return <i>{_t("labs_mjolnir|no_lists")}</i>;

        const tiles: JSX.Element[] = [];
        for (const list of lists) {
            const room = MatrixClientPeg.safeGet().getRoom(list.roomId);
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
                        {_t("action|unsubscribe")}
                    </AccessibleButton>
                    &nbsp;
                    <AccessibleButton
                        kind="primary_sm"
                        onClick={() => this.viewListRules(list)}
                        disabled={this.state.busy}
                    >
                        {_t("labs_mjolnir|view_rules")}
                    </AccessibleButton>
                    &nbsp;
                    {name}
                </li>,
            );
        }

        return (
            <div>
                <p>{_t("labs_mjolnir|lists")}</p>
                <ul>{tiles}</ul>
            </div>
        );
    }

    public render(): React.ReactNode {
        const brand = SdkConfig.get().brand;

        return (
            <SettingsTab>
                <SettingsSection>
                    <SettingsSubsectionText>
                        <strong className="warning">{_t("labs_mjolnir|advanced_warning")}</strong>
                        <p>{_t("labs_mjolnir|explainer_1", { brand }, { code: (s) => <code>{s}</code> })}</p>
                        <p>{_t("labs_mjolnir|explainer_2")}</p>
                    </SettingsSubsectionText>
                    <SettingsSubsection
                        heading={_t("labs_mjolnir|personal_heading")}
                        description={_t("labs_mjolnir|personal_description", {
                            myBanList: _t("labs_mjolnir|room_name"),
                        })}
                    >
                        {this.renderPersonalBanListRules()}
                        <form onSubmit={this.onAddPersonalRule} autoComplete="off">
                            <Field
                                type="text"
                                label={_t("labs_mjolnir|personal_new_label")}
                                placeholder={_t("labs_mjolnir|personal_new_placeholder")}
                                value={this.state.newPersonalRule}
                                onChange={this.onPersonalRuleChanged}
                            />
                            <AccessibleButton
                                kind="primary"
                                onClick={this.onAddPersonalRule}
                                disabled={this.state.busy}
                            >
                                {_t("action|ignore")}
                            </AccessibleButton>
                        </form>
                    </SettingsSubsection>
                    <SettingsSubsection
                        heading={_t("labs_mjolnir|lists_heading")}
                        description={
                            <>
                                <strong className="warning">{_t("labs_mjolnir|lists_description_1")}</strong>
                                &nbsp;
                                <span>{_t("labs_mjolnir|lists_description_2")}</span>
                            </>
                        }
                    >
                        {this.renderSubscribedBanLists()}
                        <form onSubmit={this.onSubscribeList} autoComplete="off">
                            <Field
                                type="text"
                                label={_t("labs_mjolnir|lists_new_label")}
                                value={this.state.newList}
                                onChange={this.onNewListChanged}
                            />
                            <AccessibleButton kind="primary" onClick={this.onSubscribeList} disabled={this.state.busy}>
                                {_t("action|subscribe")}
                            </AccessibleButton>
                        </form>
                    </SettingsSubsection>
                </SettingsSection>
            </SettingsTab>
        );
    }
}
