import { Engine } from "@babylonjs/core";
import { MeetingSpaceScene, IMeetingSpaceSceneParams } from "./meetingSpaceScene";
import "@babylonjs/loaders";

export interface InitializeBabylonAppOptions {
    canvas: HTMLCanvasElement;
    assetsHostUrl: string;
    registryUrl: string;
    space: string;
}

export function initializeBabylonApp(options: InitializeBabylonAppOptions) {
    if (!options.assetsHostUrl) {
        throw new Error("No assets host URL provided");
    }

    const canvas = options.canvas;
    const engine = new Engine(canvas);
    const params: IMeetingSpaceSceneParams = {
        engine: engine,
        assetsHostUrl: options.assetsHostUrl,
        registryUrl: options.registryUrl,
        space: options.space
    };
    MeetingSpaceScene.CreateAsync(params).then((scene) => {
        engine.runRenderLoop(() => {
            scene.render();
        });
        window.addEventListener("resize", () => {
            engine.resize();
        });
    });
}
