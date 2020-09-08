/*
Copyright 2017 Vector Creations Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 Travis Ralston

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

import {MatrixClientPeg} from '../MatrixClientPeg';
import SdkConfig from "../SdkConfig";
import dis from '../dispatcher/dispatcher';
import * as url from "url";
import WidgetEchoStore from '../stores/WidgetEchoStore';

// How long we wait for the state event echo to come back from the server
// before waitFor[Room/User]Widget rejects its promise
const WIDGET_WAIT_TIME = 20000;
import SettingsStore from "../settings/SettingsStore";
import ActiveWidgetStore from "../stores/ActiveWidgetStore";
import {IntegrationManagers} from "../integrations/IntegrationManagers";
import {Capability} from "../widgets/WidgetApi";
import {Room} from "matrix-js-sdk/src/models/room";
import {WidgetType} from "../widgets/WidgetType";
import {objectClone} from "./objects";
import {_t} from "../languageHandler";

export default class WidgetUtils {
    /* Returns true if user is able to send state events to modify widgets in this room
     * (Does not apply to non-room-based / user widgets)
     * @param roomId -- The ID of the room to check
     * @return Boolean -- true if the user can modify widgets in this room
     * @throws Error -- specifies the error reason
     */
    static canUserModifyWidgets(roomId) {
        if (!roomId) {
            console.warn('No room ID specified');
            return false;
        }

        const client = MatrixClientPeg.get();
        if (!client) {
            console.warn('User must be be logged in');
            return false;
        }

        const room = client.getRoom(roomId);
        if (!room) {
            console.warn(`Room ID ${roomId} is not recognised`);
            return false;
        }

        const me = client.credentials.userId;
        if (!me) {
            console.warn('Failed to get user ID');
            return false;
        }

        if (room.getMyMembership() !== "join") {
            console.warn(`User ${me} is not in room ${roomId}`);
            return false;
        }

        // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
        return room.currentState.maySendStateEvent('im.vector.modular.widgets', me);
    }

    // TODO: Generify the name of this function. It's not just scalar.
    /**
     * Returns true if specified url is a scalar URL, typically https://scalar.vector.im/api
     * @param  {[type]}  testUrlString URL to check
     * @return {Boolean} True if specified URL is a scalar URL
     */
    static isScalarUrl(testUrlString) {
        if (!testUrlString) {
            console.error('Scalar URL check failed. No URL specified');
            return false;
        }

        const testUrl = url.parse(testUrlString);
        let scalarUrls = SdkConfig.get().integrations_widgets_urls;
        if (!scalarUrls || scalarUrls.length === 0) {
            const defaultManager = IntegrationManagers.sharedInstance().getPrimaryManager();
            if (defaultManager) {
                scalarUrls = [defaultManager.apiUrl];
            } else {
                scalarUrls = [];
            }
        }

        for (let i = 0; i < scalarUrls.length; i++) {
            const scalarUrl = url.parse(scalarUrls[i]);
            if (testUrl && scalarUrl) {
                if (
                    testUrl.protocol === scalarUrl.protocol &&
                    testUrl.host === scalarUrl.host &&
                    testUrl.pathname.startsWith(scalarUrl.pathname)
                ) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Returns a promise that resolves when a widget with the given
     * ID has been added as a user widget (ie. the accountData event
     * arrives) or rejects after a timeout
     *
     * @param {string} widgetId The ID of the widget to wait for
     * @param {boolean} add True to wait for the widget to be added,
     *     false to wait for it to be deleted.
     * @returns {Promise} that resolves when the widget is in the
     *     requested state according to the `add` param
     */
    static waitForUserWidget(widgetId, add) {
        return new Promise((resolve, reject) => {
            // Tests an account data event, returning true if it's in the state
            // we're waiting for it to be in
            function eventInIntendedState(ev) {
                if (!ev || !ev.getContent()) return false;
                if (add) {
                    return ev.getContent()[widgetId] !== undefined;
                } else {
                    return ev.getContent()[widgetId] === undefined;
                }
            }

            const startingAccountDataEvent = MatrixClientPeg.get().getAccountData('m.widgets');
            if (eventInIntendedState(startingAccountDataEvent)) {
                resolve();
                return;
            }

            function onAccountData(ev) {
                const currentAccountDataEvent = MatrixClientPeg.get().getAccountData('m.widgets');
                if (eventInIntendedState(currentAccountDataEvent)) {
                    MatrixClientPeg.get().removeListener('accountData', onAccountData);
                    clearTimeout(timerId);
                    resolve();
                }
            }
            const timerId = setTimeout(() => {
                MatrixClientPeg.get().removeListener('accountData', onAccountData);
                reject(new Error("Timed out waiting for widget ID " + widgetId + " to appear"));
            }, WIDGET_WAIT_TIME);
            MatrixClientPeg.get().on('accountData', onAccountData);
        });
    }

    /**
     * Returns a promise that resolves when a widget with the given
     * ID has been added as a room widget in the given room (ie. the
     * room state event arrives) or rejects after a timeout
     *
     * @param {string} widgetId The ID of the widget to wait for
     * @param {string} roomId The ID of the room to wait for the widget in
     * @param {boolean} add True to wait for the widget to be added,
     *     false to wait for it to be deleted.
     * @returns {Promise} that resolves when the widget is in the
     *     requested state according to the `add` param
     */
    static waitForRoomWidget(widgetId, roomId, add) {
        return new Promise((resolve, reject) => {
            // Tests a list of state events, returning true if it's in the state
            // we're waiting for it to be in
            function eventsInIntendedState(evList) {
                const widgetPresent = evList.some((ev) => {
                    return ev.getContent() && ev.getContent()['id'] === widgetId;
                });
                if (add) {
                    return widgetPresent;
                } else {
                    return !widgetPresent;
                }
            }

            const room = MatrixClientPeg.get().getRoom(roomId);
            // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
            const startingWidgetEvents = room.currentState.getStateEvents('im.vector.modular.widgets');
            if (eventsInIntendedState(startingWidgetEvents)) {
                resolve();
                return;
            }

            function onRoomStateEvents(ev) {
                if (ev.getRoomId() !== roomId) return;

                // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
                const currentWidgetEvents = room.currentState.getStateEvents('im.vector.modular.widgets');

                if (eventsInIntendedState(currentWidgetEvents)) {
                    MatrixClientPeg.get().removeListener('RoomState.events', onRoomStateEvents);
                    clearTimeout(timerId);
                    resolve();
                }
            }
            const timerId = setTimeout(() => {
                MatrixClientPeg.get().removeListener('RoomState.events', onRoomStateEvents);
                reject(new Error("Timed out waiting for widget ID " + widgetId + " to appear"));
            }, WIDGET_WAIT_TIME);
            MatrixClientPeg.get().on('RoomState.events', onRoomStateEvents);
        });
    }

    static setUserWidget(widgetId, widgetType: WidgetType, widgetUrl, widgetName, widgetData) {
        const content = {
            type: widgetType.preferred,
            url: widgetUrl,
            name: widgetName,
            data: widgetData,
        };

        const client = MatrixClientPeg.get();
        // Get the current widgets and clone them before we modify them, otherwise
        // we'll modify the content of the old event.
        const userWidgets = objectClone(WidgetUtils.getUserWidgets());

        // Delete existing widget with ID
        try {
            delete userWidgets[widgetId];
        } catch (e) {
            console.error(`$widgetId is non-configurable`);
        }

        const addingWidget = Boolean(widgetUrl);

        // Add new widget / update
        if (addingWidget) {
            userWidgets[widgetId] = {
                content: content,
                sender: client.getUserId(),
                state_key: widgetId,
                type: 'm.widget',
                id: widgetId,
            };
        }

        // This starts listening for when the echo comes back from the server
        // since the widget won't appear added until this happens. If we don't
        // wait for this, the action will complete but if the user is fast enough,
        // the widget still won't actually be there.
        return client.setAccountData('m.widgets', userWidgets).then(() => {
            return WidgetUtils.waitForUserWidget(widgetId, addingWidget);
        }).then(() => {
            dis.dispatch({ action: "user_widget_updated" });
        });
    }

    static setRoomWidget(roomId, widgetId, widgetType: WidgetType, widgetUrl, widgetName, widgetData) {
        let content;

        const addingWidget = Boolean(widgetUrl);

        if (addingWidget) {
            content = {
                // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
                // For now we'll send the legacy event type for compatibility with older apps/elements
                type: widgetType.legacy,
                url: widgetUrl,
                name: widgetName,
                data: widgetData,
            };
        } else {
            content = {};
        }

        WidgetEchoStore.setRoomWidgetEcho(roomId, widgetId, content);

        const client = MatrixClientPeg.get();
        // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
        return client.sendStateEvent(roomId, "im.vector.modular.widgets", content, widgetId).then(() => {
            return WidgetUtils.waitForRoomWidget(widgetId, roomId, addingWidget);
        }).finally(() => {
            WidgetEchoStore.removeRoomWidgetEcho(roomId, widgetId);
        });
    }

    /**
     * Get room specific widgets
     * @param  {Room} room The room to get widgets force
     * @return {[object]} Array containing current / active room widgets
     */
    static getRoomWidgets(room: Room) {
        // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
        const appsStateEvents = room.currentState.getStateEvents('im.vector.modular.widgets');
        if (!appsStateEvents) {
            return [];
        }

        return appsStateEvents.filter((ev) => {
            return ev.getContent().type && ev.getContent().url;
        });
    }

    /**
     * Get user specific widgets (not linked to a specific room)
     * @return {object} Event content object containing current / active user widgets
     */
    static getUserWidgets() {
        const client = MatrixClientPeg.get();
        if (!client) {
            throw new Error('User not logged in');
        }
        const userWidgets = client.getAccountData('m.widgets');
        if (userWidgets && userWidgets.getContent()) {
            return userWidgets.getContent();
        }
        return {};
    }

    /**
     * Get user specific widgets (not linked to a specific room) as an array
     * @return {[object]} Array containing current / active user widgets
     */
    static getUserWidgetsArray() {
        return Object.values(WidgetUtils.getUserWidgets());
    }

    /**
     * Get active stickerpicker widgets (stickerpickers are user widgets by nature)
     * @return {[object]} Array containing current / active stickerpicker widgets
     */
    static getStickerpickerWidgets() {
        const widgets = WidgetUtils.getUserWidgetsArray();
        return widgets.filter((widget) => widget.content && widget.content.type === "m.stickerpicker");
    }

    /**
     * Get all integration manager widgets for this user.
     * @returns {Object[]} An array of integration manager user widgets.
     */
    static getIntegrationManagerWidgets() {
        const widgets = WidgetUtils.getUserWidgetsArray();
        return widgets.filter(w => w.content && w.content.type === "m.integration_manager");
    }

    static getRoomWidgetsOfType(room: Room, type: WidgetType) {
        const widgets = WidgetUtils.getRoomWidgets(room);
        return (widgets || []).filter(w => {
            const content = w.getContent();
            return content.url && type.matches(content.type);
        });
    }

    static removeIntegrationManagerWidgets() {
        const client = MatrixClientPeg.get();
        if (!client) {
            throw new Error('User not logged in');
        }
        const widgets = client.getAccountData('m.widgets');
        if (!widgets) return;
        const userWidgets = widgets.getContent() || {};
        Object.entries(userWidgets).forEach(([key, widget]) => {
            if (widget.content && widget.content.type === "m.integration_manager") {
                delete userWidgets[key];
            }
        });
        return client.setAccountData('m.widgets', userWidgets);
    }

    static addIntegrationManagerWidget(name: string, uiUrl: string, apiUrl: string) {
        return WidgetUtils.setUserWidget(
            "integration_manager_" + (new Date().getTime()),
            WidgetType.INTEGRATION_MANAGER,
            uiUrl,
            "Integration Manager: " + name,
            {"api_url": apiUrl},
        );
    }

    /**
     * Remove all stickerpicker widgets (stickerpickers are user widgets by nature)
     * @return {Promise} Resolves on account data updated
     */
    static removeStickerpickerWidgets() {
        const client = MatrixClientPeg.get();
        if (!client) {
            throw new Error('User not logged in');
        }
        const widgets = client.getAccountData('m.widgets');
        if (!widgets) return;
        const userWidgets = widgets.getContent() || {};
        Object.entries(userWidgets).forEach(([key, widget]) => {
            if (widget.content && widget.content.type === 'm.stickerpicker') {
                delete userWidgets[key];
            }
        });
        return client.setAccountData('m.widgets', userWidgets);
    }

    static makeAppConfig(appId, app, senderUserId, roomId, eventId) {
        if (!senderUserId) {
            throw new Error("Widgets must be created by someone - provide a senderUserId");
        }
        app.creatorUserId = senderUserId;

        app.id = appId;
        app.roomId = roomId;
        app.eventId = eventId;
        app.name = app.name || app.type;

        return app;
    }

    static getCapWhitelistForAppTypeInRoomId(appType, roomId) {
        const enableScreenshots = SettingsStore.getValue("enableWidgetScreenshots", roomId);

        const capWhitelist = enableScreenshots ? [Capability.Screenshot] : [];

        // Obviously anyone that can add a widget can claim it's a jitsi widget,
        // so this doesn't really offer much over the set of domains we load
        // widgets from at all, but it probably makes sense for sanity.
        if (WidgetType.JITSI.matches(appType)) {
            capWhitelist.push(Capability.AlwaysOnScreen);
        }
        capWhitelist.push(Capability.ReceiveTerminate);

        return capWhitelist;
    }

    static getWidgetSecurityKey(widgetId, widgetUrl, isUserWidget) {
        let widgetLocation = ActiveWidgetStore.getRoomId(widgetId);

        if (isUserWidget) {
            const userWidget = WidgetUtils.getUserWidgetsArray()
                .find((w) => w.id === widgetId && w.content && w.content.url === widgetUrl);

            if (!userWidget) {
                throw new Error("No matching user widget to form security key");
            }

            widgetLocation = userWidget.sender;
        }

        if (!widgetLocation) {
            throw new Error("Failed to locate where the widget resides");
        }

        return encodeURIComponent(`${widgetLocation}::${widgetUrl}`);
    }

    static getLocalJitsiWrapperUrl(opts: {forLocalRender?: boolean, auth?: string}={}) {
        // NB. we can't just encodeURIComponent all of these because the $ signs need to be there
        const queryStringParts = [
            'conferenceDomain=$domain',
            'conferenceId=$conferenceId',
            'isAudioOnly=$isAudioOnly',
            'displayName=$matrix_display_name',
            'avatarUrl=$matrix_avatar_url',
            'userId=$matrix_user_id',
            'roomId=$matrix_room_id',
        ];
        if (opts.auth) {
            queryStringParts.push(`auth=${opts.auth}`);
        }
        const queryString = queryStringParts.join('&');

        let baseUrl = window.location;
        if (window.location.protocol !== "https:" && !opts.forLocalRender) {
            // Use an external wrapper if we're not locally rendering the widget. This is usually
            // the URL that will end up in the widget event, so we want to make sure it's relatively
            // safe to send.
            // We'll end up using a local render URL when we see a Jitsi widget anyways, so this is
            // really just for backwards compatibility and to appease the spec.
            baseUrl = "https://app.element.io/";
        }
        const url = new URL("jitsi.html#" + queryString, baseUrl); // this strips hash fragment from baseUrl
        return url.href;
    }

    static getWidgetName(app) {
        return app?.name?.trim() || _t("Unknown App");
    }

    static getWidgetDataTitle(app) {
        return app?.data?.title?.trim() || "";
    }

    static editWidget(room, app) {
        // TODO: Open the right manager for the widget
        if (SettingsStore.getValue("feature_many_integration_managers")) {
            IntegrationManagers.sharedInstance().openAll(room, 'type_' + app.type, app.id);
        } else {
            IntegrationManagers.sharedInstance().getPrimaryManager().open(room, 'type_' + app.type, app.id);
        }
    }

    static snapshotWidget(app) {
        console.log("Requesting widget snapshot");
        ActiveWidgetStore.getWidgetMessaging(app.id).getScreenshot().catch((err) => {
            console.error("Failed to get screenshot", err);
        }).then((screenshot) => {
            dis.dispatch({
                action: 'picture_snapshot',
                file: screenshot,
            }, true);
        });
    }
}
