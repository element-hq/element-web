/*
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Room } from "matrix-js-sdk/src/models/room";
import {
    ClientWidgetApi,
    IGetOpenIDActionRequest,
    IGetOpenIDActionResponseData,
    IStickerActionRequest,
    IStickyActionRequest,
    ITemplateParams,
    IWidget,
    IWidgetApiRequest,
    IWidgetApiRequestEmptyData,
    IWidgetData,
    MatrixCapabilities,
    OpenIDRequestState,
    runTemplate,
    Widget,
    WidgetApiToWidgetAction,
    WidgetApiFromWidgetAction,
    IModalWidgetOpenRequest,
} from "matrix-widget-api";
import { StopGapWidgetDriver } from "./StopGapWidgetDriver";
import { EventEmitter } from "events";
import { WidgetMessagingStore } from "./WidgetMessagingStore";
import RoomViewStore from "../RoomViewStore";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { OwnProfileStore } from "../OwnProfileStore";
import WidgetUtils from '../../utils/WidgetUtils';
import { IntegrationManagers } from "../../integrations/IntegrationManagers";
import SettingsStore from "../../settings/SettingsStore";
import { WidgetType } from "../../widgets/WidgetType";
import ActiveWidgetStore from "../ActiveWidgetStore";
import { objectShallowClone } from "../../utils/objects";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { ElementWidgetActions } from "./ElementWidgetActions";
import Modal from "../../Modal";
import WidgetOpenIDPermissionsDialog from "../../components/views/dialogs/WidgetOpenIDPermissionsDialog";
import {ModalWidgetStore} from "../ModalWidgetStore";
import ThemeWatcher from "../../settings/watchers/ThemeWatcher";
import {getCustomTheme} from "../../theme";
import CountlyAnalytics from "../../CountlyAnalytics";

// TODO: Destroy all of this code

interface IAppTileProps {
    // Note: these are only the props we care about

    app: IWidget;
    room: Room;
    userId: string;
    creatorUserId: string;
    waitForIframeLoad: boolean;
    whitelistCapabilities: string[];
    userWidget: boolean;
}

// TODO: Don't use this because it's wrong
class ElementWidget extends Widget {
    constructor(w) {
        super(w);
    }

    public get templateUrl(): string {
        if (WidgetType.JITSI.matches(this.type)) {
            return WidgetUtils.getLocalJitsiWrapperUrl({
                forLocalRender: true,
                auth: super.rawData?.auth as string, // this.rawData can call templateUrl, do this to prevent looping
            });
        }
        return super.templateUrl;
    }

    public get popoutTemplateUrl(): string {
        if (WidgetType.JITSI.matches(this.type)) {
            return WidgetUtils.getLocalJitsiWrapperUrl({
                forLocalRender: false, // The only important difference between this and templateUrl()
                auth: super.rawData?.auth as string,
            });
        }
        return this.templateUrl; // use this instead of super to ensure we get appropriate templating
    }

    public get rawData(): IWidgetData {
        let conferenceId = super.rawData['conferenceId'];
        if (conferenceId === undefined) {
            // we'll need to parse the conference ID out of the URL for v1 Jitsi widgets
            const parsedUrl = new URL(super.templateUrl); // use super to get the raw widget URL
            conferenceId = parsedUrl.searchParams.get("confId");
        }
        let domain = super.rawData['domain'];
        if (domain === undefined) {
            // v1 widgets default to jitsi.riot.im regardless of user settings
            domain = "jitsi.riot.im";
        }

        let theme = new ThemeWatcher().getEffectiveTheme();
        if (theme.startsWith("custom-")) {
            const customTheme = getCustomTheme(theme.substr(7));
            // Jitsi only understands light/dark
            theme = customTheme.is_dark ? "dark" : "light";
        }

        // only allow light/dark through, defaulting to dark as that was previously the only state
        // accounts for legacy-light/legacy-dark themes too
        if (theme.includes("light")) {
            theme = "light";
        } else {
            theme = "dark";
        }

        return {
            ...super.rawData,
            theme,
            conferenceId,
            domain,
        };
    }

    public getCompleteUrl(params: ITemplateParams, asPopout=false): string {
        return runTemplate(asPopout ? this.popoutTemplateUrl : this.templateUrl, {
            // we need to supply a whole widget to the template, but don't have
            // easy access to the definition the superclass is using, so be sad
            // and gutwrench it.
            // This isn't a problem when the widget architecture is fixed and this
            // subclass gets deleted.
            ...super['definition'], // XXX: Private member access
            data: this.rawData,
        }, params);
    }
}

export class StopGapWidget extends EventEmitter {
    private messaging: ClientWidgetApi;
    private mockWidget: ElementWidget;
    private scalarToken: string;

    constructor(private appTileProps: IAppTileProps) {
        super();
        let app = appTileProps.app;

        // Backwards compatibility: not all old widgets have a creatorUserId
        if (!app.creatorUserId) {
            app = objectShallowClone(app); // clone to prevent accidental mutation
            app.creatorUserId = MatrixClientPeg.get().getUserId();
        }

        this.mockWidget = new ElementWidget(app);
    }

    public get widgetApi(): ClientWidgetApi {
        return this.messaging;
    }

    /**
     * The URL to use in the iframe
     */
    public get embedUrl(): string {
        return this.runUrlTemplate({asPopout: false});
    }

    /**
     * The URL to use in the popout
     */
    public get popoutUrl(): string {
        return this.runUrlTemplate({asPopout: true});
    }

    private runUrlTemplate(opts = {asPopout: false}): string {
        const templated = this.mockWidget.getCompleteUrl({
            currentRoomId: RoomViewStore.getRoomId(),
            currentUserId: MatrixClientPeg.get().getUserId(),
            userDisplayName: OwnProfileStore.instance.displayName,
            userHttpAvatarUrl: OwnProfileStore.instance.getHttpAvatarUrl(),
        }, opts?.asPopout);

        const parsed = new URL(templated);

        // Add in some legacy support sprinkles (for non-popout widgets)
        // TODO: Replace these with proper widget params
        // See https://github.com/matrix-org/matrix-doc/pull/1958/files#r405714833
        if (!opts?.asPopout) {
            parsed.searchParams.set('widgetId', this.mockWidget.id);
            parsed.searchParams.set('parentUrl', window.location.href.split('#', 2)[0]);

            // Give the widget a scalar token if we're supposed to (more legacy)
            // TODO: Stop doing this
            if (this.scalarToken) {
                parsed.searchParams.set('scalar_token', this.scalarToken);
            }
        }

        // Replace the encoded dollar signs back to dollar signs. They have no special meaning
        // in HTTP, but URL parsers encode them anyways.
        return parsed.toString().replace(/%24/g, '$');
    }

    public get isManagedByManager(): boolean {
        return !!this.scalarToken;
    }

    public get started(): boolean {
        return !!this.messaging;
    }

    private get widgetId() {
        return this.messaging.widget.id;
    }

    private onOpenIdReq = async (ev: CustomEvent<IGetOpenIDActionRequest>) => {
        ev.preventDefault();

        const rawUrl = this.appTileProps.app.url;
        const widgetSecurityKey = WidgetUtils.getWidgetSecurityKey(this.widgetId, rawUrl, this.appTileProps.userWidget);

        const settings = SettingsStore.getValue("widgetOpenIDPermissions");
        if (settings.deny && settings.deny.includes(widgetSecurityKey)) {
            this.messaging.transport.reply(ev.detail, <IGetOpenIDActionResponseData>{
                state: OpenIDRequestState.Blocked,
            });
            return;
        }
        if (settings.allow && settings.allow.includes(widgetSecurityKey)) {
            const credentials = await MatrixClientPeg.get().getOpenIdToken();
            this.messaging.transport.reply(ev.detail, <IGetOpenIDActionResponseData>{
                state: OpenIDRequestState.Allowed,
                ...credentials,
            });
            return;
        }

        // Confirm that we received the request
        this.messaging.transport.reply(ev.detail, <IGetOpenIDActionResponseData>{
            state: OpenIDRequestState.PendingUserConfirmation,
        });

        // Actually ask for permission to send the user's data
        Modal.createTrackedDialog("OpenID widget permissions", '', WidgetOpenIDPermissionsDialog, {
            widgetUrl: rawUrl,
            widgetId: this.widgetId,
            isUserWidget: this.appTileProps.userWidget,

            onFinished: async (confirm) => {
                const responseBody: IGetOpenIDActionResponseData = {
                    state: confirm ? OpenIDRequestState.Allowed : OpenIDRequestState.Blocked,
                    original_request_id: ev.detail.requestId, // eslint-disable-line camelcase
                };
                if (confirm) {
                    const credentials = await MatrixClientPeg.get().getOpenIdToken();
                    Object.assign(responseBody, credentials);
                }
                this.messaging.transport.send(WidgetApiToWidgetAction.OpenIDCredentials, responseBody).catch(error => {
                    console.error("Failed to send OpenID credentials: ", error);
                });
            },
        });
    };

    private onOpenModal = async (ev: CustomEvent<IModalWidgetOpenRequest>) => {
        ev.preventDefault();
        if (ModalWidgetStore.instance.canOpenModalWidget()) {
            ModalWidgetStore.instance.openModalWidget(ev.detail.data, this.mockWidget);
            this.messaging.transport.reply(ev.detail, {}); // ack
        } else {
            this.messaging.transport.reply(ev.detail, {
                error: {
                    message: "Unable to open modal at this time",
                },
            })
        }
    };

    public start(iframe: HTMLIFrameElement) {
        if (this.started) return;
        const driver = new StopGapWidgetDriver( this.appTileProps.whitelistCapabilities || []);
        this.messaging = new ClientWidgetApi(this.mockWidget, iframe, driver);
        this.messaging.on("preparing", () => this.emit("preparing"));
        this.messaging.on("ready", () => this.emit("ready"));
        this.messaging.on(`action:${WidgetApiFromWidgetAction.GetOpenIDCredentials}`, this.onOpenIdReq);
        this.messaging.on(`action:${WidgetApiFromWidgetAction.OpenModalWidget}`, this.onOpenModal);
        WidgetMessagingStore.instance.storeMessaging(this.mockWidget, this.messaging);

        if (!this.appTileProps.userWidget && this.appTileProps.room) {
            ActiveWidgetStore.setRoomId(this.mockWidget.id, this.appTileProps.room.roomId);
        }

        if (WidgetType.JITSI.matches(this.mockWidget.type)) {
            this.messaging.on("action:set_always_on_screen",
                (ev: CustomEvent<IStickyActionRequest>) => {
                    if (this.messaging.hasCapability(MatrixCapabilities.AlwaysOnScreen)) {
                        CountlyAnalytics.instance.trackJoinCall(this.appTileProps.room.roomId, true, true);
                        ActiveWidgetStore.setWidgetPersistence(this.mockWidget.id, ev.detail.data.value);
                        ev.preventDefault();
                        this.messaging.transport.reply(ev.detail, <IWidgetApiRequestEmptyData>{}); // ack
                    }
                },
            );
        } else if (WidgetType.STICKERPICKER.matches(this.mockWidget.type)) {
            this.messaging.on(`action:${ElementWidgetActions.OpenIntegrationManager}`,
                (ev: CustomEvent<IWidgetApiRequest>) => {
                    // Acknowledge first
                    ev.preventDefault();
                    this.messaging.transport.reply(ev.detail, <IWidgetApiRequestEmptyData>{});

                    // First close the stickerpicker
                    defaultDispatcher.dispatch({action: "stickerpicker_close"});

                    // Now open the integration manager
                    // TODO: Spec this interaction.
                    const data = ev.detail.data;
                    const integType = data?.integType
                    const integId = <string>data?.integId;

                    // TODO: Open the right integration manager for the widget
                    if (SettingsStore.getValue("feature_many_integration_managers")) {
                        IntegrationManagers.sharedInstance().openAll(
                            MatrixClientPeg.get().getRoom(RoomViewStore.getRoomId()),
                            `type_${integType}`,
                            integId,
                        );
                    } else {
                        IntegrationManagers.sharedInstance().getPrimaryManager().open(
                            MatrixClientPeg.get().getRoom(RoomViewStore.getRoomId()),
                            `type_${integType}`,
                            integId,
                        );
                    }
                },
            );

            // TODO: Replace this event listener with appropriate driver functionality once the API
            // establishes a sane way to send events back and forth.
            this.messaging.on(`action:${WidgetApiFromWidgetAction.SendSticker}`,
                (ev: CustomEvent<IStickerActionRequest>) => {
                    // Acknowledge first
                    ev.preventDefault();
                    this.messaging.transport.reply(ev.detail, <IWidgetApiRequestEmptyData>{});

                    // Send the sticker
                    defaultDispatcher.dispatch({
                        action: 'm.sticker',
                        data: ev.detail.data,
                        widgetId: this.mockWidget.id,
                    });
                },
            );
        }
    }

    public async prepare(): Promise<void> {
        if (this.scalarToken) return;
        const existingMessaging = WidgetMessagingStore.instance.getMessaging(this.mockWidget);
        if (existingMessaging) this.messaging = existingMessaging;
        try {
            if (WidgetUtils.isScalarUrl(this.mockWidget.templateUrl)) {
                const managers = IntegrationManagers.sharedInstance();
                if (managers.hasManager()) {
                    // TODO: Pick the right manager for the widget
                    const defaultManager = managers.getPrimaryManager();
                    if (WidgetUtils.isScalarUrl(defaultManager.apiUrl)) {
                        const scalar = defaultManager.getScalarClient();
                        this.scalarToken = await scalar.getScalarToken();
                    }
                }
            }
        } catch (e) {
            // All errors are non-fatal
            console.error("Error preparing widget communications: ", e);
        }
    }

    public stop(opts = {forceDestroy: false}) {
        if (!opts?.forceDestroy && ActiveWidgetStore.getPersistentWidgetId() === this.mockWidget.id) {
            console.log("Skipping destroy - persistent widget");
            return;
        }
        if (!this.started) return;
        WidgetMessagingStore.instance.stopMessaging(this.mockWidget);
        ActiveWidgetStore.delRoomId(this.mockWidget.id);
    }
}
