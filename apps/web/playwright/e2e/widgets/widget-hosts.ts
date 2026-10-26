/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/**
 * The two widget host implementations a widget spec runs against: matrix-widget-api, and the MSC4412
 * host behind its labs flag, which embeds legacy widgets through the compat wrapper.
 */
export const WIDGET_HOSTS = [
    { name: "matrix-widget-api", labsFlags: [] as string[], msc4412: false },
    { name: "MSC4412 widget host", labsFlags: ["feature_msc4412_widget_host"], msc4412: true },
];
