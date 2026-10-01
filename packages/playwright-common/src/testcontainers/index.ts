/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
export { makePostgres } from "./postgres.js";
export type { HomeserverInstance, HomeserverContainer, StartedHomeserverContainer } from "./HomeserverContainer.js";
export { type SynapseConfig, SynapseContainer, StartedSynapseContainer } from "./synapse.js";
export {
    type MasConfig,
    MatrixAuthenticationServiceContainer,
    StartedMatrixAuthenticationServiceContainer,
    makeMas,
} from "./mas.js";
export { type MailpitClient, MailpitContainer, StartedMailpitContainer } from "./mailpit.js";
