import * as Sentry from "@sentry/browser";
import { Integrations } from "@sentry/tracing";
import PlatformPeg from "./PlatformPeg";
import SdkConfig from "./SdkConfig";

export function sendSentryReport(userText: string, label: string, error: Error): void {
    if (!SdkConfig.get()["sentry"]) return;

    // Ignore reports without errors, as they're not useful in sentry and can't easily be aggregated
    if (error) {
        Sentry.captureException(error);
    }
}

interface ISentryConfig {
    dsn: string;
    environment?: string;
}

export async function initSentry(sentryConfig: ISentryConfig): Promise<void> {
    if (!sentryConfig) return;
    const platform = PlatformPeg.get();
    let appVersion = "unknown";
    try {
        appVersion = await platform.getAppVersion();
    } catch (e) {}

    Sentry.init({
        dsn: sentryConfig.dsn,
        release: `${platform.getHumanReadableName()}@${appVersion}`,
        environment: sentryConfig.environment,
        defaultIntegrations: false,
        autoSessionTracking: false,
        debug: true,
        integrations: [
            // specifically disable Integrations.GlobalHandlers, which hooks uncaught exceptions - we don't
            // want to capture those at this stage, just explicit rageshakes
            new Sentry.Integrations.InboundFilters(),
            new Sentry.Integrations.FunctionToString(),
            new Sentry.Integrations.Breadcrumbs(),
            new Sentry.Integrations.UserAgent(),
            new Sentry.Integrations.Dedupe(),
        ],
        // Set to 1.0 which is reasonable if we're only submitting Rageshakes; will need to be set < 1.0
        // if we collect more frequently.
        tracesSampleRate: 1.0,
    });
}
