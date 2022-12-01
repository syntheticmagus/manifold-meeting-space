import { Engine } from "@babylonjs/core";
import { MeetingSpaceScene, IMeetingSpaceSceneParams } from "./meetingSpaceScene";
import "@babylonjs/loaders";

export interface IManifoldMeetingSpaceOptions {
    canvas: HTMLCanvasElement;
    assetsHostUrl: string;
    registryUrl: string;
}

export class ManifoldMeetingSpaceExperience {
    private _canvas: HTMLCanvasElement;
    private _engine: Engine;
    private _scene?: MeetingSpaceScene;

    public constructor(options: IManifoldMeetingSpaceOptions) {
        if (!options.assetsHostUrl) {
            throw new Error("No assets host URL provided");
        }
    
        this._canvas = options.canvas;
        this._engine = new Engine(this._canvas);
        const params: IMeetingSpaceSceneParams = {
            engine: this._engine,
            assetsHostUrl: options.assetsHostUrl,
            registryUrl: options.registryUrl,
        };
        MeetingSpaceScene.CreateAsync(params).then((scene) => {
            this._scene = scene;
            this._engine.runRenderLoop(() => {
                this._scene?.render();
            });
            window.addEventListener("resize", () => {
                this._engine.resize();
            });
        });
    }

    public joinSpace(space: string): void {
        this._scene?.joinSpaceAsync(space);
    }

    public leaveSpace(): void {
        this._scene?.leaveSpace();
    }

    public dispose(): void {
        this._scene?.dispose();
        this._engine.dispose();
    }
}
