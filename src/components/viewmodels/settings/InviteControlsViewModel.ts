import { type AccountDataEvents } from "matrix-js-sdk/src/types";
import { useState, useMemo, useCallback } from "react";
import { logger } from "matrix-js-sdk/src/logger";

import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { useAccountData } from "../../../hooks/useAccountData";
import { useAsyncMemo } from "../../../hooks/useAsyncMemo";

interface InviteControlsViewModel {
    isSupported: boolean | undefined;
    isEnforcedServerside: boolean | undefined;
    globalInvitesEnabled: boolean;
    busy: boolean;
    error: boolean;
    toggleGlobalInvites: () => void;
}

export function useInviteControlsViewModel(): InviteControlsViewModel {
    const client = useMatrixClientContext();
    const [hasError, setHasError] = useState(false);
    const [busy, setBusy] = useState(false);
    const inviteConfig = useAccountData<AccountDataEvents["org.matrix.msc4155.invite_permission_config"]>(
        client,
        "org.matrix.msc4155.invite_permission_config",
    );

    // Is supported by the server.
    const isSupported = useAsyncMemo(async () => {
        return await client.doesServerSupportUnstableFeature("org.matrix.msc4155");
    }, [client]);

    // Is enforced by the server.
    const isEnforcedServerside = useAsyncMemo(async () => {
        const caps = await client.getCapabilities();
        return caps["org.matrix.msc4155.invite_permission_config_enforced"]?.enabled;
    }, [client]);

    // This implements a very basic version of MSC4155 that simply allows
    // or disallows all invites by setting a simple glob.
    // Keep in mind that users may configure more powerful rules on other
    // clients and we should keep those intact.
    const globalInvitesEnabled = useMemo(() => {
        if (!inviteConfig) {
            return false;
        }
        return inviteConfig["blocked_users"]?.includes("*") !== true;
    }, [inviteConfig]);

    const toggleGlobalInvites = useCallback(async () => {
        setHasError(false);
        setBusy(true);
        const newConfig = { ...inviteConfig };
        if (newConfig.blocked_users?.includes("*")) {
            newConfig.blocked_users = newConfig.blocked_users.filter((u) => u !== "*");
        } else {
            newConfig.blocked_users = [...new Set([...(newConfig.blocked_users ?? []), "*"])];
        }
        try {
            await client.setAccountData("org.matrix.msc4155.invite_permission_config", newConfig);
        } catch (ex) {
            logger.error("Could not change input config", ex);
            setHasError(true);
        } finally {
            setBusy(false);
        }
    }, [client, inviteConfig]);

    return {
        globalInvitesEnabled,
        isSupported,
        isEnforcedServerside,
        busy,
        error: hasError,
        toggleGlobalInvites,
    };
}
