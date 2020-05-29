/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import {_t} from "../../../../../languageHandler";
import {Mjolnir} from "../../../../../mjolnir/Mjolnir";
import {ListRule} from "../../../../../mjolnir/ListRule";
import {BanList, RULE_SERVER, RULE_USER} from "../../../../../mjolnir/BanList";
import Modal from "../../../../../Modal";
import {MatrixClientPeg} from "../../../../../MatrixClientPeg";
import * as sdk from "../../../../../index";

export default class MjolnirUserSettingsTab extends React.Component {
    constructor() {
        super();

        this.state = {
            busy: false,
            newPersonalRule: "",
            newList: "",
        };
    }

    _onPersonalRuleChanged = (e) => {
        this.setState({newPersonalRule: e.target.value});
    };

    _onNewListChanged = (e) => {
        this.setState({newList: e.target.value});
    };

    _onAddPersonalRule = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        let kind = RULE_SERVER;
        if (this.state.newPersonalRule.startsWith("@")) {
            kind = RULE_USER;
        }

        this.setState({busy: true});
        try {
            const list = await Mjolnir.sharedInstance().getOrCreatePersonalList();
            await list.banEntity(kind, this.state.newPersonalRule, _t("Ignored/Blocked"));
            this.setState({newPersonalRule: ""}); // this will also cause the new rule to be rendered
        } catch (e) {
            console.error(e);

            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Failed to add Mjolnir rule', '', ErrorDialog, {
                title: _t('Error adding ignored user/server'),
                description: _t('Something went wrong. Please try again or view your console for hints.'),
            });
        } finally {
            this.setState({busy: false});
        }
    };

    _onSubscribeList = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        this.setState({busy: true});
        try {
            const room = await MatrixClientPeg.get().joinRoom(this.state.newList);
            await Mjolnir.sharedInstance().subscribeToList(room.roomId);
            this.setState({newList: ""}); // this will also cause the new rule to be rendered
        } catch (e) {
            console.error(e);

            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Failed to subscribe to Mjolnir list', '', ErrorDialog, {
                title: _t('Error subscribing to list'),
                description: _t('Please verify the room ID or address and try again.'),
            });
        } finally {
            this.setState({busy: false});
        }
    };

    async _removePersonalRule(rule: ListRule) {
        this.setState({busy: true});
        try {
            const list = Mjolnir.sharedInstance().getPersonalList();
            await list.unbanEntity(rule.kind, rule.entity);
        } catch (e) {
            console.error(e);

            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Failed to remove Mjolnir rule', '', ErrorDialog, {
                title: _t('Error removing ignored user/server'),
                description: _t('Something went wrong. Please try again or view your console for hints.'),
            });
        } finally {
            this.setState({busy: false});
        }
    }

    async _unsubscribeFromList(list: BanList) {
        this.setState({busy: true});
        try {
            await Mjolnir.sharedInstance().unsubscribeFromList(list.roomId);
            await MatrixClientPeg.get().leave(list.roomId);
        } catch (e) {
            console.error(e);

            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Failed to unsubscribe from Mjolnir list', '', ErrorDialog, {
                title: _t('Error unsubscribing from list'),
                description: _t('Please try again or view your console for hints.'),
            });
        } finally {
            this.setState({busy: false});
        }
    }

    _viewListRules(list: BanList) {
        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");

        const room = MatrixClientPeg.get().getRoom(list.roomId);
        const name = room ? room.name : list.roomId;

        const renderRules = (rules: ListRule[]) => {
            if (rules.length === 0) return <i>{_t("None")}</i>;

            const tiles = [];
            for (const rule of rules) {
                tiles.push(<li key={rule.kind + rule.entity}><code>{rule.entity}</code></li>);
            }
            return <ul>{tiles}</ul>;
        };

        Modal.createTrackedDialog('View Mjolnir list rules', '', QuestionDialog, {
            title: _t("Ban list rules - %(roomName)s", {roomName: name}),
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

    _renderPersonalBanListRules() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

        const list = Mjolnir.sharedInstance().getPersonalList();
        const rules = list ? [...list.userRules, ...list.serverRules] : [];
        if (!list || rules.length <= 0) return <i>{_t("You have not ignored anyone.")}</i>;

        const tiles = [];
        for (const rule of rules) {
            tiles.push(
                <li key={rule.entity} className="mx_MjolnirUserSettingsTab_listItem">
                    <AccessibleButton
                        kind="danger_sm"
                        onClick={() => this._removePersonalRule(rule)}
                        disabled={this.state.busy}
                    >
                        {_t("Remove")}
                    </AccessibleButton>&nbsp;
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

    _renderSubscribedBanLists() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

        const personalList = Mjolnir.sharedInstance().getPersonalList();
        const lists = Mjolnir.sharedInstance().lists.filter(b => {
            return personalList? personalList.roomId !== b.roomId : true;
        });
        if (!lists || lists.length <= 0) return <i>{_t("You are not subscribed to any lists")}</i>;

        const tiles = [];
        for (const list of lists) {
            const room = MatrixClientPeg.get().getRoom(list.roomId);
            const name = room ? <span>{room.name} (<code>{list.roomId}</code>)</span> : <code>list.roomId</code>;
            tiles.push(
                <li key={list.roomId} className="mx_MjolnirUserSettingsTab_listItem">
                    <AccessibleButton
                        kind="danger_sm"
                        onClick={() => this._unsubscribeFromList(list)}
                        disabled={this.state.busy}
                    >
                        {_t("Unsubscribe")}
                    </AccessibleButton>&nbsp;
                    <AccessibleButton
                        kind="primary_sm"
                        onClick={() => this._viewListRules(list)}
                        disabled={this.state.busy}
                    >
                        {_t("View rules")}
                    </AccessibleButton>&nbsp;
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

    render() {
        const Field = sdk.getComponent('elements.Field');
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

        return (
            <div className="mx_SettingsTab mx_MjolnirUserSettingsTab">
                <div className="mx_SettingsTab_heading">{_t("Ignored users")}</div>
                <div className="mx_SettingsTab_section">
                    <div className='mx_SettingsTab_subsectionText'>
                        <span className='warning'>{_t("⚠ These settings are meant for advanced users.")}</span><br />
                        <br />
                        {_t(
                            "Add users and servers you want to ignore here. Use asterisks " +
                            "to have Riot match any characters. For example, <code>@bot:*</code> " +
                            "would ignore all users that have the name 'bot' on any server.",
                            {}, {code: (s) => <code>{s}</code>},
                        )}<br />
                        <br />
                        {_t(
                            "Ignoring people is done through ban lists which contain rules for " +
                            "who to ban. Subscribing to a ban list means the users/servers blocked by " +
                            "that list will be hidden from you.",
                        )}
                    </div>
                </div>
                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{_t("Personal ban list")}</span>
                    <div className='mx_SettingsTab_subsectionText'>
                        {_t(
                            "Your personal ban list holds all the users/servers you personally don't " +
                            "want to see messages from. After ignoring your first user/server, a new room " +
                            "will show up in your room list named 'My Ban List' - stay in this room to keep " +
                            "the ban list in effect.",
                        )}
                    </div>
                    <div>
                        {this._renderPersonalBanListRules()}
                    </div>
                    <div>
                        <form onSubmit={this._onAddPersonalRule} autoComplete="off">
                            <Field
                                type="text"
                                label={_t("Server or user ID to ignore")}
                                placeholder={_t("eg: @bot:* or example.org")}
                                value={this.state.newPersonalRule}
                                onChange={this._onPersonalRuleChanged}
                            />
                            <AccessibleButton
                                type="submit"
                                kind="primary"
                                onClick={this._onAddPersonalRule}
                                disabled={this.state.busy}
                            >
                                {_t("Ignore")}
                            </AccessibleButton>
                        </form>
                    </div>
                </div>
                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{_t("Subscribed lists")}</span>
                    <div className='mx_SettingsTab_subsectionText'>
                        <span className='warning'>{_t("Subscribing to a ban list will cause you to join it!")}</span>
                        &nbsp;
                        <span>{_t(
                            "If this isn't what you want, please use a different tool to ignore users.",
                        )}</span>
                    </div>
                    <div>
                        {this._renderSubscribedBanLists()}
                    </div>
                    <div>
                        <form onSubmit={this._onSubscribeList} autoComplete="off">
                            <Field
                                type="text"
                                label={_t("Room ID or address of ban list")}
                                value={this.state.newList}
                                onChange={this._onNewListChanged}
                            />
                            <AccessibleButton
                                type="submit"
                                kind="primary"
                                onClick={this._onSubscribeList}
                                disabled={this.state.busy}
                            >
                                {_t("Subscribe")}
                            </AccessibleButton>
                        </form>
                    </div>
                </div>
            </div>
        );
    }
}
