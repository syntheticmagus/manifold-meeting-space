import { Engine } from "@babylonjs/core";
import { CreatePlaygroundScene } from "./Playground/playground";
import "@babylonjs/loaders";

export interface InitializeBabylonAppOptions {
    canvas: HTMLCanvasElement;
    assetsHostUrl?: string;
}

export function initializeBabylonApp(options: InitializeBabylonAppOptions) {
    if (!options.assetsHostUrl) {
        throw new Error("No assets host URL provided");
    }

    const canvas = options.canvas;
    const engine = new Engine(canvas);
    CreatePlaygroundScene(engine, options.assetsHostUrl!).then((scene) => {
        engine.runRenderLoop(() => {
            scene.render();
        });
        window.addEventListener("resize", () => {
            engine.resize();
        });
    });
}

