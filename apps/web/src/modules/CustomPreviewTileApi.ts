import { CustomPreviewTileIcon, CustomPreviewTileOptions, CustomPreviewTilePatcher, CustomPreviewTileApi as ICustomPreviewTileApi, MediaHandle } from "@element-hq/element-web-module-api"

export interface RegisteredCustomPreviewTilePatcher {
    patcher: CustomPreviewTilePatcher;
    options: CustomPreviewTileOptions;
}

export interface CustomPreviewTilePatchBatch {
    icons: CustomPreviewTileIcon[];
    headers: string[];
    subtexts: string[];
}

export class CustomPreviewTileApi implements ICustomPreviewTileApi {
    private readonly patchers: Map<string, RegisteredCustomPreviewTilePatcher> = new Map();
    private sortedPatchers: RegisteredCustomPreviewTilePatcher[] = [];

    registerCustomPreviewTilePatcher(patcher: CustomPreviewTilePatcher, options: CustomPreviewTileOptions): void {
        if (this.patchers.has(options.id))
            throw new Error(`A custom previeiw tile patcher with ID ${options.id} has already been registered`);

        const regPatcher: RegisteredCustomPreviewTilePatcher = {
            patcher,
            options
        };
        this.patchers.set(options.id, regPatcher);
        this.sortedPatchers.push(regPatcher);
        this.sortedPatchers.sort();
    }

    async applyPatchers(media: MediaHandle): Promise<CustomPreviewTilePatchBatch> {
        const patches = (await Promise.all(this.sortedPatchers.map(async regPatcher => await regPatcher.patcher(media)))).filter(p => p !== null);
        const batch: CustomPreviewTilePatchBatch = {
            icons: [],
            headers: [],
            subtexts: []
        };

        patches.forEach(patch => {
            if (patch.icon)
                batch.icons.push(patch.icon);
            if (patch.header)
                batch.headers.push(patch.header);
            if (patch.subtext)
                batch.subtexts.push(patch.subtext);
        });

        return batch;
    }
}
