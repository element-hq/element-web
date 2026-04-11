/**
 * TorService.ts
 *
 * Manages the lifecycle of the bundled Tor process within the Electron main process.
 * Responsibilities:
 *  - Resolve the correct Tor binary and bundled libs for the current platform/arch
 *  - Spawn Tor as a child process with a minimal torrc
 *  - Parse Tor bootstrap progress from stdout/stderr
 *  - Expose the SOCKS5h proxy address once bootstrap reaches 100%
 *  - Kill Tor cleanly on app exit, with a forced kill fallback
 */

import { ChildProcess, spawn } from "child_process";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { app } from "electron";

export interface BootstrapEvent {
    percent: number;
    summary: string;
}

type TorPlatform = "linux-x64" | "linux-arm64" | "mac-x64" | "mac-arm64" | "win-x64";

export class TorService extends EventEmitter {
    static readonly EVENT_BOOTSTRAP = "bootstrap";
    static readonly EVENT_READY = "ready";
    static readonly EVENT_ERROR = "error";

    /** How long to wait for Tor to exit gracefully before sending SIGKILL (ms) */
    private static readonly STOP_TIMEOUT_MS = 5_000;

    /** How long to wait for bootstrap before giving up (ms) */
    private static readonly BOOTSTRAP_TIMEOUT_MS = 120_000;

    private torProcess: ChildProcess | null = null;
    private dataDir: string;
    private socksPort: number = 19050;
    private controlPort: number = 19051;
    private _isReady: boolean = false;

    constructor() {
        super();
        this.dataDir = path.join(os.tmpdir(), "element-tor-data");
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    get proxyUrl(): string {
        return `socks5://127.0.0.1:${this.socksPort}`;
    }

    get isReady(): boolean {
        return this._isReady;
    }

    async start(): Promise<void> {
        const binaryPath = this.resolveBinaryPath();
        const torrcPath = await this.writeTorrc();

        const libDir = path.dirname(binaryPath);
        const env = {
            ...process.env,
            LD_LIBRARY_PATH: [libDir, process.env.LD_LIBRARY_PATH]
                .filter(Boolean)
                .join(":"),
        };

        console.log(`[TorService] Starting Tor binary: ${binaryPath}`);

        this.torProcess = spawn(binaryPath, ["-f", torrcPath], {
            env,
            stdio: ["ignore", "pipe", "pipe"],
        });

        this.torProcess.stdout?.on("data", (data: Buffer) => {
            this.parseBootstrap(data.toString());
        });

        this.torProcess.stderr?.on("data", (data: Buffer) => {
            this.parseBootstrap(data.toString());
        });

        this.torProcess.on("exit", (code, signal) => {
            console.warn(`[TorService] Tor exited — code=${code} signal=${signal}`);
            if (!this._isReady) {
                this.emit(
                    TorService.EVENT_ERROR,
                    new Error(`Tor exited before bootstrap completed (code=${code})`),
                );
            }
            this.torProcess = null;
        });

        this.torProcess.on("error", (err) => {
            console.error("[TorService] Failed to spawn Tor:", err);
            this.emit(TorService.EVENT_ERROR, err);
        });

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Tor bootstrap timed out after ${TorService.BOOTSTRAP_TIMEOUT_MS / 1000}s`));
            }, TorService.BOOTSTRAP_TIMEOUT_MS);

            this.once(TorService.EVENT_READY, () => {
                clearTimeout(timeout);
                resolve();
            });

            this.once(TorService.EVENT_ERROR, (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    /**
     * Gracefully stop Tor with a forced kill fallback.
     * Sends SIGTERM and waits up to STOP_TIMEOUT_MS before sending SIGKILL.
     */
    stop(): void {
        if (!this.torProcess) return;

        console.log("[TorService] Stopping Tor (SIGTERM)...");
        this.torProcess.kill("SIGTERM");
        this._isReady = false;

        const proc = this.torProcess;
        this.torProcess = null;

        const forceKill = setTimeout(() => {
            if (!proc.killed) {
                console.warn("[TorService] Tor did not exit in time, sending SIGKILL...");
                proc.kill("SIGKILL");
            }
        }, TorService.STOP_TIMEOUT_MS);

        proc.once("exit", (code, signal) => {
            clearTimeout(forceKill);
            console.log(`[TorService] Tor process exited cleanly (code=${code} signal=${signal}).`);
        });

        // Give the event loop a chance to flush before the process exits
        // by keeping a reference alive briefly
        setImmediate(() => {});
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private resolveBinaryPath(): string {
        const platform = this.detectPlatform();
        const binaryName = platform.startsWith("win") ? "tor.exe" : "tor";

        let binaryPath: string;

        if (app.isPackaged) {
            binaryPath = path.join(
                process.resourcesPath,
                "3rd-party",
                "tor",
                platform,
                binaryName,
            );
        } else {
            binaryPath = path.join(
                app.getAppPath(),
                "3rd-party",
                "tor",
                platform,
                binaryName,
            );
        }

        if (!fs.existsSync(binaryPath)) {
            throw new Error(
                `Tor binary not found at ${binaryPath}. ` +
                `Run 'bash scripts/extract-tor.sh' first.`,
            );
        }

        return binaryPath;
    }

    private detectPlatform(): TorPlatform {
        const p = process.platform;
        const a = process.arch;

        if (p === "linux" && a === "x64") return "linux-x64";
        if (p === "linux" && a === "arm64") return "linux-arm64";
        if (p === "darwin" && a === "x64") return "mac-x64";
        if (p === "darwin" && a === "arm64") return "mac-arm64";
        if (p === "win32" && a === "x64") return "win-x64";

        throw new Error(`Unsupported platform: ${p} ${a}`);
    }

    private async writeTorrc(): Promise<string> {
        fs.mkdirSync(this.dataDir, { recursive: true });

        const torrcPath = path.join(this.dataDir, "torrc");
        const torrcContent = [
            `SocksPort 127.0.0.1:${this.socksPort}`,
            `ControlPort 127.0.0.1:${this.controlPort}`,
            `DataDirectory ${this.dataDir}`,
            `Log notice stdout`,
            `AvoidDiskWrites 1`,
            `CookieAuthentication 1`,
        ].join("\n");

        fs.writeFileSync(torrcPath, torrcContent, "utf-8");
        return torrcPath;
    }

    private parseBootstrap(output: string): void {
        const lines = output.split("\n");

        for (const line of lines) {
            if (line.trim()) console.log(`[Tor] ${line.trim()}`);

            const match = line.match(/Bootstrapped (\d+)%[^:]*:\s*(.+)/);
            if (match) {
                const percent = parseInt(match[1], 10);
                const summary = match[2].trim();

                this.emit(TorService.EVENT_BOOTSTRAP, { percent, summary } as BootstrapEvent);

                if (percent === 100) {
                    this._isReady = true;
                    this.emit(TorService.EVENT_READY);
                }
            }
        }
    }
}