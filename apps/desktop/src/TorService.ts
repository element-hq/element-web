/**
 * TorService.ts
 *
 * Manages the lifecycle of the bundled Tor process within the Electron main process.
 * Responsibilities:
 *  - Resolve the correct Tor binary and bundled libs for the current platform/arch
 *  - Spawn Tor as a child process with a minimal torrc
 *  - Parse Tor bootstrap progress from stdout/stderr
 *  - Expose the SOCKS5h proxy address once bootstrap reaches 100%
 *  - Kill Tor cleanly on app exit
 */

import { ChildProcess, spawn } from "child_process";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { app } from "electron";

// Bootstrap progress event payload
export interface BootstrapEvent {
    percent: number;
    summary: string;
}

// Supported platform/arch combinations
type TorPlatform = "linux-x64" | "linux-arm64" | "darwin-x64" | "darwin-arm64" | "win32-x64";

export class TorService extends EventEmitter {
    /** Emitted repeatedly during bootstrap with { percent, summary } */
    static readonly EVENT_BOOTSTRAP = "bootstrap";
    /** Emitted once when bootstrap reaches 100% */
    static readonly EVENT_READY = "ready";
    /** Emitted if Tor exits unexpectedly or fails to start */
    static readonly EVENT_ERROR = "error";

    private torProcess: ChildProcess | null = null;
    private dataDir: string;
    private socksPort: number = 19050; // Use non-standard port to avoid conflicts
    private controlPort: number = 19051;
    private _isReady: boolean = false;

    constructor() {
        super();
        // Store Tor runtime data in the OS temp dir, scoped to this app
        this.dataDir = path.join(os.tmpdir(), "element-tor-data");
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /** Returns the SOCKS5h proxy URL for use with session.setProxy() */
    get proxyUrl(): string {
        return `socks5://127.0.0.1:${this.socksPort}`;
    }

    get isReady(): boolean {
        return this._isReady;
    }

    /** Start the Tor process. Resolves when bootstrap is complete. */
    async start(): Promise<void> {
        const binaryPath = this.resolveBinaryPath();
        const torrcPath = await this.writeTorrc();

        // Set LD_LIBRARY_PATH so tor can find its bundled libs (Linux)
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

        this.torProcess.on("exit", (code) => {
            console.warn(`[TorService] Tor exited with code ${code}`);
            if (!this._isReady) {
                this.emit(TorService.EVENT_ERROR, new Error(`Tor exited before bootstrap (code ${code})`));
            }
        });

        this.torProcess.on("error", (err) => {
            console.error("[TorService] Failed to spawn Tor:", err);
            this.emit(TorService.EVENT_ERROR, err);
        });

        // Wait for bootstrap to complete (timeout: 2 minutes)
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Tor bootstrap timed out after 120s"));
            }, 120_000);

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

    /** Kill the Tor process. Called on app quit. */
    stop(): void {
        if (this.torProcess) {
            console.log("[TorService] Stopping Tor...");
            this.torProcess.kill("SIGTERM");
            this.torProcess = null;
            this._isReady = false;
        }
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Resolve the path to the Tor binary for the current platform and arch.
     * In development: relative to project root.
     * In production (packaged app): relative to app.getAppPath() or process.resourcesPath.
     */
    private resolveBinaryPath(): string {
        const platform = this.detectPlatform();
        const binaryName = platform.startsWith("win32") ? "tor.exe" : "tor";

        let binaryPath: string;

        if (app.isPackaged) {
            // In packaged app, binaries are in resources/3rd-party/tor/
            binaryPath = path.join(
                process.resourcesPath,
                "3rd-party",
                "tor",
                platform,
                binaryName
            );
        } else {
            // In development, binaries are in apps/desktop/3rd-party/tor/
            binaryPath = path.join(
                app.getAppPath(),
                "3rd-party",
                "tor",
                platform,
                binaryName
            );
        }

        if (!fs.existsSync(binaryPath)) {
            throw new Error(
                `Tor binary not found at ${binaryPath}. ` +
                `Run 'bash scripts/extract-tor.sh' first.`
            );
        }

        return binaryPath;
    }

    /** Detect the current platform/arch combination */
    private detectPlatform(): TorPlatform {
        const p = process.platform;
        const a = process.arch;

        if (p === "linux" && a === "x64") return "linux-x64";
        if (p === "linux" && a === "arm64") return "linux-arm64";
        if (p === "darwin" && a === "x64") return "darwin-x64";
        if (p === "darwin" && a === "arm64") return "darwin-arm64";
        if (p === "win32" && a === "x64") return "win32-x64";

        throw new Error(`Unsupported platform: ${p} ${a}`);
    }

    /** Write a minimal torrc to a temp directory */
    private async writeTorrc(): Promise<string> {
        fs.mkdirSync(this.dataDir, { recursive: true });

        const torrcPath = path.join(this.dataDir, "torrc");
        const torrcContent = [
            `SocksPort 127.0.0.1:${this.socksPort}`,
            `ControlPort 127.0.0.1:${this.controlPort}`,
            `DataDirectory ${this.dataDir}`,
            `Log notice stdout`,
            `AvoidDiskWrites 1`,
        ].join("\n");

        fs.writeFileSync(torrcPath, torrcContent, "utf-8");
        return torrcPath;
    }

    /**
     * Parse Tor bootstrap progress from log output.
     * Tor emits lines like:
     *   [notice] Bootstrapped 10% (conn): Connecting to a relay
     *   [notice] Bootstrapped 100% (done): Done
     */
    private parseBootstrap(output: string): void {
        const lines = output.split("\n");

        for (const line of lines) {
            // Forward all logs to console for debugging
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