import { Engine } from "@babylonjs/core/Engines/engine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Scene } from "@babylonjs/core/scene";

class Playground {
    public static async CreateScene(engine: Engine, assetsHostUrl: string): Promise<Scene> {
        var scene = new Scene(engine);
        await SceneLoader.ImportMeshAsync("", assetsHostUrl, "hex_table.glb");
        scene.createDefaultCameraOrLight();

        const env = scene.createDefaultEnvironment();
        const xr = await scene.createDefaultXRExperienceAsync({
            floorMeshes: [env!.ground!]
        });

        return scene;
    }
}

export async function CreatePlaygroundScene(engine: Engine, assetsHostUrl: string): Promise<Scene> {
    return await Playground.CreateScene(engine, assetsHostUrl);
}
