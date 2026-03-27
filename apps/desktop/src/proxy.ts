/*
Copyright 2026 tim2zg

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Proxy configuration utilities for Element Desktop.
 */

import { session } from "electron";

export interface DesktopProxyConfig {
    mode: "system" | "direct" | "custom";
    scheme?: "http" | "https" | "socks5" | "socks5h";
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    bypass?: string;
}

interface ElectronFixedConfig {
    mode: "system" | "direct" | "fixed_servers" | "auto_detect";
    proxyRules?: string;
    proxyBypassRules?: string;
}

let lastApplied: DesktopProxyConfig | null = null;

/**
 * Gets the last successfully applied proxy configuration.
 */
export function getLastAppliedConfig(): DesktopProxyConfig | null {
    return lastApplied;
}

/**
 * Apply the given proxy configuration.
 * - If Electron app not ready yet => errors might be caught.
 * - Errors are caught & logged; they do not throw.
 */
export async function applyProxyConfig(config?: Partial<DesktopProxyConfig>): Promise<void> {
    try {
        const normalized = normalizeConfig(config ?? { mode: "system" });
        let electronCfg = toElectronProxyConfig(normalized);

        // For system mode, we perform a manual resolution to avoid issues with Electron's default 'system' mode
        // which sometimes bypasses HTTP traffic incorrectly.
        if (normalized.mode === "system") {
            electronCfg = await resolveSystemProxy(session.defaultSession);
        }

        // Avoid re-applying identical config (cheap equality check).
        if (lastApplied && shallowEqual(normalized, lastApplied)) {
            console.log("[proxy] Config unchanged, skipping re-apply:", normalized);
            return;
        }

        console.log("[proxy] Applying new proxy config to session:", JSON.stringify(electronCfg));
        await session.defaultSession.setProxy(electronCfg);
        lastApplied = normalized;
        console.log("[proxy] Successfully applied config.");

        // Verification check for different protocols
        const [resHttps, resHttp, resMatrix] = await Promise.all([
            session.defaultSession.resolveProxy("https://google.com"),
            session.defaultSession.resolveProxy("http://example.com"),
            session.defaultSession.resolveProxy("https://matrix.org"),
        ]);
        console.log("[proxy] Verification Google (HTTPS):", resHttps);
        console.log("[proxy] Verification Example (HTTP):", resHttp);
        console.log("[proxy] Verification Matrix (HTTPS):", resMatrix);

        // Log certificate errors which often happen with intercepting proxies like ZAP
        if (!session.defaultSession.listenerCount("certificate-error")) {
            (session.defaultSession as any).on("certificate-error", (event: any, webContents: any, url: any, error: any, certificate: any, callback: any) => {
                console.warn(`[proxy] Certificate error for ${url}: ${error} (Issuer: ${certificate.issuerName})`);
                // We keep security strict by default, but this log confirms why traffic is failing.
            });
        }
    } catch (err) {
        console.error("Failed to apply proxy config:", err);
    }
}

/**
 * Resolves the system proxy settings by performing a manual resolution.
 * This is used to work around Electron's built-in system mode limitations.
 */
async function resolveSystemProxy(sess: Electron.Session): Promise<ElectronFixedConfig> {
    // We must set it to 'system' first, otherwise resolveProxy might just return 'DIRECT'
    // because it's using the previous session state.
    await sess.setProxy({ mode: "system" });

    const [resHttp, resHttps] = await Promise.all([
        sess.resolveProxy("http://example.com"),
        sess.resolveProxy("https://google.com"),
    ]);

    console.log("[proxy] System resolution results - HTTP:", resHttp, "HTTPS:", resHttps);

    const httpProxy = parseProxyResult(resHttp);
    const httpsProxy = parseProxyResult(resHttps);

    if (httpProxy || httpsProxy) {
        const rules: string[] = [];
        // Chromium proxy rules can be: "http=proxy1:8080;https=proxy2:8080"
        // or just "proxy1:8080" for all protocols.
        if (httpProxy) rules.push(`http=${httpProxy}`);
        if (httpsProxy) rules.push(`https=${httpsProxy}`);
        
        return {
            mode: "fixed_servers",
            proxyRules: rules.join(";"),
        };
    }
    
    return { mode: "direct" };
}

function normalizeConfig(cfg: Partial<DesktopProxyConfig>): DesktopProxyConfig {
    if (cfg.mode === "custom") {
        return {
            mode: "custom",
            scheme: cfg.scheme ?? "http",
            host: cfg.host ?? "",
            port: cfg.port,
            username: cfg.username,
            password: cfg.password,
            bypass: cfg.bypass,
        };
    }
    if (cfg.mode === "direct") {
        return { mode: "direct" };
    }
    return { mode: "system" };
}

function toElectronProxyConfig(cfg: DesktopProxyConfig): ElectronFixedConfig {
    if (cfg.mode === "system") {
        return { mode: "system" };
    }
    if (cfg.mode === "direct") {
        return { mode: "direct" };
    }
    // custom
    const parts: string[] = [];
    if (cfg.host && cfg.port) {
        let auth = "";
        if (cfg.username) {
            auth = encodeURIComponent(cfg.username);
            if (cfg.password) {
                auth += ":" + encodeURIComponent(cfg.password);
            }
            auth += "@";
        }
        // Build rule like: scheme://authhost:port
        // If we don't prefix with "scheme=", Chromium applies it to all protocols.
        const scheme = cfg.scheme ?? "http";
        parts.push(`${scheme}://${auth}${cfg.host}:${cfg.port}`);
    }

    const proxyRules = parts.join(";");
    const proxyBypassRules = (cfg.bypass ?? "")
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .join(",");

    return {
        mode: "fixed_servers",
        proxyRules: proxyRules || undefined,
        proxyBypassRules: proxyBypassRules || undefined,
    };
}

/**
 * Parses a proxy string from Electron's resolveProxy.
 * E.g. "PROXY 127.0.0.1:8081; DIRECT" -> "http://127.0.0.1:8081"
 */
function parseProxyResult(res: string): string | undefined {
    const parts = res.split(";");
    for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.startsWith("PROXY ")) {
            const addr = trimmed.substring(6);
            return `http://${addr}`;
        }
        if (trimmed.startsWith("SOCKS ")) {
            const addr = trimmed.substring(6);
            return `socks4://${addr}`;
        }
        if (trimmed.startsWith("SOCKS5 ")) {
            const addr = trimmed.substring(7);
            return `socks5://${addr}`;
        }
        if (trimmed.startsWith("HTTPS ")) {
            const addr = trimmed.substring(6);
            return `https://${addr}`;
        }
    }
    return undefined;
}

function shallowEqual(a: DesktopProxyConfig, b: DesktopProxyConfig): boolean {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
        if ((a as any)[k] !== (b as any)[k]) return false;
    }
    return true;
}
