import { Engine } from "@babylonjs/core/Engines/engine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Scene } from "@babylonjs/core/scene";

export class MeetingSpace {
    public static async CreateScene(engine: Engine, assetsHostUrl: string): Promise<Scene> {
        var scene = new Scene(engine);
        scene.createDefaultLight();
        
        await SceneLoader.ImportMeshAsync("", assetsHostUrl, "vr_room.glb");

        const env = scene.createDefaultEnvironment({ createGround: false, createSkybox: false });
        const xr = await scene.createDefaultXRExperienceAsync({
            floorMeshes: [scene.getMeshByName("floor")!]
        });

        return scene;
    }
}
