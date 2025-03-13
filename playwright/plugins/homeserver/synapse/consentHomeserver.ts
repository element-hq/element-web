/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Fixtures } from "../../../element-web-test.ts";

export const consentHomeserver: Fixtures = {
    _homeserver: [
        async ({ _homeserver: container, mailpit }, use) => {
            container
                .withCopyDirectoriesToContainer([
                    { source: "playwright/plugins/homeserver/synapse/res", target: "/data/res" },
                ])
                .withConfig({
                    email: {
                        enable_notifs: false,
                        smtp_host: "mailpit",
                        smtp_port: 1025,
                        smtp_user: "username",
                        smtp_pass: "password",
                        require_transport_security: false,
                        notif_from: "Your Friendly %(app)s homeserver <noreply@example.com>",
                        app_name: "Matrix",
                        notif_template_html: "notif_mail.html",
                        notif_template_text: "notif_mail.txt",
                        notif_for_new_users: true,
                        client_base_url: "http://localhost/element",
                    },
                    user_consent: {
                        template_dir: "/data/res/templates/privacy",
                        version: "1.0",
                        server_notice_content: {
                            msgtype: "m.text",
                            body: "To continue using this homeserver you must review and agree to the terms and conditions at %(consent_uri)s",
                        },
                        send_server_notice_to_guests: true,
                        block_events_error:
                            "To continue using this homeserver you must review and agree to the terms and conditions at %(consent_uri)s",
                        require_at_registration: true,
                    },
                    server_notices: {
                        system_mxid_localpart: "notices",
                        system_mxid_display_name: "Server Notices",
                        system_mxid_avatar_url: "mxc://localhost/oumMVlgDnLYFaPVkExemNVVZ",
                        room_name: "Server Notices",
                    },
                })
                .withConfigField("listeners[0].resources[0].names", ["client", "consent"]);
            await use(container);
        },
        { scope: "worker" },
    ],

    context: async ({ homeserverType, context }, use, testInfo) => {
        testInfo.skip(homeserverType !== "synapse", "does not yet support MAS");
        await use(context);
    },
};
